import { VerificationState } from "@noteschain/shared";
import { contentHashHex, contentHashV2Hex, derivePublicationPda, fetchPublicationAccount } from "@noteschain/blockchain-client";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { logger } from "../../lib/logger.js";
import { getReadOnlySolanaClient, programId } from "../../lib/solanaClient.js";

export interface VerificationResult {
  state: (typeof VerificationState)[keyof typeof VerificationState];
  message: string;
  checkedAt: string;
}

function result(state: VerificationResult["state"], message: string): VerificationResult {
  return { state, message, checkedAt: new Date().toISOString() };
}

/**
 * Live on-chain verification — see ARCHITECTURE.md §2 / product spec §18.
 * The one rule that must hold no matter what: never report VERIFIED based
 * only on a transaction signature being present in Postgres. Every branch
 * below either fetches and decodes the live account or explicitly bails
 * into a non-VERIFIED state.
 */
export async function verifyPublication(id: string): Promise<VerificationResult> {
  const pub = await prisma.publication.findUnique({ where: { id }, include: { chainRecord: true } });
  if (!pub || !pub.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }

  if (pub.status !== "PUBLISHED" || pub.onChainPublicationId === null) {
    return result(VerificationState.NOT_FINALIZED, "This publication hasn't reached the blockchain yet.");
  }

  const [expectedPda] = derivePublicationPda(programId(), BigInt(pub.onChainPublicationId.toString()));

  if (pub.chainRecord?.publicationPda && pub.chainRecord.publicationPda !== expectedPda.toBase58()) {
    return result(
      VerificationState.PDA_MISMATCH,
      "The recorded transaction's account address doesn't match the expected derivation.",
    );
  }

  const { connection, program } = getReadOnlySolanaClient();

  let accountInfo;
  try {
    accountInfo = await connection.getAccountInfo(expectedPda);
  } catch (err) {
    logger.warn({ err, publicationId: id }, "Verification RPC call failed");
    return result(VerificationState.RPC_UNAVAILABLE, "Couldn't reach the Solana RPC endpoint — try again shortly.");
  }

  if (!accountInfo) {
    return result(VerificationState.ACCOUNT_NOT_FOUND, "No on-chain account exists at the expected address.");
  }

  let account;
  try {
    account = await fetchPublicationAccount(program, connection, expectedPda);
  } catch (err) {
    logger.warn({ err, publicationId: id }, "On-chain account failed to decode");
    return result(
      VerificationState.UNSUPPORTED_VERSION,
      "The on-chain account exists but couldn't be decoded by this client version.",
    );
  }

  if (!account) {
    return result(VerificationState.ACCOUNT_NOT_FOUND, "No on-chain account exists at the expected address.");
  }

  // The DB records which schema a publication was written under. If the chain
  // disagrees, that is a distinct failure from a content mismatch and saying
  // so is the difference between "someone edited this note" and "our records
  // are inconsistent".
  if (account.schemaVersion !== pub.chainSchemaVersion) {
    return result(
      VerificationState.VERSION_MISMATCH,
      "The on-chain record uses a different schema than this publication expects.",
    );
  }

  // This is where the v2 design earns its keep. Verification never read the
  // account's stored body even under v1 — it always recomputed the hash from
  // the database and compared digests. Moving the body off-chain therefore
  // changes nothing about how a note is proven; it only means this check is
  // now the primary proof rather than a redundant one.
  const onChainHash = account.contentHash;
  const expectedHash =
    account.schemaVersion === 2
      ? contentHashV2Hex(pub.title, pub.excerpt, pub.content)
      : contentHashHex(pub.title, pub.content);

  if (onChainHash !== expectedHash || onChainHash !== pub.contentHash) {
    return result(
      VerificationState.HASH_MISMATCH,
      "The on-chain content hash doesn't match this publication's current content.",
    );
  }

  // Cheap corroborating check that only v2 can make: the chain records how
  // many bytes the body had, so a truncated or swapped body is caught even
  // before hashing.
  if (account.schemaVersion === 2 && Number(account.contentLength) !== pub.contentBytes) {
    return result(
      VerificationState.HASH_MISMATCH,
      "The on-chain content length doesn't match this publication's stored content.",
    );
  }

  const onChainPublicationId = account.publicationId;
  if (onChainPublicationId !== BigInt(pub.onChainPublicationId.toString())) {
    return result(VerificationState.PDA_MISMATCH, "The on-chain publication id doesn't match the expected value.");
  }

  await prisma.publicationChainRecord.update({
    where: { publicationId: id },
    data: { lastVerifiedAt: new Date() },
  });

  return result(VerificationState.VERIFIED, "This publication's on-chain record matches its current content.");
}

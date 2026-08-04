import { VerificationState } from "@noteschain/shared";
import { contentHashHex, derivePublicationPda } from "@noteschain/blockchain-client";
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
    account = await program.account.publication.fetch(expectedPda);
  } catch (err) {
    logger.warn({ err, publicationId: id }, "On-chain account failed to decode");
    return result(
      VerificationState.UNSUPPORTED_VERSION,
      "The on-chain account exists but couldn't be decoded by this client version.",
    );
  }

  const onChainHash = Buffer.from(account.contentHash as number[]).toString("hex");
  const expectedHash = contentHashHex(pub.title, pub.content);
  if (onChainHash !== expectedHash || onChainHash !== pub.contentHash) {
    return result(
      VerificationState.HASH_MISMATCH,
      "The on-chain content hash doesn't match this publication's current content.",
    );
  }

  const onChainPublicationId = BigInt((account.publicationId as { toString(): string }).toString());
  if (onChainPublicationId !== BigInt(pub.onChainPublicationId.toString())) {
    return result(VerificationState.PDA_MISMATCH, "The on-chain publication id doesn't match the expected value.");
  }

  await prisma.publicationChainRecord.update({
    where: { publicationId: id },
    data: { lastVerifiedAt: new Date() },
  });

  return result(VerificationState.VERIFIED, "This publication's on-chain record matches its current content.");
}

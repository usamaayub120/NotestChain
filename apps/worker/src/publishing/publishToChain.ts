import { PublicKey } from "@solana/web3.js";
// Default-import + destructure — @coral-xyz/anchor is CJS, and Node's static
// named-export detection for ESM-importing-CJS (cjs-module-lexer) fails to
// see `BN` specifically (it's fine on AnchorProvider/Program/Wallet — see
// solanaClient.ts) even though it's a real export at runtime. Confirmed by
// the worker crash-looping under `node dist/worker.js` (this file's compiled
// output) despite typechecking clean and running fine under `tsx watch`.
import anchorPkg from "@coral-xyz/anchor";
import type { Logger } from "pino";
import {
  contentHashHex,
  derivePlatformConfigPda,
  derivePublicationPda,
  identityReferenceHash,
  ZERO_IDENTITY_HASH,
} from "@noteschain/blockchain-client";
import { IDENTITY_MODE_CODE, DISCOVERABILITY_CODE, type IdentityMode, type Discoverability } from "@noteschain/shared";
import { prisma } from "../lib/prisma.js";
import { logger as rootLogger } from "../lib/logger.js";
import { getSolanaClient, programId } from "./solanaClient.js";

const { BN } = anchorPkg;

export class PermanentPublishError extends Error {}

/**
 * The full publish pipeline for one Publication — see ARCHITECTURE.md §6.
 * Every step that mutates on-chain or off-chain state is written so a
 * retry (from any point) converges rather than duplicates: the program
 * itself rejects a stale publication_id (§3.1), and here we check for an
 * already-existing, already-matching on-chain account before ever
 * attempting to create one.
 */
export async function publishPublicationToChain(publicationId: string, jobId: string): Promise<void> {
  const log = rootLogger.child({ publicationId, jobId });

  const publication = await prisma.publication.findUniqueOrThrow({
    where: { id: publicationId },
    include: { publicIdentity: true, chainRecord: true },
  });

  if (publication.status === "PUBLISHED") {
    log.info("Already published, nothing to do");
    return;
  }

  const { connection, program, wallet, publisherPubkey } = getSolanaClient();
  const [platformPda] = derivePlatformConfigPda(programId());

  // Idempotency guard: if a previous attempt already landed on-chain (e.g.
  // we crashed after submit but before recording it), find that instead of
  // submitting a duplicate. We don't yet know the id, so first check
  // whether the DB already recorded one we can verify.
  if (publication.chainRecord?.publicationPda) {
    const already = await tryVerifyExisting(publication, new PublicKey(publication.chainRecord.publicationPda), log);
    if (already) return;
  }

  const platformAccount = await program.account.platformConfig.fetch(platformPda);
  const expectedId = BigInt(platformAccount.publicationCounter.toString());
  const [publicationPda] = derivePublicationPda(programId(), expectedId);

  // Someone (or a prior crashed attempt) may have already published at this
  // exact PDA — check before trying to create it again.
  const preExisting = await tryVerifyExisting(publication, publicationPda, log, expectedId);
  if (preExisting) return;

  const identityMode = publication.identityMode as IdentityMode;
  const isAnonymous = identityMode === "ANONYMOUS";
  const identityHashBytes = isAnonymous
    ? ZERO_IDENTITY_HASH
    : identityReferenceHash(publication.publicIdentityId!);
  const authorDisplaySnapshot = isAnonymous ? "" : publication.publicIdentity!.displayName;

  const contentHash = Buffer.from(contentHashHex(publication.title, publication.content), "hex");
  if (contentHash.toString("hex") !== publication.contentHash) {
    // Defensive: the immutable snapshot on the Publication row should never
    // drift from its own recorded hash. If it has, something is wrong
    // off-chain and we must not publish potentially-tampered content.
    throw new PermanentPublishError(
      `Content hash mismatch for publication ${publicationId} — refusing to publish.`,
    );
  }

  await prisma.publicationChainRecord.update({
    where: { publicationId },
    data: { chainStatus: "SUBMITTING", submissionAttempts: { increment: 1 } },
  });

  const previousPublication = publication.previousPublicationId
    ? await resolvePreviousPublicationPda(publication.previousPublicationId)
    : null;

  const methodBuilder = program.methods
    .publishPublication(
      new BN(expectedId.toString()),
      IDENTITY_MODE_CODE[identityMode],
      DISCOVERABILITY_CODE[publication.discoverability as Discoverability],
      Array.from(identityHashBytes),
      Array.from(contentHash),
      publication.title,
      authorDisplaySnapshot,
      publication.content,
      previousPublication?.pda ?? null,
    )
    // platformConfig, publication, and systemProgram are all auto-resolved by
    // Anchor's client from the IDL (const/arg seeds and a fixed address,
    // respectively) — passing them explicitly is a type error under 0.31.1.
    .accounts({
      previousPublicationAccount: previousPublication?.pda ?? null,
      authority: publisherPubkey,
    });

  const transaction = await methodBuilder.transaction();
  transaction.feePayer = publisherPubkey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)} — ${simulation.value.logs?.join("\n")}`);
  }

  const signedTransaction = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await prisma.publicationChainRecord.update({
    where: { publicationId },
    data: {
      chainStatus: "SUBMITTED",
      transactionSignature: signature,
      publicationPda: publicationPda.toBase58(),
      submittedAt: new Date(),
    },
  });
  log.info({ signature }, "Submitted publish_publication transaction");

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  await prisma.publicationChainRecord.update({
    where: { publicationId },
    data: { chainStatus: "CONFIRMED", confirmedAt: new Date() },
  });

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "finalized");
  const finalizedAt = new Date();

  const account = await program.account.publication.fetch(publicationPda);
  verifyAccountMatches(account, publication, expectedId);

  await prisma.$transaction([
    prisma.publicationChainRecord.update({
      where: { publicationId },
      data: { chainStatus: "FINALIZED", finalizedAt, lastVerifiedAt: finalizedAt },
    }),
    prisma.publication.update({
      where: { id: publicationId },
      data: { status: "PUBLISHED", onChainPublicationId: expectedId, publishedAt: finalizedAt },
    }),
  ]);

  log.info({ signature, publicationPda: publicationPda.toBase58() }, "Publication finalized on-chain");
}

async function resolvePreviousPublicationPda(previousPublicationId: string) {
  const previous = await prisma.publication.findUnique({ where: { id: previousPublicationId } });
  if (!previous?.onChainPublicationId) {
    throw new PermanentPublishError(
      `previous_publication ${previousPublicationId} has not itself been finalized on-chain yet.`,
    );
  }
  const [pda] = derivePublicationPda(programId(), BigInt(previous.onChainPublicationId.toString()));
  return { pda };
}

/**
 * Returns true (and finishes the DB update) if a matching, already-correct
 * account is found at the given PDA — the caller should stop, this
 * publish is already done. Throws if an account exists but doesn't match
 * (a real anomaly we must not paper over).
 */
async function tryVerifyExisting(
  publication: { id: string; title: string; content: string; contentHash: string },
  pda: PublicKey,
  log: Logger,
  expectedId?: bigint,
): Promise<boolean> {
  const { connection, program } = getSolanaClient();
  const info = await connection.getAccountInfo(pda);
  if (!info) return false;

  const account = await program.account.publication.fetch(pda);
  verifyAccountMatches(account, publication, expectedId ?? BigInt(account.publicationId.toString()));

  const finalizedAt = new Date();
  await prisma.$transaction([
    prisma.publicationChainRecord.update({
      where: { publicationId: publication.id },
      data: {
        chainStatus: "FINALIZED",
        publicationPda: pda.toBase58(),
        finalizedAt,
        lastVerifiedAt: finalizedAt,
      },
    }),
    prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: "PUBLISHED",
        onChainPublicationId: BigInt(account.publicationId.toString()),
        publishedAt: finalizedAt,
      },
    }),
  ]);
  log.info({ pda: pda.toBase58() }, "Found already-finalized account — converged");
  return true;
}

function verifyAccountMatches(
  account: { contentHash: number[] | Buffer; title: string; content: string; publicationId: unknown },
  publication: { title: string; content: string; contentHash: string },
  expectedId: bigint,
): void {
  const onChainHash = Buffer.from(account.contentHash).toString("hex");
  if (onChainHash !== publication.contentHash) {
    throw new PermanentPublishError(
      `On-chain content hash (${onChainHash}) does not match expected (${publication.contentHash}) — flagging for manual review.`,
    );
  }
  if (BigInt(account.publicationId as string) !== expectedId) {
    throw new PermanentPublishError("On-chain publication_id does not match the expected id.");
  }
}

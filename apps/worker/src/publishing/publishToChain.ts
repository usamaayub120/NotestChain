import { PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
import type { Logger } from "pino";
import type { Prisma } from "@prisma/client";
import {
  contentHashHex,
  contentHashV2Hex,
  derivePlatformConfigPda,
  derivePublicationPda,
  fetchPublicationAccount,
  identityReferenceHash,
  type OnChainPublication,
  ZERO_IDENTITY_HASH,
} from "@noteschain/blockchain-client";
import { IDENTITY_MODE_CODE, DISCOVERABILITY_CODE, type IdentityMode, type Discoverability } from "@noteschain/shared";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../lib/prisma.js";
import { logger as rootLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { getSolanaClient, programId } from "./solanaClient.js";

// @coral-xyz/anchor is CJS — createRequire sidesteps ESM default-import
// interop entirely (which differs between `node` and `tsx`'s loader; see
// packages/blockchain-client/src/program.ts for the full explanation).
const require = createRequire(import.meta.url);
const { BN } = require("@coral-xyz/anchor") as typeof import("@coral-xyz/anchor");

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
    include: { publicIdentity: true, chainRecord: true, privateAuthor: { select: { email: true } } },
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
    const already = await tryVerifyExisting(
      publication,
      new PublicKey(publication.chainRecord.publicationPda),
      log,
      undefined,
      publication.chainRecord.transactionSignature,
    );
    if (already) return;
  }

  const platformAccount = await program.account.platformConfig.fetch(platformPda);
  const expectedId = BigInt(platformAccount.publicationCounter.toString());
  const [publicationPda] = derivePublicationPda(programId(), expectedId);

  // Someone (or a prior crashed attempt) may have already published at this
  // exact PDA — check before trying to create it again.
  const preExisting = await tryVerifyExisting(publication, publicationPda, log, expectedId, null);
  if (preExisting) return;

  const identityMode = publication.identityMode as IdentityMode;
  const isAnonymous = identityMode === "ANONYMOUS";
  const identityHashBytes = isAnonymous
    ? ZERO_IDENTITY_HASH
    : identityReferenceHash(publication.publicIdentityId!);
  const authorDisplaySnapshot = isAnonymous ? "" : publication.publicIdentity!.displayName;

  // Recomputed from the immutable snapshot rather than trusted. Under v1 the
  // program repeated this check on-chain; under v2 it cannot, because it
  // never sees the body. This is now the last gate before the digest becomes
  // permanent, so it matters more than it used to, not less.
  const contentHash = Buffer.from(
    publication.chainSchemaVersion === 2
      ? contentHashV2Hex(publication.title, publication.excerpt, publication.content)
      : contentHashHex(publication.title, publication.content),
    "hex",
  );
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

  // v2 sends the excerpt where v1 sent the body, plus the body's byte length
  // so the account is self-describing. The body itself never enters the
  // transaction — which is exactly what lifts the old 600-byte cap, since
  // that cap existed to keep title + display + body inside Solana's hard
  // 1232-byte packet limit.
  const methodBuilder = (
    publication.chainSchemaVersion === 2
      ? program.methods.publishPublicationV2(
          new BN(expectedId.toString()),
          IDENTITY_MODE_CODE[identityMode],
          DISCOVERABILITY_CODE[publication.discoverability as Discoverability],
          Array.from(identityHashBytes),
          Array.from(contentHash),
          new BN(publication.contentBytes),
          publication.title,
          authorDisplaySnapshot,
          publication.excerpt,
          previousPublication?.pda ?? null,
        )
      : program.methods.publishPublication(
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

  const account = await fetchPublicationAccount(program, connection, publicationPda);
  if (!account) {
    throw new Error(`Finalized transaction ${signature} left no account at ${publicationPda.toBase58()}.`);
  }
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
    prisma.emailJob.create({
      data: chainFinalizedEmailJobInput(publication, publication.privateAuthor.email, publicationPda, signature),
    }),
  ]);

  log.info({ signature, publicationPda: publicationPda.toBase58() }, "Publication finalized on-chain");
}

/**
 * Shared by both finalize paths below — the happy path (just submitted and
 * confirmed in this call) and the idempotent recovery path in
 * tryVerifyExisting (converging onto an account a previous, possibly
 * crashed, attempt already finalized). `publication.status === "PUBLISHED"`
 * is checked at the top of publishPublicationToChain and short-circuits any
 * re-entry, so whichever of the two paths runs, it can only run once per
 * publication ever — this can't double-enqueue the notification.
 */
export function chainFinalizedEmailJobInput(
  publication: { id: string; title: string; privateAuthorUserId: string },
  authorEmail: string,
  pda: PublicKey,
  transactionSignature: string | null,
): Prisma.EmailJobUncheckedCreateInput {
  const explorerUrl = transactionSignature
    ? `${env.PUBLIC_EXPLORER_BASE_URL}/tx/${transactionSignature}?cluster=${env.SOLANA_CLUSTER}`
    : null;
  const data = buildEmailJobData(EmailKind.PUBLICATION_CHAIN_FINALIZED, {
    publicationTitle: publication.title,
    publicationUrl: `${env.PUBLIC_WEB_ORIGIN}/p/${publication.id}`,
    publicationPda: pda.toBase58(),
    explorerUrl,
  });
  return {
    kind: EmailKind.PUBLICATION_CHAIN_FINALIZED,
    toEmail: authorEmail,
    toUserId: publication.privateAuthorUserId,
    data: data as Prisma.InputJsonValue,
  };
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
  publication: { id: string; title: string; contentHash: string; chainSchemaVersion: number; privateAuthorUserId: string; privateAuthor: { email: string } },
  pda: PublicKey,
  log: Logger,
  expectedId: bigint | undefined,
  knownTransactionSignature: string | null,
): Promise<boolean> {
  const { connection, program } = getSolanaClient();

  // v1 and v2 share one seed and one id counter, so this PDA can legitimately
  // hold either schema — including one we did not expect. fetchPublicationAccount
  // reports the version instead of throwing on the "wrong" decoder, which
  // matters here: a throw would be treated as retryable and the job would
  // spin forever instead of surfacing the anomaly.
  const account = await fetchPublicationAccount(program, connection, pda);
  if (!account) return false;

  verifyAccountMatches(account, publication, expectedId ?? account.publicationId);

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
    prisma.emailJob.create({
      data: chainFinalizedEmailJobInput(publication, publication.privateAuthor.email, pda, knownTransactionSignature),
    }),
  ]);
  log.info({ pda: pda.toBase58() }, "Found already-finalized account — converged");
  return true;
}

function verifyAccountMatches(
  account: OnChainPublication,
  publication: { title: string; contentHash: string; chainSchemaVersion: number },
  expectedId: bigint,
): void {
  // A schema disagreement is its own failure, not a hash mismatch. Reporting
  // it as "content doesn't match" would send an operator hunting for tampered
  // text when the real problem is that this PDA already holds a publication
  // written under the other schema.
  if (account.schemaVersion !== publication.chainSchemaVersion) {
    throw new PermanentPublishError(
      `On-chain account at this PDA uses schema v${account.schemaVersion}, but this publication expects v${publication.chainSchemaVersion} — flagging for manual review.`,
    );
  }
  if (account.contentHash !== publication.contentHash) {
    throw new PermanentPublishError(
      `On-chain content hash (${account.contentHash}) does not match expected (${publication.contentHash}) — flagging for manual review.`,
    );
  }
  if (account.publicationId !== expectedId) {
    throw new PermanentPublishError("On-chain publication_id does not match the expected id.");
  }
}

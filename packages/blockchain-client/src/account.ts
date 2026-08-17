import type { Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { DecentralizedNotes } from "./idl/decentralized_notes.js";

/**
 * The single place that decides which Publication schema an on-chain account
 * uses. Every reader goes through here.
 *
 * The reason it is one function rather than a branch at each call site: there
 * are three readers (live verification, the publish worker's idempotency
 * check, and reconciliation) and if each grows its own version branch they
 * will drift. A drifted branch here does not throw a type error — it reports
 * a publication as unverified or missing, which looks like a data problem
 * rather than a code one.
 */

export type OnChainPublicationBase = {
  publicationId: bigint;
  identityMode: number;
  discoverability: number;
  publishedAt: bigint;
  identityReferenceHash: string;
  contentHash: string;
  title: string;
  authorDisplaySnapshot: string;
  previousPublication: PublicKey | null;
};

export type OnChainPublication =
  | (OnChainPublicationBase & {
      schemaVersion: 1;
      /** The full note body — v1 stored it on-chain. */
      content: string;
    })
  | (OnChainPublicationBase & {
      schemaVersion: 2;
      /** A blurb, NOT the body. The body lives in Postgres. */
      excerpt: string;
      /** UTF-8 byte length of the off-chain body. */
      contentLength: bigint;
    });

function toHex(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function toBigInt(value: unknown): bigint {
  return BigInt((value as { toString(): string }).toString());
}

function base(raw: Record<string, unknown>): OnChainPublicationBase {
  return {
    publicationId: toBigInt(raw.publicationId),
    identityMode: Number(raw.identityMode),
    discoverability: Number(raw.discoverability),
    publishedAt: toBigInt(raw.publishedAt),
    identityReferenceHash: toHex(raw.identityReferenceHash as number[]),
    contentHash: toHex(raw.contentHash as number[]),
    title: raw.title as string,
    authorDisplaySnapshot: raw.authorDisplaySnapshot as string,
    previousPublication: (raw.previousPublication as PublicKey | null) ?? null,
  };
}

function discriminatorOf(program: Program<DecentralizedNotes>, accountName: string): Buffer | null {
  const entry = program.idl.accounts?.find((a) => a.name.toLowerCase() === accountName.toLowerCase());
  return entry ? Buffer.from(entry.discriminator) : null;
}

/**
 * Fetches and decodes a publication account of either schema.
 *
 * Returns `null` when no account exists, and throws only when an account
 * exists but is not a publication this client understands. It deliberately
 * does NOT throw on a version it wasn't expecting — the publish worker's
 * idempotency path can legitimately land on a PDA holding the other schema
 * (v1 and v2 share one seed and one id counter), and a throw there would be
 * retried forever instead of reported.
 */
export async function fetchPublicationAccount(
  program: Program<DecentralizedNotes>,
  connection: Connection,
  pda: PublicKey,
): Promise<OnChainPublication | null> {
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  if (info.data.length < 8) throw new Error(`Account ${pda.toBase58()} is too small to be a publication.`);

  const discriminator = info.data.subarray(0, 8);
  const v1 = discriminatorOf(program, "publication");
  const v2 = discriminatorOf(program, "publicationV2");

  if (v1 && discriminator.equals(v1)) {
    const raw = program.coder.accounts.decode("publication", info.data) as Record<string, unknown>;
    return { schemaVersion: 1, ...base(raw), content: raw.content as string };
  }

  if (v2 && discriminator.equals(v2)) {
    const raw = program.coder.accounts.decode("publicationV2", info.data) as Record<string, unknown>;
    return {
      schemaVersion: 2,
      ...base(raw),
      excerpt: raw.excerpt as string,
      contentLength: toBigInt(raw.contentLength),
    };
  }

  throw new Error(`Account ${pda.toBase58()} has an unrecognised discriminator ${discriminator.toString("hex")}.`);
}

export type OnChainPublicationEntry = { address: PublicKey; account: OnChainPublication };

/**
 * Every publication account of BOTH schemas, keyed by publication id.
 *
 * `program.account.publication.all()` filters by the v1 discriminator, so on
 * its own it returns zero v2 accounts. Reconciliation using it directly would
 * flag every v2 publication as missing from the chain — a flood of false
 * audit alarms that looks like a serious integrity incident.
 */
export async function fetchAllPublicationAccounts(
  program: Program<DecentralizedNotes>,
): Promise<Map<string, OnChainPublicationEntry>> {
  const [v1, v2] = await Promise.all([program.account.publication.all(), program.account.publicationV2.all()]);

  const merged = new Map<string, OnChainPublicationEntry>();

  for (const { account, publicKey } of v1) {
    const raw = account as unknown as Record<string, unknown>;
    const decoded: OnChainPublication = { schemaVersion: 1, ...base(raw), content: raw.content as string };
    merged.set(decoded.publicationId.toString(), { address: publicKey, account: decoded });
  }

  for (const { account, publicKey } of v2) {
    const raw = account as unknown as Record<string, unknown>;
    const decoded: OnChainPublication = {
      schemaVersion: 2,
      ...base(raw),
      excerpt: raw.excerpt as string,
      contentLength: toBigInt(raw.contentLength),
    };
    merged.set(decoded.publicationId.toString(), { address: publicKey, account: decoded });
  }

  return merged;
}

import { PublicKey } from "@solana/web3.js";
import { fetchPublicationAccount } from "@noteschain/blockchain-client";
import { prisma } from "../../lib/prisma.js";
import { getReadOnlySolanaClient } from "../../lib/solanaClient.js";
import { getPublicationById } from "./publications.service.js";
import { env } from "../../config/env.js";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
// 32-byte pubkeys base58-encode to ~43-44 chars, 64-byte signatures to ~87-88
// — a huge gap, so a length cutoff safely tells them apart without needing
// a full base58-decode dependency.
const SIGNATURE_MIN_LENGTH = 60;

export interface OnChainOnlyResult {
  publicationId: string;
  pda: string;
  schemaVersion: 1 | 2;
  title: string;
  authorDisplaySnapshot: string;
  publishedAt: number;
  content: string | null;
  excerpt: string | null;
  contentHash: string;
  explorerUrl: string;
}

export type LookupResult =
  | { kind: "publication"; publication: Awaited<ReturnType<typeof getPublicationById>> }
  | { kind: "onchain_only"; account: OnChainOnlyResult }
  | { kind: "not_found" };

/** Accepts this site's own note URLs and Solana Explorer's tx/address URLs. */
function extractFromUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    try {
      url = new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
  const match = url.pathname.match(/\/(?:p|tx|address)\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function tryPublication(id: string, viewerUserId?: string): Promise<LookupResult | null> {
  try {
    const publication = await getPublicationById(id, viewerUserId);
    return { kind: "publication", publication };
  } catch {
    return null;
  }
}

/**
 * Classifies whatever a visitor pasted — this site's own URL, a bare id, a
 * transaction signature, a publication PDA, an on-chain publication counter,
 * or a Solana Explorer link — and resolves it to a publication. Never
 * re-implements visibility rules: every DB match still goes through the
 * existing `getPublicationById`, so delisted/private notes stay exactly as
 * hidden as they already are everywhere else.
 */
export async function resolveProof(rawInput: string, viewerUserId?: string): Promise<LookupResult> {
  const input = rawInput.trim();
  if (!input) return { kind: "not_found" };

  const candidate = extractFromUrl(input) ?? input;

  const direct = await tryPublication(candidate, viewerUserId);
  if (direct) return direct;

  if (/^\d+$/.test(candidate)) {
    const pub = await prisma.publication.findFirst({ where: { onChainPublicationId: BigInt(candidate) } });
    if (pub) {
      const result = await tryPublication(pub.id, viewerUserId);
      if (result) return result;
    }
  }

  if (!BASE58_RE.test(candidate)) return { kind: "not_found" };

  if (candidate.length >= SIGNATURE_MIN_LENGTH) {
    const record = await prisma.publicationChainRecord.findFirst({ where: { transactionSignature: candidate } });
    if (record) {
      const result = await tryPublication(record.publicationId, viewerUserId);
      if (result) return result;
    }
    return { kind: "not_found" };
  }

  const record = await prisma.publicationChainRecord.findFirst({ where: { publicationPda: candidate } });
  if (record) {
    const result = await tryPublication(record.publicationId, viewerUserId);
    if (result) return result;
  }

  // No DB row references this PDA — it may be a genuine orphan (published
  // directly against the program, outside this platform's moderation/outbox
  // flow — see RUNBOOK.md §1). Decode it directly rather than reporting
  // "not found" for data that demonstrably exists on-chain.
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(candidate);
  } catch {
    return { kind: "not_found" };
  }

  const { connection, program } = getReadOnlySolanaClient();
  let account;
  try {
    account = await fetchPublicationAccount(program, connection, pubkey);
  } catch {
    return { kind: "not_found" };
  }
  if (!account) return { kind: "not_found" };

  return {
    kind: "onchain_only",
    account: {
      publicationId: account.publicationId.toString(),
      pda: candidate,
      schemaVersion: account.schemaVersion,
      title: account.title,
      authorDisplaySnapshot: account.authorDisplaySnapshot,
      publishedAt: Number(account.publishedAt),
      content: account.schemaVersion === 1 ? account.content : null,
      excerpt: account.schemaVersion === 2 ? account.excerpt : null,
      contentHash: account.contentHash,
      explorerUrl: `${env.PUBLIC_EXPLORER_BASE_URL}/address/${candidate}${
        env.SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${env.SOLANA_CLUSTER}`
      }`,
    },
  };
}

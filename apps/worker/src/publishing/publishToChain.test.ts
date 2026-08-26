import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { chainFinalizedEmailJobInput, chainFinalizedPushJobInput } from "./publishToChain.js";

/**
 * Only this pure helper is unit-tested here — the rest of
 * publishPublicationToChain needs a live Solana connection and a funded
 * publisher keypair, which this suite has no access to. This is the piece
 * that decides what the PUBLICATION_CHAIN_FINALIZED email actually says,
 * and it's cheap to get wrong (an explorer link built from the wrong
 * cluster, a missing PDA) without any test noticing.
 */
describe("chainFinalizedEmailJobInput", () => {
  const publication = { id: "pub-1", title: "A short thought", privateAuthorUserId: "user-1" };
  const pda = new PublicKey("11111111111111111111111111111111");

  it("builds a payload that satisfies the kind's own schema (buildEmailJobData doesn't throw)", () => {
    const input = chainFinalizedEmailJobInput(publication, "writer@example.com", pda, "sig123");

    expect(input.kind).toBe("PUBLICATION_CHAIN_FINALIZED");
    expect(input.toEmail).toBe("writer@example.com");
    expect(input.toUserId).toBe("user-1");
  });

  it("includes the PDA and an explorer link when a transaction signature is known", () => {
    const input = chainFinalizedEmailJobInput(publication, "writer@example.com", pda, "sig123");
    const data = input.data as { publicationPda: string; explorerUrl: string | null; publicationUrl: string };

    expect(data.publicationPda).toBe(pda.toBase58());
    expect(data.explorerUrl).toContain("sig123");
    expect(data.publicationUrl).toContain(publication.id);
  });

  it("omits the explorer link rather than fabricating one when no signature is known", () => {
    // The idempotent-recovery path in tryVerifyExisting can converge onto an
    // account without ever having obtained a signature itself in this
    // process — this is the case that exercises.
    const input = chainFinalizedEmailJobInput(publication, "writer@example.com", pda, null);
    const data = input.data as { explorerUrl: string | null };

    expect(data.explorerUrl).toBeNull();
  });

  it("keeps the recipient's email in the toEmail column only, not duplicated into the JSON payload", () => {
    const input = chainFinalizedEmailJobInput(publication, "writer@example.com", pda, null);
    expect(JSON.stringify(input.data)).not.toContain("writer@example.com");
  });
});

/** Same reasoning as chainFinalizedEmailJobInput above — the matching push. */
describe("chainFinalizedPushJobInput", () => {
  const publication = { id: "pub-1", title: "A short thought", privateAuthorUserId: "user-1" };

  it("builds a payload that satisfies the kind's own schema (buildPushJobData doesn't throw)", () => {
    const input = chainFinalizedPushJobInput(publication);

    expect(input.kind).toBe("PUBLICATION_CHAIN_FINALIZED");
    expect(input.userId).toBe("user-1");
  });

  it("carries the publication id so the app can deep-link to the note on tap", () => {
    const input = chainFinalizedPushJobInput(publication);
    const data = input.data as { publicationId: string; publicationTitle: string };

    expect(data.publicationId).toBe(publication.id);
    expect(data.publicationTitle).toBe(publication.title);
  });

  it("needs no transaction signature or PDA — unlike the email, the push never shows either", () => {
    // chainFinalizedPushJobInput takes only `publication`, so this is really
    // asserting the function signature stays that way: nothing here should
    // start requiring a pda/signature just because the email version does.
    expect(chainFinalizedPushJobInput.length).toBe(1);
  });
});

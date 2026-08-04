import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createHash } from "crypto";
import { assert } from "chai";
import type { DecentralizedNotes } from "../target/types/decentralized_notes";

const IDENTITY_MODE = { NAMED: 0, PSEUDONYMOUS: 1, ANONYMOUS: 2 };
const DISCOVERABILITY = { PUBLIC: 0, UNLISTED: 1 };

function contentHash(title: string, content: string): Buffer {
  return createHash("sha256").update(title + "\x1e" + content).digest();
}

function identityHash(identityId: string): Buffer {
  return createHash("sha256").update(identityId).digest();
}

describe("decentralized_notes", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DecentralizedNotes as Program<DecentralizedNotes>;

  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    program.programId,
  );

  function publicationPda(id: bigint | number): PublicKey {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(id));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("publication"), buf],
      program.programId,
    )[0];
  }

  async function currentCounter(): Promise<bigint> {
    const platform = await program.account.platformConfig.fetch(platformPda);
    return BigInt(platform.publicationCounter.toString());
  }

  async function fundedKeypair(): Promise<Keypair> {
    const kp = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    return kp;
  }

  it("initializes the platform", async () => {
    const treasury = Keypair.generate().publicKey;
    await program.methods
      .initializePlatform(treasury)
      .accounts({
        platformConfig: platformPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const platform = await program.account.platformConfig.fetch(platformPda);
    assert.equal(platform.publicationCounter.toNumber(), 0);
    assert.isTrue(platform.authority.equals(provider.wallet.publicKey));
    assert.isTrue(platform.treasury.equals(treasury));
  });

  it("publishes a named publication at the deterministic PDA and increments the counter", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Hello NotesChain";
    const content = "A short, verifiable thought kept on Solana.";

    await program.methods
      .publishPublication(
        new BN(id.toString()),
        IDENTITY_MODE.NAMED,
        DISCOVERABILITY.PUBLIC,
        Array.from(identityHash("identity-123")),
        Array.from(contentHash(title, content)),
        title,
        "Marguerite Vale",
        content,
        null,
      )
      .accounts({
        platformConfig: platformPda,
        publication: pda,
        previousPublicationAccount: null,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const pub = await program.account.publication.fetch(pda);
    assert.equal(pub.title, title);
    assert.equal(pub.content, content);
    assert.equal(pub.identityMode, IDENTITY_MODE.NAMED);
    assert.isNull(pub.previousPublication);

    const after = await currentCounter();
    assert.equal(after, id + 1n);
  });

  it("publishes an anonymous publication with a zero-filled identity hash and empty display name", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Anonymous thought";
    const content = "Nobody knows this is me.";

    await program.methods
      .publishPublication(
        new BN(id.toString()),
        IDENTITY_MODE.ANONYMOUS,
        DISCOVERABILITY.PUBLIC,
        Array.from(new Uint8Array(32)),
        Array.from(contentHash(title, content)),
        title,
        "",
        content,
        null,
      )
      .accounts({
        platformConfig: platformPda,
        publication: pda,
        previousPublicationAccount: null,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const pub = await program.account.publication.fetch(pda);
    assert.equal(pub.authorDisplaySnapshot, "");
    assert.deepEqual(Array.from(pub.identityReferenceHash), Array.from(new Uint8Array(32)));
  });

  it("rejects an anonymous publication with a non-zero identity hash", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Bad anon";
    const content = "This should fail.";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.ANONYMOUS,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("leaked-identity")),
          Array.from(contentHash(title, content)),
          title,
          "",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "AnonymousHashMustBeZero");
    }
    assert.isTrue(threw, "expected the transaction to be rejected");
  });

  it("rejects a named publication with a missing identity hash", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Missing identity";
    const content = "This should also fail.";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(new Uint8Array(32)),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "MissingIdentityReference");
    }
    assert.isTrue(threw);
  });

  it("rejects an oversized title", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "x".repeat(101);
    const content = "fine";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "TitleTooLong");
    }
    assert.isTrue(threw);
  });

  it("rejects an oversized body", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "fine";
    const content = "x".repeat(601);

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "ContentTooLong");
    }
    assert.isTrue(threw);
  });

  it("rejects an invalid identity_mode value", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Invalid mode";
    const content = "fine";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          99,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "InvalidIdentityMode");
    }
    assert.isTrue(threw);
  });

  it("rejects an invalid discoverability value", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Invalid disco";
    const content = "fine";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          77,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "InvalidDiscoverability");
    }
    assert.isTrue(threw);
  });

  it("rejects a content hash that doesn't match the recomputed hash", async () => {
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Tampered";
    const content = "The real content.";
    const wrongHash = contentHash(title, "different content entirely");

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(wrongHash),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "ContentHashMismatch");
    }
    assert.isTrue(threw);
  });

  it("rejects a stale/duplicate publication id", async () => {
    // id 0 was already consumed by the first test — the counter has moved
    // on, so re-using it must fail even though the PDA derivation itself
    // is deterministic and "correct" for that id.
    const staleId = 0n;
    const pda = publicationPda(staleId);
    const title = "Duplicate attempt";
    const content = "fine";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(staleId.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      // Either our explicit stale-counter check or Anchor's own "account
      // already in use" error is an acceptable rejection here — both mean
      // "you cannot recreate an existing publication."
      const message = String(err);
      assert.isTrue(
        message.includes("StalePublicationCounter") || message.includes("already in use"),
        message,
      );
    }
    assert.isTrue(threw);
  });

  it("rejects publishing from a signer that is not the platform authority", async () => {
    const impostor = await fundedKeypair();
    const id = await currentCounter();
    const pda = publicationPda(id);
    const title = "Impostor";
    const content = "Should not land.";

    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(id.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash(title, content)),
          title,
          "Someone",
          content,
          null,
        )
        .accounts({
          platformConfig: platformPda,
          publication: pda,
          previousPublicationAccount: null,
          authority: impostor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "Unauthorized");
    }
    assert.isTrue(threw);
  });

  it("links a revision to its previous publication via previous_publication", async () => {
    const originalId = await currentCounter();
    const originalPda = publicationPda(originalId);
    const originalTitle = "Original thought";
    const originalContent = "The first version.";

    await program.methods
      .publishPublication(
        new BN(originalId.toString()),
        IDENTITY_MODE.NAMED,
        DISCOVERABILITY.PUBLIC,
        Array.from(identityHash("identity-123")),
        Array.from(contentHash(originalTitle, originalContent)),
        originalTitle,
        "Someone",
        originalContent,
        null,
      )
      .accounts({
        platformConfig: platformPda,
        publication: originalPda,
        previousPublicationAccount: null,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const revisionId = await currentCounter();
    const revisionPda = publicationPda(revisionId);
    const revisionTitle = "Original thought (revised)";
    const revisionContent = "A corrected version.";

    await program.methods
      .publishPublication(
        new BN(revisionId.toString()),
        IDENTITY_MODE.NAMED,
        DISCOVERABILITY.PUBLIC,
        Array.from(identityHash("identity-123")),
        Array.from(contentHash(revisionTitle, revisionContent)),
        revisionTitle,
        "Someone",
        revisionContent,
        originalPda,
      )
      .accounts({
        platformConfig: platformPda,
        publication: revisionPda,
        previousPublicationAccount: originalPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const revision = await program.account.publication.fetch(revisionPda);
    assert.isTrue(revision.previousPublication.equals(originalPda));

    const original = await program.account.publication.fetch(originalPda);
    assert.equal(original.title, originalTitle, "the original is never rewritten");
  });

  it("rejects a previous_publication argument that doesn't match the supplied account", async () => {
    const otherId = 0n; // any already-published id
    const otherPda = publicationPda(otherId);

    const anotherId = await currentCounter();
    // create a second real publication to act as the "wrong" account
    const wrongPda = publicationPda(anotherId);
    const title = "Wrong link setup";
    const content = "setup";
    await program.methods
      .publishPublication(
        new BN(anotherId.toString()),
        IDENTITY_MODE.NAMED,
        DISCOVERABILITY.PUBLIC,
        Array.from(identityHash("identity-123")),
        Array.from(contentHash(title, content)),
        title,
        "Someone",
        content,
        null,
      )
      .accounts({
        platformConfig: platformPda,
        publication: wrongPda,
        previousPublicationAccount: null,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const newId = await currentCounter();
    const newPda = publicationPda(newId);
    let threw = false;
    try {
      await program.methods
        .publishPublication(
          new BN(newId.toString()),
          IDENTITY_MODE.NAMED,
          DISCOVERABILITY.PUBLIC,
          Array.from(identityHash("identity-123")),
          Array.from(contentHash("mismatch", "mismatch")),
          "mismatch",
          "Someone",
          "mismatch",
          otherPda, // claims otherPda...
        )
        .accounts({
          platformConfig: platformPda,
          publication: newPda,
          previousPublicationAccount: wrongPda, // ...but supplies wrongPda's account
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "InvalidPreviousPublication");
    }
    assert.isTrue(threw);
  });

  it("rotates the platform authority", async () => {
    const newAuthority = await fundedKeypair();

    await program.methods
      .rotateAuthority(newAuthority.publicKey)
      .accounts({
        platformConfig: platformPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    const platform = await program.account.platformConfig.fetch(platformPda);
    assert.isTrue(platform.authority.equals(newAuthority.publicKey));

    // Rotate back so later test runs against the same local validator
    // (if any) aren't left with a changed authority.
    await program.methods
      .rotateAuthority(provider.wallet.publicKey)
      .accounts({
        platformConfig: platformPda,
        authority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();
  });

  it("rejects rotate_authority from a non-authority signer", async () => {
    const impostor = await fundedKeypair();
    let threw = false;
    try {
      await program.methods
        .rotateAuthority(impostor.publicKey)
        .accounts({
          platformConfig: platformPda,
          authority: impostor.publicKey,
        })
        .signers([impostor])
        .rpc();
    } catch (err) {
      threw = true;
      assert.include(String(err), "Unauthorized");
    }
    assert.isTrue(threw);
  });

  it("has no update_publication, delete_publication, or close_publication instruction", () => {
    // Enforced at compile time (the IDL simply has no such methods) — this
    // just documents/confirms that at the client-generation level too.
    const methods = program.methods as unknown as Record<string, unknown>;
    assert.isUndefined(methods.updatePublication);
    assert.isUndefined(methods.deletePublication);
    assert.isUndefined(methods.closePublication);
  });
});

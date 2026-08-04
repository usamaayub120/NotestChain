import { PublicKey } from "@solana/web3.js";

export const PLATFORM_SEED = Buffer.from("platform");
export const PUBLICATION_SEED = Buffer.from("publication");

export function publicationIdToLeBytes(publicationId: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(publicationId);
  return buf;
}

export function derivePlatformConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PLATFORM_SEED], programId);
}

export function derivePublicationPda(
  programId: PublicKey,
  publicationId: bigint,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PUBLICATION_SEED, publicationIdToLeBytes(publicationId)],
    programId,
  );
}

/**
 * Gives every active account the one Keeper profile the new identity model
 * assumes it has.
 *
 * Idempotent — safe to run repeatedly, and safe to run against production.
 * It only ever adds a primary identity or flags an existing one as primary;
 * it never renames, hides, deletes, or re-attributes anything.
 *
 *   pnpm tsx scripts/backfill-keeper-profiles.ts [--dry-run]
 *
 * Run after `prisma migrate deploy` has applied
 * 20260825090000_add_keeper_profiles_and_follows.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { slugifyUsername, usernameFromEmail, withUsernameSuffix } from "@noteschain/shared";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const FALLBACK_USERNAME_BASE = "keeper";
const SEQUENTIAL_ATTEMPTS = 12;
const RANDOM_ATTEMPTS = 8;
const BATCH_SIZE = 200;

async function isUsernameFree(tx: Prisma.TransactionClient, username: string): Promise<boolean> {
  return (await tx.publicIdentity.findUnique({ where: { username }, select: { id: true } })) === null;
}

async function allocateUsername(tx: Prisma.TransactionClient, email: string): Promise<string> {
  const base = usernameFromEmail(email) ?? slugifyUsername(FALLBACK_USERNAME_BASE) ?? FALLBACK_USERNAME_BASE;
  if (await isUsernameFree(tx, base)) return base;

  for (let n = 2; n < 2 + SEQUENTIAL_ATTEMPTS; n += 1) {
    const candidate = withUsernameSuffix(base, String(n));
    if (await isUsernameFree(tx, candidate)) return candidate;
  }
  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = withUsernameSuffix(base, randomBytes(3).toString("hex"));
    if (await isUsernameFree(tx, candidate)) return candidate;
  }
  throw new Error(`Could not allocate a username for ${email}`);
}

type Outcome = "already" | "promoted" | "created";

async function backfillUser(userId: string, email: string): Promise<Outcome> {
  return prisma.$transaction(async (tx) => {
    const identities = await tx.publicIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (identities.some((identity) => identity.isPrimary)) return "already";

    // Someone who already publishes under their real name keeps that handle
    // as their Keeper profile — promoting it means nothing they have shown
    // readers changes, and they get no second handle to explain.
    const realName = identities.find((identity) => identity.type === "REAL_NAME");
    if (realName) {
      if (!dryRun) {
        await tx.publicIdentity.update({
          where: { id: realName.id },
          data: {
            isPrimary: true,
            // Already theirs, already public — not a generated handle, so no
            // free rename is owed.
            usernameChangedAt: realName.usernameChangedAt ?? realName.createdAt,
          },
        });
      }
      return "promoted";
    }

    const username = await allocateUsername(tx, email);
    if (!dryRun) {
      await tx.publicIdentity.create({
        data: {
          userId,
          type: "REAL_NAME",
          isPrimary: true,
          username,
          displayName: username,
          // Generated, so the owner is still owed one free rename.
          usernameChangedAt: null,
        },
      });
    }
    return "created";
  });
}

async function main() {
  const counts: Record<Outcome, number> = { already: 0, promoted: 0, created: 0 };
  let cursor: string | undefined;
  let scanned = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      // DELETED accounts are tombstones with scrubbed emails; giving one a
      // public profile would undo part of the deletion.
      where: { status: { not: "DELETED" } },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (users.length === 0) break;

    for (const user of users) {
      counts[await backfillUser(user.id, user.email)] += 1;
      scanned += 1;
    }
    cursor = users[users.length - 1]!.id;
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}scanned ${scanned} account(s): ` +
      `${counts.created} created, ${counts.promoted} promoted, ${counts.already} already had one.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

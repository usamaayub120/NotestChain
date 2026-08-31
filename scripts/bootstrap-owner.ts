/**
 * One-time, operations-only Owner bootstrap. This deliberately requires the
 * exact immutable user ID; it never guesses from email or selects a user.
 * Usage: OWNER_USER_ID=<uuid> pnpm bootstrap:owner
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.OWNER_USER_ID;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Set OWNER_USER_ID to the exact account UUID.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("The supplied OWNER_USER_ID does not exist.");
  const existingOwner = await prisma.staffRoleAssignment.findFirst({ where: { role: "OWNER" }, select: { userId: true } });
  if (existingOwner && existingOwner.userId !== userId) throw new Error("An Owner already exists; ordinary operations must not replace it.");
  await prisma.staffRoleAssignment.upsert({ where: { userId_role: { userId, role: "OWNER" } }, create: { userId, role: "OWNER" }, update: {} });
  console.log(`Owner assignment verified for ${userId}.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());

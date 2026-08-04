/**
 * Creates (or promotes) a single ADMIN user from CLI args or env vars —
 * never from a hardcoded credential. Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' pnpm create:admin
 */
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables and re-run.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { email, passwordHash, role: "ADMIN", status: "ACTIVE" },
  });

  console.log(`Admin ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

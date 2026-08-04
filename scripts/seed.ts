/**
 * Local/dev seed data only — never run against production. Creates one
 * admin, one moderator, one regular user, a few public identities, drafts
 * in various states, an approved + a rejected submission, and one
 * already-"published" (off-chain-only, blockchain_status=NOT_SUBMITTED)
 * publication so the read model has something to show before Phase 3/4
 * wire up real chain publishing.
 */
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { computeContentHash } from "@noteschain/blockchain-client";

const prisma = new PrismaClient();

const DEV_PASSWORD = "dev-password-123!"; // seed-only, never a real credential

async function upsertUser(email: string, role: "ADMIN" | "MODERATOR" | "USER") {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, passwordHash, role, status: "ACTIVE" },
  });
}

async function main() {
  console.log("Seeding NotesChain dev data...");

  const admin = await upsertUser("admin@noteschain.dev", "ADMIN");
  const moderator = await upsertUser("moderator@noteschain.dev", "MODERATOR");
  const user = await upsertUser("writer@noteschain.dev", "USER");

  const realIdentity = await prisma.publicIdentity.upsert({
    where: { username: "marguerite" },
    update: {},
    create: {
      userId: user.id,
      type: "REAL_NAME",
      username: "marguerite",
      displayName: "Marguerite Vale",
      bio: "Notices small things. Keeps a few of them.",
      isVisible: true,
    },
  });

  const pseudonym = await prisma.publicIdentity.upsert({
    where: { username: "night-owl" },
    update: {},
    create: {
      userId: user.id,
      type: "PSEUDONYM",
      username: "night-owl",
      displayName: "Night Owl",
      bio: "Writes after midnight.",
      isVisible: true,
    },
  });

  const draft1 = await prisma.draft.create({
    data: {
      userId: user.id,
      title: "A note on slowness",
      content: "Some nights the city sounds like a held breath.",
      tags: ["night", "city"],
      identityMode: "PSEUDONYMOUS",
      publicIdentityId: pseudonym.id,
      discoverability: "PUBLIC",
      status: "DRAFT",
    },
  });
  await prisma.draftVersion.create({
    data: { draftId: draft1.id, versionNumber: 1, title: draft1.title, content: draft1.content },
  });

  const approvedTitle = "What I keep";
  const approvedContent = "Not everything. Just the parts that still feel true in the morning.";
  const approvedDraft = await prisma.draft.create({
    data: {
      userId: user.id,
      title: approvedTitle,
      content: approvedContent,
      tags: ["reflection"],
      identityMode: "NAMED",
      publicIdentityId: realIdentity.id,
      discoverability: "PUBLIC",
      status: "APPROVED",
      submittedAt: new Date(),
    },
  });
  const approvedSubmission = await prisma.submission.create({
    data: {
      draftId: approvedDraft.id,
      submittedByUserId: user.id,
      titleSnapshot: approvedTitle,
      contentSnapshot: approvedContent,
      tagsSnapshot: ["reflection"],
      identityModeSnapshot: "NAMED",
      publicIdentityIdSnapshot: realIdentity.id,
      discoverabilitySnapshot: "PUBLIC",
      status: "APPROVED",
      decidedAt: new Date(),
    },
  });
  await prisma.moderationDecision.create({
    data: {
      submissionId: approvedSubmission.id,
      moderatorUserId: moderator.id,
      action: "APPROVE",
      reason: "Meets community guidelines.",
    },
  });

  const contentHash = computeContentHash(approvedTitle, approvedContent).toString("hex");
  await prisma.publication.upsert({
    where: { sourceDraftId: approvedDraft.id },
    update: {},
    create: {
      sourceDraftId: approvedDraft.id,
      privateAuthorUserId: user.id,
      publicIdentityId: realIdentity.id,
      identityMode: "NAMED",
      discoverability: "PUBLIC",
      title: approvedTitle,
      content: approvedContent,
      excerpt: approvedContent.slice(0, 140),
      tags: ["reflection"],
      contentHash,
      status: "CHAIN_PENDING",
      isPlatformVisible: true,
    },
  });

  const rejectedTitle = "Untitled rant";
  const rejectedDraft = await prisma.draft.create({
    data: {
      userId: user.id,
      title: rejectedTitle,
      content: "This one didn't make the cut for the seed demo.",
      identityMode: "ANONYMOUS",
      discoverability: "PUBLIC",
      status: "REJECTED",
      submittedAt: new Date(),
    },
  });
  const rejectedSubmission = await prisma.submission.create({
    data: {
      draftId: rejectedDraft.id,
      submittedByUserId: user.id,
      titleSnapshot: rejectedTitle,
      contentSnapshot: rejectedDraft.content,
      tagsSnapshot: [],
      identityModeSnapshot: "ANONYMOUS",
      discoverabilitySnapshot: "PUBLIC",
      status: "REJECTED",
      decidedAt: new Date(),
    },
  });
  await prisma.moderationDecision.create({
    data: {
      submissionId: rejectedSubmission.id,
      moderatorUserId: moderator.id,
      action: "REJECT",
      reason: "Does not read as a complete thought yet.",
    },
  });

  console.log("Seed complete:");
  console.log(`  admin:     ${admin.email} / ${DEV_PASSWORD}`);
  console.log(`  moderator: ${moderator.email} / ${DEV_PASSWORD}`);
  console.log(`  user:      ${user.email} / ${DEV_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import type { Prisma } from "@prisma/client";
import { PublicKey } from "@solana/web3.js";
import { Role } from "@noteschain/shared";
import { getWalletStatus, type WalletStatus } from "@noteschain/blockchain-client";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { getSolanaClient } from "../publishing/solanaClient.js";

const RENOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface TrackedWallet {
  key: string;
  label: string;
  pubkey: string;
  thresholdSol: number;
}

// Module-level, not persisted — restarting the worker just re-derives
// "currently low" from a fresh RPC read on the next tick and, worst case,
// re-sends one alert. Never auto-fixes anything, mirrors reconcile.ts's
// flag-only philosophy.
const lastStatus = new Map<string, WalletStatus>();
const lastNotifiedAt = new Map<string, number>();

/**
 * Hooked into worker.ts's tick() the same way reconciliation is — gated by
 * its own interval, never on every tick. Only alerts on a transition into
 * "low" (or after a cooldown if it's still low), so a wallet sitting low
 * doesn't spam an AuditLog row and an email every interval forever.
 */
export async function checkWalletBalances(): Promise<void> {
  const { connection, publisherPubkey } = getSolanaClient();

  const wallets: TrackedWallet[] = [
    {
      key: "publisher",
      label: "Publisher wallet",
      pubkey: publisherPubkey.toBase58(),
      thresholdSol: env.SOLANA_PUBLISHER_LOW_BALANCE_SOL,
    },
    {
      key: "upgradeAuthority",
      label: "Upgrade authority wallet",
      pubkey: env.SOLANA_UPGRADE_AUTHORITY_PUBLIC_KEY,
      thresholdSol: env.SOLANA_UPGRADE_AUTHORITY_LOW_BALANCE_SOL,
    },
  ];

  for (const wallet of wallets) {
    const { balanceSol, status } = await getWalletStatus(connection, new PublicKey(wallet.pubkey), wallet.thresholdSol);
    const previous = lastStatus.get(wallet.key);
    lastStatus.set(wallet.key, status);

    if (status !== "low" || balanceSol === null) continue;

    const justCrossed = previous !== "low";
    const cooldownElapsed = Date.now() - (lastNotifiedAt.get(wallet.key) ?? 0) >= RENOTIFY_COOLDOWN_MS;
    if (!justCrossed && !cooldownElapsed) continue;

    lastNotifiedAt.set(wallet.key, Date.now());
    await notifyLowBalance(wallet, balanceSol);
  }
}

async function notifyLowBalance(wallet: TrackedWallet, balanceSol: number): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: "WALLET_BALANCE_LOW",
      targetType: "SolanaWallet",
      targetId: wallet.key,
      metadata: { label: wallet.label, pubkey: wallet.pubkey, balanceSol, thresholdSol: wallet.thresholdSol },
    },
  });
  logger.warn({ wallet: wallet.key, balanceSol, thresholdSol: wallet.thresholdSol }, "Wallet balance low");

  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true, email: true } });
  const walletsUrl = `${env.PUBLIC_WEB_ORIGIN}/admin/wallets`;

  if (admins.length === 0) return;

  await prisma.emailJob.createMany({
    data: admins.map((admin) => ({
      kind: EmailKind.WALLET_BALANCE_LOW,
      toEmail: admin.email,
      toUserId: admin.id,
      data: buildEmailJobData(EmailKind.WALLET_BALANCE_LOW, {
        walletLabel: wallet.label,
        balanceSol,
        thresholdSol: wallet.thresholdSol,
        walletsUrl,
      }) as Prisma.InputJsonValue,
    })),
  });
}

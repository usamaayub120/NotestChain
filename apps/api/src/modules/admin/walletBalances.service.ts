import { PublicKey } from "@solana/web3.js";
import { getWalletStatus, type WalletStatus } from "@noteschain/blockchain-client";
import { getReadOnlySolanaClient } from "../../lib/solanaClient.js";
import { env } from "../../config/env.js";

export interface WalletBalanceInfo {
  key: "publisher" | "upgradeAuthority";
  label: string;
  pubkey: string | null;
  purpose: string;
  balanceSol: number | null;
  thresholdSol: number;
  status: WalletStatus | "not_configured";
  explorerUrl: string | null;
}

function explorerUrl(pubkey: string): string {
  const cluster = env.SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${env.SOLANA_CLUSTER}`;
  return `${env.PUBLIC_EXPLORER_BASE_URL}/address/${pubkey}${cluster}`;
}

/**
 * Both wallets that matter operationally, using only public keys — never a
 * secret. `platform_config.treasury` is deliberately excluded: it's
 * write-once at `initialize_platform` and never read by any instruction or
 * off-chain code, so it isn't a balance anyone needs to watch today.
 */
export async function listWalletBalances(): Promise<WalletBalanceInfo[]> {
  const { connection } = getReadOnlySolanaClient();

  const wallets: Omit<WalletBalanceInfo, "balanceSol" | "status" | "explorerUrl">[] = [
    {
      key: "publisher",
      label: "Publisher wallet",
      pubkey: env.SOLANA_PUBLISHER_PUBLIC_KEY ?? null,
      purpose:
        "Pays the transaction fee and rent for every published note. If this runs low, publishing starts failing.",
      thresholdSol: env.SOLANA_PUBLISHER_LOW_BALANCE_SOL,
    },
    {
      key: "upgradeAuthority",
      label: "Upgrade authority wallet",
      pubkey: env.SOLANA_UPGRADE_AUTHORITY_PUBLIC_KEY,
      purpose:
        "Pays for upgrading the on-chain program itself. Only spent when deploying a program change — irrelevant day to day.",
      thresholdSol: env.SOLANA_UPGRADE_AUTHORITY_LOW_BALANCE_SOL,
    },
  ];

  return Promise.all(
    wallets.map(async (wallet) => {
      if (!wallet.pubkey) {
        return { ...wallet, balanceSol: null, status: "not_configured" as const, explorerUrl: null };
      }
      const { balanceSol, status } = await getWalletStatus(connection, new PublicKey(wallet.pubkey), wallet.thresholdSol);
      return { ...wallet, balanceSol, status, explorerUrl: explorerUrl(wallet.pubkey) };
    }),
  );
}

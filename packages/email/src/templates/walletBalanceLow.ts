import type { WalletBalanceLowData } from "../schemas.js";
import { paragraph, renderLayout, renderPlainText, technicalDetail, technicalDetailText, type RenderedEmail } from "../layout.js";
import { escapeHtml } from "../escape.js";

export function renderWalletBalanceLow(data: WalletBalanceLowData): RenderedEmail {
  const heading = `${data.walletLabel} balance is low`;
  const label = escapeHtml(data.walletLabel);
  const action = { label: "View Solana wallets", href: data.walletsUrl };

  const detail = technicalDetail("Current balance", `${data.balanceSol} SOL (alert threshold: ${data.thresholdSol} SOL)`);
  const detailText = technicalDetailText("Current balance", `${data.balanceSol} SOL (alert threshold: ${data.thresholdSol} SOL)`);

  return {
    subject: heading,
    html: renderLayout({
      preheader: `${label} is running low on devnet SOL.`,
      heading,
      bodyHtml: [paragraph(`${label} has dropped below its alert threshold.`), detail].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [`${data.walletLabel} has dropped below its alert threshold.`, "", detailText],
      action,
    }),
  };
}

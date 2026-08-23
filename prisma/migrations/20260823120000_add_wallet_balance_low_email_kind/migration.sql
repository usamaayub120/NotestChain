-- Admin/worker "wallet running low" alert email — see packages/email's
-- registry.ts for the WALLET_BALANCE_LOW template.

ALTER TYPE "EmailKind" ADD VALUE 'WALLET_BALANCE_LOW';

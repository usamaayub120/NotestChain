CREATE TYPE "SessionTransport" AS ENUM ('WEB', 'MOBILE');

ALTER TABLE "Session"
  ADD COLUMN "transport" "SessionTransport" NOT NULL DEFAULT 'WEB',
  ADD COLUMN "deviceName" TEXT;

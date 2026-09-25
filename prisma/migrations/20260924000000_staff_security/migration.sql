ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RECEPTION';
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');
ALTER TABLE "User" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "User" SET "status" = 'PENDING' WHERE "isActive" = false;
CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "AuthRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
-- Remove previously stored credentials; secrets belong in deployment environment.
DO $$
BEGIN
  UPDATE "SystemSetting" SET "value" = (("value"::jsonb - 'botToken')::text)
  WHERE "key" = 'telegram_config';
EXCEPTION WHEN invalid_text_representation THEN
  DELETE FROM "SystemSetting" WHERE "key" = 'telegram_config';
END $$;

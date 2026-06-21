CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "AuditScope" AS ENUM ('SERVER', 'COLLECTION', 'USER', 'SYSTEM');

ALTER TABLE "AuditLog" RENAME COLUMN "createdById" TO "actorUserId";
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" DROP NOT NULL;

ALTER TABLE "AuditLog"
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorDisplayName" TEXT,
  ADD COLUMN "actorRole" TEXT,
  ADD COLUMN "collectionId" TEXT,
  ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "details" JSONB,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "scope" "AuditScope" NOT NULL DEFAULT 'SYSTEM';

UPDATE "AuditLog"
SET
  "summary" = initcap(replace("action", '_', ' ')) || ' ' || "entityType",
  "details" = jsonb_strip_nulls(jsonb_build_object('before', "before", 'after', "after")),
  "actorEmail" = "User"."email",
  "actorDisplayName" = "User"."name",
  "actorRole" = "User"."serverRole"::text
FROM "User"
WHERE "AuditLog"."actorUserId" = "User"."id";

UPDATE "AuditLog"
SET "summary" = initcap(replace("action", '_', ' ')) || ' ' || "entityType"
WHERE "summary" = '';

ALTER TABLE "AuditLog" ALTER COLUMN "summary" DROP DEFAULT;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_collectionId_createdAt_idx" ON "AuditLog"("collectionId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");
CREATE INDEX "AuditLog_scope_createdAt_idx" ON "AuditLog"("scope", "createdAt");

INSERT INTO "AuditLog" (
  "id", "createdAt", "entityType", "entityId", "action", "summary", "severity", "scope"
) VALUES (
  'audit-log-initialized-20260621', CURRENT_TIMESTAMP, 'AuditLog', NULL,
  'AUDIT_LOG_INITIALIZED', 'Comprehensive audit logging initialized', 'INFO', 'SYSTEM'
) ON CONFLICT ("id") DO NOTHING;

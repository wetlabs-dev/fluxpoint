CREATE TYPE "AiRequestType" AS ENUM ('TANK_NAME', 'COVER_CARD', 'CARE_ADVICE', 'TROUBLESHOOTING', 'SUMMARY', 'IMAGE_GENERATION', 'MODERATION', 'OTHER');
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'BLOCKED');
CREATE TYPE "ModerationInputType" AS ENUM ('TEXT', 'IMAGE', 'PROMPT');
CREATE TYPE "ModerationStatus" AS ENUM ('ALLOWED', 'FLAGGED', 'BLOCKED', 'ERROR');
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "CollectionRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

CREATE TABLE "AiRequestLog" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "aquariumId" TEXT,
    "userId" TEXT,
    "requestType" "AiRequestType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptSummary" TEXT,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costEstimate" DECIMAL(12,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationReview" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputType" "ModerationInputType" NOT NULL,
    "status" "ModerationStatus" NOT NULL,
    "categories" JSONB,
    "scores" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "userId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "messageId" TEXT,
    "error" TEXT,
    "template" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionInvitation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CollectionRole" NOT NULL DEFAULT 'VIEWER',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "inviterId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiRequestLog_collectionId_createdAt_idx" ON "AiRequestLog"("collectionId", "createdAt");
CREATE INDEX "AiRequestLog_aquariumId_createdAt_idx" ON "AiRequestLog"("aquariumId", "createdAt");
CREATE INDEX "AiRequestLog_userId_createdAt_idx" ON "AiRequestLog"("userId", "createdAt");
CREATE INDEX "ModerationReview_collectionId_createdAt_idx" ON "ModerationReview"("collectionId", "createdAt");
CREATE INDEX "ModerationReview_entityType_entityId_idx" ON "ModerationReview"("entityType", "entityId");
CREATE INDEX "EmailLog_collectionId_createdAt_idx" ON "EmailLog"("collectionId", "createdAt");
CREATE INDEX "EmailLog_userId_createdAt_idx" ON "EmailLog"("userId", "createdAt");
CREATE INDEX "EmailLog_entityType_entityId_idx" ON "EmailLog"("entityType", "entityId");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");
CREATE UNIQUE INDEX "CollectionInvitation_tokenHash_key" ON "CollectionInvitation"("tokenHash");
CREATE INDEX "CollectionInvitation_collectionId_status_idx" ON "CollectionInvitation"("collectionId", "status");
CREATE INDEX "CollectionInvitation_email_status_idx" ON "CollectionInvitation"("email", "status");

ALTER TABLE "AiRequestLog" ADD CONSTRAINT "AiRequestLog_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRequestLog" ADD CONSTRAINT "AiRequestLog_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRequestLog" ADD CONSTRAINT "AiRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionInvitation" ADD CONSTRAINT "CollectionInvitation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionInvitation" ADD CONSTRAINT "CollectionInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

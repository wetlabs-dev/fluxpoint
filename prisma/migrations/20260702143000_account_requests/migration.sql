CREATE TYPE "AccountRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "AccountRequest" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "message" TEXT,
  "requestedCollectionId" TEXT,
  "requestedCollectionName" TEXT,
  "status" "AccountRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "approvalNotes" TEXT,
  "rejectionReason" TEXT,
  "approvedServerRole" "ServerRole",
  "approvedCollectionId" TEXT,
  "approvedCollectionRole" "CollectionRole",
  "invitationId" TEXT,
  "invitedUserId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountRequest_invitationId_key" ON "AccountRequest"("invitationId");
CREATE UNIQUE INDEX "AccountRequest_pending_email_unique" ON "AccountRequest"(LOWER("email")) WHERE "status" = 'PENDING';
CREATE INDEX "AccountRequest_email_status_idx" ON "AccountRequest"("email", "status");
CREATE INDEX "AccountRequest_status_requestedAt_idx" ON "AccountRequest"("status", "requestedAt");
CREATE INDEX "AccountRequest_reviewedById_reviewedAt_idx" ON "AccountRequest"("reviewedById", "reviewedAt");
CREATE INDEX "AccountRequest_requestedCollectionId_status_idx" ON "AccountRequest"("requestedCollectionId", "status");
CREATE INDEX "AccountRequest_approvedCollectionId_status_idx" ON "AccountRequest"("approvedCollectionId", "status");

ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_requestedCollectionId_fkey" FOREIGN KEY ("requestedCollectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_approvedCollectionId_fkey" FOREIGN KEY ("approvedCollectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "CollectionInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

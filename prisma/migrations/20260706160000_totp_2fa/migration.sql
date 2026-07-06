ALTER TABLE "Session" ADD COLUMN "twoFactorVerifiedAt" TIMESTAMP(3);

CREATE TABLE "UserTwoFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "recoveryCodesCiphertext" TEXT,
    "recoveryCodesGeneratedAt" TIMESTAMP(3),
    "recoveryCodesViewedAt" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "userTwoFactorId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTwoFactor_userId_key" ON "UserTwoFactor"("userId");
CREATE UNIQUE INDEX "TwoFactorChallenge_tokenHash_key" ON "TwoFactorChallenge"("tokenHash");
CREATE INDEX "TwoFactorChallenge_userId_idx" ON "TwoFactorChallenge"("userId");
CREATE INDEX "TwoFactorChallenge_expiresAt_idx" ON "TwoFactorChallenge"("expiresAt");
CREATE INDEX "TwoFactorChallenge_consumedAt_idx" ON "TwoFactorChallenge"("consumedAt");
CREATE UNIQUE INDEX "TwoFactorRecoveryCode_userTwoFactorId_codeHash_key" ON "TwoFactorRecoveryCode"("userTwoFactorId", "codeHash");
CREATE INDEX "TwoFactorRecoveryCode_userTwoFactorId_idx" ON "TwoFactorRecoveryCode"("userTwoFactorId");
CREATE INDEX "TwoFactorRecoveryCode_usedAt_idx" ON "TwoFactorRecoveryCode"("usedAt");

ALTER TABLE "UserTwoFactor" ADD CONSTRAINT "UserTwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userTwoFactorId_fkey" FOREIGN KEY ("userTwoFactorId") REFERENCES "UserTwoFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "StockingPressureLevel" AS ENUM ('UNKNOWN', 'VERY_LIGHT', 'LIGHT', 'MODERATE', 'HEAVY', 'OVERSTOCKED');
CREATE TYPE "StockingPressureConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "AquariumStockingPressureEstimate" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "level" "StockingPressureLevel" NOT NULL,
    "confidence" "StockingPressureConfidence" NOT NULL,
    "flags" JSONB,
    "summary" TEXT NOT NULL,
    "reasoning" JSONB,
    "cautions" JSONB,
    "missingData" JSONB,
    "inputFingerprint" TEXT NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "estimatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumStockingPressureEstimate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AquariumStockingPressureEstimate_aquariumId_createdAt_idx" ON "AquariumStockingPressureEstimate"("aquariumId", "createdAt");
CREATE INDEX "AquariumStockingPressureEstimate_collectionId_createdAt_idx" ON "AquariumStockingPressureEstimate"("collectionId", "createdAt");

ALTER TABLE "AquariumStockingPressureEstimate" ADD CONSTRAINT "AquariumStockingPressureEstimate_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumStockingPressureEstimate" ADD CONSTRAINT "AquariumStockingPressureEstimate_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumStockingPressureEstimate" ADD CONSTRAINT "AquariumStockingPressureEstimate_estimatedByUserId_fkey" FOREIGN KEY ("estimatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

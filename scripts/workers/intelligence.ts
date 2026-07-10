import { prisma } from "@/lib/db/prisma";
import { runAquariumIntelligence } from "@/domains/aquarium-intelligence/actions";
import { produceAquariumIntelligenceAlerts } from "@/domains/notifications/alert-producers";
import { runWorker } from "./lib";

async function refreshAquariumIntelligence() {
  let processed = 0;
  const aquariums = await prisma.aquarium.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, collectionId: true, updatedAt: true, healthAssessments: { orderBy: { assessedAt: "desc" }, take: 1 } },
    take: 50
  });
  for (const aquarium of aquariums) {
    const latest = aquarium.healthAssessments[0];
    const stale = !latest || aquarium.updatedAt > latest.assessedAt || latest.assessedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000;
    if (!stale) continue;
    await runAquariumIntelligence(aquarium.id, aquarium.collectionId, "WORKER");
    processed += 1;
  }
  const alerts = await produceAquariumIntelligenceAlerts(new Date(), prisma);
  return {
    summary: `Processed ${processed} aquarium intelligence refresh${processed === 1 ? "" : "es"}.`,
    metadata: { recordsProcessed: processed, alerts }
  };
}

runWorker({
  name: "aquarium-intelligence",
  enabledEnv: "ENABLE_INTELLIGENCE_WORKER",
  intervalMs: Number(process.env.INTELLIGENCE_WORKER_INTERVAL_MS || 60 * 60 * 1000),
  tick: refreshAquariumIntelligence
});

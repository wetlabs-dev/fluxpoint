import { prisma } from "@/lib/db/prisma";
import { runAquariumIntelligence } from "@/domains/aquarium-intelligence/actions";

async function main() {
  const startedAt = new Date();
  const run = await prisma.serverWorkerRun.create({ data: { workerName: "aquarium-intelligence", status: "RUNNING", startedAt } });
  let processed = 0;
  try {
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
    const finishedAt = new Date();
    await prisma.serverWorkerRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), summary: `Processed ${processed} aquarium intelligence refresh${processed === 1 ? "" : "es"}.`, metadata: { recordsProcessed: processed } } });
  } catch (error) {
    const finishedAt = new Date();
    await prisma.serverWorkerRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), error: error instanceof Error ? error.message : String(error) } });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { prisma } from "../../src/lib/db/prisma";
import { recordWorkerIncident, resolveWorkerIncident } from "../../src/domains/server/server-incidents";

const fiveMinutes = 5 * 60 * 1000;

export async function runWorker(options: {
  name: string;
  enabledEnv: string;
  intervalMs?: number;
  tick?: () => Promise<void | { summary?: string; metadata?: Record<string, unknown> }>;
}) {
  const enabled = process.env[options.enabledEnv] === "true";

  if (!enabled) {
    console.log(`[${options.name}] disabled via ${options.enabledEnv}; sleeping until shutdown.`);
    await new Promise<void>((resolve) => {
      process.on("SIGTERM", resolve);
      process.on("SIGINT", resolve);
    });
    console.log(`[${options.name}] disabled worker stopped.`);
    return;
  }

  let stopping = false;
  let wakeSleep = () => {};
  const stop = () => {
    stopping = true;
    wakeSleep();
    console.log(`[${options.name}] shutdown requested.`);
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log(`[${options.name}] worker started.`);

  while (!stopping) {
    console.log(`[${options.name}] heartbeat ${new Date().toISOString()}`);
    const startedAt = new Date();
    const run = await prisma.serverWorkerRun.create({ data: { workerName: options.name, status: "RUNNING", startedAt } });
    try {
      const locked = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext('fluxpoint-worker'), hashtext(${options.name})) AS acquired
        `;
        if (!rows[0]?.acquired) return { acquired: false as const, result: undefined };
        return { acquired: true as const, result: await options.tick?.() };
      }, { timeout: Math.max(60_000, (options.intervalMs ?? fiveMinutes) * 2), maxWait: 5_000 });
      const finishedAt = new Date();
      await prisma.serverWorkerRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), summary: locked.acquired ? locked.result?.summary || "Worker tick completed." : "Skipped because another worker owns the advisory lock.", metadata: locked.acquired ? locked.result?.metadata as never : { skipped: "advisory_lock" } } });
      if (locked.acquired) await resolveWorkerIncident(options.name);
    } catch (error) {
      const finishedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      await prisma.serverWorkerRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), error: message } });
      await recordWorkerIncident(options.name, message);
      console.error(`[${options.name}] tick failed`, message);
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, options.intervalMs ?? fiveMinutes);
      wakeSleep = () => { clearTimeout(timer); resolve(); };
    });
    wakeSleep = () => {};
  }

  console.log(`[${options.name}] worker stopped.`);
}

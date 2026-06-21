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
      const result = await options.tick?.();
      const finishedAt = new Date();
      await prisma.serverWorkerRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), summary: result?.summary || "Worker tick completed.", metadata: result?.metadata as never } });
      await resolveWorkerIncident(options.name);
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

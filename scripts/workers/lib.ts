const fiveMinutes = 5 * 60 * 1000;

export async function runWorker(options: {
  name: string;
  enabledEnv: string;
  intervalMs?: number;
  tick?: () => Promise<void>;
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
  const stop = () => {
    stopping = true;
    console.log(`[${options.name}] shutdown requested.`);
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log(`[${options.name}] worker started.`);

  while (!stopping) {
    console.log(`[${options.name}] heartbeat ${new Date().toISOString()}`);
    await options.tick?.();
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs ?? fiveMinutes));
  }

  console.log(`[${options.name}] worker stopped.`);
}

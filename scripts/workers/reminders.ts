import { runWorker } from "./lib";
import { produceAllNotificationAlerts } from "../../src/domains/notifications/alert-producers";

async function sendDueAlerts() {
  const result = await produceAllNotificationAlerts();
  console.log("[reminders] notification scan complete", result);
  return { summary: `Scanned ${result.care.scanned} due care tasks; ${result.metrics.abnormal} abnormal metrics; ${result.server.incidents} server incidents.`, metadata: result };
}

runWorker({
  name: "reminders",
  enabledEnv: "ENABLE_REMINDERS_WORKER",
  intervalMs: Number(process.env.REMINDER_WORKER_INTERVAL_MS || 300000),
  tick: sendDueAlerts
});

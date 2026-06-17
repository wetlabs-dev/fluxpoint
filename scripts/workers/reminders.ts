import { runWorker } from "./lib";

runWorker({
  name: "reminders",
  enabledEnv: "ENABLE_REMINDERS_WORKER"
});

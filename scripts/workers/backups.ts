import { runWorker } from "./lib";

runWorker({
  name: "backups",
  enabledEnv: "ENABLE_BACKUPS_WORKER"
});

import { runWorker } from "./lib";
import { processNextBackupRequest } from "../../src/domains/server/backup-service";

runWorker({
  name: "backups",
  enabledEnv: "ENABLE_BACKUPS_WORKER",
  intervalMs: Number(process.env.BACKUP_WORKER_INTERVAL_SECONDS || 60) * 1000,
  tick: async () => { await processNextBackupRequest(); }
});

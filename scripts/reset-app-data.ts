import { resetAppData } from "../src/domains/server/data-reset";
import { prisma } from "../src/lib/db/prisma";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const values = (flag: string) => args.flatMap((arg, index) => arg === flag && args[index + 1] ? [args[index + 1]] : []);

async function main() {
  const dryRun = has("--dry-run");
  if (!dryRun && !has("--confirm-reset")) throw new Error("Refusing reset without --confirm-reset. Use --dry-run to preview safely.");
  if (!dryRun && process.env.NODE_ENV === "production" && !has("--i-understand-this-deletes-data")) throw new Error("Production reset also requires --i-understand-this-deletes-data.");
  const preserveEmails = values("--preserve-user-email").map((email) => email.toLowerCase());
  const result = await resetAppData({
    dryRun,
    preserveAllUsers: has("--preserve-all-users") || !has("--delete-non-preserved-users"),
    preserveUserEmails: preserveEmails,
    deleteNonPreservedUsers: has("--delete-non-preserved-users"),
    createDefaultCollection: has("--create-default-collection"),
    deleteFiles: has("--delete-files"),
    deleteOperationalData: has("--delete-operational-data"),
    deleteBackupMetadata: has("--delete-backup-metadata")
  });
  console.log(dryRun ? "Fluxpoint application data reset dry run" : "Fluxpoint application data reset complete");
  console.table(result.before);
  console.log("Preserved users:", result.preservedUsers.map((user) => `${user.email} (${user.serverRole})`).join(", ") || "none");
  console.log("Users selected for deletion:", result.deletedUsers.map((user) => user.email).join(", ") || "none");
  console.log("Options:", { createDefaultCollection: result.createDefaultCollection, deleteFiles: result.deleteFiles, deleteOperationalData: result.deleteOperationalData, deleteBackupMetadata: result.deleteBackupMetadata });
  if (!dryRun) {
    console.table(result.after);
    console.log("Created default collection:", result.createdCollection?.name ?? "no");
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

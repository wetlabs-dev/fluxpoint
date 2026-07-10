import { createHash } from "crypto";
import { createReadStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { directorySize } from "@/domains/server/server-metrics";

const execFileAsync = promisify(execFile);
const backupRoot = () => path.join(process.cwd(), "backups");

function safeFolderName(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid backup folder name.");
  return value;
}

function folderPath(folderName: string) {
  return path.join(backupRoot(), safeFolderName(folderName));
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function checksum(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function postgresCliUrl() {
  const value = process.env.DATABASE_URL || "";
  try { const url = new URL(value); url.searchParams.delete("schema"); return url.toString(); } catch { return value.replace(/\?schema=[^&]+(&|$)/, "?").replace(/[?&]$/, ""); }
}

async function artifact(filePath: string, type: "DATABASE" | "UPLOADS" | "LABELS" | "REPORTS" | "MANIFEST") {
  const info = await stat(filePath);
  return { type, name: path.basename(filePath), relativePath: path.relative(process.cwd(), filePath), sizeBytes: BigInt(info.size), checksum: await checksum(filePath) };
}

async function archiveDirectory(source: string, output: string) {
  await mkdir(source, { recursive: true });
  await execFileAsync("tar", ["-czf", output, "-C", source, "."], { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 });
}

export async function processNextBackupRequest() {
  const request = await prisma.backupRequest.findFirst({ where: { status: "REQUESTED" }, orderBy: { requestedAt: "asc" }, include: { run: true } });
  if (!request) return null;
  const claimed = await prisma.backupRequest.updateMany({ where: { id: request.id, status: "REQUESTED" }, data: { status: "RUNNING" } });
  if (!claimed.count) return null;
  const startedAt = new Date();
  const folderName = `fluxpoint-${stamp(startedAt)}-${request.id.slice(-8)}`;
  const output = folderPath(folderName);
  const run = request.run || await prisma.backupRun.create({ data: { requestId: request.id } });
  await prisma.$transaction([
    prisma.backupRun.update({ where: { id: run.id }, data: { status: "RUNNING", folderName, backupPath: path.relative(process.cwd(), output), startedAt } })
  ]);

  try {
    await mkdir(output, { recursive: false });
    const dump = path.join(output, "fluxpoint.dump");
    const uploadsArchive = path.join(output, "uploads.tar.gz");
    const labelsArchive = path.join(output, "labels.tar.gz");
    const reportsArchive = path.join(output, "reports.tar.gz");
    await execFileAsync("pg_dump", ["--format=custom", `--file=${dump}`, postgresCliUrl()], { timeout: 15 * 60 * 1000, maxBuffer: 2 * 1024 * 1024 });
    await archiveDirectory(path.join(process.cwd(), "public", "uploads"), uploadsArchive);
    await archiveDirectory(path.join(process.cwd(), "public", "labels"), labelsArchive);
    await archiveDirectory(path.join(process.cwd(), "public", "reports"), reportsArchive);
    const artifacts = await Promise.all([
      artifact(dump, "DATABASE"), artifact(uploadsArchive, "UPLOADS"), artifact(labelsArchive, "LABELS"), artifact(reportsArchive, "REPORTS")
    ]);
    const manifestPath = path.join(output, "manifest.json");
    const manifest = { version: 1, application: "Fluxpoint", createdAt: new Date().toISOString(), requestId: request.id, notes: request.notes, artifacts: artifacts.map((item) => ({ ...item, sizeBytes: Number(item.sizeBytes) })) };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    artifacts.push(await artifact(manifestPath, "MANIFEST"));
    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.backupArtifact.deleteMany({ where: { backupRunId: run.id } }),
      ...artifacts.map((item) => prisma.backupArtifact.create({ data: { backupRunId: run.id, ...item } })),
      prisma.backupRun.update({ where: { id: run.id }, data: { status: "COMPLETE", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), manifest: manifest as never, log: "Backup completed with database, uploads, labels, reports, and manifest artifacts." } }),
      prisma.backupRequest.update({ where: { id: request.id }, data: { status: "COMPLETE" } })
    ]);
    await writeAuditLog({ entityType: "BackupRun", entityId: run.id, action: "BACKUP_COMPLETED", after: { folderName, artifacts: artifacts.map((item) => item.name) }, createdById: request.requestedById });
    return run.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.backupRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), error: message } }),
      prisma.backupRequest.update({ where: { id: request.id }, data: { status: "FAILED" } })
    ]);
    await writeAuditLog({ entityType: "BackupRun", entityId: run.id, action: "BACKUP_FAILED", after: { folderName, error: message }, createdById: request.requestedById });
    throw error;
  }
}

export async function backupFolders() {
  const runs = await prisma.backupRun.findMany({ include: { request: { include: { requestedBy: true } }, artifacts: true, restorePlans: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: 30 });
  return Promise.all(runs.map(async (run) => ({ ...run, diskBytes: run.folderName ? await directorySize(folderPath(run.folderName)) : 0, exists: run.folderName ? await stat(folderPath(run.folderName)).then((value) => value.isDirectory()).catch(() => false) : false })));
}

export async function backupCleanupPreview(retentionDays: number) {
  const days = Math.min(3650, Math.max(1, Math.floor(retentionDays || 180)));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const runs = await prisma.backupRun.findMany({ where: { status: "COMPLETE", finishedAt: { lt: cutoff }, folderName: { not: null } }, orderBy: { finishedAt: "asc" } });
  const candidates = await Promise.all(runs.map(async (run) => ({ id: run.id, folderName: run.folderName!, finishedAt: run.finishedAt!, sizeBytes: await directorySize(folderPath(run.folderName!)) })));
  return { days, cutoff, candidates, totalBytes: candidates.reduce((sum, item) => sum + item.sizeBytes, 0) };
}

export async function deleteBackupRun(runId: string, userId: string) {
  const run = await prisma.backupRun.findUniqueOrThrow({ where: { id: runId } });
  if (["REQUESTED", "RUNNING"].includes(run.status)) throw new Error("Active backups cannot be deleted.");
  if (run.folderName) await rm(folderPath(run.folderName), { recursive: true, force: true });
  await prisma.$transaction([
    prisma.backupRun.update({ where: { id: run.id }, data: { status: "DELETED", log: [run.log, `Deleted at ${new Date().toISOString()}.`].filter(Boolean).join("\n") } }),
    prisma.backupRequest.update({ where: { id: run.requestId }, data: { status: "DELETED" } })
  ]);
  await writeAuditLog({ entityType: "BackupRun", entityId: run.id, action: "BACKUP_DELETED", before: run, createdById: userId });
}

export async function applyBackupCleanup(retentionDays: number, userId: string) {
  const preview = await backupCleanupPreview(retentionDays);
  for (const candidate of preview.candidates) await deleteBackupRun(candidate.id, userId);
  await writeAuditLog({ entityType: "BackupRun", entityId: "cleanup", action: "BACKUP_CLEANUP_APPLIED", after: { retentionDays: preview.days, count: preview.candidates.length, bytes: preview.totalBytes }, createdById: userId });
  return preview;
}

export async function validateBackupForRestore(runId: string) {
  const run = await prisma.backupRun.findUniqueOrThrow({ where: { id: runId }, include: { artifacts: true } });
  const passed: string[] = [];
  const warnings: string[] = [];
  const failed: string[] = [];
  if (run.status === "COMPLETE") passed.push("Backup run is marked complete."); else failed.push(`Backup status is ${run.status.toLowerCase()}.`);
  if (run.folderName && await stat(folderPath(run.folderName)).then((value) => value.isDirectory()).catch(() => false)) passed.push("Backup folder exists under the configured root."); else failed.push("Backup folder is missing.");
  for (const type of ["DATABASE", "UPLOADS", "LABELS", "REPORTS", "MANIFEST"] as const) {
    const item = run.artifacts.find((artifact) => artifact.type === type);
    if (!item) failed.push(`${type.toLowerCase()} artifact is missing from the database record.`);
    else if (item.sizeBytes <= 0) failed.push(`${item.name} is empty.`);
    else {
      const filePath = path.resolve(process.cwd(), item.relativePath);
      const root = run.folderName ? path.resolve(folderPath(run.folderName)) : "";
      if (!root || !filePath.startsWith(`${root}${path.sep}`)) failed.push(`${item.name} points outside the backup folder.`);
      else {
        const info = await stat(filePath).catch(() => null);
        if (!info?.isFile()) failed.push(`${item.name} is missing from disk.`);
        else if (BigInt(info.size) !== item.sizeBytes) failed.push(`${item.name} size does not match its database record.`);
        else if (item.checksum && await checksum(filePath) !== item.checksum) failed.push(`${item.name} checksum does not match.`);
        else passed.push(`${item.name} exists and matches its recorded size and checksum.`);
      }
    }
  }
  if (run.folderName) {
    const root = folderPath(run.folderName);
    try { await execFileAsync("pg_restore", ["-l", path.join(root, "fluxpoint.dump")], { timeout: 30_000, maxBuffer: 1024 * 1024 }); passed.push("PostgreSQL can list the custom-format dump."); } catch { failed.push("PostgreSQL could not read the database dump catalog."); }
    for (const archive of ["uploads.tar.gz", "labels.tar.gz", "reports.tar.gz"]) {
      try { await execFileAsync("tar", ["-tzf", path.join(root, archive)], { timeout: 30_000, maxBuffer: 1024 * 1024 }); passed.push(`${archive} can be listed by tar.`); } catch { failed.push(`${archive} could not be listed by tar.`); }
    }
  }
  const maintenance = await prisma.maintenanceMode.findUnique({ where: { id: "global" } });
  if (maintenance?.enabled) passed.push("Maintenance mode is enabled."); else warnings.push("Enable maintenance mode before executing a restore.");
  return { readiness: failed.length ? "NOT_READY" : warnings.length ? "READY_WITH_WARNINGS" : "READY", passed, warnings, failed, checkedAt: new Date().toISOString() };
}

export function restoreOperatorSteps(run: { folderName: string | null }) {
  if (!run.folderName) throw new Error("Backup folder is unavailable.");
  const relative = `backups/${safeFolderName(run.folderName)}`;
  return [
    "# Review the validation report and announce maintenance mode.",
    "docker compose stop app reminders metrics backups ai-worker image-moderation intelligence",
    "export PG_RESTORE_URL=\"${DATABASE_URL%%\\?schema=*}\"",
    `pg_restore --clean --if-exists --no-owner --dbname=\"$PG_RESTORE_URL\" ${relative}/fluxpoint.dump`,
    `tar -xzf ${relative}/uploads.tar.gz -C public/uploads`,
    `tar -xzf ${relative}/labels.tar.gz -C public/labels`,
    `tar -xzf ${relative}/reports.tar.gz -C public/reports`,
    "docker compose up -d app",
    "npm run check:production"
  ].join("\n");
}

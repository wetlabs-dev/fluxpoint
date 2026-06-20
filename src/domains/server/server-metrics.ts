import { access, mkdir, readdir, readFile, stat, statfs } from "fs/promises";
import { constants, type Dirent } from "fs";
import os from "os";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { evaluateServerIncidents } from "@/domains/server/server-incidents";

export const SERVER_METRIC_RETENTION_HOURS = Number(process.env.SERVER_METRICS_RETENTION_HOURS || 48);

export type ServerMetricData = {
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number; processRssBytes: number; heapUsedBytes: number };
  disk: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number };
  network: { rxBytes: number; txBytes: number };
  storage: { uploadsBytes: number; labelsBytes: number; reportsBytes: number; backupsBytes: number; databaseBytes: number; codeBytes: number; otherBytes: number };
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`;
}

export async function directorySize(root: string): Promise<number> {
  let entries: Dirent[];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return 0; }
  let total = 0;
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) total += await directorySize(target);
    else if (entry.isFile()) total += (await stat(target)).size;
  }
  return total;
}

async function databaseSize() {
  try {
    const result = await prisma.$queryRaw<Array<{ size: bigint }>>`SELECT pg_database_size(current_database()) AS size`;
    return Number(result[0]?.size || 0);
  } catch { return 0; }
}

async function networkTotals() {
  try {
    const text = await readFile("/proc/net/dev", "utf8");
    return text.split("\n").slice(2).reduce((total, line) => {
      const [name, valuesText] = line.split(":");
      if (!valuesText || name.trim() === "lo") return total;
      const values = valuesText.trim().split(/\s+/).map(Number);
      return { rxBytes: total.rxBytes + (values[0] || 0), txBytes: total.txBytes + (values[8] || 0) };
    }, { rxBytes: 0, txBytes: 0 });
  } catch { return { rxBytes: 0, txBytes: 0 }; }
}

async function diskTotals(target: string) {
  try {
    const value = await statfs(target);
    const totalBytes = Number(value.blocks) * Number(value.bsize);
    const freeBytes = Number(value.bavail) * Number(value.bsize);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return { totalBytes, freeBytes, usedBytes, usedPercent: totalBytes ? Number((usedBytes / totalBytes * 100).toFixed(1)) : 0 };
  } catch { return { totalBytes: 0, freeBytes: 0, usedBytes: 0, usedPercent: 0 }; }
}

async function updateCollectionStorageEstimates() {
  const collections = await prisma.collection.findMany({
    include: { mediaAssets: { select: { sizeBytes: true } }, _count: { select: { aquariums: true, items: true, events: true, mediaAssets: true, speciesDefinitions: true } } }
  });
  await Promise.all(collections.map((collection) => prisma.storageEstimate.create({ data: {
    collectionId: collection.id,
    uploadBytes: BigInt(collection.mediaAssets.reduce((sum, media) => sum + media.sizeBytes, 0)),
    photoCount: collection._count.mediaAssets,
    recordCount: Object.values(collection._count).reduce((sum, count) => sum + count, 0)
  } })));
}

export async function collectServerMetricData(): Promise<ServerMetricData> {
  const uploads = path.join(process.cwd(), "public", "uploads");
  const labels = path.join(process.cwd(), "public", "labels");
  const reports = path.join(process.cwd(), "public", "reports");
  const backups = path.join(process.cwd(), "backups");
  await Promise.all([uploads, labels, reports, backups].map((directory) => mkdir(directory, { recursive: true })));
  const [disk, uploadsBytes, labelsBytes, reportsBytes, backupsBytes, databaseBytes, codeBytes, network] = await Promise.all([
    diskTotals(process.cwd()), directorySize(uploads), directorySize(labels), directorySize(reports), directorySize(backups), databaseSize(), directorySize(path.join(process.cwd(), ".next", "standalone")), networkTotals()
  ]);
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const memory = process.memoryUsage();
  const categorized = uploadsBytes + labelsBytes + reportsBytes + backupsBytes + databaseBytes + codeBytes;
  return {
    memory: { totalBytes, freeBytes, usedBytes, usedPercent: totalBytes ? Number((usedBytes / totalBytes * 100).toFixed(1)) : 0, processRssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
    disk,
    network,
    storage: { uploadsBytes, labelsBytes, reportsBytes, backupsBytes, databaseBytes, codeBytes, otherBytes: Math.max(0, disk.usedBytes - categorized) }
  };
}

export async function collectAndPersistServerMetrics() {
  if (process.env.SERVER_METRICS_ENABLED === "false") return null;
  const metrics = await collectServerMetricData();
  const snapshot = await prisma.serverMetricSnapshot.create({ data: { metrics: metrics as never } });
  const cutoff = new Date(Date.now() - SERVER_METRIC_RETENTION_HOURS * 60 * 60 * 1000);
  await Promise.all([
    prisma.serverMetricSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } }),
    prisma.storageEstimate.deleteMany({ where: { measuredAt: { lt: cutoff } } }),
    updateCollectionStorageEstimates()
  ]);
  const history = await prisma.serverMetricSnapshot.findMany({ where: { capturedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }, orderBy: { capturedAt: "asc" }, take: 12 });
  await evaluateServerIncidents(history);
  return snapshot;
}

export async function serverMetricHistory() {
  const cutoff = new Date(Date.now() - SERVER_METRIC_RETENTION_HOURS * 60 * 60 * 1000);
  return prisma.serverMetricSnapshot.findMany({ where: { capturedAt: { gte: cutoff } }, orderBy: { capturedAt: "asc" } });
}

export async function pathWritable(target: string) {
  try { await mkdir(target, { recursive: true }); await access(target, constants.W_OK); return true; } catch { return false; }
}

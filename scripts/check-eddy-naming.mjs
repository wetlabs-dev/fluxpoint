import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules", "coverage", "logs", "tmp", "test-results", "playwright-report"]);
const ignoredFiles = new Set(["tsconfig.tsbuildinfo"]);
const allowedHistoricalNote = path.normalize("docs/ai/eddy.md");
const stalePatterns = [
  "Current" + " Keeper",
  "Current" + "Keeper",
  "current" + "Keeper",
  "current-" + "keeper",
  "current_" + "keeper",
  "CURRENT_" + "KEEPER"
];

function walk(dir) {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      entries.push(...walk(fullPath));
    } else if (stats.isFile()) {
      entries.push(fullPath);
    }
  }
  return entries;
}

const failures = [];

for (const file of walk(root)) {
  const relative = path.relative(root, file);
  if (relative === allowedHistoricalNote) continue;
  if (ignoredFiles.has(path.basename(relative))) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of stalePatterns) {
    const index = text.indexOf(pattern);
    if (index === -1) continue;
    const line = text.slice(0, index).split("\n").length;
    failures.push(`${relative}:${line}: stale assistant name "${pattern}"`);
  }
}

if (failures.length) {
  console.error("Eddy naming check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Eddy naming check passed.");

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderManualMarkdown } from "./generate-user-manual";

const expected = renderManualMarkdown();
const repoRoot = process.cwd();
const outputs = [
  join(repoRoot, "docs", "USER_MANUAL.md"),
  join(repoRoot, "public", "manual", "USER_MANUAL.md")
];

const stale: string[] = [];

for (const output of outputs) {
  let actual = "";
  try {
    actual = readFileSync(output, "utf8");
  } catch {
    stale.push(`${output} (missing)`);
    continue;
  }
  if (actual !== expected) stale.push(output);
}

if (stale.length) {
  console.error("Fluxpoint user manual output is stale. Run `npm run docs:manual`.");
  for (const output of stale) console.error(`- ${output}`);
  process.exit(1);
}

console.log("Fluxpoint user manual output is current.");

import { readFileSync } from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const pageFiles = [
  "src/app/(app)/collection/page.tsx",
  "src/app/(app)/aquariums/page.tsx",
  "src/app/(app)/aquariums/[id]/page.tsx"
];

for (const file of pageFiles) {
  const source = readFileSync(file, "utf8");
  assert(!source.includes("ensureDefaultWaterSources"), `${file} must not reseed default water sources during normal page loads.`);
}

const creationFiles = [
  "src/lib/auth/session.ts",
  "src/domains/server/actions.ts",
  "src/domains/server/data-reset.ts",
  "scripts/bootstrap.ts"
];

for (const file of creationFiles) {
  const source = readFileSync(file, "utf8");
  assert(source.includes("ensureDefaultWaterSources"), `${file} should seed default water sources only when creating starter collections.`);
}

console.log("Water source deletion persistence checks passed.");

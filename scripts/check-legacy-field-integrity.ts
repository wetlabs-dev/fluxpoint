import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import { prisma } from "../src/lib/db/prisma";
async function main() {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  assert.equal(schema.includes("generatedName"), false, "generatedName returned to the Prisma schema.");
  const columns = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM information_schema.columns WHERE table_name = 'Aquarium' AND column_name = 'generatedName'`;
  assert.equal(Number(columns[0]?.count ?? 0), 0, "generatedName still exists in PostgreSQL.");
  const incompleteTargets = await prisma.aquarium.count({ where: { OR: [{ targetSalinityMinPpt: null }, { targetSalinityMaxPpt: null }] } });
  console.log(`Legacy-field integrity passed: generatedName removed; ${incompleteTargets} aquarium(s) still require legacy salinity compatibility and were intentionally retained.`);
}
main().finally(() => prisma.$disconnect());

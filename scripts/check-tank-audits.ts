import { auditGroupForItemType, canCancelTankAudit, canEditTankAudit, canFinalizeTankAudit } from "../src/domains/tank-audits/tank-audit-service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(auditGroupForItemType("FISH") === "Fish", "fish group failed");
assert(auditGroupForItemType("INVERT") === "Invertebrates", "invert group failed");
assert(auditGroupForItemType("PLANT") === "Plants", "plant group failed");
assert(auditGroupForItemType("EQUIPMENT") === "Equipment", "equipment group failed");
assert(auditGroupForItemType("SUBSTRATE") === "Hardscape / Substrate", "substrate group failed");
assert(auditGroupForItemType("OTHER") === "Other", "other group failed");
assert(canEditTankAudit("FISHKEEPER"), "fishkeepers should save observations");
assert(!canFinalizeTankAudit("FISHKEEPER"), "fishkeepers should not finalize");
assert(canFinalizeTankAudit("AQUARIST"), "aquarists should finalize");
assert(canCancelTankAudit("COLLECTION_OWNER"), "owners should cancel");
assert(!canCancelTankAudit("AQUARIST"), "aquarists should not cancel");

console.log("Tank audit workflow checks passed.");

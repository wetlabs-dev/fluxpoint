import { activeConditionStatuses, conditionCategories, conditionEntityTypes, conditionSeverities, conditionStatuses, conditionTypesByCategory, severityPriority } from "../src/domains/conditions/condition-catalog";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

assert(conditionStatuses.includes("RESOLVED"), "Resolved conditions must remain a durable status.");
assert(!activeConditionStatuses.includes("RESOLVED"), "Resolved conditions must not appear in the active scope.");
assert(conditionEntityTypes.includes("AQUARIUM") && conditionEntityTypes.includes("EQUIPMENT") && conditionEntityTypes.includes("FISH") && conditionEntityTypes.includes("PLANT") && conditionEntityTypes.includes("CORAL"), "Required entity scopes are missing.");
assert(conditionCategories.includes("DISEASE") && conditionCategories.includes("ALGAE") && conditionCategories.includes("EQUIPMENT"), "Required categories are missing.");
assert(conditionSeverities.length === 5 && severityPriority("CRITICAL") === "CRITICAL" && severityPriority("HIGH") === "HIGH", "Severity-to-task priority mapping is invalid.");
assert(conditionTypesByCategory.ALGAE.includes("Cyanobacteria"), "Starter taxonomy is missing cyanobacteria.");
assert(conditionTypesByCategory.PARASITE.includes("Ich / white spot"), "Starter taxonomy is missing ich / white spot.");
assert(conditionTypesByCategory.EQUIPMENT.includes("Heater drift"), "Starter taxonomy is missing heater drift.");

console.log("Health condition taxonomy, lifecycle, entity, and priority checks passed.");

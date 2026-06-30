import assert from "node:assert/strict";
import { readFile } from "fs/promises";
import { defaultBreedingStages, breedingProjectTypes, breedingObservationTypes } from "../src/domains/breeding/catalog";

async function main() {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  for (const model of ["BreedingProject", "BreedingParent", "BreedingCohort", "BreedingObservation", "BreedingTraitObservation", "BreedingGoal", "BreedingMeasurement", "BreedingPhoto", "BreedingMilestone", "BreedingSummary", "SpeciesTrait"]) {
    assert.ok(schema.includes(`model ${model}`), `${model} must exist in Prisma schema.`);
  }
  for (const enumName of ["BreedingProjectType", "BreedingProjectStatus", "BreedingParentRole", "BreedingQuantityType", "BreedingObservationType"]) {
    assert.ok(schema.includes(`enum ${enumName}`), `${enumName} must exist in Prisma schema.`);
  }
  assert.deepEqual(breedingProjectTypes, ["MANAGED", "OPPORTUNISTIC", "COMMUNITY", "PROPAGATION"]);
  assert.ok(breedingObservationTypes.includes("SPAWN") && breedingObservationTypes.includes("TRAIT") && breedingObservationTypes.includes("MEASUREMENT"));
  assert.ok(defaultBreedingStages.fish.includes("FREE_SWIMMING"));
  assert.ok(defaultBreedingStages.propagation.includes("ROOTING"));
  assert.ok(schema.includes("originBreedingProjectId"), "Graduated inventory must retain project origin.");
  assert.ok(schema.includes("breedingProjectId") && schema.includes("CareTask"), "Breeding care tasks must be linkable.");
  assert.ok(schema.includes("workflowRunId"), "Breeding projects must attach workflow runs.");
  assert.ok(schema.includes("BREEDING"), "Breeding timeline event type must exist.");

  const actions = await readFile(new URL("../src/domains/breeding/actions.ts", import.meta.url), "utf8");
  for (const action of ["createBreedingProject", "addBreedingObservation", "graduateBreedingCohort", "attachBreedingWorkflow", "saveBreedingSummary"]) {
    assert.ok(actions.includes(`export async function ${action}`), `${action} action must exist.`);
  }
  assert.ok(actions.includes("BREEDING_COHORT_GRADUATED_TO_INVENTORY"), "Graduation must be audited.");
  assert.ok(actions.includes("createBreedingEvent"), "Observations should create aquarium timeline events.");

  const nav = await readFile(new URL("../src/components/layout/app-shell.tsx", import.meta.url), "utf8");
  assert.ok(nav.includes('href: "/breeding"'), "Top-level Breeding nav item must exist.");

  const docs = await readFile(new URL("../docs/product/breeding-projects.md", import.meta.url), "utf8");
  assert.ok(docs.includes("does not calculate inheritance"), "Docs must state the non-genetics scope.");
  assert.ok(docs.includes("Community projects never require"), "Docs must cover community breeding.");

  console.log("Breeding Projects schema, actions, navigation, and docs checks passed.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

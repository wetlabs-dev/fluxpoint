import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editableWorkflowStepTypes, workflowStepTypeRegistry } from "../src/domains/workflows/step-types";
import { starterWorkflowTemplates } from "../src/domains/workflows/defaults";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const worker = readFileSync("src/domains/notifications/alert-producers.ts", "utf8");
const page = readFileSync("src/app/(app)/workflows/page.tsx", "utf8");
const runPage = readFileSync("src/app/(app)/workflows/runs/[id]/page.tsx", "utf8");

for (const type of editableWorkflowStepTypes) assert.ok(workflowStepTypeRegistry[type], `missing workflow step registry entry for ${type}`);
assert.ok(starterWorkflowTemplates.some((template) => template.name === "Brine Shrimp Hatch"), "missing Brine Shrimp Hatch starter workflow");
assert.match(schema, /model WorkflowNotification/);
assert.match(schema, /WORKFLOW_REMINDER/);
assert.match(worker, /processDueWorkflowNotifications/);
assert.match(page, /Create workflow template/);
assert.match(page, /Re-add default workflows/);
assert.match(runPage, /Scheduled alerts/);
assert.match(runPage, /Complete step/);

console.log("Fluxpoint workflow builder checks passed.");

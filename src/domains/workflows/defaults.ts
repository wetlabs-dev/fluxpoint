import { Prisma, type PrismaClient, type WorkflowCategory, type WorkflowStepType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type StarterWorkflowStep = {
  title: string;
  description?: string;
  stepType: WorkflowStepType;
  waitAfterPreviousMinutes?: number;
  alertOffsetMinutes?: number;
  alertChannels?: string[];
  config?: Record<string, unknown>;
};

export type StarterWorkflowTemplate = {
  name: string;
  description: string;
  category: WorkflowCategory;
  defaultDurationMinutes?: number;
  steps: StarterWorkflowStep[];
};

export const starterWorkflowTemplates: StarterWorkflowTemplate[] = [
  {
    name: "Brine Shrimp Hatch",
    description: "A reusable hatch-and-harvest workflow for small live food batches.",
    category: "CUSTOM",
    defaultDurationMinutes: 36 * 60,
    steps: [
      { title: "Prepare hatch vessel", description: "Fill the vessel with saltwater, add aeration, and confirm temperature is stable.", stepType: "CHECKLIST", config: { items: ["Saltwater mixed", "Aeration running", "Temperature checked"] } },
      { title: "Add cysts", description: "Add cysts and note the approximate amount used.", stepType: "LOG_EVENT", config: { eventTitle: "Brine shrimp cysts added" } },
      { title: "Wait for hatch", description: "Let the culture hatch before harvest.", stepType: "WAIT", waitAfterPreviousMinutes: 24 * 60, alertOffsetMinutes: 0, alertChannels: ["EMAIL", "PUSH"] },
      { title: "Check hatch density", description: "Confirm nauplii are visible and active.", stepType: "MEASUREMENT", config: { measurementLabel: "Hatch density", unit: "notes" } },
      { title: "Harvest and rinse", description: "Harvest nauplii, rinse, feed, and clean the vessel if the batch is complete.", stepType: "CHECKLIST", config: { items: ["Harvested", "Rinsed", "Fed or stored", "Vessel cleaned"] } }
    ]
  }
];

export async function ensureDefaultWorkflowTemplates(collectionId: string, createdById?: string, db: PrismaClient = prisma) {
  const results = [];
  for (const template of starterWorkflowTemplates) {
    const existing = await db.workflowTemplate.findFirst({ where: { collectionId, name: template.name, isSystem: true } });
    if (existing) {
      results.push(existing);
      continue;
    }
    const created = await db.workflowTemplate.create({
      data: {
        collectionId,
        name: template.name,
        description: template.description,
        category: template.category,
        isSystem: true,
        defaultDurationMinutes: template.defaultDurationMinutes,
        createdById,
        steps: {
          create: template.steps.map((step, index) => ({
            order: index + 1,
            sortOrder: index + 1,
            title: step.title,
            description: step.description,
            stepType: step.stepType,
            config: step.config ? JSON.parse(JSON.stringify(step.config)) as Prisma.InputJsonValue : undefined,
            waitAfterPreviousMinutes: step.waitAfterPreviousMinutes,
            alertOffsetMinutes: step.alertOffsetMinutes,
            alertChannels: step.alertChannels ? JSON.parse(JSON.stringify(step.alertChannels)) as Prisma.InputJsonValue : undefined
          }))
        }
      }
    });
    results.push(created);
  }
  return results;
}

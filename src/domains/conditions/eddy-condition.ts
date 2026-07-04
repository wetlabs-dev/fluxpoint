import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { auditCollectionAction } from "@/domains/audit/audit-service";

export type EddyConditionResult = { summary: string; checklist: string[]; investigate: string[]; followUpCadence: string; safetyNote: string };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "checklist", "investigate", "followUpCadence", "safetyNote"],
  properties: {
    summary: { type: "string" },
    checklist: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
    investigate: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    followUpCadence: { type: "string" },
    safetyNote: { type: "string" }
  }
} as const;

function clean(value: unknown, fallback: EddyConditionResult): EddyConditionResult {
  if (!value || typeof value !== "object") return fallback;
  const result = value as Partial<EddyConditionResult>;
  return { summary: String(result.summary || fallback.summary), checklist: Array.isArray(result.checklist) ? result.checklist.slice(0, 8).map(String) : fallback.checklist, investigate: Array.isArray(result.investigate) ? result.investigate.slice(0, 6).map(String) : fallback.investigate, followUpCadence: String(result.followUpCadence || fallback.followUpCadence), safetyNote: String(result.safetyNote || fallback.safetyNote) };
}

export async function reviewConditionWithEddy(input: { conditionId: string; userId: string; collectionId: string }) {
  const condition = await prisma.healthCondition.findFirst({ where: { id: input.conditionId, collectionId: input.collectionId }, include: { aquarium: { select: { name: true, salinity: true, volumeGallons: true } }, observations: { orderBy: { observedAt: "desc" }, take: 8 }, careTasks: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 5 }, medicationCourses: { include: { medicationDefinition: { select: { name: true } } }, orderBy: { startedAt: "desc" }, take: 3 } } });
  if (!condition) throw new Error("Condition not found.");
  const status = aiProviderStatus();
  const fallback: EddyConditionResult = {
    summary: `${condition.title} is recorded as ${condition.status.toLowerCase()} with ${condition.severity.toLowerCase()} severity. Keep observations factual and compare changes over time.`,
    checklist: ["Record the affected count and visible signs consistently.", "Check recent water parameters and equipment operation before changing the plan.", "Photograph the same view or affected area when useful for comparison."],
    investigate: [condition.suspectedCause ? `Re-check the recorded possibility: ${condition.suspectedCause}` : "Review changes in livestock, plants, food, equipment, maintenance, and water over the prior 72 hours."],
    followUpCadence: condition.severity === "CRITICAL" || condition.severity === "HIGH" ? "Observe promptly and log another check within 12–24 hours, or sooner if signs worsen." : "Log a comparable observation in 2–3 days, or sooner if signs change.",
    safetyNote: "This is an observation aid, not a diagnosis or prescription. For severe distress, rapid losses, breathing difficulty, or uncertainty about treatment, contact an aquatic veterinarian or qualified local specialist. Never release aquarium organisms into the wild."
  };
  const log = await prisma.aiRequestLog.create({ data: { collectionId: input.collectionId, aquariumId: condition.aquariumId, userId: input.userId, requestType: "TROUBLESHOOTING", featureKey: "CONDITION_REVIEW", provider: status.provider, model: status.responsesModel, promptSummary: `Condition review: ${condition.title}`.slice(0, 240), input: { conditionId: condition.id, category: condition.category, severity: condition.severity, status: condition.status } } });
  await auditCollectionAction({ collectionId: input.collectionId, entityType: "HealthCondition", entityId: condition.id, action: "EDDY_CONDITION_TOOL_REQUESTED", summary: `Eddy condition review requested for ${condition.title}`, actorUserId: input.userId, metadata: { aiRequestLogId: log.id, featureKey: "CONDITION_REVIEW" } });
  try {
    const usage = await incrementEddyUsage({ userId: input.userId, collectionId: input.collectionId, featureKey: "CONDITION_REVIEW", requestLogId: log.id });
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    let result = fallback;
    let tokensInput: number | null = null;
    let tokensOutput: number | null = null;
    if (status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY) {
      const context = { title: condition.title, type: condition.conditionType, category: condition.category, status: condition.status, severity: condition.severity, firstObservedAt: condition.firstObservedAt, affectedCount: condition.affectedCount, affectedCountLabel: condition.affectedCountLabel, summary: condition.summary, suspectedCause: condition.suspectedCause, actionPlan: condition.actionPlan, aquarium: condition.aquarium, recentObservations: condition.observations.map((entry) => ({ observedAt: entry.observedAt, status: entry.status, severity: entry.severity, affectedCount: entry.affectedCount, notes: entry.notes })), openFollowUps: condition.careTasks.map((entry) => ({ title: entry.title, dueAt: entry.dueAt })), medications: condition.medicationCourses.map((entry) => ({ title: entry.title, product: entry.medicationDefinition.name, status: entry.status, notes: entry.notes })) };
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini", input: [{ role: "system", content: "You are Eddy, Fluxpoint's aquarium operations assistant. Use only the supplied user record. Summarize observations without diagnosing disease, claiming certainty, or prescribing medication. Suggest what to observe and causes to investigate, not conclusions. Respect user-entered medication labels and doses without changing them. Mention an aquatic veterinarian or qualified local specialist for severe distress, rapid losses, or breathing difficulty. Always say never to release organisms into the wild when biosecurity is relevant." }, { role: "user", content: `Review this condition record and produce a conservative observation checklist:\n${JSON.stringify(context)}` }], text: { format: { type: "json_schema", name: "fluxpoint_condition_review", strict: true, schema } } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Eddy provider request failed.");
      const outputText = payload.output_text ?? payload.output?.flatMap((entry: any) => entry.content ?? []).find((entry: any) => entry.type === "output_text")?.text;
      if (!outputText) throw new Error("Eddy returned no condition review.");
      result = clean(JSON.parse(outputText), fallback);
      tokensInput = Number(payload.usage?.input_tokens ?? 0) || null;
      tokensOutput = Number(payload.usage?.output_tokens ?? 0) || null;
    }
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result, tokensInput, tokensOutput, completedAt: new Date() } });
    return { ...result, usage };
  } catch (error) {
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() } });
    throw error;
  }
}

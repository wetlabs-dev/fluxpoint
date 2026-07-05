import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, collectionOwnerRoles, requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";
import type { EmergencyIncidentStatus, EmergencyPhase, EmergencySeverity, EmergencyStepStatus, EmergencyType } from "@prisma/client";

export const emergencyTypes: EmergencyType[] = [
  "POWER_OUTAGE",
  "TANK_LEAK",
  "TANK_BREAK",
  "FILTER_FAILURE",
  "HEATER_FAILURE",
  "CHILLER_FAILURE",
  "AIR_PUMP_FAILURE",
  "CO2_OVERDOSE",
  "OXYGEN_CRASH",
  "AMMONIA_SPIKE",
  "NITRITE_SPIKE",
  "TEMPERATURE_SPIKE",
  "TEMPERATURE_DROP",
  "CONTAMINATION",
  "DISEASE_OUTBREAK",
  "FLOOD",
  "OTHER"
];

export const emergencySeverities: EmergencySeverity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
export const emergencyStatuses: EmergencyIncidentStatus[] = ["ACTIVE", "STABILIZING", "RECOVERING", "VERIFYING", "RESOLVED", "CANCELLED"];
export const emergencyPhases: EmergencyPhase[] = ["IMMEDIATE", "STABILIZATION", "RECOVERY", "VERIFICATION"];

type StepTemplate = {
  title: string;
  description?: string | null;
  dueOffsetMinutes?: number | null;
  alert?: boolean;
  important?: boolean;
};

const defaultPlans: Array<{
  title: string;
  emergencyType: EmergencyType;
  severityDefault: EmergencySeverity;
  description: string;
  supplies: string[];
  immediateSteps: StepTemplate[];
  stabilizationSteps: StepTemplate[];
  recoverySteps: StepTemplate[];
  verificationSteps: StepTemplate[];
}> = [
  {
    title: "Power outage plan",
    emergencyType: "POWER_OUTAGE",
    severityDefault: "HIGH",
    description: "Keep oxygenation and temperature stable while preserving filtration biology until power returns.",
    supplies: ["Battery air pump", "Air stones", "Insulating towels or foam", "USB battery packs", "Flashlight"],
    immediateSteps: [
      { title: "Confirm outage and estimated restoration time.", important: true },
      { title: "Stop feeding.", description: "Avoid adding waste while filtration and oxygenation are limited." },
      { title: "Preserve oxygenation with battery air pump.", dueOffsetMinutes: 15, alert: true, important: true },
      { title: "Keep filters wet.", description: "Do not let biological media dry out." },
      { title: "Avoid opening lids unnecessarily." }
    ],
    stabilizationSteps: [
      { title: "Add battery air to priority tanks.", dueOffsetMinutes: 120, alert: true },
      { title: "Monitor temperature.", dueOffsetMinutes: 180, alert: true },
      { title: "Insulate tanks if needed." },
      { title: "Rotate battery air if supplies are limited." }
    ],
    recoverySteps: [
      { title: "Restore filtration.", important: true },
      { title: "Check heater/controller operation." },
      { title: "Observe livestock behavior.", dueOffsetMinutes: 360, alert: true },
      { title: "Resume lights gradually if needed." }
    ],
    verificationSteps: [
      { title: "Test ammonia/nitrite.", dueOffsetMinutes: 720, alert: true, important: true },
      { title: "Confirm temperature stability.", dueOffsetMinutes: 1440, alert: true },
      { title: "Check filters restarted." },
      { title: "Observe fish for stress for 24–48 hours.", dueOffsetMinutes: 2880, alert: true }
    ]
  },
  {
    title: "Filter failure",
    emergencyType: "FILTER_FAILURE",
    severityDefault: "HIGH",
    description: "Protect oxygenation and biological media while restoring or replacing filtration.",
    supplies: ["Battery air pump", "Spare sponge filter", "Dechlorinated water", "Bucket for wet media"],
    immediateSteps: [
      { title: "Confirm the filter is stopped or underperforming.", important: true },
      { title: "Keep biological media wet in tank water." },
      { title: "Add extra aeration.", dueOffsetMinutes: 15, alert: true }
    ],
    stabilizationSteps: [
      { title: "Install backup filtration or air-driven sponge.", dueOffsetMinutes: 60, alert: true },
      { title: "Reduce feeding until stable." },
      { title: "Inspect impeller, tubing, intake, and power." }
    ],
    recoverySteps: [
      { title: "Restore normal filtration.", important: true },
      { title: "Seed replacement media from existing wet media if safe." }
    ],
    verificationSteps: [
      { title: "Test ammonia and nitrite.", dueOffsetMinutes: 720, alert: true },
      { title: "Verify flow remains stable tomorrow.", dueOffsetMinutes: 1440, alert: true }
    ]
  },
  {
    title: "Heater failure",
    emergencyType: "HEATER_FAILURE",
    severityDefault: "HIGH",
    description: "Stop dangerous temperature drift and verify stable heating or cooling.",
    supplies: ["Backup heater", "Thermometer", "Controller", "Insulating wrap"],
    immediateSteps: [
      { title: "Unplug unsafe heater if stuck on or visibly damaged.", important: true },
      { title: "Confirm actual water temperature with a second thermometer." },
      { title: "Protect livestock from rapid temperature swings." }
    ],
    stabilizationSteps: [
      { title: "Install backup heater/controller if temperature is dropping.", dueOffsetMinutes: 60, alert: true },
      { title: "Increase aeration if overheating." }
    ],
    recoverySteps: [
      { title: "Replace failed heater before returning to normal operation." },
      { title: "Review controller alarm thresholds." }
    ],
    verificationSteps: [
      { title: "Confirm temperature stability over several hours.", dueOffsetMinutes: 360, alert: true },
      { title: "Recheck livestock behavior tomorrow.", dueOffsetMinutes: 1440, alert: true }
    ]
  },
  {
    title: "Tank leak",
    emergencyType: "TANK_LEAK",
    severityDefault: "CRITICAL",
    description: "Protect people, electricity, livestock, and property while moving water and animals safely.",
    supplies: ["Towels", "Buckets", "Spare tank or tote", "Battery air pump", "Power strip safety access"],
    immediateSteps: [
      { title: "Keep people safe around water and electricity.", description: "Do not touch wet electrical equipment; cut power at a safe dry switch if needed.", important: true },
      { title: "Contain water with towels or bins." },
      { title: "Prepare emergency holding container with aeration.", dueOffsetMinutes: 15, alert: true }
    ],
    stabilizationSteps: [
      { title: "Move livestock only if the tank is structurally unsafe or water loss continues." },
      { title: "Keep filter media wet and aerated." }
    ],
    recoverySteps: [
      { title: "Move hardscape and equipment safely after power is isolated." },
      { title: "Do not refill a structurally compromised tank." }
    ],
    verificationSteps: [
      { title: "Verify livestock are stable in holding setup.", dueOffsetMinutes: 120, alert: true },
      { title: "Check ammonia/nitrite in holding water.", dueOffsetMinutes: 720, alert: true }
    ]
  },
  {
    title: "Ammonia spike",
    emergencyType: "AMMONIA_SPIKE",
    severityDefault: "HIGH",
    description: "Reduce toxic ammonia exposure and identify the source without overcorrecting.",
    supplies: ["Ammonia test", "Dechlorinator/ammonia binder", "Prepared water", "Siphon"],
    immediateSteps: [
      { title: "Confirm ammonia with a reliable test.", important: true },
      { title: "Stop feeding temporarily." },
      { title: "Increase aeration." }
    ],
    stabilizationSteps: [
      { title: "Perform a controlled water change if safe for inhabitants.", dueOffsetMinutes: 60, alert: true },
      { title: "Use conditioner/binder only according to label directions." }
    ],
    recoverySteps: [
      { title: "Look for dead livestock, decaying plant matter, or filter disruption." },
      { title: "Resume feeding slowly after readings stabilize." }
    ],
    verificationSteps: [
      { title: "Retest ammonia and nitrite.", dueOffsetMinutes: 360, alert: true },
      { title: "Retest again tomorrow.", dueOffsetMinutes: 1440, alert: true }
    ]
  },
  {
    title: "CO₂ overdose",
    emergencyType: "CO2_OVERDOSE",
    severityDefault: "CRITICAL",
    description: "Restore oxygenation and raise gas exchange quickly while avoiding unsafe electrical handling.",
    supplies: ["Air pump", "Air stone", "pH test", "Surface agitation"],
    immediateSteps: [
      { title: "Stop CO₂ injection.", important: true },
      { title: "Increase surface agitation and aeration immediately.", dueOffsetMinutes: 5, alert: true, important: true },
      { title: "Observe fish breathing and behavior." }
    ],
    stabilizationSteps: [
      { title: "Test pH and compare to normal range." },
      { title: "Keep lights/CO₂ off until livestock recover." }
    ],
    recoverySteps: [
      { title: "Inspect regulator, solenoid, timer, and diffuser." },
      { title: "Restart CO₂ conservatively only after stability returns." }
    ],
    verificationSteps: [
      { title: "Confirm normal breathing and behavior.", dueOffsetMinutes: 120, alert: true },
      { title: "Recheck pH before restarting CO₂.", dueOffsetMinutes: 1440, alert: true }
    ]
  }
];

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  const text = String(value ?? "");
  return allowed.includes(text as T) ? text as T : fallback;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStepLines(value: string | null): StepTemplate[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, description, offset, alert] = line.split("|").map((part) => part.trim());
      const dueOffsetMinutes = offset && Number.isFinite(Number(offset)) ? Math.max(0, Math.round(Number(offset))) : null;
      return { title, description: description || null, dueOffsetMinutes, alert: ["alert", "true", "yes", "1"].includes((alert || "").toLowerCase()) };
    });
}

function stepLines(steps: unknown) {
  return Array.isArray(steps) ? steps.map((step: any) => [step.title, step.description, step.dueOffsetMinutes, step.alert ? "alert" : ""].filter((value) => value !== null && value !== undefined && value !== "").join(" | ")).join("\n") : "";
}

function safeJsonSteps(value: unknown): StepTemplate[] {
  if (!Array.isArray(value)) return [];
  return value.map((step: any) => ({
    title: String(step?.title ?? "").trim(),
    description: step?.description ? String(step.description) : null,
    dueOffsetMinutes: Number.isFinite(Number(step?.dueOffsetMinutes)) ? Math.max(0, Math.round(Number(step.dueOffsetMinutes))) : null,
    alert: Boolean(step?.alert),
    important: Boolean(step?.important)
  })).filter((step) => step.title);
}

function statusPhase(status: EmergencyIncidentStatus): EmergencyPhase {
  if (status === "STABILIZING") return "STABILIZATION";
  if (status === "RECOVERING") return "RECOVERY";
  if (status === "VERIFYING") return "VERIFICATION";
  return "IMMEDIATE";
}

function dueDate(startedAt: Date, step: StepTemplate) {
  return step.dueOffsetMinutes == null ? null : new Date(startedAt.getTime() + step.dueOffsetMinutes * 60_000);
}

async function getCollection(allowedRoles = careRoles) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, allowedRoles);
  return { user, collection };
}

export function formatEmergencyLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function ensureDefaultEmergencyPlans(collectionId: string, createdById?: string | null) {
  for (const plan of defaultPlans) {
    const existing = await prisma.emergencyPlan.findFirst({ where: { collectionId, title: plan.title } });
    if (existing) continue;
    await prisma.emergencyPlan.create({
      data: {
        collectionId,
        title: plan.title,
        emergencyType: plan.emergencyType,
        severityDefault: plan.severityDefault,
        description: plan.description,
        immediateSteps: plan.immediateSteps as never,
        stabilizationSteps: plan.stabilizationSteps as never,
        recoverySteps: plan.recoverySteps as never,
        verificationSteps: plan.verificationSteps as never,
        supplies: plan.supplies as never,
        notes: "Starter Fluxpoint emergency plan. Customize before relying on it.",
        createdById
      }
    });
  }
}

export function planTextareas(plan: { immediateSteps: unknown; stabilizationSteps: unknown; recoverySteps: unknown; verificationSteps: unknown }) {
  return {
    immediateSteps: stepLines(plan.immediateSteps),
    stabilizationSteps: stepLines(plan.stabilizationSteps),
    recoverySteps: stepLines(plan.recoverySteps),
    verificationSteps: stepLines(plan.verificationSteps)
  };
}

export async function saveEmergencyPlan(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(collectionOwnerRoles);
  const id = text(formData, "id");
  const data = {
    collectionId: collection.id,
    title: text(formData, "title") ?? "Emergency plan",
    emergencyType: enumValue(formData.get("emergencyType"), emergencyTypes, "OTHER"),
    severityDefault: enumValue(formData.get("severityDefault"), emergencySeverities, "MODERATE"),
    description: text(formData, "description"),
    immediateSteps: parseStepLines(text(formData, "immediateSteps")) as never,
    stabilizationSteps: parseStepLines(text(formData, "stabilizationSteps")) as never,
    recoverySteps: parseStepLines(text(formData, "recoverySteps")) as never,
    verificationSteps: parseStepLines(text(formData, "verificationSteps")) as never,
    supplies: (text(formData, "supplies")?.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean) ?? []) as never,
    notes: text(formData, "notes")
  };
  const before = id ? await prisma.emergencyPlan.findFirstOrThrow({ where: { id, collectionId: collection.id } }) : null;
  const plan = id
    ? await prisma.emergencyPlan.update({ where: { id }, data })
    : await prisma.emergencyPlan.create({ data: { ...data, createdById: user.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyPlan", entityId: plan.id, action: id ? "EMERGENCY_PLAN_UPDATED" : "EMERGENCY_PLAN_CREATED", before, after: plan, createdById: user.id });
  revalidatePath("/emergency-response");
  await setFormFlash(`${id ? "Updated" : "Created"} emergency plan: ${plan.title}.`);
}

export async function archiveEmergencyPlan(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(collectionOwnerRoles);
  const id = String(formData.get("id"));
  const before = await prisma.emergencyPlan.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const plan = await prisma.emergencyPlan.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyPlan", entityId: id, action: "EMERGENCY_PLAN_ARCHIVED", before, after: plan, createdById: user.id });
  revalidatePath("/emergency-response");
  await setFormFlash(`Archived emergency plan: ${plan.title}.`);
}

async function createIncidentCareTask(input: { collectionId: string; aquariumId: string | null; incidentTitle: string; stepId: string; title: string; description: string | null; dueAt: Date }) {
  const schedule = await prisma.careSchedule.create({
    data: {
      collectionId: input.collectionId,
      aquariumId: input.aquariumId,
      name: `Emergency: ${input.title}`,
      description: `Emergency response for ${input.incidentTitle}${input.description ? ` — ${input.description}` : ""}`,
      scheduleType: "OTHER",
      cadenceType: "CUSTOM",
      startDate: input.dueAt,
      nextDueAt: input.dueAt,
      enabled: true
    }
  });
  return prisma.careTask.create({
    data: {
      careScheduleId: schedule.id,
      aquariumId: input.aquariumId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      priority: "CRITICAL",
      emergencyIncidentStepId: input.stepId
    }
  });
}

export async function startEmergencyIncident(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(careRoles);
  const planId = text(formData, "emergencyPlanId");
  const plan = planId ? await prisma.emergencyPlan.findFirst({ where: { id: planId, collectionId: collection.id } }) : null;
  const startedAt = parseDate(text(formData, "startedAt")) ?? new Date();
  const selectedAquariumIds = [...new Set(formData.getAll("aquariumIds").map((value) => String(value)).filter(Boolean))];
  if (selectedAquariumIds.length) {
    const count = await prisma.aquarium.count({ where: { collectionId: collection.id, id: { in: selectedAquariumIds } } });
    if (count !== selectedAquariumIds.length) throw new Error("Choose aquariums owned by this collection.");
  }
  const emergencyType = enumValue(formData.get("emergencyType"), emergencyTypes, plan?.emergencyType ?? "OTHER");
  const severity = enumValue(formData.get("severity"), emergencySeverities, plan?.severityDefault ?? "MODERATE");
  const title = text(formData, "title") ?? `${formatEmergencyLabel(emergencyType)} — ${startedAt.toLocaleDateString()}`;
  const initialNotes = text(formData, "initialNotes");
  const incident = await prisma.emergencyIncident.create({
    data: {
      collectionId: collection.id,
      emergencyPlanId: plan?.id ?? null,
      title,
      emergencyType,
      severity,
      startedAt,
      createdById: user.id,
      summary: initialNotes,
      aquariums: { create: selectedAquariumIds.map((aquariumId) => ({ collectionId: collection.id, aquariumId, severity })) },
      logs: initialNotes ? { create: { collectionId: collection.id, logType: "NOTE", message: initialNotes, createdById: user.id, loggedAt: startedAt } } : undefined
    }
  });

  const phaseSteps: Array<[EmergencyPhase, StepTemplate[]]> = plan ? [
    ["IMMEDIATE", safeJsonSteps(plan.immediateSteps)],
    ["STABILIZATION", safeJsonSteps(plan.stabilizationSteps)],
    ["RECOVERY", safeJsonSteps(plan.recoverySteps)],
    ["VERIFICATION", safeJsonSteps(plan.verificationSteps)]
  ] : [["IMMEDIATE", [{ title: `Respond to ${formatEmergencyLabel(emergencyType)}`, description: "Stabilize oxygenation, temperature, water quality, and safety first.", dueOffsetMinutes: 0, alert: true, important: true }]]];

  let sortOrder = 0;
  for (const [phase, steps] of phaseSteps) {
    for (const step of steps) {
      sortOrder += 10;
      const dueAt = dueDate(startedAt, step);
      const created = await prisma.emergencyIncidentStep.create({
        data: {
          collectionId: collection.id,
          incidentId: incident.id,
          phase,
          sortOrder,
          title: step.title,
          description: step.description,
          dueAt
        }
      });
      if (dueAt && step.alert) await createIncidentCareTask({ collectionId: collection.id, aquariumId: selectedAquariumIds[0] ?? null, incidentTitle: title, stepId: created.id, title: created.title, description: created.description, dueAt });
    }
  }

  for (const aquariumId of selectedAquariumIds) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "OTHER",
        title: `Emergency started: ${title}`,
        summary: `${formatEmergencyLabel(emergencyType)} · ${severity.toLowerCase()} severity`,
        notes: initialNotes,
        metadata: { emergencyIncidentId: incident.id, emergencyType, severity, major: true },
        eventDate: startedAt,
        createdById: user.id
      }
    });
  }

  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyIncident", entityId: incident.id, action: "EMERGENCY_INCIDENT_STARTED", after: { ...incident, aquariumIds: selectedAquariumIds }, createdById: user.id, severity: severity === "CRITICAL" ? "CRITICAL" : severity === "HIGH" ? "WARNING" : "INFO" });
  revalidatePath("/emergency-response");
  revalidatePath("/dashboard");
  for (const aquariumId of selectedAquariumIds) revalidatePath(`/aquariums/${aquariumId}`);
  await setFormFlash(`Started emergency response: ${title}.`);
}

export async function updateEmergencyIncidentStatus(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const status = enumValue(formData.get("status"), emergencyStatuses, "ACTIVE");
  const before = await prisma.emergencyIncident.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { aquariums: true } });
  const now = new Date();
  const data: any = { status };
  if (status === "STABILIZING" && !before.stabilizedAt) data.stabilizedAt = now;
  if (status === "RECOVERING" && !before.recoveryStartedAt) data.recoveryStartedAt = now;
  if (status === "VERIFYING" && !before.verificationStartedAt) data.verificationStartedAt = now;
  if (status === "RESOLVED") {
    data.resolvedAt = now;
    data.outcomeNotes = text(formData, "outcomeNotes") ?? before.outcomeNotes;
    data.rootCause = text(formData, "rootCause") ?? before.rootCause;
  }
  const incident = await prisma.emergencyIncident.update({ where: { id }, data, include: { aquariums: true } });
  await prisma.emergencyIncidentLog.create({ data: { collectionId: collection.id, incidentId: id, logType: "STATUS_CHANGE", message: `Status changed to ${formatEmergencyLabel(status)}.`, metadata: { from: before.status, to: status }, createdById: user.id } });
  for (const linked of before.aquariums) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: linked.aquariumId,
        eventType: "OTHER",
        title: status === "RESOLVED" ? `Emergency resolved: ${before.title}` : `Emergency phase changed: ${before.title}`,
        summary: `Emergency response is now ${formatEmergencyLabel(status)}.`,
        notes: status === "RESOLVED" ? data.outcomeNotes : null,
        metadata: { emergencyIncidentId: id, status, phase: statusPhase(status), major: true },
        createdById: user.id
      }
    });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyIncident", entityId: id, action: status === "RESOLVED" ? "EMERGENCY_INCIDENT_RESOLVED" : "EMERGENCY_INCIDENT_STATUS_CHANGED", before, after: incident, createdById: user.id, severity: before.severity === "CRITICAL" ? "CRITICAL" : "INFO" });
  revalidatePath("/emergency-response");
  revalidatePath("/dashboard");
  for (const linked of before.aquariums) revalidatePath(`/aquariums/${linked.aquariumId}`);
  await setFormFlash(status === "RESOLVED" ? `Resolved emergency: ${incident.title}.` : `Moved ${incident.title} to ${formatEmergencyLabel(status)}.`);
}

export async function updateEmergencyStepStatus(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const status = enumValue(formData.get("status"), ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"] as const, "PENDING") as EmergencyStepStatus;
  const before = await prisma.emergencyIncidentStep.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { incident: { include: { aquariums: true } }, careTask: true } });
  const step = await prisma.emergencyIncidentStep.update({
    where: { id },
    data: {
      status,
      notes: text(formData, "notes") ?? before.notes,
      completedAt: status === "DONE" || status === "SKIPPED" ? new Date() : null,
      completedById: status === "DONE" || status === "SKIPPED" ? user.id : null
    }
  });
  if (before.careTask && (status === "DONE" || status === "SKIPPED")) {
    await prisma.careTask.update({ where: { id: before.careTask.id }, data: { status: status === "DONE" ? "COMPLETED" : "SKIPPED", completedAt: status === "DONE" ? new Date() : null, skippedAt: status === "SKIPPED" ? new Date() : null, completedById: user.id } });
  }
  if (status === "DONE" || status === "SKIPPED") {
    await prisma.emergencyIncidentLog.create({ data: { collectionId: collection.id, incidentId: before.incidentId, logType: "ACTION", message: `${status === "DONE" ? "Completed" : "Skipped"}: ${before.title}`, createdById: user.id } });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyIncidentStep", entityId: id, action: status === "DONE" || status === "SKIPPED" ? `EMERGENCY_STEP_${status}` : "EMERGENCY_STEP_STATUS_CHANGED", before, after: step, createdById: user.id, severity: before.incident.severity === "CRITICAL" && (status === "DONE" || status === "SKIPPED") ? "WARNING" : "INFO" });
  revalidatePath("/emergency-response");
  revalidatePath("/dashboard");
  for (const linked of before.incident.aquariums) revalidatePath(`/aquariums/${linked.aquariumId}`);
  await setFormFlash(`${formatEmergencyLabel(status)}: ${before.title}.`);
}

export async function addEmergencyLog(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(careRoles);
  const incidentId = String(formData.get("incidentId"));
  const incident = await prisma.emergencyIncident.findFirstOrThrow({ where: { id: incidentId, collectionId: collection.id }, include: { aquariums: true } });
  const aquariumId = text(formData, "aquariumId");
  if (aquariumId) {
    const belongs = incident.aquariums.some((entry) => entry.aquariumId === aquariumId);
    if (!belongs) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  }
  const logType = enumValue(formData.get("logType"), ["NOTE", "ACTION", "METRIC", "PHOTO", "STATUS_CHANGE", "EQUIPMENT", "LOSS", "RECOVERY_CHECK"] as const, "NOTE");
  const metrics = ["temperature", "ammonia", "nitrite", "nitrate", "ph", "dissolvedOxygen", "salinity", "tds"].reduce<Record<string, string>>((acc, key) => {
    const value = text(formData, key);
    if (value) acc[key] = value;
    return acc;
  }, {});
  const log = await prisma.emergencyIncidentLog.create({
    data: {
      collectionId: collection.id,
      incidentId,
      aquariumId,
      logType,
      message: text(formData, "message") ?? (Object.keys(metrics).length ? "Emergency metric check logged." : "Emergency update logged."),
      metadata: Object.keys(metrics).length ? { metrics } : undefined,
      createdById: user.id
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyIncidentLog", entityId: log.id, action: logType === "METRIC" ? "EMERGENCY_METRICS_LOGGED" : "EMERGENCY_LOG_ADDED", after: log, createdById: user.id });
  revalidatePath("/emergency-response");
  if (aquariumId) revalidatePath(`/aquariums/${aquariumId}`);
  await setFormFlash("Emergency log added.");
}

export async function createEddyEmergencyGuidance(formData: FormData) {
  "use server";

  const { user, collection } = await getCollection(careRoles);
  const incidentId = String(formData.get("incidentId"));
  const mode = String(formData.get("mode") ?? "respond");
  const incident = await prisma.emergencyIncident.findFirstOrThrow({ where: { id: incidentId, collectionId: collection.id }, include: { aquariums: { include: { aquarium: { include: { items: true, equipmentAttachments: { include: { item: { include: { equipmentProfile: true } } } }, readings: { orderBy: { measuredAt: "desc" }, take: 8 } } } } }, logs: { orderBy: { loggedAt: "desc" }, take: 12 }, steps: { orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] } } });
  const type = formatEmergencyLabel(incident.emergencyType);
  const guidance = mode === "monitor"
    ? [
      `Monitor ${type.toLowerCase()} recovery with oxygenation, behavior, temperature, and water tests appropriate to the event.`,
      "Set short follow-up checks rather than assuming the tank is stable immediately.",
      "Watch vulnerable inhabitants first and record any abnormal breathing, hiding, flashing, or lethargy."
    ]
    : mode === "summary"
      ? [
        `${incident.title}: ${incident.status.toLowerCase()} incident with ${incident.logs.length} recorded log(s) and ${incident.steps.filter((step) => step.status === "DONE").length}/${incident.steps.length} completed steps.`,
        incident.rootCause ? `Root cause noted: ${incident.rootCause}` : "Root cause has not been confirmed yet.",
        incident.outcomeNotes ? `Outcome: ${incident.outcomeNotes}` : "Outcome notes are still pending."
      ]
      : [
        `For ${type.toLowerCase()}, prioritize human safety, oxygenation, temperature stability, and water testing.`,
        "If water and electricity are both involved, use only safe dry shutoffs or professional help; do not handle wet electrical equipment.",
        "Do not feed until oxygenation/filtration and water quality are stable.",
        "If disease is involved, treat this as triage guidance rather than veterinary certainty."
      ];
  const log = await prisma.emergencyIncidentLog.create({
    data: {
      collectionId: collection.id,
      incidentId,
      logType: "ACTION",
      message: `Eddy emergency ${mode} guidance:\n${guidance.map((line) => `• ${line}`).join("\n")}`,
      metadata: { mode, guardrails: ["no unsafe electrical advice", "no veterinary certainty", "review before applying"], tankCount: incident.aquariums.length },
      createdById: user.id
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "EmergencyIncident", entityId: incident.id, action: "EDDY_EMERGENCY_GUIDANCE_REQUESTED", metadata: { logId: log.id, mode, emergencyType: incident.emergencyType }, createdById: user.id });
  revalidatePath("/emergency-response");
  await setFormFlash("Eddy emergency guidance added to the incident log for review.");
}

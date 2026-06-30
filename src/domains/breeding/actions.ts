"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BreedingObservationType, BreedingProjectStatus, BreedingProjectType, BreedingTraitConfidence, ItemType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, collectionOwnerRoles, requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { defaultStageForProject, breedingObservationTypes, breedingProjectStatuses, breedingProjectTypes, breedingTraitConfidences } from "@/domains/breeding/catalog";
import { setFormFlash } from "@/lib/forms/form-flash";
import { finishCreateFlow } from "@/lib/forms/create-flow";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() || null : null;
}

function dateValue(formData: FormData, key: string, fallback = new Date()) {
  const value = text(formData, key);
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) throw new Error(`${key} is not a valid date.`);
  return date;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${key} must be zero or greater.`);
  return number;
}

async function context(roles = structuralRoles) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, roles);
  return { user, collection };
}

async function projectInCollection(projectId: string, collectionId: string) {
  return prisma.breedingProject.findFirstOrThrow({ where: { id: projectId, collectionId }, include: { speciesDefinition: true, aquarium: true } });
}

function revalidateBreeding(projectId?: string | null, aquariumId?: string | null) {
  revalidatePath("/breeding");
  revalidatePath("/breeding/reports");
  revalidatePath("/dashboard");
  revalidatePath("/schedules");
  revalidatePath("/inventory");
  if (projectId) revalidatePath(`/breeding/${projectId}`);
  if (aquariumId) revalidatePath(`/aquariums/${aquariumId}`);
}

async function createBreedingEvent(input: { collectionId: string; projectId: string; aquariumId: string | null; cohortId?: string | null; observationId?: string | null; speciesDefinitionId?: string | null; userId: string; title: string; summary?: string | null; eventDate?: Date }) {
  if (!input.aquariumId) return null;
  return prisma.aquariumEvent.create({
    data: {
      collectionId: input.collectionId,
      aquariumId: input.aquariumId,
      relatedSpeciesId: input.speciesDefinitionId ?? null,
      breedingProjectId: input.projectId,
      breedingCohortId: input.cohortId ?? null,
      breedingObservationId: input.observationId ?? null,
      eventType: "BREEDING",
      title: input.title,
      summary: input.summary,
      eventDate: input.eventDate ?? new Date(),
      createdById: input.userId
    }
  });
}

export async function createBreedingProject(formData: FormData) {
  const { user, collection } = await context();
  const title = text(formData, "title");
  if (!title) throw new Error("Project title is required.");
  const projectTypeValue = text(formData, "projectType") ?? "MANAGED";
  const projectType = breedingProjectTypes.includes(projectTypeValue as BreedingProjectType) ? projectTypeValue as BreedingProjectType : "MANAGED";
  const speciesDefinitionId = text(formData, "speciesDefinitionId");
  const aquariumId = text(formData, "aquariumId");
  if (speciesDefinitionId) await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  if (aquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const project = await prisma.breedingProject.create({
    data: {
      collectionId: collection.id,
      title: title.slice(0, 180),
      projectType,
      speciesDefinitionId,
      aquariumId,
      status: "ACTIVE",
      startedAt: dateValue(formData, "startedAt"),
      description: text(formData, "description"),
      notes: text(formData, "notes"),
      createdById: user.id,
      cohorts: text(formData, "createInitialCohort") === "on" ? {
        create: {
          collectionId: collection.id,
          name: text(formData, "cohortName") || "Cohort 1",
          stage: text(formData, "stage") || defaultStageForProject(projectType),
          estimatedQuantity: text(formData, "estimatedQuantity"),
          quantityType: "ESTIMATED",
          currentEstimate: numberValue(formData, "currentEstimate"),
          destinationAquariumId: aquariumId,
          notes: text(formData, "cohortNotes")
        }
      } : undefined
    }
  });
  await createBreedingEvent({ collectionId: collection.id, projectId: project.id, aquariumId, speciesDefinitionId, userId: user.id, title: `Breeding project started: ${project.title}`, summary: project.description, eventDate: project.startedAt });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingProject", entityId: project.id, action: "BREEDING_PROJECT_CREATED", after: project, createdById: user.id });
  revalidateBreeding(project.id, aquariumId);
  await finishCreateFlow(formData, { detailUrl: `/breeding/${project.id}`, addAnotherUrl: "/breeding?create=1", createdMessage: `Created breeding project: ${project.title}.`, addAnotherMessage: `Created breeding project: ${project.title}. Ready for another.` });
}

export async function updateBreedingProject(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  if (!projectId) throw new Error("Project is required.");
  const before = await projectInCollection(projectId, collection.id);
  const statusValue = text(formData, "status") ?? before.status;
  const status = breedingProjectStatuses.includes(statusValue as BreedingProjectStatus) ? statusValue as BreedingProjectStatus : before.status;
  if (status === "COMPLETED" && before.status !== "COMPLETED") await requireCollectionRole(collection.id, collectionOwnerRoles);
  const updated = await prisma.breedingProject.update({
    where: { id: projectId },
    data: {
      title: text(formData, "title") ?? before.title,
      status,
      completedAt: status === "COMPLETED" ? dateValue(formData, "completedAt", new Date()) : status === before.status ? before.completedAt : null,
      completedById: status === "COMPLETED" ? user.id : before.completedById,
      description: text(formData, "description"),
      notes: text(formData, "notes")
    }
  });
  if (status === "COMPLETED" && before.status !== "COMPLETED") {
    await createBreedingEvent({ collectionId: collection.id, projectId, aquariumId: updated.aquariumId, speciesDefinitionId: updated.speciesDefinitionId, userId: user.id, title: `Breeding project completed: ${updated.title}`, summary: updated.notes, eventDate: updated.completedAt ?? new Date() });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingProject", entityId: projectId, action: status === "COMPLETED" && before.status !== "COMPLETED" ? "BREEDING_PROJECT_COMPLETED" : "BREEDING_PROJECT_UPDATED", before, after: updated, createdById: user.id });
  revalidateBreeding(projectId, updated.aquariumId);
  await setFormFlash("Breeding project saved.");
}

export async function addBreedingParent(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  if (!projectId) throw new Error("Project is required.");
  const project = await projectInCollection(projectId, collection.id);
  const aquariumItemId = text(formData, "aquariumItemId");
  if (aquariumItemId) await prisma.aquariumItem.findFirstOrThrow({ where: { id: aquariumItemId, collectionId: collection.id } });
  const parent = await prisma.breedingParent.create({
    data: {
      collectionId: collection.id,
      projectId,
      aquariumItemId,
      role: (text(formData, "role") ?? "UNKNOWN") as never,
      confidence: (text(formData, "confidence") ?? (project.projectType === "COMMUNITY" ? "COMMUNITY" : "CANDIDATE")) as never,
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingParent", entityId: parent.id, action: "BREEDING_PARENT_ADDED", after: parent, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Parent or contributor saved.");
}

export async function addBreedingCohort(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  if (!projectId) throw new Error("Project is required.");
  const project = await projectInCollection(projectId, collection.id);
  const name = text(formData, "name");
  if (!name) throw new Error("Cohort name is required.");
  const destinationAquariumId = text(formData, "destinationAquariumId");
  if (destinationAquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: destinationAquariumId, collectionId: collection.id } });
  const cohort = await prisma.breedingCohort.create({ data: { collectionId: collection.id, projectId, name, estimatedQuantity: text(formData, "estimatedQuantity"), quantityType: (text(formData, "quantityType") ?? "ESTIMATED") as never, stage: text(formData, "stage") || defaultStageForProject(project.projectType), currentEstimate: numberValue(formData, "currentEstimate"), destinationAquariumId, notes: text(formData, "notes") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingCohort", entityId: cohort.id, action: "BREEDING_COHORT_UPDATED", after: cohort, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Cohort saved.");
}

export async function updateBreedingCohort(formData: FormData) {
  const { user, collection } = await context();
  const cohortId = text(formData, "cohortId");
  if (!cohortId) throw new Error("Cohort is required.");
  const before = await prisma.breedingCohort.findFirstOrThrow({ where: { id: cohortId, collectionId: collection.id }, include: { project: true } });
  const updated = await prisma.breedingCohort.update({ where: { id: cohortId }, data: { stage: text(formData, "stage") ?? before.stage, estimatedQuantity: text(formData, "estimatedQuantity"), currentEstimate: numberValue(formData, "currentEstimate"), notes: text(formData, "notes") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingCohort", entityId: cohortId, action: "BREEDING_COHORT_UPDATED", before, after: updated, createdById: user.id });
  revalidateBreeding(before.projectId, before.project.aquariumId);
  await setFormFlash("Cohort updated.");
}

export async function addBreedingObservation(formData: FormData) {
  const { user, collection } = await context(careRoles);
  const projectId = text(formData, "projectId");
  const notes = text(formData, "notes");
  if (!projectId || !notes) throw new Error("Observation notes are required.");
  const project = await projectInCollection(projectId, collection.id);
  const typeValue = text(formData, "observationType") ?? "GENERAL";
  const observationType = breedingObservationTypes.includes(typeValue as BreedingObservationType) ? typeValue as BreedingObservationType : "GENERAL";
  const cohortId = text(formData, "cohortId");
  if (cohortId) await prisma.breedingCohort.findFirstOrThrow({ where: { id: cohortId, projectId, collectionId: collection.id } });
  const observedAt = dateValue(formData, "observedAt");
  const observation = await prisma.breedingObservation.create({ data: { collectionId: collection.id, projectId, cohortId, aquariumId: project.aquariumId, observationType, observedAt, title: text(formData, "title"), notes, createdById: user.id } });
  await createBreedingEvent({ collectionId: collection.id, projectId, aquariumId: project.aquariumId, cohortId, observationId: observation.id, speciesDefinitionId: project.speciesDefinitionId, userId: user.id, title: `${observationType.toLowerCase().replaceAll("_", " ")}: ${project.title}`, summary: notes.slice(0, 500), eventDate: observedAt });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingObservation", entityId: observation.id, action: "BREEDING_OBSERVATION_ADDED", after: observation, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Breeding observation saved.");
}

export async function addBreedingGoal(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  const goal = text(formData, "goal");
  if (!projectId || !goal) throw new Error("Goal is required.");
  const project = await projectInCollection(projectId, collection.id);
  const created = await prisma.breedingGoal.create({ data: { collectionId: collection.id, projectId, goal, notes: text(formData, "notes") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingGoal", entityId: created.id, action: "BREEDING_GOAL_CHANGED", after: created, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Goal saved.");
}

export async function addSpeciesTrait(formData: FormData) {
  const { user, collection } = await context();
  const speciesDefinitionId = text(formData, "speciesDefinitionId");
  const name = text(formData, "name");
  if (!speciesDefinitionId || !name) throw new Error("Trait name is required.");
  await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  const trait = await prisma.speciesTrait.upsert({ where: { collectionId_speciesDefinitionId_name: { collectionId: collection.id, speciesDefinitionId, name } }, create: { collectionId: collection.id, speciesDefinitionId, name, description: text(formData, "description") }, update: { description: text(formData, "description") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesTrait", entityId: trait.id, action: "BREEDING_TRAIT_LIBRARY_UPDATED", after: trait, createdById: user.id });
  revalidatePath("/species");
  revalidatePath("/breeding");
  await setFormFlash("Species trait saved.");
}

export async function addBreedingTraitObservation(formData: FormData) {
  const { user, collection } = await context(careRoles);
  const projectId = text(formData, "projectId");
  const traitName = text(formData, "traitName");
  const expression = text(formData, "expression");
  if (!projectId || !traitName || !expression) throw new Error("Trait and expression are required.");
  const project = await projectInCollection(projectId, collection.id);
  const confidenceValue = text(formData, "confidence") ?? "MEDIUM";
  const confidence = breedingTraitConfidences.includes(confidenceValue as BreedingTraitConfidence) ? confidenceValue as BreedingTraitConfidence : "MEDIUM";
  const trait = await prisma.breedingTraitObservation.create({ data: { collectionId: collection.id, projectId, speciesTraitId: text(formData, "speciesTraitId"), traitName, expression, confidence, notes: text(formData, "notes"), observedAt: dateValue(formData, "observedAt") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingTraitObservation", entityId: trait.id, action: "BREEDING_TRAIT_OBSERVED", after: trait, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Trait observation saved.");
}

export async function addBreedingMeasurement(formData: FormData) {
  const { user, collection } = await context(careRoles);
  const projectId = text(formData, "projectId");
  const metric = text(formData, "metric");
  const unit = text(formData, "unit");
  const value = numberValue(formData, "value");
  if (!projectId || !metric || !unit || value === null) throw new Error("Measurement metric, value, and unit are required.");
  const project = await projectInCollection(projectId, collection.id);
  const measurement = await prisma.breedingMeasurement.create({ data: { collectionId: collection.id, projectId, cohortId: text(formData, "cohortId"), measuredAt: dateValue(formData, "measuredAt"), metric, value, unit, notes: text(formData, "notes") } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingMeasurement", entityId: measurement.id, action: "BREEDING_MEASUREMENT_ADDED", after: measurement, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Measurement saved.");
}

export async function addBreedingCareTask(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  if (!projectId || !title) throw new Error("Care task title is required.");
  const project = await projectInCollection(projectId, collection.id);
  const dueAt = dateValue(formData, "dueAt", addDays(new Date(), 1));
  const schedule = await prisma.careSchedule.create({ data: { collectionId: collection.id, aquariumId: project.aquariumId, name: `Breeding: ${project.title}`, description: "One-time breeding project task.", scheduleType: "OTHER", cadenceType: "CUSTOM", startDate: dueAt, nextDueAt: dueAt, enabled: false } });
  const task = await prisma.careTask.create({ data: { careScheduleId: schedule.id, aquariumId: project.aquariumId, breedingProjectId: projectId, title, description: text(formData, "description"), dueAt, priority: (text(formData, "priority") ?? "NORMAL") as never } });
  await writeAuditLog({ collectionId: collection.id, entityType: "CareTask", entityId: task.id, action: "BREEDING_CARE_TASK_CREATED", after: task, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Breeding care task created.");
}

export async function attachBreedingPhoto(formData: FormData) {
  const { user, collection } = await context(careRoles);
  const projectId = text(formData, "projectId");
  const mediaAssetId = text(formData, "mediaAssetId");
  if (!projectId || !mediaAssetId) throw new Error("Choose a project and photo.");
  const project = await projectInCollection(projectId, collection.id);
  const media = await prisma.mediaAsset.findFirstOrThrow({ where: { id: mediaAssetId, collectionId: collection.id } });
  const photo = await prisma.breedingPhoto.upsert({
    where: { projectId_mediaAssetId: { projectId, mediaAssetId } },
    create: { collectionId: collection.id, projectId, mediaAssetId, caption: text(formData, "caption") || media.caption, takenAt: media.createdAt },
    update: { caption: text(formData, "caption") || media.caption }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingPhoto", entityId: photo.id, action: "BREEDING_PHOTO_ATTACHED", after: photo, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Photo linked to breeding project.");
}

export async function attachBreedingWorkflow(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  const workflowTemplateId = text(formData, "workflowTemplateId");
  if (!projectId || !workflowTemplateId) throw new Error("Choose a workflow template.");
  const project = await projectInCollection(projectId, collection.id);
  if (!project.aquariumId) throw new Error("Attach an aquarium before starting a breeding workflow.");
  const template = await prisma.workflowTemplate.findFirstOrThrow({ where: { id: workflowTemplateId } });
  const run = await prisma.workflowRun.create({ data: { workflowTemplateId, aquariumId: project.aquariumId, notes: `Breeding project: ${project.title}` } });
  const steps = await prisma.workflowStep.findMany({ where: { workflowTemplateId }, orderBy: { order: "asc" } });
  if (steps.length) await prisma.workflowStepRun.createMany({ data: steps.map((step) => ({ workflowRunId: run.id, workflowStepId: step.id })) });
  await prisma.breedingProject.update({ where: { id: projectId }, data: { workflowRunId: run.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingProject", entityId: projectId, action: "BREEDING_WORKFLOW_ATTACHED", after: { workflowRunId: run.id, workflowTemplateId }, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash(`Attached workflow: ${template.name}.`);
}

export async function graduateBreedingCohort(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  const cohortId = text(formData, "cohortId");
  const name = text(formData, "name");
  const quantity = numberValue(formData, "quantity");
  if (!projectId || !cohortId || !name || quantity === null) throw new Error("Cohort, name, and quantity are required.");
  const project = await projectInCollection(projectId, collection.id);
  const cohort = await prisma.breedingCohort.findFirstOrThrow({ where: { id: cohortId, collectionId: collection.id, projectId } });
  const itemType = (text(formData, "itemType") ?? project.speciesDefinition?.category ?? "OTHER") as ItemType;
  const aquariumId = text(formData, "aquariumId") || cohort.destinationAquariumId || project.aquariumId;
  if (aquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const item = await prisma.aquariumItem.create({ data: { collectionId: collection.id, aquariumId, itemType, speciesDefinitionId: project.speciesDefinitionId, name, quantity, unit: text(formData, "unit") || "offspring", status: aquariumId ? "IN_AQUARIUM" : "ACTIVE", notes: text(formData, "notes") || `Graduated from breeding project ${project.title}.`, originBreedingProjectId: projectId, originBreedingCohortId: cohortId } });
  await prisma.breedingCohort.update({ where: { id: cohortId }, data: { stage: "GRADUATED", currentEstimate: quantity } });
  await createBreedingEvent({ collectionId: collection.id, projectId, aquariumId: aquariumId ?? project.aquariumId, cohortId, speciesDefinitionId: project.speciesDefinitionId, userId: user.id, title: `Graduated cohort: ${cohort.name}`, summary: `${quantity} ${item.unit ?? "offspring"} added to inventory as ${item.name}.` });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingCohort", entityId: cohortId, action: "BREEDING_COHORT_GRADUATED_TO_INVENTORY", after: { itemId: item.id, quantity, aquariumId }, createdById: user.id });
  revalidateBreeding(projectId, aquariumId ?? project.aquariumId);
  await setFormFlash("Cohort graduated into Inventory.");
}

export async function saveBreedingSummary(formData: FormData) {
  const { user, collection } = await context();
  const projectId = text(formData, "projectId");
  const summary = text(formData, "summary");
  if (!projectId || !summary) throw new Error("Summary is required.");
  const project = await projectInCollection(projectId, collection.id);
  const record = await prisma.breedingSummary.create({ data: { collectionId: collection.id, projectId, summary, outcomes: text(formData, "outcomes"), goalsAchieved: text(formData, "goalsAchieved"), improvements: text(formData, "improvements"), generatedById: user.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingSummary", entityId: record.id, action: "BREEDING_SUMMARY_SAVED", after: record, createdById: user.id });
  revalidateBreeding(projectId, project.aquariumId);
  await setFormFlash("Breeding summary saved.");
}

export async function deleteBreedingProject(formData: FormData) {
  const { user, collection } = await context(collectionOwnerRoles);
  const projectId = text(formData, "projectId");
  if (!projectId) throw new Error("Project is required.");
  const before = await projectInCollection(projectId, collection.id);
  await prisma.breedingProject.delete({ where: { id: projectId } });
  await writeAuditLog({ collectionId: collection.id, entityType: "BreedingProject", entityId: projectId, action: "BREEDING_PROJECT_DELETED", before, createdById: user.id, severity: "WARNING" });
  revalidateBreeding(null, before.aquariumId);
  await setFormFlash("Breeding project deleted.");
  redirect("/breeding");
}

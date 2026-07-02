"use client";

import { useState } from "react";
import type { WorkflowCategory, WorkflowStep, WorkflowStepType, WorkflowTemplate } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { editableWorkflowStepTypes, workflowStepLabel } from "@/domains/workflows/step-types";

type StepDraft = {
  id: string;
  title: string;
  description: string;
  stepType: WorkflowStepType;
  waitAfterPreviousMinutes: string;
  alertOffsetMinutes: string;
  alertEmail: boolean;
  alertPush: boolean;
  required: boolean;
  measurementLabel: string;
  unit: string;
  targetValue: string;
  minValue: string;
  maxValue: string;
  eventTitle: string;
  checklistItems: string;
};

type TemplateWithSteps = WorkflowTemplate & { steps: WorkflowStep[] };

const blankStep = (index: number): StepDraft => ({
  id: `step-${Date.now()}-${index}`,
  title: "",
  description: "",
  stepType: "INSTRUCTION",
  waitAfterPreviousMinutes: "",
  alertOffsetMinutes: "",
  alertEmail: false,
  alertPush: false,
  required: true,
  measurementLabel: "",
  unit: "",
  targetValue: "",
  minValue: "",
  maxValue: "",
  eventTitle: "",
  checklistItems: ""
});

function fromTemplate(template?: TemplateWithSteps): StepDraft[] {
  if (!template?.steps.length) return [blankStep(0)];
  return template.steps.map((step, index) => {
    const config = (step.config || {}) as Record<string, unknown>;
    const channels = Array.isArray(step.alertChannels) ? step.alertChannels.map(String) : [];
    return {
      ...blankStep(index),
      id: step.id,
      title: step.title,
      description: step.description || "",
      stepType: step.stepType,
      waitAfterPreviousMinutes: step.waitAfterPreviousMinutes?.toString() || "",
      alertOffsetMinutes: step.alertOffsetMinutes?.toString() || "",
      alertEmail: channels.includes("EMAIL"),
      alertPush: channels.includes("PUSH"),
      required: step.isRequired,
      measurementLabel: String(config.measurementLabel || ""),
      unit: String(config.unit || ""),
      targetValue: String(config.targetValue || ""),
      minValue: String(config.minValue || ""),
      maxValue: String(config.maxValue || ""),
      eventTitle: String(config.eventTitle || ""),
      checklistItems: Array.isArray(config.items) ? config.items.join("\n") : ""
    };
  });
}

export function WorkflowTemplateForm({ action, template, aquariums }: { action: (formData: FormData) => void | Promise<void>; template?: TemplateWithSteps; aquariums: Array<{ id: string; name: string; generatedName: string | null }> }) {
  const [steps, setSteps] = useState<StepDraft[]>(() => fromTemplate(template));
  const categories: WorkflowCategory[] = ["MAINTENANCE", "QUARANTINE", "MEDICATION", "BREEDING", "CYCLING", "ACCLIMATION", "VACATION", "CUSTOM"];
  const update = (index: number, patch: Partial<StepDraft>) => setSteps((current) => current.map((step, i) => i === index ? { ...step, ...patch } : step));
  return (
    <form action={action} className="space-y-4">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Name<input name="name" required defaultValue={template?.name || ""} className="rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-semibold">Category<select name="category" defaultValue={template?.category || "CUSTOM"} className="rounded-md border border-border bg-background px-3 py-2">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">Description<textarea name="description" defaultValue={template?.description || ""} className="min-h-20 rounded-md border border-border bg-background px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-semibold">Default aquarium<select name="defaultAquariumId" defaultValue={template?.defaultAquariumId || ""} className="rounded-md border border-border bg-background px-3 py-2"><option value="">No default aquarium</option>{aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName || aquarium.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Expected duration minutes<input name="defaultDurationMinutes" type="number" min="0" defaultValue={template?.defaultDurationMinutes || ""} className="rounded-md border border-border bg-background px-3 py-2" /></label>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Steps</h4><Button type="button" variant="secondary" onClick={() => setSteps((current) => [...current, blankStep(current.length)])}>Add step</Button></div>
        {steps.map((step, index) => (
          <div key={step.id} className="rounded-md border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {index + 1}</span><Button type="button" variant="ghost" onClick={() => setSteps((current) => current.length === 1 ? current : current.filter((_, i) => i !== index))}>Remove</Button></div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">Type<select name="stepType" value={step.stepType} onChange={(event) => update(index, { stepType: event.target.value as WorkflowStepType })} className="rounded-md border border-border bg-background px-3 py-2">{editableWorkflowStepTypes.map((type) => <option key={type} value={type}>{workflowStepLabel(type)}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-semibold">Title<input name="stepTitle" required value={step.title} onChange={(event) => update(index, { title: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="grid gap-1 text-sm font-semibold md:col-span-2">Description<textarea name="stepDescription" value={step.description} onChange={(event) => update(index, { description: event.target.value })} className="min-h-16 rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="grid gap-1 text-sm font-semibold">Wait after previous (minutes)<input name="stepWaitAfterPreviousMinutes" type="number" min="0" value={step.waitAfterPreviousMinutes} onChange={(event) => update(index, { waitAfterPreviousMinutes: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="grid gap-1 text-sm font-semibold">Alert offset before due (minutes)<input name="stepAlertOffsetMinutes" type="number" min="0" value={step.alertOffsetMinutes} onChange={(event) => update(index, { alertOffsetMinutes: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" /></label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" name="stepRequired" value={index} checked={step.required} onChange={(event) => update(index, { required: event.target.checked })} /> Required</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" name="stepAlertEmail" value={index} checked={step.alertEmail} onChange={(event) => update(index, { alertEmail: event.target.checked })} /> Email alert</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" name="stepAlertPush" value={index} checked={step.alertPush} onChange={(event) => update(index, { alertPush: event.target.checked })} /> Push alert</label>
              </div>
              {step.stepType === "MEASUREMENT" ? <>
                <input name="stepMeasurementLabel" placeholder="Measurement label" value={step.measurementLabel} onChange={(event) => update(index, { measurementLabel: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" />
                <input name="stepUnit" placeholder="Unit" value={step.unit} onChange={(event) => update(index, { unit: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" />
                <input name="stepTargetValue" placeholder="Target value" value={step.targetValue} onChange={(event) => update(index, { targetValue: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" />
                <input name="stepMinValue" placeholder="Minimum" value={step.minValue} onChange={(event) => update(index, { minValue: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" />
                <input name="stepMaxValue" placeholder="Maximum" value={step.maxValue} onChange={(event) => update(index, { maxValue: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2" />
              </> : <>
                <input type="hidden" name="stepMeasurementLabel" value="" /><input type="hidden" name="stepUnit" value="" /><input type="hidden" name="stepTargetValue" value="" /><input type="hidden" name="stepMinValue" value="" /><input type="hidden" name="stepMaxValue" value="" />
              </>}
              {step.stepType === "LOG_EVENT" ? <input name="stepEventTitle" placeholder="Timeline event title" value={step.eventTitle} onChange={(event) => update(index, { eventTitle: event.target.value })} className="rounded-md border border-border bg-background px-3 py-2 md:col-span-2" /> : <input type="hidden" name="stepEventTitle" value="" />}
              {step.stepType === "CHECKLIST" ? <textarea name="stepChecklistItems" placeholder="One checklist item per line" value={step.checklistItems} onChange={(event) => update(index, { checklistItems: event.target.value })} className="min-h-20 rounded-md border border-border bg-background px-3 py-2 md:col-span-2" /> : <input type="hidden" name="stepChecklistItems" value="" />}
            </div>
          </div>
        ))}
      </div>
      <Button type="submit">{template ? "Save workflow template" : "Create workflow template"}</Button>
    </form>
  );
}

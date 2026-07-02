import type { WorkflowStepType } from "@prisma/client";

export const workflowStepTypeRegistry: Record<WorkflowStepType, { label: string; description: string; completesRun?: boolean }> = {
  INSTRUCTION: { label: "Instruction", description: "A plain care instruction for the keeper to perform." },
  MEASUREMENT: { label: "Measurement", description: "Collect a reading or numeric/text value before completing the step." },
  ALERT: { label: "Alert", description: "Send an email/push reminder at the configured time." },
  CHECKLIST: { label: "Checklist", description: "Confirm a small checklist before moving on." },
  WAIT: { label: "Wait", description: "Pause the workflow until the wait period has elapsed." },
  LOG_EVENT: { label: "Timeline log", description: "Record a concise aquarium timeline event." },
  TASK: { label: "Task", description: "Legacy task step; treated like an instruction." },
  CHECK: { label: "Check", description: "Legacy check step; treated like a checklist." },
  INPUT: { label: "Input", description: "Legacy input step; treated like a measurement." },
  DECISION: { label: "Decision", description: "Legacy decision step; treated like an instruction." }
};

export const editableWorkflowStepTypes: WorkflowStepType[] = ["INSTRUCTION", "MEASUREMENT", "WAIT", "ALERT", "CHECKLIST", "LOG_EVENT"];

export function workflowStepLabel(type: WorkflowStepType) {
  return workflowStepTypeRegistry[type]?.label ?? type.replaceAll("_", " ").toLowerCase();
}

export function normalizedStepType(type: WorkflowStepType): WorkflowStepType {
  if (type === "TASK" || type === "DECISION") return "INSTRUCTION";
  if (type === "CHECK") return "CHECKLIST";
  if (type === "INPUT") return "MEASUREMENT";
  return type;
}

# Fluxpoint Workflows

Workflow Builder v1 lets a collection define reusable care routines and start as many parallel runs as needed.

## Concepts

- **Workflow template**: reusable collection-scoped routine with ordered steps.
- **Workflow run**: one started copy of a template. Runs may be linked to an aquarium or kept collection-level.
- **Workflow step run**: a durable snapshot of the template step at start time, with its own status, due time, notes, and result data.
- **Workflow notification**: a scheduled email or push alert for a step. Delivery uses Fluxpoint notification preferences and delivery logs.

## Step types

- Instruction: plain keeper instruction.
- Measurement: prompts for a reading/value before completion.
- Wait: pauses until the configured wait time is due.
- Alert: reminder-oriented step.
- Checklist: one or more checkboxes.
- Timeline log: records a concise aquarium timeline event when completed.

Legacy `TASK`, `CHECK`, `INPUT`, and `DECISION` step rows are retained for migration safety and normalized in the UI/runtime.

## Notifications

Workflow step alerts are processed by the reminders worker. They:

- advance waiting steps to due;
- send due email/push alerts through the existing notification delivery service;
- respect quiet hours for push;
- reuse delivery dedupe keys to avoid repeat sends;
- cancel scheduled alerts when a step/run is completed, skipped, or cancelled.

Workflow reminders use the existing care reminder email/push preference switches in v1.

## Default templates

Fluxpoint can re-add starter workflow templates from Server Maintenance or the Workflows page. The Brine Shrimp Hatch template is ordinary seed data, not a hard-coded workflow branch.

## Permissions

- Viewers can view workflows.
- Fishkeepers/aquarists/owners can start runs and complete/skip steps.
- Aquarists/owners can create and edit templates.
- Collection owners can archive templates and restore default templates.
- Server admins inherit collection-owner behavior.

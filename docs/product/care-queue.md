# Care queue

Care schedules generate tasks for recurring feeding, testing, dosing, maintenance, equipment service, water changes, and general care. Conditions add one-time `CONDITION_CHECK` tasks without creating a second task system.

Condition follow-ups link directly to their condition and carry low, normal, high, or critical priority derived from severity. Completing one requires observation notes and may update the condition status. This creates a `HealthConditionObservation`, completes the task, updates `lastObservedAt`, and writes an audit record in one workflow. Skipping remains available when a check is intentionally not performed.

Due condition checks use notification delivery guards and per-user email/push preferences. The care worker deduplicates each task by its identifier and due time.

Emergency response steps with due offsets appear in the Care Queue as linked urgent tasks. Completing or skipping those tasks updates the linked emergency incident step so urgent checks stay synchronized with incident history. Emergency response notifications use the existing notification delivery infrastructure and the Emergency response preference row.

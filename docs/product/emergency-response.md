# Emergency Response

Fluxpoint Emergency Response separates reusable emergency plans from real emergency incidents.

## Plans vs incidents

- Emergency plans are reusable playbooks such as Power outage, Tank leak, Heater failure, Filter failure, Ammonia spike, or CO2 overdose.
- Emergency incidents are real events that are active now or preserved as history.
- Starting an incident from a plan copies the plan steps into incident-specific checklist rows so later plan edits do not rewrite history.

## Phases

Incident steps are grouped into four phases:

1. Immediate response
2. Stabilization
3. Recovery
4. Verification

Moving an incident between phases records a major status log and writes aquarium timeline events for affected tanks.

## Power outage example

The starter Power outage plan prioritizes human safety, stopped feeding, battery aeration, wet filter media, temperature monitoring, gradual recovery, and ammonia/nitrite verification.

## Reminders and care queue

Plan steps can include due offsets and alert flags. When an incident starts, those steps create linked Care Queue tasks. Completing or skipping the task updates the incident step.

Emergency reminder delivery uses the existing notification system and the Emergency response notification preference. Push quiet hours and email configuration are respected by the shared delivery service.

## Eddy guidance

Eddy emergency guidance writes guarded suggestions into the incident log. It prioritizes safety, oxygenation, temperature stability, water testing, and professional help for electrical/flood hazards. Eddy does not provide veterinary certainty and does not overwrite a saved plan.

## Safety

Do not handle wet electrical equipment. Use safe dry shutoffs or local professional help for severe electrical, flooding, structural, or animal-health hazards.

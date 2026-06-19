# Lighting Schedules

Fluxpoint lighting schedules are fixture-aware. A light equipment record can reference a light capability profile, and schedules reference the same profile.

Capability profiles describe:

- control mode such as on/off, dimmable, RGB, RGBW, or custom
- supported channels
- preferred point count

Schedules store ordered time points. Each point keeps legacy white/red/green/blue/intensity columns for compatibility and a JSON `values` map for profile-specific channel values.

Assignments happen per aquarium light fixture. Fluxpoint validates that the selected schedule and selected light use the same capability profile, so a schedule designed for an RGBW fixture cannot accidentally be assigned to a simple on/off timer.

Current scope:

- design schedule templates
- duplicate templates
- protect assigned templates from deletion
- assign one schedule per light fixture
- record assignment changes on the aquarium timeline

Out of scope for this pass:

- hardware control
- Prometheus or Grafana sensor changes
- sunrise/sunset automation
- vendor-specific light APIs

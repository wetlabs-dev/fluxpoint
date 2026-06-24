# Lighting Schedules

Fluxpoint lighting schedules are fixture-aware. A light equipment record can reference a light capability profile, and schedules reference the same profile.

Capability profiles describe:

- control mode such as on/off, dimmable, RGB, RGBW, or custom
- supported channels
- preferred point count

Schedules store ordered time points. Each point keeps legacy white/red/green/blue/intensity columns for compatibility, a JSON `values` map for profile-specific channel values, and `rampMinutes`. A ramp is stored on its destination point and ends at that point's time; the interval before it is a plateau. The schedule is a continuous 24-hour loop: the last point transitions to the first point on the following day, including ramps that cross midnight. Graphs render that overnight segment and suppress or angle labels when nearby points would overlap.

Assignments happen per aquarium light fixture. An aquarium can have multiple attached lights, and every light can independently select, replace, clear, enable, or disable its own schedule. Fluxpoint validates that the selected schedule and selected light use the same capability profile, so a schedule designed for an RGBW fixture cannot accidentally be assigned to a simple on/off timer.

Current scope:

- design schedule templates
- duplicate templates
- protect assigned templates from deletion
- assign one schedule per light fixture
- record assignment changes on the aquarium timeline
- compare normalized equivalent full-output hours while editing
- combine fixture lumens, or a clearly labeled wattage-derived fallback, with the integrated schedule to show [Estimated Daily Light Load](./lighting-light-load.md)

Out of scope for this pass:

- hardware control
- Prometheus or Grafana sensor changes
- sunrise/sunset automation
- vendor-specific light APIs

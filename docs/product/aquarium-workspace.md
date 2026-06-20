# Aquarium Workspace v2

The aquarium workspace at `/aquariums/[id]` is the keeper's operating home for one tank. The sticky navigation exposes Overview, Inhabitants, Equipment, Metrics, Timeline, Schedules, Photos, Eddy, and QR/Labels without splitting daily work across unrelated pages.

Overview combines aquarium identity, an approved cover photo or generated fallback, dimensions and estimated volume, location and age, substrate/heater/light assignments, latest manual readings, recent events, and approved recent photos. Quick actions jump directly to focused forms.

Inhabitants are grouped into fish, invertebrates, plants, and coral/other. Equipment remains an `AquariumItem` with an `EquipmentProfile`. Both surfaces show approved thumbnails and offer item-scoped uploads. Timeline events show their approved attachments; the Photos gallery aggregates all assets whose aquarium is the current workspace.

Metrics remain manual or existing cached Fluxpoint values. This workspace does not introduce sensor discovery, Prometheus setup, or Grafana setup.

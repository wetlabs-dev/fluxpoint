# Aquarium metric thresholds

Fluxpoint uses `AquariumMetricConfig` as the single threshold store for charts, current readings, Prometheus output, and Grafana synchronization. Aquarium settings derive and synchronize these values:

- Ammonia: 0–0 ppm
- Nitrite: 0–0 ppm
- Nitrate: 0–40 ppm
- GH and KH: target ±2, with minimum clamped to zero
- Temperature: target ±2 °F when no explicit profile range exists
- pH: target ±0.3 when no explicit profile range exists
- Salinity: the aquarium’s target minimum and maximum in ppt

Creation, profile updates, bootstrap, and metric-config initialization all use the central aquarium-threshold helper. A range manually edited in the dedicated Metrics UI is marked as an override and is not replaced by later aquarium profile saves. Other derived rows continue to recalculate automatically.

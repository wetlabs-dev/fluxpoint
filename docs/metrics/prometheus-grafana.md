# Fluxpoint Metrics: Prometheus And Grafana

Fluxpoint owns the observability configuration for aquarium metrics. Sensors and operators send readings to Fluxpoint, Fluxpoint stores the latest values in Postgres for the app UI, Prometheus scrapes Fluxpoint for time-series storage, and Grafana renders managed dashboards from Fluxpoint-created panels.

## Architecture

- `POST /api/metrics/ingest` accepts aquarium readings with a hashed Fluxpoint ingestion token.
- Fluxpoint validates token scope, metric keys, and aquarium ownership.
- Fluxpoint writes the latest value to `MetricLatestValue` and mirrors supported water parameters to `WaterParameterReading`.
- `GET /api/metrics/prometheus` emits Prometheus text for the latest values and configured threshold lines.
- Prometheus scrapes the Fluxpoint app at `/api/metrics/prometheus`.
- Grafana uses the provisioned `Fluxpoint Prometheus` datasource and Fluxpoint-managed dashboard records.
- Aquarium workspaces query Prometheus `query_range` for seven-day first-party charts using the `aquarium_id` label. Configured min/max values render as visible chart boundaries; recent database readings are a bounded availability fallback, not a second history backend.

This first version intentionally avoids Pushgateway. Prometheus pulls from Fluxpoint, which keeps the device contract small and lets Fluxpoint remain the source of truth for labels, aquarium scope, and metric definitions.

## Docker Services

Docker Compose now includes:

- `prometheus`: internal Prometheus service with persisted `fluxpoint_prometheus_data`.
- `grafana`: internal Grafana service with persisted `fluxpoint_grafana_data`.
- `metrics`: Fluxpoint worker that can check backend health and sync dashboards when `ENABLE_METRICS_WORKER=true`.

Provisioning files live under:

- `deploy/prometheus/prometheus.yml`
- `deploy/grafana/provisioning/datasources/datasource.yml`
- `deploy/grafana/provisioning/dashboards/dashboards.yml`
- `deploy/grafana/dashboards`

Prometheus and Grafana are not exposed publicly and are not started by the default Compose profile. Start them intentionally with:

```bash
docker compose --profile observability up -d --build
```

## Environment

Required or expected variables:

```bash
METRICS_ENABLED=true
METRICS_BACKEND=prometheus
GRAPH_BACKEND=grafana
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
GRAFANA_PUBLIC_URL=
GRAFANA_EMBED_MODE=native
GRAFANA_ADMIN_USER=fluxpoint
GRAFANA_ADMIN_PASSWORD=change_me
GRAFANA_SERVICE_ACCOUNT_TOKEN=
ENABLE_METRICS_WORKER=false
```

Grafana itself reads `GF_*` variables, so production should also set:

```bash
GF_SECURITY_ADMIN_USER=fluxpoint
GF_SECURITY_ADMIN_PASSWORD=change_me
GF_SECURITY_ALLOW_EMBEDDING=true
GF_AUTH_ANONYMOUS_ENABLED=false
```

Set `GRAFANA_PUBLIC_URL` and `GRAFANA_EMBED_MODE=iframe` only after Grafana has a protected reverse-proxy route. Otherwise Fluxpoint displays native latest-value cards and managed-dashboard status without embedding Grafana.

## Metric Names And Labels

Prometheus metric examples:

- `fluxpoint_aquarium_temperature_f`
- `fluxpoint_aquarium_ph`
- `fluxpoint_aquarium_nitrate_ppm`
- `fluxpoint_aquarium_tds_ppm`

Labels are intentionally low cardinality:

- `collection_id`
- `aquarium_id`
- `aquarium_slug`
- `metric_key`
- `source`
- optional `device_id`
- optional `sensor_channel_id`

Secrets, raw token values, free-form notes, and unbounded user text must not be emitted as labels.

## Thresholds

Thresholds resolve in this order:

1. `AquariumMetricConfig.minValue` / `maxValue`
2. Aquarium profile targets where Fluxpoint has a clear existing target value
3. Future species/husbandry policy
4. `MetricDefinition.defaultMin` / `defaultMax`

Fluxpoint does not invent thresholds where no configured or profile-backed target exists.

For Prometheus, threshold lines are emitted as `{metric}_min` and `{metric}_max` when a bound exists. Grafana dashboard panels include those lines as additional series.

## Ingestion

Create an aquarium-scoped token from an aquarium page under the Metrics tab. Fluxpoint shows the plain token once and stores only its hash.

Example request:

```bash
curl -X POST https://fluxpoint.wetlabs.dev/api/metrics/ingest \
  -H "Authorization: Bearer flxm_..." \
  -H "Content-Type: application/json" \
  -d '{
    "aquariumId": "AQUARIUM_ID",
    "metrics": [
      { "key": "temperature_f", "value": 76.4, "unit": "F", "timestamp": "2026-06-18T12:00:00Z", "source": "SENSOR" },
      { "key": "ph", "value": 6.8, "unit": "pH", "timestamp": "2026-06-18T12:00:00Z", "source": "SENSOR" }
    ]
  }'
```

The token can be scoped to a single aquarium. Collection-wide tokens are supported by the model but the current UI creates aquarium-scoped tokens first.

## Grafana Sync

Fluxpoint creates `GrafanaManagedDashboard` and `GraphPanel` records for aquarium dashboards. When Grafana credentials are configured, Fluxpoint can create or update dashboards through Grafana’s HTTP API. When Grafana is unavailable or `GRAFANA_EMBED_MODE=native`, Fluxpoint records a skipped/disabled sync state and the app continues to work.

The metrics worker can periodically check backend health and sync dashboards:

```bash
ENABLE_METRICS_WORKER=true
METRICS_WORKER_INTERVAL_MS=600000
```

## Security Notes

- Prometheus stays Docker-internal by default.
- Grafana stays Docker-internal by default.
- Do not expose raw Grafana publicly unless it is intentionally protected.
- Ingestion tokens are stored hashed and shown only once at creation.
- The Prometheus endpoint emits IDs and metric labels, not secrets.
- V1 does not accept arbitrary PromQL from users.

## Deferred

- Raspberry Pi, Pico, and ESP32 firmware.
- Device registry and pairing flows beyond ingestion tokens.
- Grafana alerting and Alertmanager.
- Species-derived threshold policy.
- Retention/downsampling policy beyond Prometheus defaults.
- Remote write and Home Assistant integration.

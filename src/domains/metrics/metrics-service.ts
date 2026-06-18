import { createHash, randomBytes } from "crypto";
import type { AquariumMetricConfig, MetricSource, WaterParameter } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { commonMetricDefinitions } from "@/domains/metrics/metric-definitions";

type IngestMetric = {
  key: string;
  value: number;
  unit?: string;
  timestamp?: string;
  source?: MetricSource;
  deviceId?: string;
  sensorChannelId?: string;
};

const readingSourceByMetricSource = {
  MANUAL: "MANUAL",
  SENSOR: "SENSOR",
  API: "SENSOR",
  IMPORTED: "IMPORTED"
} as const;

export function metricsEnabled() {
  return process.env.METRICS_ENABLED !== "false";
}

export function hashMetricToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newMetricToken() {
  return `flxm_${randomBytes(32).toString("base64url")}`;
}

export async function ensureCollectionMetricDefinitions(collectionId: string) {
  const definitions = [];
  for (const definition of commonMetricDefinitions) {
    const metricDefinition = await prisma.metricDefinition.upsert({
      where: { collectionId_key: { collectionId, key: definition.key } },
      update: {
        displayName: definition.displayName,
        description: definition.description,
        parameter: definition.parameter,
        unit: definition.unit,
        prometheusName: definition.prometheusName,
        defaultMin: definition.defaultMin ?? null,
        defaultMax: definition.defaultMax ?? null,
        enabledByDefault: true
      },
      create: {
        collectionId,
        key: definition.key,
        displayName: definition.displayName,
        description: definition.description,
        parameter: definition.parameter,
        unit: definition.unit,
        prometheusName: definition.prometheusName,
        defaultMin: definition.defaultMin ?? null,
        defaultMax: definition.defaultMax ?? null,
        enabledByDefault: true
      }
    });
    definitions.push(metricDefinition);
  }
  return definitions;
}

export async function ensureAquariumMetricConfigs(aquariumId: string) {
  const aquarium = await prisma.aquarium.findUniqueOrThrow({
    where: { id: aquariumId },
    select: { id: true, collectionId: true, profile: true }
  });
  const definitions = await ensureCollectionMetricDefinitions(aquarium.collectionId);
  const configs = [];

  for (const definition of definitions) {
    const seed = commonMetricDefinitions.find((item) => item.key === definition.key);
    const profileBounds = aquarium.profile ? profileBoundsForParameter(definition.parameter, aquarium.profile) : {};
    configs.push(
      await prisma.aquariumMetricConfig.upsert({
        where: { aquariumId_metricDefinitionId: { aquariumId, metricDefinitionId: definition.id } },
        update: {
          collectionId: aquarium.collectionId,
          displayOrder: seed?.displayOrder ?? 999
        },
        create: {
          collectionId: aquarium.collectionId,
          aquariumId,
          metricDefinitionId: definition.id,
          enabled: definition.enabledByDefault,
          minValue: profileBounds.minValue ?? null,
          maxValue: profileBounds.maxValue ?? null,
          displayOrder: seed?.displayOrder ?? 999
        }
      })
    );
  }

  return configs;
}

export async function createMetricIngestionToken(options: {
  collectionId: string;
  aquariumId?: string | null;
  name: string;
  expiresAt?: Date | null;
}) {
  const token = newMetricToken();
  const record = await prisma.metricIngestionToken.create({
    data: {
      collectionId: options.collectionId,
      aquariumId: options.aquariumId ?? null,
      name: options.name,
      tokenHash: hashMetricToken(token),
      expiresAt: options.expiresAt ?? null
    }
  });
  return { token, record };
}

export async function ingestAquariumMetrics(token: string, aquariumId: string, metrics: IngestMetric[]) {
  if (!metricsEnabled()) throw new Error("Metrics ingestion is disabled.");
  const tokenRecord = await prisma.metricIngestionToken.findUnique({
    where: { tokenHash: hashMetricToken(token) }
  });
  if (!tokenRecord || tokenRecord.revokedAt) throw new Error("Invalid metrics token.");
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) throw new Error("Metrics token has expired.");
  if (tokenRecord.aquariumId && tokenRecord.aquariumId !== aquariumId) throw new Error("Metrics token is not scoped to this aquarium.");

  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId: tokenRecord.collectionId }
  });
  await ensureAquariumMetricConfigs(aquarium.id);
  const configs = await prisma.aquariumMetricConfig.findMany({
    where: { aquariumId: aquarium.id },
    include: { metricDefinition: true }
  });
  const configByKey = new Map(configs.map((config) => [config.metricDefinition.key, config]));
  const accepted = [];

  for (const metric of metrics) {
    const config = configByKey.get(metric.key);
    if (!config || !config.enabled) continue;
    if (!Number.isFinite(metric.value)) continue;
    const measuredAt = metric.timestamp ? new Date(metric.timestamp) : new Date();
    if (Number.isNaN(measuredAt.getTime())) continue;
    const source = metric.source ?? "API";
    const unit = metric.unit?.trim() || config.metricDefinition.unit;

    await prisma.metricLatestValue.upsert({
      where: { metricConfigId: config.id },
      update: {
        value: metric.value,
        unit,
        source,
        deviceId: metric.deviceId ?? null,
        sensorChannelId: metric.sensorChannelId ?? null,
        measuredAt
      },
      create: {
        collectionId: aquarium.collectionId,
        aquariumId: aquarium.id,
        metricDefinitionId: config.metricDefinitionId,
        metricConfigId: config.id,
        value: metric.value,
        unit,
        source,
        deviceId: metric.deviceId ?? null,
        sensorChannelId: metric.sensorChannelId ?? null,
        measuredAt
      }
    });

    if (config.metricDefinition.parameter) {
      await prisma.waterParameterReading.create({
        data: {
          aquariumId: aquarium.id,
          parameter: config.metricDefinition.parameter,
          value: metric.value,
          unit,
          source: readingSourceByMetricSource[source],
          measuredAt,
          notes: "Ingested via Fluxpoint metrics API."
        }
      });
    }

    accepted.push(config.metricDefinition.key);
  }

  await prisma.metricIngestionToken.update({
    where: { id: tokenRecord.id },
    data: { lastUsedAt: new Date() }
  });

  return { accepted: accepted.length, keys: accepted };
}

export async function renderPrometheusMetrics() {
  if (!metricsEnabled()) {
    return "# HELP fluxpoint_metrics_enabled Fluxpoint metrics backend enabled state.\n# TYPE fluxpoint_metrics_enabled gauge\nfluxpoint_metrics_enabled 0\n";
  }

  const values = await prisma.metricLatestValue.findMany({
    include: {
      collection: true,
      aquarium: true,
      metricDefinition: true,
      metricConfig: true
    },
    orderBy: { updatedAt: "desc" }
  });

  const lines = [
    "# HELP fluxpoint_metrics_enabled Fluxpoint metrics backend enabled state.",
    "# TYPE fluxpoint_metrics_enabled gauge",
    "fluxpoint_metrics_enabled 1"
  ];
  const seenTypes = new Set<string>();

  for (const reading of values) {
    const metricName = reading.metricDefinition.prometheusName;
    if (!seenTypes.has(metricName)) {
      lines.push(`# HELP ${metricName} ${escapeHelp(reading.metricDefinition.description ?? reading.metricDefinition.displayName)}`);
      lines.push(`# TYPE ${metricName} gauge`);
      seenTypes.add(metricName);
    }

    const labels = formatLabels({
      collection_id: reading.collectionId,
      aquarium_id: reading.aquariumId,
      aquarium_slug: reading.aquarium.slug,
      metric_key: reading.metricDefinition.key,
      source: reading.source,
      device_id: reading.deviceId,
      sensor_channel_id: reading.sensorChannelId
    });
    const timestamp = reading.measuredAt.getTime();
    lines.push(`${metricName}{${labels}} ${reading.value} ${timestamp}`);

    const min = resolvedMin(reading.metricConfig, reading.metricDefinition);
    const max = resolvedMax(reading.metricConfig, reading.metricDefinition);
    if (min !== null) lines.push(`${metricName}_min{${labels}} ${min} ${timestamp}`);
    if (max !== null) lines.push(`${metricName}_max{${labels}} ${max} ${timestamp}`);
  }

  lines.push("");
  return lines.join("\n");
}

export async function metricsBackendStatus() {
  const latestLog = await prisma.metricSyncLog.findFirst({ orderBy: { createdAt: "desc" } });
  const latestReading = await prisma.metricLatestValue.findFirst({ orderBy: { measuredAt: "desc" } });
  return {
    enabled: metricsEnabled(),
    backend: process.env.METRICS_BACKEND || "prometheus",
    graphBackend: process.env.GRAPH_BACKEND || "grafana",
    prometheusUrl: process.env.PROMETHEUS_URL || "http://prometheus:9090",
    grafanaUrl: process.env.GRAFANA_URL || "http://grafana:3000",
    grafanaPublicUrl: process.env.GRAFANA_PUBLIC_URL || "",
    embedMode: process.env.GRAFANA_EMBED_MODE || "native",
    latestLog,
    latestReading
  };
}

function profileBoundsForParameter(
  parameter: WaterParameter | null,
  profile: { targetTemperature: number | null; targetPh: number | null; targetGh: number | null; targetKh: number | null }
) {
  if (parameter === "TEMPERATURE" && profile.targetTemperature !== null) return { minValue: profile.targetTemperature - 2, maxValue: profile.targetTemperature + 2 };
  if (parameter === "PH" && profile.targetPh !== null) return { minValue: profile.targetPh - 0.3, maxValue: profile.targetPh + 0.3 };
  if (parameter === "GH" && profile.targetGh !== null) return { minValue: Math.max(0, profile.targetGh - 2), maxValue: profile.targetGh + 2 };
  if (parameter === "KH" && profile.targetKh !== null) return { minValue: Math.max(0, profile.targetKh - 2), maxValue: profile.targetKh + 2 };
  return {};
}

function resolvedMin(config: AquariumMetricConfig, definition: { defaultMin: number | null }) {
  return config.minValue ?? definition.defaultMin ?? null;
}

function resolvedMax(config: AquariumMetricConfig, definition: { defaultMax: number | null }) {
  return config.maxValue ?? definition.defaultMax ?? null;
}

function formatLabels(labels: Record<string, string | null>) {
  return Object.entries(labels)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(",");
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function escapeHelp(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

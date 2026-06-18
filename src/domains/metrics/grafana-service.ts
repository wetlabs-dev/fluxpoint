import { prisma } from "@/lib/db/prisma";
import { ensureAquariumMetricConfigs } from "@/domains/metrics/metrics-service";

const datasourceName = "Fluxpoint Prometheus";

export function grafanaConfig() {
  return {
    enabled: process.env.GRAPH_BACKEND !== "native" && process.env.GRAFANA_URL !== "",
    url: process.env.GRAFANA_URL || "http://grafana:3000",
    publicUrl: process.env.GRAFANA_PUBLIC_URL || "",
    adminUser: process.env.GRAFANA_ADMIN_USER || "fluxpoint",
    adminPassword: process.env.GRAFANA_ADMIN_PASSWORD || "",
    serviceAccountToken: process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN || "",
    prometheusUrl: process.env.PROMETHEUS_URL || "http://prometheus:9090",
    embedMode: process.env.GRAFANA_EMBED_MODE || "native"
  };
}

export async function grafanaHealth() {
  const config = grafanaConfig();
  if (!config.enabled) return { configured: false, ok: false, message: "Grafana graph backend is disabled or not configured." };
  try {
    const response = await grafanaFetch("/api/health", { method: "GET", signal: AbortSignal.timeout(2500) });
    return { configured: true, ok: response.ok, message: response.ok ? "Grafana health endpoint responded." : `Grafana returned ${response.status}.` };
  } catch (error) {
    return { configured: true, ok: false, message: error instanceof Error ? error.message : "Grafana health check failed." };
  }
}

export async function prometheusHealth() {
  const url = process.env.PROMETHEUS_URL || "http://prometheus:9090";
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/-/ready`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    return { configured: true, ok: response.ok, message: response.ok ? "Prometheus is ready." : `Prometheus returned ${response.status}.` };
  } catch (error) {
    return { configured: true, ok: false, message: error instanceof Error ? error.message : "Prometheus health check failed." };
  }
}

export async function ensureDatasource() {
  const config = grafanaConfig();
  if (!config.enabled || (!config.serviceAccountToken && !config.adminPassword)) {
    await logSync("ENSURE_DATASOURCE", "SKIPPED", "Grafana credentials are not configured.");
    return null;
  }

  const existing = await grafanaFetch(`/api/datasources/name/${encodeURIComponent(datasourceName)}`, { method: "GET" });
  if (existing.ok) return existing.json();

  const response = await grafanaFetch("/api/datasources", {
    method: "POST",
    body: JSON.stringify({
      name: datasourceName,
      type: "prometheus",
      access: "proxy",
      url: config.prometheusUrl,
      isDefault: true,
      jsonData: { timeInterval: "15s" }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    await logSync("ENSURE_DATASOURCE", "FAILED", message);
    throw new Error(message);
  }

  await logSync("ENSURE_DATASOURCE", "SUCCEEDED", "Grafana datasource is available.");
  return response.json();
}

export async function syncAquariumDashboards() {
  const aquariums = await prisma.aquarium.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true }
  });
  for (const aquarium of aquariums) {
    await ensureAquariumDashboard(aquarium.id);
  }
}

export async function ensureAquariumDashboard(aquariumId: string) {
  await ensureAquariumMetricConfigs(aquariumId);
  const aquarium = await prisma.aquarium.findUniqueOrThrow({
    where: { id: aquariumId },
    include: {
      metricConfigs: {
        where: { enabled: true },
        include: { metricDefinition: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  const uid = dashboardUid(aquarium.id);
  const title = `${aquarium.generatedName ?? aquarium.name} Metrics`;
  const existing = await prisma.grafanaManagedDashboard.upsert({
    where: { aquariumId: aquarium.id },
    update: { title, uid },
    create: {
      collectionId: aquarium.collectionId,
      aquariumId: aquarium.id,
      uid,
      title
    }
  });

  const config = grafanaConfig();
  if (!config.enabled || config.embedMode === "native") {
    await ensureStoredPanels(existing.id, aquarium.id, aquarium.collectionId, aquarium.metricConfigs, uid);
    await prisma.grafanaManagedDashboard.update({
      where: { id: existing.id },
      data: { status: "DISABLED", lastSyncedAt: new Date(), lastError: "Native graph mode; Grafana dashboard sync skipped." }
    }).catch(() => null);
    await logSync("SYNC_DASHBOARD", "SKIPPED", "Native graph mode; Grafana dashboard sync skipped.", aquarium.collectionId, aquarium.id);
    return existing;
  }

  try {
    await ensureDatasource();
    const dashboard = buildDashboard(uid, title, aquarium.metricConfigs);
    const response = await grafanaFetch("/api/dashboards/db", {
      method: "POST",
      body: JSON.stringify({ dashboard, overwrite: true })
    });
    if (!response.ok) throw new Error(await response.text());

    await ensureStoredPanels(existing.id, aquarium.id, aquarium.collectionId, aquarium.metricConfigs, uid);
    const updated = await prisma.grafanaManagedDashboard.update({
      where: { id: existing.id },
      data: { status: "SYNCED", lastSyncedAt: new Date(), lastError: null }
    });
    await logSync("SYNC_DASHBOARD", "SUCCEEDED", "Grafana dashboard synced.", aquarium.collectionId, aquarium.id);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grafana dashboard sync failed.";
    await prisma.grafanaManagedDashboard.update({
      where: { id: existing.id },
      data: { status: "FAILED", lastError: message }
    });
    await logSync("SYNC_DASHBOARD", "FAILED", message, aquarium.collectionId, aquarium.id);
    return existing;
  }
}

export function getPanelEmbedUrl(options: { dashboardUid: string; panelId: number; from?: string; to?: string }) {
  const config = grafanaConfig();
  if (!config.publicUrl || config.embedMode !== "iframe") return null;
  const base = config.publicUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    orgId: "1",
    panelId: String(options.panelId),
    from: options.from ?? "now-24h",
    to: options.to ?? "now",
    theme: "light"
  });
  return `${base}/d-solo/${options.dashboardUid}/fluxpoint-aquarium?${params.toString()}`;
}

async function ensureStoredPanels(
  dashboardId: string,
  aquariumId: string,
  collectionId: string,
  configs: { id: string; metricDefinition: { displayName: string }; displayOrder: number }[],
  dashboardUidValue: string
) {
  let panelId = 1;
  for (const config of configs) {
    const embedPath = getPanelEmbedUrl({ dashboardUid: dashboardUidValue, panelId });
    await prisma.graphPanel.upsert({
      where: { metricConfigId_backend: { metricConfigId: config.id, backend: "GRAFANA" } },
      update: { dashboardId, panelId, title: config.metricDefinition.displayName, embedPath },
      create: {
        collectionId,
        aquariumId,
        metricConfigId: config.id,
        dashboardId,
        backend: "GRAFANA",
        panelId,
        title: config.metricDefinition.displayName,
        embedPath
      }
    });
    panelId += 1;
  }
}

function buildDashboard(
  uid: string,
  title: string,
  configs: { metricDefinition: { displayName: string; prometheusName: string; unit: string }; minValue: number | null; maxValue: number | null }[]
) {
  return {
    id: null,
    uid,
    title,
    timezone: "browser",
    schemaVersion: 39,
    version: 1,
    refresh: "30s",
    time: { from: "now-24h", to: "now" },
    panels: configs.map((config, index) => {
      const panelId = index + 1;
      return {
        id: panelId,
        title: config.metricDefinition.displayName,
        type: "timeseries",
        gridPos: { h: 8, w: 12, x: (index % 2) * 12, y: Math.floor(index / 2) * 8 },
        fieldConfig: {
          defaults: {
            unit: grafanaUnit(config.metricDefinition.unit),
            custom: { drawStyle: "line", showPoints: "never" },
            thresholds: {
              mode: "absolute",
              steps: [
                { color: "green", value: null },
                ...(config.minValue !== null ? [{ color: "yellow", value: config.minValue }] : []),
                ...(config.maxValue !== null ? [{ color: "red", value: config.maxValue }] : [])
              ]
            }
          },
          overrides: []
        },
        targets: [
          {
            refId: "A",
            expr: config.metricDefinition.prometheusName,
            legendFormat: "actual"
          },
          ...(config.minValue !== null ? [{ refId: "B", expr: `${config.metricDefinition.prometheusName}_min`, legendFormat: "min" }] : []),
          ...(config.maxValue !== null ? [{ refId: "C", expr: `${config.metricDefinition.prometheusName}_max`, legendFormat: "max" }] : [])
        ]
      };
    })
  };
}

function dashboardUid(aquariumId: string) {
  return `fluxpoint-${aquariumId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 28)}`;
}

function grafanaUnit(unit: string) {
  if (unit === "F") return "fahrenheit";
  if (unit === "pH") return "none";
  if (unit === "ppm") return "ppm";
  if (unit === "%") return "percent";
  return "short";
}

async function grafanaFetch(path: string, init: RequestInit) {
  const config = grafanaConfig();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (config.serviceAccountToken) {
    headers.set("Authorization", `Bearer ${config.serviceAccountToken}`);
  } else if (config.adminPassword) {
    headers.set("Authorization", `Basic ${Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString("base64")}`);
  }
  return fetch(`${config.url.replace(/\/$/, "")}${path}`, { ...init, headers, cache: "no-store" });
}

async function logSync(action: string, status: "SUCCEEDED" | "FAILED" | "SKIPPED", message: string, collectionId?: string, aquariumId?: string) {
  await prisma.metricSyncLog.create({
    data: {
      collectionId,
      aquariumId,
      action,
      status,
      message
    }
  });
}

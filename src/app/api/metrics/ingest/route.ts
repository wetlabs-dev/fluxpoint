import { NextResponse } from "next/server";
import { ingestAquariumMetrics } from "@/domains/metrics/metrics-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return NextResponse.json({ error: "Missing metrics token." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!isIngestPayload(body)) {
    return NextResponse.json({ error: "Expected aquariumId and metrics array." }, { status: 400 });
  }

  try {
    const result = await ingestAquariumMetrics(token, body.aquariumId, body.metrics);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Metrics ingestion failed." },
      { status: 400 }
    );
  }
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return request.headers.get("x-fluxpoint-metrics-token")?.trim() ?? "";
}

function isIngestPayload(value: unknown): value is {
  aquariumId: string;
  metrics: { key: string; value: number; unit?: string; timestamp?: string; source?: "MANUAL" | "SENSOR" | "API" | "IMPORTED"; deviceId?: string; sensorChannelId?: string }[];
} {
  if (!value || typeof value !== "object") return false;
  const payload = value as { aquariumId?: unknown; metrics?: unknown };
  if (typeof payload.aquariumId !== "string" || !Array.isArray(payload.metrics)) return false;
  return payload.metrics.every((metric) => {
    if (!metric || typeof metric !== "object") return false;
    const item = metric as { key?: unknown; value?: unknown; source?: unknown };
    if (typeof item.key !== "string" || typeof item.value !== "number") return false;
    if (item.source && !["MANUAL", "SENSOR", "API", "IMPORTED"].includes(String(item.source))) return false;
    return true;
  });
}

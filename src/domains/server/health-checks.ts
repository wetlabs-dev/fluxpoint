import path from "path";
import type { ServerHealthStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { emailProviderStatus } from "@/domains/email/email-service";
import { pathWritable } from "@/domains/server/server-metrics";

type Check = { key: string; label: string; status: ServerHealthStatus; message: string; metadata?: Record<string, unknown> };

export async function runServerHealthChecks() {
  const checks: Check[] = [{ key: "app", label: "Application", status: "OK", message: "Server-rendered maintenance checks are running." }];
  checks.push({ key: "container_runtime", label: "Container runtime", status: "INFO", message: "Host container inspection is intentionally disabled. Use docker compose ps on the host for runtime state." });
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ key: "database", label: "Database connection", status: "OK", message: "PostgreSQL responded successfully." });
  } catch (error) {
    checks.push({ key: "database", label: "Database connection", status: "CRITICAL", message: error instanceof Error ? error.message : "Database check failed." });
  }
  const [users, collections] = await Promise.all([prisma.user.count(), prisma.collection.count()]);
  checks.push({ key: "default_records", label: "Default user and collection", status: users > 0 && collections > 0 ? "OK" : "CRITICAL", message: `${users} user(s) and ${collections} collection(s) found.` });
  checks.push({ key: "legacy_roles", label: "Legacy role cleanup", status: "OK", message: "Fluxpoint has no legacy site-role table requiring cleanup." });

  for (const [key, label, directory] of [
    ["uploads_writable", "Uploads directory", path.join(process.cwd(), "public", "uploads")],
    ["labels_writable", "Labels directory", path.join(process.cwd(), "public", "labels")],
    ["reports_writable", "Reports directory", path.join(process.cwd(), "public", "reports")],
    ["backups_writable", "Backups directory", path.join(process.cwd(), "backups")]
  ] as const) {
    const writable = await pathWritable(directory);
    checks.push({ key, label, status: writable ? "OK" : "CRITICAL", message: writable ? `${directory} is writable.` : `${directory} is not writable.` });
  }

  const ai = aiProviderStatus();
  checks.push({ key: "ai_provider", label: "AI provider", status: !ai.enabled ? "WARNING" : ai.configured && !ai.fallbackActive ? "OK" : "WARNING", message: !ai.enabled ? "AI is disabled." : ai.configured && !ai.fallbackActive ? `${ai.provider} is configured.` : `${ai.requestedProvider} is not fully configured; ${ai.provider} fallback is active.` });
  const email = emailProviderStatus();
  checks.push({ key: "email_provider", label: "Email provider", status: email.configured && email.provider !== "console" ? "OK" : "WARNING", message: email.configured && email.provider !== "console" ? `${email.provider} delivery is configured.` : "Console/local email is active; production delivery is not configured." });

  await Promise.all(checks.map((check) => prisma.serverHealthCheck.upsert({ where: { key: check.key }, update: { label: check.label, status: check.status, message: check.message, metadata: check.metadata as never, checkedAt: new Date() }, create: { ...check, metadata: check.metadata as never } })));
  return checks;
}

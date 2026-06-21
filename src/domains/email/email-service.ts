import { prisma } from "@/lib/db/prisma";
import { consoleEmailProvider } from "@/domains/email/providers/console-provider";
import { sesEmailProvider } from "@/domains/email/providers/ses-provider";
import type { EmailProvider, OutboundEmail } from "@/domains/email/providers/types";
import { createAuditLog } from "@/domains/audit/audit-service";

type SendEmailInput = OutboundEmail & {
  collectionId?: string | null;
  userId?: string | null;
  template?: string;
  entityType?: string;
  entityId?: string | null;
};

export function emailEnabled() {
  return process.env.EMAIL_ENABLED === "true" || process.env.EMAIL_DELIVERY_MODE === "smtp";
}

export function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || (process.env.EMAIL_DELIVERY_MODE === "smtp" ? "ses" : "console")).toLowerCase();
  if (provider === "ses") return sesEmailProvider;
  return consoleEmailProvider;
}

export function emailProviderStatus() {
  const provider = getEmailProvider();
  return {
    provider: provider.name,
    enabled: emailEnabled() || provider.name === "console",
    configured: provider.configured(),
    region: process.env.AWS_REGION || null,
    from: process.env.SMTP_FROM || process.env.APP_EMAIL_FROM || process.env.SES_FROM_EMAIL || null
  };
}

export function appUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function sendEmail(input: SendEmailInput) {
  const provider = getEmailProvider();
  const enabled = emailEnabled() || provider.name === "console";
  const log = await prisma.emailLog.create({
    data: {
      collectionId: input.collectionId,
      userId: input.userId,
      to: input.to,
      subject: input.subject,
      provider: provider.name,
      status: enabled ? "QUEUED" : "SKIPPED",
      template: input.template,
      entityType: input.entityType,
      entityId: input.entityId
    }
  });

  if (!enabled) {
    await createAuditLog({ collectionId: input.collectionId, entityType: "EmailLog", entityId: log.id, action: "EMAIL_SKIPPED", summary: `${input.template || "Email"} skipped`, actorUserId: input.userId, metadata: { provider: provider.name, template: input.template, entityType: input.entityType, entityId: input.entityId } });
    return { provider: provider.name, messageId: undefined, skipped: true };
  }

  try {
    if (!provider.configured()) throw new Error(`${provider.name} email provider is not configured.`);
    const result = await provider.sendEmail(input);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", messageId: result.messageId, sentAt: new Date() }
    });
    await createAuditLog({ collectionId: input.collectionId, entityType: "EmailLog", entityId: log.id, action: "EMAIL_SENT", summary: `${input.template || "Email"} sent`, actorUserId: input.userId, metadata: { provider: provider.name, template: input.template, entityType: input.entityType, entityId: input.entityId } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message }
    });
    await createAuditLog({ collectionId: input.collectionId, entityType: "EmailLog", entityId: log.id, action: "EMAIL_FAILED", summary: `${input.template || "Email"} failed`, actorUserId: input.userId, severity: "WARNING", details: { provider: provider.name, template: input.template, entityType: input.entityType, entityId: input.entityId, error: message } });
    console.error("Fluxpoint email send failed", { provider: provider.name, to: input.to, subject: input.subject, error: message });
    throw error;
  }
}

"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type CollectionRole, type ServerRole } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireServerAdmin } from "@/domains/server/server-admin";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import {
  accountRequestAdminEmail,
  accountRequestApprovalEmail,
  accountRequestReceivedEmail,
  accountRequestRejectedEmail,
  invitationEmail
} from "@/domains/email/templates";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";

const genericSentPath = "/request-account?sent=1";
const emailDailyLimit = 3;
const ipDailyLimit = 12;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase().slice(0, 320);
}

function text(value: FormDataEntryValue | null, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function clientAddress(headerStore: Headers) {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerStore.get("x-real-ip")?.trim() || null;
}

function roleFromForm(value: FormDataEntryValue | null): CollectionRole {
  const role = String(value || "VIEWER");
  return role === "COLLECTION_OWNER" || role === "AQUARIST" || role === "FISHKEEPER" ? role : "VIEWER";
}

function serverRoleFromForm(value: FormDataEntryValue | null): ServerRole {
  return String(value || "STANDARD_USER") === "SERVER_ADMIN" ? "SERVER_ADMIN" : "STANDARD_USER";
}

async function safeSend(input: Parameters<typeof sendEmail>[0]) {
  try {
    await sendEmail(input);
  } catch {
    // Email delivery is best-effort for account requests; durable request state remains authoritative.
  }
}

async function notifyServerAdmins(request: { id: string; name: string; email: string; requestedCollectionName?: string | null; message?: string | null }) {
  const admins = await prisma.user.findMany({ where: { serverRole: "SERVER_ADMIN", disabledAt: null }, select: { id: true, email: true } });
  await Promise.all(admins.map((admin) => safeSend({
    ...accountRequestAdminEmail({
      requesterName: request.name,
      requesterEmail: request.email,
      requestedCollectionName: request.requestedCollectionName,
      message: request.message,
      actionUrl: appUrl(`/server-maintenance/account-requests?request=${request.id}`)
    }),
    to: admin.email,
    userId: admin.id,
    template: "account-request-admin",
    entityType: "AccountRequest",
    entityId: request.id
  })));
}

export async function submitAccountRequest(formData: FormData) {
  const name = text(formData.get("name"), 160);
  const email = normalizeEmail(formData.get("email"));
  const requestedCollectionName = text(formData.get("requestedCollectionName"), 180) || null;
  const message = text(formData.get("message"), 1200) || null;
  const headerStore = await headers();
  const ipAddress = clientAddress(headerStore);
  const userAgent = headerStore.get("user-agent")?.slice(0, 500) || null;

  if (name.length < 2 || !email.includes("@")) redirect(genericSentPath);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [emailCount, ipCount, existingPending] = await Promise.all([
    prisma.accountRequest.count({ where: { email, requestedAt: { gte: since } } }),
    ipAddress ? prisma.accountRequest.count({ where: { ipAddress, requestedAt: { gte: since } } }) : Promise.resolve(0),
    prisma.accountRequest.findFirst({ where: { email, status: "PENDING" }, select: { id: true } })
  ]);

  if (emailCount >= emailDailyLimit || ipCount >= ipDailyLimit || existingPending) {
    await writeAuditLog({ entityType: "AccountRequest", action: "ACCOUNT_REQUEST_RATE_LIMITED_OR_DUPLICATE", actorEmail: email, severity: "WARNING", details: { emailCount, ipCount, hasExistingPending: Boolean(existingPending), ipAddress, userAgent } });
    redirect(genericSentPath);
  }

  try {
    const request = await prisma.accountRequest.create({
      data: { name, email, requestedCollectionName, message, ipAddress, userAgent }
    });
    await writeAuditLog({ entityType: "AccountRequest", entityId: request.id, action: "ACCOUNT_REQUEST_SUBMITTED", actorEmail: email, after: { email, name, requestedCollectionName, hasMessage: Boolean(message) }, metadata: { ipAddress, userAgent } });
    await Promise.all([
      safeSend({
        ...accountRequestReceivedEmail({ name }),
        to: email,
        template: "account-request-received",
        entityType: "AccountRequest",
        entityId: request.id
      }),
      notifyServerAdmins(request)
    ]);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      await writeAuditLog({ entityType: "AccountRequest", action: "ACCOUNT_REQUEST_SUBMISSION_FAILED", actorEmail: email, severity: "WARNING", details: { error: error instanceof Error ? error.message : String(error), ipAddress, userAgent } });
    }
  }

  redirect(genericSentPath);
}

export async function approveAccountRequest(formData: FormData) {
  const actor = await requireUser();
  await requireServerAdmin(actor);
  const id = String(formData.get("id") || "");
  const collectionId = String(formData.get("collectionId") || "");
  const serverRole = serverRoleFromForm(formData.get("serverRole"));
  const collectionRole = roleFromForm(formData.get("collectionRole"));
  const approvalNotes = text(formData.get("approvalNotes"), 1000) || null;
  if (!collectionId) throw new Error("Choose a collection for the approved account.");

  const request = await prisma.accountRequest.findUniqueOrThrow({ where: { id } });
  if (request.status !== "PENDING") throw new Error("This account request has already been reviewed.");
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: collectionId } });
  const existingUser = await prisma.user.findUnique({ where: { email: request.email } });
  const reviewedAt = new Date();

  if (existingUser) {
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: existingUser.id }, data: { name: existingUser.name || request.name, serverRole, disabledAt: null } }),
      prisma.collectionMembership.upsert({
        where: { collectionId_userId: { collectionId, userId: existingUser.id } },
        create: { collectionId, userId: existingUser.id, role: collectionRole },
        update: { role: collectionRole }
      }),
      prisma.accountRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt,
          reviewedById: actor.id,
          approvalNotes,
          approvedServerRole: serverRole,
          approvedCollectionId: collectionId,
          approvedCollectionRole: collectionRole,
          invitedUserId: existingUser.id
        }
      })
    ]);
    await safeSend({
      ...accountRequestApprovalEmail({ name: request.name, collectionName: collection.name, actionUrl: appUrl("/login") }),
      to: request.email,
      userId: updatedUser.id,
      collectionId,
      template: "account-request-approved-existing-user",
      entityType: "AccountRequest",
      entityId: id
    });
  } else {
    const token = randomBytes(32).toString("base64url");
    const invitation = await prisma.collectionInvitation.create({
      data: {
        collectionId,
        email: request.email,
        role: collectionRole,
        tokenHash: hashToken(token),
        inviterId: actor.id,
        expiresAt: addDays(new Date(), 14)
      }
    });
    await prisma.accountRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt,
        reviewedById: actor.id,
        approvalNotes,
        approvedServerRole: serverRole,
        approvedCollectionId: collectionId,
        approvedCollectionRole: collectionRole,
        invitationId: invitation.id
      }
    });
    await safeSend({
      ...accountRequestApprovalEmail({ name: request.name, collectionName: collection.name, actionUrl: appUrl(`/invite/${token}`) }),
      to: request.email,
      collectionId,
      userId: actor.id,
      template: "account-request-approved-invitation",
      entityType: "AccountRequest",
      entityId: id
    });
    await safeSend({
      ...invitationEmail({ collectionName: collection.name, inviterName: actor.name, role: collectionRole, acceptUrl: appUrl(`/invite/${token}`) }),
      to: request.email,
      collectionId,
      userId: actor.id,
      template: "collection-invitation",
      entityType: "CollectionInvitation",
      entityId: invitation.id
    });
  }

  await writeAuditLog({ collectionId, entityType: "AccountRequest", entityId: id, action: "ACCOUNT_REQUEST_APPROVED", before: request, after: { serverRole, collectionId, collectionRole, existingUserId: existingUser?.id ?? null }, createdById: actor.id });
  revalidatePath("/server-maintenance");
  revalidatePath("/server-maintenance/users");
  revalidatePath("/server-maintenance/account-requests");
  await setFormFlash(`Approved account request for ${request.email}.`);
}

export async function rejectAccountRequest(formData: FormData) {
  const actor = await requireUser();
  await requireServerAdmin(actor);
  const id = String(formData.get("id") || "");
  const rejectionReason = text(formData.get("rejectionReason"), 1000) || null;
  const notify = String(formData.get("notify")) === "on";
  const request = await prisma.accountRequest.findUniqueOrThrow({ where: { id } });
  if (request.status !== "PENDING") throw new Error("This account request has already been reviewed.");
  const updated = await prisma.accountRequest.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: actor.id, rejectionReason } });
  await writeAuditLog({ entityType: "AccountRequest", entityId: id, action: "ACCOUNT_REQUEST_REJECTED", before: request, after: updated, createdById: actor.id, severity: "WARNING" });
  if (notify) {
    await safeSend({
      ...accountRequestRejectedEmail({ name: request.name, reason: rejectionReason }),
      to: request.email,
      userId: actor.id,
      template: "account-request-rejected",
      entityType: "AccountRequest",
      entityId: id
    });
  }
  revalidatePath("/server-maintenance");
  revalidatePath("/server-maintenance/account-requests");
  await setFormFlash(`Rejected account request for ${request.email}.`);
}

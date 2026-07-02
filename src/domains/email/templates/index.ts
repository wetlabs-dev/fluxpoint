import { renderBrandedEmail } from "@/domains/email/templates/base";

export function welcomeEmail(email: string, appUrl?: string) {
  return renderBrandedEmail({
    title: "Welcome to Fluxpoint",
    preview: "Your Fluxpoint account is ready.",
    body: [
      `A Fluxpoint account has been created for ${email}.`,
      "You can now track aquariums, stocking, care tasks, equipment, and the small observations that keep living water stable."
    ],
    actionLabel: "Open Fluxpoint",
    actionUrl: appUrl
  });
}

export function invitationEmail(input: { collectionName: string; inviterName?: string | null; acceptUrl: string; role: string }) {
  return renderBrandedEmail({
    title: `Join ${input.collectionName} on Fluxpoint`,
    preview: "You have been invited to a Fluxpoint collection.",
    body: [
      `${input.inviterName ?? "A Fluxpoint keeper"} invited you to ${input.collectionName} as ${input.role.toLowerCase()}.`,
      "Use the invitation link to open Fluxpoint. Invitation acceptance UI is intentionally lightweight while collection sharing is still being expanded."
    ],
    actionLabel: "Open invitation",
    actionUrl: input.acceptUrl
  });
}

export function accountRequestReceivedEmail(input: { name: string }) {
  return renderBrandedEmail({
    title: "Fluxpoint account request received",
    preview: "A server administrator will review your Fluxpoint access request.",
    body: [
      `Thanks, ${input.name}. Your Fluxpoint account request was sent.`,
      "Fluxpoint access is approved by the server administrator. You will receive another message if access is approved or if the administrator needs more information."
    ],
    actionLabel: undefined,
    actionUrl: undefined
  });
}

export function accountRequestAdminEmail(input: { requesterName: string; requesterEmail: string; requestedCollectionName?: string | null; message?: string | null; actionUrl: string }) {
  return renderBrandedEmail({
    title: "New Fluxpoint account request",
    preview: `${input.requesterName} requested Fluxpoint access.`,
    body: [
      `${input.requesterName} (${input.requesterEmail}) requested access to this Fluxpoint server.`,
      input.requestedCollectionName ? `Requested collection: ${input.requestedCollectionName}.` : "No specific collection was requested.",
      input.message ? `Message: ${input.message}` : "No message was provided."
    ],
    actionLabel: "Review request",
    actionUrl: input.actionUrl
  });
}

export function accountRequestApprovalEmail(input: { name: string; actionUrl?: string | null; collectionName?: string | null }) {
  return renderBrandedEmail({
    title: "Your Fluxpoint access was approved",
    preview: "A server administrator approved your Fluxpoint account request.",
    body: [
      `Good news, ${input.name}: your Fluxpoint access request was approved.`,
      input.collectionName ? `Collection access: ${input.collectionName}.` : "A server administrator updated your Fluxpoint access.",
      input.actionUrl ? "Use the secure link below to finish setup or accept your invitation." : "You can now sign in with your existing Fluxpoint account."
    ],
    actionLabel: input.actionUrl ? "Finish Fluxpoint setup" : "Open Fluxpoint",
    actionUrl: input.actionUrl ?? undefined
  });
}

export function accountRequestRejectedEmail(input: { name: string; reason?: string | null }) {
  return renderBrandedEmail({
    title: "Fluxpoint account request update",
    preview: "Your Fluxpoint account request was reviewed.",
    body: [
      `Hi ${input.name}, a server administrator reviewed your Fluxpoint account request and did not approve it at this time.`,
      input.reason ? `Reason: ${input.reason}` : "If you think this was a mistake, contact the Fluxpoint server administrator directly."
    ],
    actionLabel: undefined,
    actionUrl: undefined
  });
}

export function passwordResetEmail(resetUrl: string) {
  return renderBrandedEmail({
    title: "Reset your Fluxpoint password",
    preview: "Use this single-use link to reset your password.",
    body: [
      "We received a request to reset your Fluxpoint password.",
      "This link is single-use and expires soon. If you did not request it, you can ignore this email."
    ],
    actionLabel: "Reset password",
    actionUrl: resetUrl
  });
}

export function careReminderEmail(input: { title: string; aquariumName?: string | null; dueText: string; actionUrl: string; description?: string | null }) {
  return renderBrandedEmail({
    title: input.title,
    preview: "A Fluxpoint care task is due.",
    body: [
      input.aquariumName ? `Aquarium: ${input.aquariumName}.` : "Collection-wide care task.",
      `Due: ${input.dueText}.`,
      input.description || "Open Fluxpoint to complete or skip this care task."
    ],
    actionLabel: "Open care task",
    actionUrl: input.actionUrl
  });
}

export function careDigestEmail(input: { title: string; lines: string[]; actionUrl: string }) {
  return renderBrandedEmail({
    title: input.title,
    preview: "Your Fluxpoint care digest is ready.",
    body: input.lines.length ? input.lines : ["No urgent care tasks are due right now."],
    actionLabel: "Open Fluxpoint",
    actionUrl: input.actionUrl
  });
}

export function notificationAlertEmail(input: { title: string; body: string; actionUrl: string }) {
  return renderBrandedEmail({ title: input.title, preview: input.body, body: [input.body, "Manage email and push alerts from Account Settings."], actionLabel: "Open Fluxpoint", actionUrl: input.actionUrl });
}

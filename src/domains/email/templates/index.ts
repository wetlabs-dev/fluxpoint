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

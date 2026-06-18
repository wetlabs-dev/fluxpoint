import nodemailer from "nodemailer";
import type { EmailProvider, OutboundEmail } from "@/domains/email/providers/types";

function smtpPort() {
  const port = Number(process.env.SMTP_PORT || process.env.SES_SMTP_PORT || 587);
  return Number.isFinite(port) ? port : 587;
}

function smtpHost() {
  return process.env.SMTP_HOST || (process.env.AWS_REGION ? `email-smtp.${process.env.AWS_REGION}.amazonaws.com` : undefined);
}

export const sesEmailProvider: EmailProvider = {
  name: "ses",
  configured() {
    return Boolean(smtpHost() && (process.env.SMTP_USER || process.env.AWS_ACCESS_KEY_ID) && (process.env.SMTP_PASSWORD || process.env.AWS_SECRET_ACCESS_KEY));
  },
  async sendEmail(message: OutboundEmail) {
    const host = smtpHost();
    if (!host) throw new Error("SMTP_HOST or AWS_REGION is required for SES email.");
    const transporter = nodemailer.createTransport({
      host,
      port: smtpPort(),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || process.env.AWS_ACCESS_KEY_ID,
        pass: process.env.SMTP_PASSWORD || process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    const from = process.env.SMTP_FROM || process.env.APP_EMAIL_FROM || `${process.env.SES_FROM_NAME || "Fluxpoint"} <${process.env.SES_FROM_EMAIL || "no-reply@wetlabs.dev"}>`;
    const info = await transporter.sendMail({
      from,
      to: message.to,
      replyTo: message.replyTo || process.env.SES_REPLY_TO_EMAIL || process.env.SMTP_REPLY_TO,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    return { provider: "ses", messageId: info.messageId };
  }
};

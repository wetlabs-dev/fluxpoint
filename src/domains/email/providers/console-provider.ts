import type { EmailProvider, OutboundEmail } from "@/domains/email/providers/types";

export const consoleEmailProvider: EmailProvider = {
  name: "console",
  configured() {
    return true;
  },
  async sendEmail(message: OutboundEmail) {
    console.info("Fluxpoint console email", {
      to: message.to,
      subject: message.subject,
      replyTo: message.replyTo,
      text: message.text.slice(0, 500)
    });
    return { provider: "console", messageId: `console-${Date.now()}` };
  }
};

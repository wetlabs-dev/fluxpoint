export type EmailProviderName = "console" | "ses";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult = {
  provider: EmailProviderName;
  messageId?: string;
};

export type EmailProvider = {
  name: EmailProviderName;
  configured(): boolean;
  sendEmail(message: OutboundEmail): Promise<EmailSendResult>;
};

type TemplateOptions = {
  title: string;
  preview: string;
  body: string[];
  actionLabel?: string;
  actionUrl?: string;
  footer?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderBrandedEmail({
  title,
  preview,
  body,
  actionLabel,
  actionUrl,
  footer = "Sent by Fluxpoint, keeping aquarium care quietly organized."
}: TemplateOptions) {
  const text = [
    title,
    "",
    ...body,
    ...(actionUrl ? ["", `${actionLabel || "Open Fluxpoint"}: ${actionUrl}`] : []),
    "",
    footer
  ].join("\n");

  const paragraphs = body.map((line) => `<p style="margin:0 0 16px;color:#35565a;font-size:16px;line-height:1.55;">${escapeHtml(line)}</p>`).join("");
  const action = actionUrl
    ? `<p style="margin:28px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:8px;background:#0d4a54;color:#fffaf0;font-weight:700;text-decoration:none;padding:12px 18px;">${escapeHtml(actionLabel || "Open Fluxpoint")}</a></p>`
    : "";

  const html = `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;background:#f5f1e9;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #d7e1d8;border-radius:16px;background:#fffaf0;box-shadow:0 18px 50px rgba(9,46,53,.08);overflow:hidden;">
          <tr><td style="padding:28px 28px 18px;border-bottom:1px solid #d7e1d8;background:#fffdf7;">
            <div style="color:#0d4a54;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Fluxpoint</div>
            <h1 style="margin:8px 0 0;color:#0b3f48;font-size:28px;line-height:1.15;">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:28px;">${paragraphs}${action}<p style="margin:28px 0 0;color:#657b7f;font-size:13px;line-height:1.5;">${escapeHtml(footer)}</p></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject: title, text, html };
}

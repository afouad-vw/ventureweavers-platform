import "server-only";

const FROM = "VentureWeavers <no-reply@mail.ventureweavers.com>";

/** Send a transactional email through Resend. Does nothing until RESEND_API_KEY is set. */
export async function sendEmail(to: string, subject: string, html: string, opts: { replyTo?: string } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status}`);
  return { skipped: false as const };
}

export type BatchEmail = { to: string; subject: string; html: string; headers?: Record<string, string> };

/** Send up to 100 emails in one call to Resend. Returns how many were accepted. */
export async function sendBatch(emails: BatchEmail[]): Promise<{ sent: number; failed: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((e) => ({ from: FROM, to: [e.to], subject: e.subject, html: e.html, headers: e.headers }))),
    }).catch(() => null);
    if (res?.ok) sent += chunk.length;
    else failed += chunk.length;
  }
  return { sent, failed };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The same frame as the sign-in emails in supabase/templates. */
export function emailFrame(title: string, paragraphs: string[], cta?: { label: string; href: string }, footerHtml?: string) {
  return `<!doctype html><html><body style="margin:0;background:#F3F8F5;font-family:'Nunito Sans',Arial,sans-serif;color:#071112">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#071112;padding:20px 28px;color:#29BE9C;font-weight:800;font-size:15px;letter-spacing:0.5px">VentureWeavers</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#3c4a48">${p}</p>`).join("")}
${cta ? `<a href="${esc(cta.href)}" style="display:inline-block;background:#02686F;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px">${esc(cta.label)}</a>` : ""}
</td></tr><tr><td style="padding:16px 28px;border-top:1px solid #e3ece8;font-size:12px;color:#6b7a78">VentureWeavers · Cairo · across MENA${footerHtml ? `<br>${footerHtml}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

export { esc };

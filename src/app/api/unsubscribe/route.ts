import { NextResponse, type NextRequest } from "next/server";
import { esc } from "@/lib/email/send";
import { verifyUnsubscribe } from "@/lib/content/unsubscribe";
import { createServiceClient } from "@/lib/supabase/service";

// The Floor Notes unsubscribe. GET shows a confirm button (so link scanners in mail apps can't
// unsubscribe anyone by opening the link); POST turns the setting off. Mail apps' one-click
// "Unsubscribe" (List-Unsubscribe-Post) also arrives as a POST.

function page(title: string, body: string, form?: { u: string; t: string }) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · VentureWeavers</title>
<style>body{margin:0;background:#F3F8F5;font:14px/1.55 'Nunito Sans',Arial,sans-serif;color:#071112;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
main{background:#fff;border-radius:16px;max-width:420px;width:100%;padding:28px;box-shadow:0 1px 2px rgb(7 17 18/.05)}b.brand{color:#02686F;font-weight:800}h1{font-size:20px;margin:10px 0}
button,a.btn{display:inline-block;background:#02686F;color:#fff;border:0;border-radius:8px;font:700 14px 'Nunito Sans',Arial,sans-serif;padding:11px 18px;cursor:pointer;text-decoration:none}p{color:#3c4a48}</style></head>
<body><main><b class="brand">VentureWeavers</b><h1>${esc(title)}</h1><p>${body}</p>${
    form
      ? `<form method="post"><input type="hidden" name="u" value="${esc(form.u)}"><input type="hidden" name="t" value="${esc(form.t)}"><button type="submit">Unsubscribe</button></form>`
      : `<a class="btn" href="/my-space?tab=profile">Notification settings</a>`
  }</main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyUnsubscribe(u, t)) return page("This link doesn't work", "It may be incomplete. You can turn The Floor Notes off in My space › Profile & settings.");
  return page("Stop The Floor Notes?", "You'll stop getting our newsletter by email. Booking and account emails still arrive.", { u, t });
}

export async function POST(req: NextRequest) {
  // One-click requests put u and t in the address; the confirm form sends them in the body.
  const form = await req.formData().catch(() => null);
  const u = String(form?.get("u") ?? req.nextUrl.searchParams.get("u") ?? "");
  const t = String(form?.get("t") ?? req.nextUrl.searchParams.get("t") ?? "");
  if (!verifyUnsubscribe(u, t)) return page("This link doesn't work", "It may be incomplete. You can turn The Floor Notes off in My space › Profile & settings.");
  const { error } = await createServiceClient().from("profiles").update({ consent_newsletter: false }).eq("id", u);
  if (error) return page("Something went wrong", "Please try again in a minute, or turn it off in My space › Profile & settings.");
  return page("You're unsubscribed", "You won't get The Floor Notes by email any more. You can turn it back on any time in My space.");
}

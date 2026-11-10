import { NextResponse, type NextRequest } from "next/server";
import { INVITEE_URI, verifyCalendlySignature } from "@/lib/calendly";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Calendly webhook (invitee.created, invitee.canceled). Signed with CALENDLY_SIGNING_KEY.
 * Keeps the Requests inbox in step when a meeting booked from the platform is moved or cancelled in Calendly.
 */
export async function POST(req: NextRequest) {
  const key = process.env.CALENDLY_SIGNING_KEY ?? "";
  const body = await req.text();
  if (!key || body.length > 100_000 || !verifyCalendlySignature(req.headers.get("calendly-webhook-signature"), body, key)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let msg: { event?: string; payload?: { uri?: string; scheduled_event?: { start_time?: string; location?: { join_url?: string } } } };
  try {
    msg = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const invitee = msg.payload?.uri ?? "";
  if (!INVITEE_URI.test(invitee)) return NextResponse.json({ ok: true, ignored: true });
  const svc = createServiceClient();
  const { data: r } = await svc.from("requests").select("id, status").eq("calendly_invitee", invitee).maybeSingle();
  if (!r) return NextResponse.json({ ok: true, ignored: true }); // booked outside the platform

  if (msg.event === "invitee.canceled") {
    await svc.from("requests").update({ cancelled_at: new Date().toISOString(), status: "declined" }).eq("id", r.id);
  } else if (msg.event === "invitee.created") {
    const start = msg.payload?.scheduled_event?.start_time;
    const join = msg.payload?.scheduled_event?.location?.join_url;
    await svc
      .from("requests")
      .update({
        ...(start ? { meeting_at: start, preferred_at: start } : {}),
        ...(join && /^https:\/\/[^\s<>"]{3,290}$/.test(join) ? { meeting_url: join } : {}),
      })
      .eq("id", r.id);
  }
  return NextResponse.json({ ok: true });
}

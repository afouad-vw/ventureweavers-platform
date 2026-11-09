import { NextResponse, type NextRequest } from "next/server";
import { sendEventReminder } from "@/lib/email/booking";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Daily at 09:00 Cairo (vercel.json): email a reminder to everyone with a confirmed booking for an
 * event in the next 24-48 hours, and expire lapsed reservations. Vercel sends the CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const svc = createServiceClient();
  await svc.rpc("expire_holds");

  const from = new Date(Date.now() + 15 * 3_600_000).toISOString();
  const to = new Date(Date.now() + 39 * 3_600_000).toISOString();
  const { data: events } = await svc.from("events").select("id, title, starts_at, venue").eq("status", "published").gte("starts_at", from).lt("starts_at", to);

  let sent = 0;
  for (const e of events ?? []) {
    const { data: bookings } = await svc.from("bookings").select("member_id, tickets(code)").eq("event_id", e.id).eq("status", "confirmed");
    for (const b of bookings ?? []) {
      const { data: u } = await svc.auth.admin.getUserById(b.member_id as string);
      const code = (b.tickets as unknown as { code: string } | null)?.code;
      if (u?.user?.email && code) {
        await sendEventReminder(u.user.email, { code, event: e }).then(() => sent++, () => {});
      }
    }
  }
  return NextResponse.json({ events: events?.length ?? 0, sent });
}

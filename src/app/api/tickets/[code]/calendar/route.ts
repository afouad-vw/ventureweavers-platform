import { NextResponse, type NextRequest } from "next/server";
import { eventIcs } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

/** Calendar file for a member's own ticket. Row level security hides other members' tickets. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^VW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("code, bookings(events(id, slug, title, starts_at, venue, description))")
    .eq("code", code)
    .maybeSingle();
  const e = (data as unknown as { bookings: { events: { id: string; slug: string; title: string; starts_at: string | null; venue: string | null; description: string | null } } } | null)?.bookings?.events;
  if (!e?.starts_at) return new NextResponse(null, { status: 404 });
  const ics = eventIcs({ ...e, starts_at: e.starts_at, url: `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}/outloud/events/${e.slug}` });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${e.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

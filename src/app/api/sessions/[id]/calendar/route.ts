import { NextResponse, type NextRequest } from "next/server";
import { eventIcs } from "@/lib/events/format";
import { createClient } from "@/lib/supabase/server";

/** Calendar file for a live session. Row level security returns it only to the cohort's learners (and admins). */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("class_sessions").select("id, title, starts_at, meet_url").eq("id", id).maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const ics = eventIcs({
    id: data.id,
    title: data.title,
    starts_at: data.starts_at,
    venue: data.meet_url ?? "Google Meet",
    description: data.meet_url ? `Join: ${data.meet_url}` : "The Meet link is in your classroom.",
    url: `https://${process.env.APP_HOST ?? "app.ventureweavers.com"}/tvs/classroom?tab=live`,
  });
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="session.ics"`, "Cache-Control": "private, no-store" },
  });
}

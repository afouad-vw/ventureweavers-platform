import "server-only";
import type { Business } from "@/lib/profile/about";
import { createClient } from "@/lib/supabase/server";

export const BUSINESS_COLS = "member_id, name, type, stage, website, member_role, linkedin, position";
type Row = Business & { member_id: string; position: number };

/** A member's businesses in their order (the member themself, or staff with Contacts access). */
export async function businessesOf(memberId: string): Promise<Business[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("member_businesses").select(BUSINESS_COLS).eq("member_id", memberId).order("position");
  return ((data ?? []) as Row[]).map(({ name, type, stage, website, member_role, linkedin }) => ({ name, type, stage, website, member_role, linkedin }));
}

/** Businesses for many members at once, keyed by member id. */
export async function businessesFor(memberIds: string[]): Promise<Map<string, Business[]>> {
  const out = new Map<string, Business[]>();
  if (!memberIds.length) return out;
  const supabase = await createClient();
  for (let i = 0; i < memberIds.length; i += 300) {
    const { data } = await supabase.from("member_businesses").select(BUSINESS_COLS).in("member_id", memberIds.slice(i, i + 300)).order("position");
    for (const r of (data ?? []) as Row[]) {
      const list = out.get(r.member_id) ?? [];
      list.push({ name: r.name, type: r.type, stage: r.stage, website: r.website, member_role: r.member_role, linkedin: r.linkedin });
      out.set(r.member_id, list);
    }
  }
  return out;
}

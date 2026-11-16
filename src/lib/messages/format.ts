/** Messages between members and the VentureWeavers team. Shared by the member page and the admin inbox. */

export const MESSAGE_MAX = 2000;

export type Message = { id: string; body: string; from_team: boolean; created_at: string; author?: string | null };
export type Thread = {
  id: string;
  member_id: string;
  status: "open" | "done";
  last_message_at: string;
  last_member_message_at: string | null;
  member_read_at: string | null;
  team_read_at: string | null;
};

/** Trims a message; null when it is empty or too long. */
export function cleanMessage(raw: unknown): string | null {
  const body = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  return body.length >= 1 && body.length <= MESSAGE_MAX ? body : null;
}

/** Team replies the member hasn't seen yet. */
export function memberUnread(messages: Pick<Message, "from_team" | "created_at">[], readAt: string | null): number {
  return messages.filter((m) => m.from_team && (!readAt || m.created_at > readAt)).length;
}

/** True when the member wrote after the team last opened the thread. */
export function teamUnread(t: Pick<Thread, "last_member_message_at" | "team_read_at">): boolean {
  return Boolean(t.last_member_message_at && (!t.team_read_at || t.last_member_message_at > t.team_read_at));
}

/** Messages grouped by Cairo day, for date separators. */
export function byDay<T extends { created_at: string }>(messages: T[]): { day: string; items: T[] }[] {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const out: { day: string; items: T[] }[] = [];
  for (const m of messages) {
    const day = fmt.format(new Date(m.created_at));
    if (out.at(-1)?.day === day) out.at(-1)!.items.push(m);
    else out.push({ day, items: [m] });
  }
  return out;
}

export const messageTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

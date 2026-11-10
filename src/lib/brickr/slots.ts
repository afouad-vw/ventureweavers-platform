import { cairoLocalToISO, TZ } from "@/lib/events/format";

/** Meeting request times: the next 5 working days in Cairo (Sunday to Thursday), at these times. */
export const SLOTS = ["10:00", "11:30", "13:00", "15:00", "16:30", "18:00"] as const;
const WEEKEND = new Set(["Fri", "Sat"]);

export type Day = { date: string; dow: string; day: string; month: string };

/** The next `count` working days after today in Cairo, as YYYY-MM-DD with labels. */
export function nextWorkingDays(now = new Date(), count = 5): Day[] {
  const out: Day[] = [];
  const parts = (d: Date) => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
    const get = (t: string) => f.find((p) => p.type === t)!.value;
    return { date: `${get("year")}-${get("month")}-${get("day")}`, dow: get("weekday") };
  };
  for (let i = 1; out.length < count && i < 15; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const p = parts(d);
    if (WEEKEND.has(p.dow)) continue;
    const month = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "short" }).format(d);
    out.push({ date: p.date, dow: p.dow, day: String(Number(p.date.slice(8))), month });
  }
  return out;
}

/** Turn a chosen day and slot into a time, only if it is one of the offered choices. */
export function slotToISO(date: string, slot: string, now = new Date()): string | null {
  if (!(SLOTS as readonly string[]).includes(slot)) return null;
  if (!nextWorkingDays(now).some((d) => d.date === date)) return null;
  return cairoLocalToISO(`${date}T${slot}`);
}

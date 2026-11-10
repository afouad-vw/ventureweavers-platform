import { describe, expect, it } from "vitest";
import { auditItem, changedFields, filterTimeline, sortTimeline, type TimelineItem } from "./timeline";

const item = (key: string, at: string, extra: Partial<TimelineItem> = {}): TimelineItem => ({ key, at, space: "Outloud", title: key, ...extra });

describe("timeline", () => {
  it("sorts newest first and drops bad dates", () => {
    const out = sortTimeline([item("a", "2026-11-01T10:00:00Z"), item("b", "2026-11-03T10:00:00Z"), item("c", "not a date"), item("d", "2026-11-02T10:00:00Z")]);
    expect(out.map((i) => i.key)).toEqual(["b", "d", "a"]);
  });
  it("keeps a stable order for the same time", () => {
    const t = "2026-11-01T10:00:00Z";
    expect(sortTimeline([item("z", t), item("a", t)]).map((i) => i.key)).toEqual(["a", "z"]);
  });
  it("filters by space and partner actions", () => {
    const items = [item("a", "2026-11-01", { space: "TVS" }), item("b", "2026-11-01", { space: "House", by: "Ahmed" }), item("c", "2026-11-01")];
    expect(filterTimeline(items, "TVS").map((i) => i.key)).toEqual(["a"]);
    expect(filterTimeline(items, "Partner actions").map((i) => i.key)).toEqual(["b"]);
    expect(filterTimeline(items, "All")).toHaveLength(3);
  });
  it("names the changed fields", () => {
    expect(changedFields({ full_name: "A", goals: ["Education"], phone: "+20 1" }, { full_name: "B", goals: ["Education", "Content"], phone: "+20 1" })).toEqual(["name", "interests"]);
    expect(changedFields(null, { full_name: "B" })).toEqual([]);
  });
  it("turns audit rows into partner actions", () => {
    expect(auditItem({ id: 1, action: "member.suspend", at: "2026-11-10", before: null, after: { reason: "Spam" } }, "Ahmed")).toMatchObject({ title: "Account suspended", detail: "Spam", by: "Ahmed" });
    expect(auditItem({ id: 2, action: "member.password_reset", at: "2026-11-10", before: null, after: null }, "Karim")?.title).toBe("Password reset email sent");
    expect(auditItem({ id: 3, action: "contact.create", at: "2026-11-10", before: null, after: null }, "Karim")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { itemHref, parseAccess, parseVisibility } from "./access";

describe("private items", () => {
  it("reads the people list: members by id, contacts by email, no repeats", () => {
    const r = parseAccess(JSON.stringify([
      { member_id: "00000000-0000-0000-0000-0000000000a1", name: "  Mona  Adel " },
      { member_id: "00000000-0000-0000-0000-0000000000a1", name: "again" },
      { email: "Sara@Example.com", name: "Sara" },
      { email: "sara@example.com" },
      { member_id: "not-an-id" },
      { email: "nope" },
    ]));
    expect(r).toEqual([
      { member_id: "00000000-0000-0000-0000-0000000000a1", name: "Mona Adel" },
      { email: "sara@example.com", name: "Sara" },
    ]);
    expect(parseAccess("{bad")).toEqual([]);
  });
  it("is public unless set to private", () => {
    expect(parseVisibility("private")).toBe("private");
    expect(parseVisibility("anything")).toBe("public");
  });
  it("links invitees to the right page", () => {
    expect(itemHref("event", "vip", { masterclass: true })).toBe("/tvs/masterclasses/vip");
    expect(itemHref("event", "vip")).toBe("/outloud/events/vip");
    expect(itemHref("resource", "x")).toBe("/library");
  });
});

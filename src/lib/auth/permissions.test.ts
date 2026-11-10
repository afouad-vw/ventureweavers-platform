import { describe, expect, it } from "vitest";
import { ALL_PERMS, can, canAny, cleanPerms, describePerms, PRESETS } from "./permissions";

describe("admin permissions", () => {
  it("super admins can do everything", () => {
    expect(ALL_PERMS.every((p) => can({ isSuper: true, perms: [] }, p))).toBe(true);
  });
  it("manage includes view, not the other way round", () => {
    const a = { isSuper: false, perms: ["requests.manage", "contacts.view"] };
    expect(can(a, "requests.view")).toBe(true);
    expect(can(a, "requests.manage")).toBe(true);
    expect(can(a, "contacts.view")).toBe(true);
    expect(can(a, "contacts.manage")).toBe(false);
    expect(can(a, "payments.view")).toBe(false);
  });
  it("door staff can only check in", () => {
    const door = { isSuper: false, perms: PRESETS.find((p) => p.key === "door")!.perms };
    expect(ALL_PERMS.filter((p) => can(door, p))).toEqual(["checkin.manage"]);
  });
  it("any-of checks", () => {
    expect(canAny({ isSuper: false, perms: ["live.manage"] }, ["events.view", "live.manage"])).toBe(true);
    expect(canAny({ isSuper: false, perms: [] }, ["events.view"])).toBe(false);
  });
  it("cleans unknown and redundant permissions", () => {
    expect(cleanPerms(["contacts.view", "contacts.manage", "settings.manage", "checkin.view", "checkin.manage"])).toEqual(["contacts.manage", "checkin.manage"]);
  });
  it("describes access in words", () => {
    expect(describePerms(["requests.manage", "contacts.view"])).toBe("Contacts (view), Requests (manage)");
    expect(describePerms(["checkin.manage"])).toBe("Door check-in");
    expect(describePerms([])).toBe("No access yet");
  });
});

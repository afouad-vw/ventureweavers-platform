import { describe, expect, it } from "vitest";
import { applicationLabel, enrolmentLabel, nextStatus, previousStatus, programCardState, type ApplicationStatus, type EnrolmentStatus } from "./format";

const tvac = { id: "p1", kind: "Foundation", status: "open" };
const v360 = { id: "p2", kind: "360 program", status: "open" };
const angel = { id: "p3", kind: "360 program", status: "in_development" };
const none = { applications: [] as { program_id: string; status: ApplicationStatus }[], enrolledPrograms: new Map<string, EnrolmentStatus>(), interests: new Set<string>() };

describe("program card buttons", () => {
  it("foundation takes applications, 360s show dates, in-development offers Notify me", () => {
    expect(programCardState(tvac, none)).toEqual({ kind: "apply" });
    expect(programCardState(v360, none)).toEqual({ kind: "dates" });
    expect(programCardState(angel, none)).toEqual({ kind: "notify", on: false });
    expect(programCardState(angel, { ...none, interests: new Set(["p3"]) })).toEqual({ kind: "notify", on: true });
  });
  it("follows the member's application and enrolment", () => {
    expect(programCardState(tvac, { ...none, applications: [{ program_id: "p1", status: "intro_call" }] })).toEqual({ kind: "applied", status: "intro_call" });
    expect(programCardState(tvac, { ...none, applications: [{ program_id: "p1", status: "declined" }] })).toEqual({ kind: "apply" });
    expect(programCardState(tvac, { ...none, enrolledPrograms: new Map([["p1", "offered"]]) })).toEqual({ kind: "offered" });
    expect(programCardState(tvac, { ...none, enrolledPrograms: new Map([["p1", "confirmed"]]) })).toEqual({ kind: "enrolled" });
    expect(programCardState(v360, { ...none, enrolledPrograms: new Map([["p2", "confirmed"]]) })).toEqual({ kind: "enrolled" });
  });
});

describe("application board", () => {
  it("moves one column at a time; Won only through an offer", () => {
    expect(nextStatus("new")).toBe("intro_call");
    expect(nextStatus("intro_call")).toBe("proposal");
    expect(nextStatus("proposal")).toBeNull();
    expect(previousStatus("proposal")).toBe("intro_call");
    expect(previousStatus("new")).toBeNull();
    expect(previousStatus("won")).toBeNull();
  });
  it("labels", () => {
    expect(applicationLabel("intro_call")).toBe("Intro call");
    expect(enrolmentLabel("offered")).toBe("Waiting for payment");
    expect(enrolmentLabel("confirmed")).toBe("Enrolled");
  });
});

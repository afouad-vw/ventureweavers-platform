import { describe, expect, it } from "vitest";
import { isHouseLook, isMentorship, panelMeta, SLIDES, slideIndex } from "./house";

describe("house slides", () => {
  it("has the house, five spaces and My space in order", () => {
    expect(SLIDES.map((s) => s.key)).toEqual(["house", "outloud", "tvs", "brickr", "quidquo", "blong", "me"]);
    expect(SLIDES[0].dock).toEqual([]);
    expect(slideIndex("me")).toBe(6);
  });
  it("lists the sections asked for under each space", () => {
    const labels = (k: string) => SLIDES.find((s) => s.key === k)!.dock.map((d) => d.label);
    expect(labels("outloud")).toEqual(["Live content", "Digital content", "Blogs"]);
    expect(labels("tvs")).toEqual(["Programs", "Masterclasses", "Private programs"]);
    expect(labels("brickr")).toEqual(["Fractional services", "Mentorship"]);
    expect(labels("quidquo")).toEqual(["Progress", "Waiting list"]);
    expect(labels("blong")).toEqual(["Communities", "Discussions", "Networking"]);
    expect(labels("me")).toEqual(["Tickets", "Learning", "Requests", "Payments", "My news", "Saved", "Profile settings", "Sign out"]);
  });
});

describe("panelMeta", () => {
  it("names the section for each page", () => {
    expect(panelMeta("/outloud", "").title).toBe("Live content");
    expect(panelMeta("/outloud", "?tab=content").title).toBe("Digital content");
    expect(panelMeta("/outloud", "tab=blog").title).toBe("Blogs");
    expect(panelMeta("/tvs", "?tab=private").title).toBe("Private programs");
    expect(panelMeta("/brickr", "?kind=mentorship").title).toBe("Mentorship");
    expect(panelMeta("/quidquo", "?tab=waitlist").title).toBe("Waiting list");
    expect(panelMeta("/my-space", "?tab=profile").title).toBe("Profile settings");
    expect(panelMeta("/my-space", "").title).toBe("Tickets");
    expect(panelMeta("/my-space", "?tab=privacy").title).toBe("Profile settings");
    expect(panelMeta("/blong/networking", "?tab=requests").title).toBe("Networking");
    expect(panelMeta("/blong/members/00000000-0000-0000-0000-000000000001").detail).toBe(true);
    expect(panelMeta("/blong/communities").space).toBe("blong");
    expect(panelMeta("/blong/networking").detail).toBe(false);
  });
  it("puts each page behind the right space", () => {
    expect(panelMeta("/live").space).toBe("outloud");
    expect(panelMeta("/projects/acme").space).toBe("brickr");
    expect(panelMeta("/messages").space).toBe("house");
    expect(panelMeta("/updates").title).toBe("Updates & Notifications");
  });
  it("marks detail pages so the panel shows Back", () => {
    expect(panelMeta("/outloud/events/open-floor-show-01").detail).toBe(true);
    expect(panelMeta("/tvs/programs/tvac").detail).toBe(true);
    expect(panelMeta("/outloud").detail).toBe(false);
  });
});

describe("isMentorship", () => {
  it("splits BRICKR services", () => {
    expect(isMentorship({ name: "Founder Mentorship" })).toBe(true);
    expect(isMentorship({ name: "Portfolio support", tags: ["Mentorship"] })).toBe(true);
    expect(isMentorship({ name: "Fractional leadership", slug: "fractional-leadership" })).toBe(false);
  });
});

describe("isHouseLook", () => {
  it("is on for everyone unless the browser chose the classic look", () => {
    expect(isHouseLook(undefined)).toBe(true);
    expect(isHouseLook("house")).toBe(true);
    expect(isHouseLook("classic")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isListed, meetingButtons, parseBooking, parsePubStatus, statusLabel, waitItemHref, waitlistCsv } from "./waitlist";

describe("Coming soon statuses", () => {
  it("reads only known statuses, defaulting to Draft", () => {
    expect(parsePubStatus("coming_soon")).toBe("coming_soon");
    expect(parsePubStatus("published")).toBe("published");
    expect(parsePubStatus("open")).toBe("draft");
    expect(parsePubStatus(null)).toBe("draft");
  });
  it("labels and lists", () => {
    expect(statusLabel("coming_soon")).toBe("Coming soon");
    expect(isListed("coming_soon")).toBe(true);
    expect(isListed("draft")).toBe(false);
  });
});

describe("how members meet us", () => {
  const url = "https://calendly.com/karim/brickr-intro";
  it("shows Notify me while Coming soon, whatever the booking setting", () => {
    expect(meetingButtons({ status: "coming_soon", booking: "calendar", calendly_url: url })).toEqual(["notify"]);
  });
  it("follows the booking setting once live", () => {
    expect(meetingButtons({ status: "published", booking: "request", calendly_url: url })).toEqual(["request"]);
    expect(meetingButtons({ status: "published", booking: "calendar", calendly_url: url })).toEqual(["calendar"]);
    expect(meetingButtons({ status: "published", booking: "both", calendly_url: url })).toEqual(["calendar", "request"]);
  });
  it("falls back to a request when the calendar link is missing or not Calendly", () => {
    expect(meetingButtons({ status: "published", booking: "calendar", calendly_url: null })).toEqual(["request"]);
    expect(meetingButtons({ status: "published", booking: "both", calendly_url: "https://evil.example/x" })).toEqual(["request"]);
  });
  it("needs a Calendly link for calendar and both", () => {
    expect(parseBooking("calendar", "")).toEqual({ ok: false, error: expect.stringContaining("Calendly link") });
    expect(parseBooking("both", "https://evil.example/x")).toEqual({ ok: false, error: expect.stringContaining("isn't a Calendly") });
    expect(parseBooking("calendar", "calendly.com/karim/intro")).toEqual({ ok: true, booking: "calendar", calendly_url: "https://calendly.com/karim/intro" });
    expect(parseBooking("anything", "")).toEqual({ ok: true, booking: "request", calendly_url: null });
  });
});

describe("waitlists", () => {
  it("links each kind of item to its page", () => {
    expect(waitItemHref("program", { slug: "angel360" })).toBe("/tvs/programs/angel360");
    expect(waitItemHref("event", { slug: "ai-class", type: "masterclass" })).toBe("/tvs/masterclasses/ai-class");
    expect(waitItemHref("event", { slug: "show-03", type: "public_show" })).toBe("/outloud/events/show-03");
    expect(waitItemHref("service", { slug: "growth", space: "BRICKR" })).toBe("/brickr/services/growth");
    expect(waitItemHref("service", { slug: "private-class", space: "TVS" })).toBe("/tvs");
  });
  it("exports CSV that spreadsheets can't run as formulas", () => {
    const csv = waitlistCsv("Angel360", [
      { member_id: "1", name: "=HYPERLINK(1)", email: "a@b.co", at: "2026-11-17T10:00:00Z", notified: false },
      { member_id: "2", name: "Sara, Cairo", email: null, at: "2026-11-16T10:00:00Z", notified: true },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Item,Name,Email,Joined,Notified");
    expect(lines[1]).toBe(`Angel360,"'=HYPERLINK(1)",a@b.co,2026-11-17,No`);
    expect(lines[2]).toBe(`Angel360,"Sara, Cairo",,2026-11-16,Yes`);
  });
});

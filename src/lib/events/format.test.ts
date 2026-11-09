import { describe, expect, it } from "vitest";
import { bookingBadge, bookingError, cairoLocalToISO, eventIcs, formatEGP, isoToCairoLocal, slugify, toPiasters } from "./format";

describe("money", () => {
  it("formats piasters as EGP", () => {
    expect(formatEGP(45000)).toBe("EGP 450");
    expect(formatEGP(45050)).toBe("EGP 450.50");
    expect(formatEGP(1250000)).toBe("EGP 12,500");
  });
  it("shows a placeholder when the price isn't set", () => {
    expect(formatEGP(null)).toBe("[PRICE]");
  });
  it("parses prices to whole piasters", () => {
    expect(toPiasters("450")).toBe(45000);
    expect(toPiasters("450.5")).toBe(45050);
    expect(toPiasters("1,200.25")).toBe(120025);
    expect(toPiasters(" ")).toBeNull();
  });
  it("rejects bad prices", () => {
    for (const bad of ["-5", "abc", "1.234", "1e5", "99999999"]) expect(() => toPiasters(bad)).toThrow();
  });
  it("never loses a piaster to floating point", () => {
    expect(toPiasters("0.29")).toBe(29);
    expect(toPiasters("19.99")).toBe(1999);
  });
});

describe("Cairo time", () => {
  it("converts winter times (UTC+2)", () => {
    expect(cairoLocalToISO("2026-11-20T19:00")).toBe("2026-11-20T17:00:00.000Z");
  });
  it("converts summer times (UTC+3)", () => {
    expect(cairoLocalToISO("2026-07-15T19:00")).toBe("2026-07-15T16:00:00.000Z");
  });
  it("round-trips for the editor", () => {
    expect(isoToCairoLocal("2026-11-20T17:00:00.000Z")).toBe("2026-11-20T19:00");
    expect(isoToCairoLocal(cairoLocalToISO("2026-07-15T09:30"))).toBe("2026-07-15T09:30");
  });
  it("rejects incomplete input", () => {
    expect(() => cairoLocalToISO("2026-11-20")).toThrow();
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Open Floor · Show 01")).toBe("open-floor-show-01");
    expect(slugify("  Café — Pricing!! ")).toBe("cafe-pricing");
    expect(slugify("!!!")).toBe("event");
  });
});

describe("booking badge", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  it("reserved within the deadline awaits payment", () => {
    expect(bookingBadge({ status: "reserved", hold_expires_at: "2026-11-11T10:00:00Z" }, now).label).toBe("Awaiting payment");
  });
  it("reserved past the deadline shows expired even before cleanup", () => {
    expect(bookingBadge({ status: "reserved", hold_expires_at: "2026-11-09T10:00:00Z" }, now).label).toBe("Expired");
  });
  it("checked in wins", () => {
    expect(bookingBadge({ status: "confirmed", hold_expires_at: null, checked_in_at: "2026-11-10T09:00:00Z" }, now).label).toBe("Checked in");
  });
});

describe("booking errors", () => {
  it("maps database codes to plain words", () => {
    expect(bookingError("ERROR: sold_out")).toMatch(/aren't enough seats/);
    expect(bookingError("weird")).toMatch(/Something went wrong/);
  });
});

describe("calendar file", () => {
  it("builds a valid event with escaped text", () => {
    const ics = eventIcs({ id: "e1", title: "Show, 01; live", starts_at: "2026-11-20T17:00:00.000Z", venue: "Cairo" });
    expect(ics).toContain("DTSTART:20261120T170000Z");
    expect(ics).toContain("DTEND:20261120T190000Z");
    expect(ics).toContain("SUMMARY:Show\\, 01\\; live");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});

import { describe, expect, it } from "vitest";
import { cleanDriveUrl, driveEmbedUrl, formatMoney, isOpenRequest, lines, parseAmount, staffRequestMoves, termLine } from "./format";

describe("project money", () => {
  it("formats amounts with their currency, TBA when unknown", () => {
    expect(formatMoney(3000, "USD")).toBe("USD 3,000");
    expect(formatMoney("12500.5", "EGP")).toBe("EGP 12,500.50");
    expect(formatMoney(null, "USD")).toBe("TBA");
  });
  it("reads typed amounts strictly", () => {
    expect(parseAmount("3,000")).toBe(3000);
    expect(parseAmount("2500.50")).toBe(2500.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-5")).toBeNaN();
    expect(parseAmount("1.234")).toBeNaN();
    expect(parseAmount("12e3")).toBeNaN();
  });
});

describe("request steps for staff", () => {
  it("never lets staff approve on the client's behalf", () => {
    for (const status of ["submitted", "in_review", "quoted", "approved", "in_progress", "client_declined"]) {
      expect(staffRequestMoves({ status, price: 100 })).not.toContain("approved");
    }
  });
  it("paid quotes wait for the client; included work can start", () => {
    expect(staffRequestMoves({ status: "quoted", price: 2500 })).not.toContain("in_progress");
    expect(staffRequestMoves({ status: "quoted", price: 0 })).toContain("in_progress");
    expect(staffRequestMoves({ status: "approved", price: 2500 })).toContain("in_progress");
  });
  it("closed requests have no next step", () => {
    expect(staffRequestMoves({ status: "done", price: 1 })).toEqual([]);
    expect(isOpenRequest("declined")).toBe(false);
    expect(isOpenRequest("quoted")).toBe(true);
  });
});

describe("Google Drive folders", () => {
  it("accepts folder links only, cleaned", () => {
    expect(cleanDriveUrl("https://drive.google.com/drive/u/1/folders/19-mLRAchb5ryFwkD7OFWSdw28BaG5mpf?usp=sharing")).toBe("https://drive.google.com/drive/folders/19-mLRAchb5ryFwkD7OFWSdw28BaG5mpf");
    expect(cleanDriveUrl("https://drive.google.com/file/d/abc/view")).toBe("");
    expect(cleanDriveUrl("https://evil.example/drive/folders/1234567890")).toBe("");
  });
  it("builds the embedded folder view", () => {
    expect(driveEmbedUrl("https://drive.google.com/drive/folders/19-mLRAchb5ryFwkD7OFWSdw28BaG5mpf")).toBe("https://drive.google.com/embeddedfolderview?id=19-mLRAchb5ryFwkD7OFWSdw28BaG5mpf#list");
  });
});

describe("terms and lists", () => {
  it("describes the term", () => {
    expect(termLine({ starts_on: "2026-12-01", term_months: 12 })).toBe("12 months from 1 Dec 2026");
    expect(termLine({ starts_on: null, term_months: null })).toBe("TBA");
  });
  it("cleans typed lines", () => {
    expect(lines(" a \n\n b \n", 12, 300)).toEqual(["a", "b"]);
  });
});

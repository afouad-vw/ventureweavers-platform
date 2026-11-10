import { describe, expect, it } from "vitest";
import { cleanQuery, normalize, rank, score } from "./search";

describe("search", () => {
  it("normalizes case, accents and spaces", () => {
    expect(normalize("  Café   PRICING ")).toBe("cafe pricing");
  });
  it("needs every word", () => {
    expect(score("angel investing", "Angel360", ["From understanding the ecosystem to investing"])).toBeGreaterThan(0);
    expect(score("angel hiring", "Angel360", ["investing"])).toBe(0);
    expect(score("", "Anything", [])).toBe(0);
  });
  it("ranks title matches first", () => {
    const items = [
      { t: "Pricing in a moving currency", d: "" },
      { t: "Hiring your first heads", d: "pricing comes later" },
    ];
    expect(rank("pricing", items, (x) => [x.t, x.d]).map((x) => x.t)).toEqual(["Pricing in a moving currency", "Hiring your first heads"]);
  });
  it("limits results and trims queries", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ t: `Show ${i}` }));
    expect(rank("show", many, (x) => [x.t], 5)).toHaveLength(5);
    expect(cleanQuery("  a   b ")).toBe("a b");
    expect(cleanQuery("x".repeat(200))).toHaveLength(80);
  });
});

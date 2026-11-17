import { describe, expect, it } from "vitest";
import { domainOf, money, nameKey, parseRelationships, parseValue, pipelineTotal, RELATIONSHIPS } from "./format";

describe("business CRM", () => {
  it("adds up open deals per currency", () => {
    expect(pipelineTotal([
      { stage: "Proposal", value: 18000, currency: "USD" },
      { stage: "Lead", value: 2000, currency: "USD" },
      { stage: "Qualified", value: 250000, currency: "EGP" },
      { stage: "Won", value: 99999, currency: "USD" },
      { stage: "Lost", value: 5, currency: "EGP" },
      { stage: "Lead", value: null, currency: "EGP" },
    ])).toBe("USD 20,000 · EGP 250,000");
    expect(pipelineTotal([])).toBe("");
  });
  it("formats and reads values", () => {
    expect(money(18000, "USD")).toBe("USD 18,000");
    expect(money(1500.5, "EGP")).toBe("EGP 1,500.5");
    expect(money(null, "EGP")).toBe("No value yet");
    expect(parseValue("18,000")).toBe(18000);
    expect(parseValue("")).toBeNull();
    expect(parseValue("1.5k")).toBe("invalid");
    expect(parseValue("-5")).toBe("invalid");
  });
  it("spots the same business written differently", () => {
    expect(nameKey("Nile Pay LLC")).toBe(nameKey("nile-pay"));
    expect(domainOf("https://www.NilePay.com/about")).toBe("nilepay.com");
    expect(domainOf("not a url")).toBe("");
  });
});

describe("parseRelationships", () => {
  it("keeps known tags once, in order", () => {
    expect(parseRelationships(["Partner", "Friend", "Client", "Partner"])).toEqual(["Partner", "Client"]);
  });
  it("matches the database list", () => {
    expect(RELATIONSHIPS).toEqual(["Partner", "Client", "Service Provider", "Sponsor", "Investor", "Portfolio", "Prospect", "Community"]);
  });
});

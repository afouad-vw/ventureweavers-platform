import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/profile/options";
import { parseAnswers, QUESTIONS } from "./questions";

const form = (o: Record<string, string>) => (k: string) => o[k];

describe("TVS application questions", () => {
  it("has questions for every role", () => {
    for (const r of ROLES) expect(QUESTIONS[r].length).toBeGreaterThan(1);
  });
  it("asks founders about their venture", () => {
    const r = parseAnswers("Founder", form({ q_venture: "Nile Pay", q_stage: "Seed", q_building: "Payments for SMEs in Egypt", q_team: "2–5" }));
    expect(r.ok && r.stage).toBe("Seed");
    expect(r.ok && r.answers.map((a) => a.q)).toEqual(["Venture name", "Stage", "What are you building, and for whom?", "Team size"]);
    expect(r.ok && r.summary).toBe("Payments for SMEs in Egypt");
  });
  it("requires the role's required answers", () => {
    const r = parseAnswers("Investor or angel", form({ q_investor_type: "Angel", q_sectors: "Fintech" }));
    expect(r).toEqual({ ok: false, error: "Answer “Typical ticket size”." });
  });
  it("only accepts listed options", () => {
    const r = parseAnswers("Investor or angel", form({ q_investor_type: "Angel", q_ticket: "A billion", q_sectors: "x", q_goal: "y" }));
    expect(r.ok).toBe(false);
  });
  it("rejects unknown roles and long answers", () => {
    expect(parseAnswers("Pirate", form({})).ok).toBe(false);
    expect(parseAnswers("Expert or mentor", form({ q_expertise: "x", q_contribute: "y".repeat(1001) })).ok).toBe(false);
  });
});

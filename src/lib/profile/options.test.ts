import { describe, expect, it } from "vitest";
import { cleanOnboarding } from "./options";

const base = { name: " Nour ", phone: "+20 100 <b>", role: "Founder", stage: "Seed", goals: [], topics: [], whatsapp: true, push: false, newsletter: true };

describe("cleanOnboarding", () => {
  it("trims and strips unsafe characters", () => {
    const c = cleanOnboarding(base);
    expect(c.full_name).toBe("Nour");
    expect(c.phone).toBe("+20 100");
  });
  it("drops values that aren't on the lists", () => {
    const c = cleanOnboarding({ ...base, role: "Admin", stage: "x", goals: ["Raise capital", "hack"], topics: ["Growth", "Growth", "<x>"] });
    expect(c.role).toBeNull();
    expect(c.stage).toBeNull();
    expect(c.goals).toEqual(["Raise capital"]);
    expect(c.interests).toEqual(["Growth"]);
  });
  it("needs a phone number for WhatsApp consent", () => {
    expect(cleanOnboarding({ ...base, phone: "" }).consent_whatsapp).toBe(false);
  });
});

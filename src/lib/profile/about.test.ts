import { describe, expect, it } from "vitest";
import { joinPhone, needsAbout, parseAbout, parseBusinesses, splitPhone } from "./about";

const form = (o: Record<string, string | string[]>) => ({
  get: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[])[0] : o[k]),
  getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : o[k] ? [o[k]] : []),
});
const good = { name: "Mona Adel", dial_country: "EG", phone: "0100 123 4567", country: "Egypt", roles: ["Founder", "Expert or mentor"], interests: ["Education", "QuidQuo"], contact: ["WhatsApp", "Email"], newsletter: "on" };

describe("phone numbers", () => {
  it("joins the country code and number", () => {
    expect(joinPhone("EG", "01001234567")).toBe("+20 1001234567");
    expect(joinPhone("SA", "+966 50 123 4567")).toBe("+966 501234567");
    expect(joinPhone("AE", "00971501234567")).toBe("+971 501234567");
    expect(joinPhone("EG", "123")).toBeNull();
    expect(joinPhone("XX", "01001234567")).toBeNull();
  });
  it("splits a stored number for the form", () => {
    expect(splitPhone("+20 1001234567")).toEqual({ dialCountry: "EG", number: "1001234567" });
    expect(splitPhone("+1 4155550100", "CA")).toEqual({ dialCountry: "CA", number: "4155550100" });
  });
});

describe("about you", () => {
  it("accepts a complete form", () => {
    const f = form(good);
    const r = parseAbout(f.get, f.getAll);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.phone).toBe("+20 1001234567");
      expect(r.value.consent_whatsapp).toBe(true);
      expect(r.value.linkedin).toBeNull();
      expect(r.value.consent_newsletter).toBe(true);
      expect(r.value.roles).toEqual(["Founder", "Expert or mentor"]);
      expect(r.businesses).toEqual([]);
    }
  });
  it("needs everything except LinkedIn", () => {
    for (const k of ["name", "phone", "country", "roles", "interests", "contact"]) {
      const f = form({ ...good, [k]: k === "interests" || k === "contact" || k === "roles" ? [] : "" });
      expect(parseAbout(f.get, f.getAll).ok).toBe(false);
    }
  });
  it("checks the LinkedIn link when given", () => {
    const bad = form({ ...good, linkedin: "facebook.com/me" });
    expect(parseAbout(bad.get, bad.getAll).ok).toBe(false);
    const ok = form({ ...good, linkedin: "linkedin.com/in/mona" });
    const r = parseAbout(ok.get, ok.getAll);
    expect(r.ok && r.value.linkedin).toBe("https://www.linkedin.com/in/mona");
  });
  it("ignores unknown choices", () => {
    const f = form({ ...good, interests: ["Hacking"], contact: ["Fax"] });
    expect(parseAbout(f.get, f.getAll).ok).toBe(false);
  });
  it("knows when a member still has to complete it", () => {
    expect(needsAbout({ full_name: "A", phone: "+20 1", country: "Egypt", role: "Founder", goals: ["Education"], contact_prefs: ["Email"] })).toBe(false);
    expect(needsAbout({ full_name: "A", phone: "+20 1", country: null, role: "Founder", goals: ["Education"], contact_prefs: ["Email"] })).toBe(true);
    expect(needsAbout({ full_name: "A", phone: "+20 1", country: "Egypt", role: "Founder", goals: ["Learn with a cohort"], contact_prefs: ["Email"] })).toBe(true);
  });
});

describe("Ecosystem Roles and businesses", () => {
  it("keeps known roles once, in the order picked", () => {
    const f = form({ ...good, roles: ["Expert or mentor", "Pirate", "Expert or mentor", "Founder"] });
    const r = parseAbout(f.get, f.getAll);
    expect(r.ok && r.value.roles).toEqual(["Expert or mentor", "Founder"]);
  });
  it("reads several businesses and cleans their links", () => {
    const r = parseBusinesses(JSON.stringify([
      { name: " Nile  Pay ", type: "Venture", website: "nilepay.com", member_role: "Co-founder", linkedin: "linkedin.com/company/nilepay/" },
      { name: "Delta Angels", type: "Angel Investor" },
      { name: "", type: "", website: "", member_role: "", linkedin: "" },
    ]));
    expect(r).toEqual({ ok: true, value: [
      { name: "Nile Pay", type: "Venture", website: "https://nilepay.com", member_role: "Co-founder", linkedin: "https://www.linkedin.com/company/nilepay" },
      { name: "Delta Angels", type: "Angel Investor", website: null, member_role: null, linkedin: null },
    ] });
  });
  it("refuses bad business details", () => {
    expect(parseBusinesses(JSON.stringify([{ website: "x.com" }])).ok).toBe(false);
    expect(parseBusinesses(JSON.stringify([{ name: "X", website: "not a site" }])).ok).toBe(false);
    expect(parseBusinesses(JSON.stringify([{ name: "X", linkedin: "facebook.com/x" }])).ok).toBe(false);
    expect(parseBusinesses(JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ name: `B${i}` })))).ok).toBe(false);
    expect(parseBusinesses("{oops").ok).toBe(false);
  });
  it("drops unknown business types", () => {
    const r = parseBusinesses(JSON.stringify([{ name: "X", type: "Pirate ship" }]));
    expect(r.ok && r.value[0].type).toBeNull();
  });
});

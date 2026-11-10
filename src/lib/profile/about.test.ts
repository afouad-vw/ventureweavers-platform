import { describe, expect, it } from "vitest";
import { joinPhone, needsAbout, parseAbout, splitPhone } from "./about";

const form = (o: Record<string, string | string[]>) => ({
  get: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[])[0] : o[k]),
  getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : o[k] ? [o[k]] : []),
});
const good = { name: "Mona Adel", dial_country: "EG", phone: "0100 123 4567", country: "Egypt", role: "Founder", interests: ["Education", "QuidQuo"], contact: ["WhatsApp", "Email"], newsletter: "on" };

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
    }
  });
  it("needs everything except LinkedIn", () => {
    for (const k of ["name", "phone", "country", "role", "interests", "contact"]) {
      const f = form({ ...good, [k]: k === "interests" || k === "contact" ? [] : "" });
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

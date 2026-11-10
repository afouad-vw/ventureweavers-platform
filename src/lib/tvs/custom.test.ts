import { describe, expect, it } from "vitest";
import { parseCustomRequest } from "./custom";

const form = (o: Record<string, string>) => (k: string) => o[k];
const good = { name: "Sara Ali", email: "Sara@Example.com", organisation: "Acme Ventures", goals: "Train our 12 portfolio founders on fundraising and pricing.", for_who: "A portfolio", format: "Online" };

describe("custom program request", () => {
  it("accepts a complete request and tidies it", () => {
    const r = parseCustomRequest(form(good));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("sara@example.com");
      expect(r.value.forWho).toBe("A portfolio");
    }
  });
  it("needs a name, email, organisation and goals", () => {
    expect(parseCustomRequest(form({ ...good, name: "" })).ok).toBe(false);
    expect(parseCustomRequest(form({ ...good, email: "nope" })).ok).toBe(false);
    expect(parseCustomRequest(form({ ...good, organisation: "" })).ok).toBe(false);
    expect(parseCustomRequest(form({ ...good, goals: "Short" })).ok).toBe(false);
  });
  it("falls back for unknown choices and strips control characters", () => {
    const r = parseCustomRequest(form({ ...good, for_who: "Hackers", format: "VR", name: "Sara\u0007 Ali" }));
    expect(r.ok && r.value.forWho).toBe("Something else");
    expect(r.ok && r.value.format).toBe("Either");
    expect(r.ok && r.value.name).toBe("Sara Ali");
  });
});

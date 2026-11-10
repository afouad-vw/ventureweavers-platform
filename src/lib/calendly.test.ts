import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cleanCalendlyUrl, INVITEE_URI, verifyCalendlySignature } from "./calendly";

describe("Calendly links", () => {
  it("accepts scheduling pages only", () => {
    expect(cleanCalendlyUrl("calendly.com/karim-hemdan")).toBe("https://calendly.com/karim-hemdan");
    expect(cleanCalendlyUrl("https://calendly.com/karim-hemdan/30min/")).toBe("https://calendly.com/karim-hemdan/30min");
    expect(cleanCalendlyUrl("https://evil.com/karim")).toBe("");
    expect(cleanCalendlyUrl("https://calendly.com.evil.io/x")).toBe("");
    expect(cleanCalendlyUrl("javascript:alert(1)")).toBe("");
  });
  it("recognises booking addresses", () => {
    expect(INVITEE_URI.test("https://api.calendly.com/scheduled_events/ABCDEFGH123/invitees/IJKLMNOP456")).toBe(true);
    expect(INVITEE_URI.test("https://api.calendly.com/scheduled_events/ABC/invitees/x")).toBe(false);
  });
});

describe("Calendly webhook signatures", () => {
  const key = "test-signing-key";
  const body = '{"event":"invitee.canceled"}';
  const now = 1_800_000_000;
  const sign = (t: number, b = body) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${b}`).digest("hex")}`;
  it("accepts a fresh, correct signature", () => {
    expect(verifyCalendlySignature(sign(now), body, key, now)).toBe(true);
  });
  it("rejects tampering, wrong keys, old signatures and junk", () => {
    expect(verifyCalendlySignature(sign(now), body + " ", key, now)).toBe(false);
    expect(verifyCalendlySignature(sign(now), body, "other", now)).toBe(false);
    expect(verifyCalendlySignature(sign(now - 600), body, key, now)).toBe(false);
    expect(verifyCalendlySignature("t=abc,v1=zz", body, key, now)).toBe(false);
    expect(verifyCalendlySignature(null, body, key, now)).toBe(false);
  });
});

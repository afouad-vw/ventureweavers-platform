import { describe, expect, it } from "vitest";
import { draftBody, parseNews, startSection } from "./format";

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = {
    business_name: "Nile Pay", news_type: "Funding round", headline: "Nile Pay raises seed", news_date: "2026-11-10",
    summary: "A seed round.", details: "Full details.", link: "nilepay.example/news", preferred: "Either",
    contact_name: "Laila", contact_email: "Laila@Example.com", consent: "on",
  };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.set(k, v);
  return f;
};
const ours = (u: string) => u.includes("/content-images/");
const now = new Date("2026-11-17T10:00:00Z");

describe("news submissions", () => {
  it("accepts a complete submission and cleans it", () => {
    const r = parseNews(form(), ours, now);
    expect(r.ok && r.value.link).toBe("https://nilepay.example/news");
    expect(r.ok && r.value.contact_email).toBe("laila@example.com");
  });
  it("needs consent, a known type and a real email", () => {
    expect(parseNews(form({ consent: "" }), ours, now)).toMatchObject({ ok: false });
    expect(parseNews(form({ news_type: "Gossip" }), ours, now)).toMatchObject({ ok: false });
    expect(parseNews(form({ contact_email: "nope" }), ours, now)).toMatchObject({ ok: false });
  });
  it("enforces lengths and dates", () => {
    expect(parseNews(form({ summary: "x".repeat(301) }), ours, now)).toMatchObject({ ok: false });
    expect(parseNews(form({ details: "x".repeat(3001) }), ours, now)).toMatchObject({ ok: false });
    expect(parseNews(form({ news_date: "2030-01-01" }), ours, now)).toMatchObject({ ok: false });
  });
  it("only takes images we uploaded", () => {
    expect(parseNews(form({ image_url: "https://evil.example/x.jpg" }), ours, now)).toMatchObject({ ok: false });
    expect(parseNews(form({ image_url: "https://a.supabase.co/storage/v1/object/public/content-images/news/x.jpg" }), ours, now)).toMatchObject({ ok: true });
  });
  it("drafts with the business credited", () => {
    expect(draftBody({ business_name: "Nile Pay", details: "Hi", link: null })).toContain("Shared by Nile Pay");
    expect(startSection("Either")).toBe("Newsletter");
    expect(startSection("VW Notes")).toBe("VW Notes");
  });
});

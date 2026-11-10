import { describe, expect, it } from "vitest";
import { cleanLinkedIn, formatHours, namesOf, parseList, parseOutline, parsePeople, totalHours, peopleLinkError, cleanPhoto } from "./details";

describe("details", () => {
  it("parses hosts and guests, dropping empty rows", () => {
    expect(parsePeople('[{"name":" Ahmed  Fouad ","title":"Co-founder"},{"name":"","title":"x"},{"name":"Karim"}]')).toEqual([
      { name: "Ahmed Fouad", title: "Co-founder" },
      { name: "Karim", title: "" },
    ]);
    expect(parsePeople("not json")).toEqual([]);
    expect(parsePeople(JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ name: `P${i}` }))))).toHaveLength(10);
  });
  it("parses the outline and keeps hours sensible", () => {
    expect(parseOutline('[{"title":"Intro","hours":"1,5"},{"title":"Deep dive","hours":200},{"title":"Q&A","hours":0.1},{"title":"","hours":2}]')).toEqual([
      { title: "Intro", hours: 1.5 },
      { title: "Deep dive", hours: 100 },
      { title: "Q&A", hours: 0.25 },
    ]);
  });
  it("totals and formats hours", () => {
    expect(totalHours([{ title: "a", hours: 1.5 }, { title: "b", hours: 2 }])).toBe(3.5);
    expect(formatHours(1)).toBe("1 hr");
    expect(formatHours(3.5)).toBe("3.5 hrs");
    expect(formatHours(0.5)).toBe("30 min");
  });
  it("cleans lists typed one per line", () => {
    expect(parseList("- Laptop\n\n1. A venture idea\n• laptop\n  Curiosity  ")).toEqual(["Laptop", "A venture idea", "Curiosity"]);
  });
  it("joins names", () => {
    expect(namesOf([{ name: "Ahmed", title: "" }, { name: "Karim", title: "" }])).toBe("Ahmed & Karim");
    expect(namesOf([{ name: "A", title: "" }, { name: "B", title: "" }, { name: "C", title: "" }])).toBe("A, B & C");
  });
  it("keeps only real LinkedIn addresses", () => {
    expect(cleanLinkedIn("linkedin.com/in/ahmed-fouad/")).toBe("https://www.linkedin.com/in/ahmed-fouad");
    expect(cleanLinkedIn("https://eg.linkedin.com/in/karim")).toBe("https://www.linkedin.com/in/karim");
    expect(cleanLinkedIn("https://evil.com/in/x")).toBe("");
    expect(cleanLinkedIn("https://linkedin.com.evil.io/in/x")).toBe("");
    expect(cleanLinkedIn("javascript:alert(1)")).toBe("");
    expect(parsePeople('[{"name":"A","linkedin":"https://www.linkedin.com/in/a"},{"name":"B","linkedin":"nope"}]')).toEqual([
      { name: "A", title: "", linkedin: "https://www.linkedin.com/in/a" },
      { name: "B", title: "" },
    ]);
  });
});

describe("peopleLinkError", () => {
  it("names the person with a bad LinkedIn link", () => {
    expect(peopleLinkError(JSON.stringify([{ name: "Ahmed", linkedin: "linkedin.com/in/ahmed" }]), "host")).toBeNull();
    expect(peopleLinkError(JSON.stringify([{ name: "Ahmed", linkedin: "" }]), "host")).toBeNull();
    expect(peopleLinkError(JSON.stringify([{ name: "Karim", linkedin: "https://twitter.com/karim" }]), "host")).toContain("Karim");
    expect(peopleLinkError("not json", "host")).toBeNull();
  });
});

describe("cleanPhoto", () => {
  it("keeps only photos from the images bucket", () => {
    expect(cleanPhoto("https://abc.supabase.co/storage/v1/object/public/content-images/2026-11/x.jpg")).toContain("content-images");
    expect(cleanPhoto("https://evil.example/x.jpg")).toBe("");
    expect(cleanPhoto("https://abc.supabase.co/storage/v1/object/public/avatars/u/x.jpg")).toBe("");
  });
  it("is kept by parsePeople", () => {
    const [p] = parsePeople(JSON.stringify([{ name: "A", title: "", photo: "https://abc.supabase.co/storage/v1/object/public/content-images/a.png" }]));
    expect(p.photo).toBeTruthy();
  });
});

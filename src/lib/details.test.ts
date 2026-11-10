import { describe, expect, it } from "vitest";
import { formatHours, namesOf, parseList, parseOutline, parsePeople, totalHours } from "./details";

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
});

import { describe, expect, it } from "vitest";
import { parseCsv, toContacts } from "./import";

describe("contacts CSV import", () => {
  it("reads quotes, commas, semicolons and line endings", () => {
    expect(parseCsv('name,company\r\n"Hassan, Nour","Acme ""Labs"""\nOmar;Fund\n\n')).toEqual([["name", "company"], ["Hassan, Nour", 'Acme "Labs"'], ["Omar", "Fund"]]);
    expect(parseCsv("﻿name\nA")).toEqual([["name"], ["A"]]);
  });

  it("maps columns by header and cleans values", () => {
    const r = toContacts(parseCsv("Full name,E-mail,Mobile,Company,Role,Spaces\nNour Hassan,NOUR@x.com,+20 100 (123) abc,Acme,Founder · Seed,\"tvs, Outloud, Mars\""));
    expect(r.skipped).toEqual([]);
    expect(r.rows).toEqual([{ name: "Nour Hassan", email: "nour@x.com", phone: "+20 100 (123) ", company: "Acme", role: "Founder · Seed", tags: ["TVS", "Outloud"] }]);
  });

  it("skips rows without a name, bad emails and duplicates", () => {
    const r = toContacts(parseCsv("name,email\n,a@x.com\nA,not-an-email\nB,b@x.com\nC,B@X.com\nD,old@x.com\nE,"), new Set(["OLD@x.com"]));
    expect(r.rows.map((x) => x.name)).toEqual(["B", "E"]);
    expect(r.skipped.map((s) => s.line)).toEqual([2, 3, 5, 6]);
  });

  it("needs a name column", () => {
    expect(toContacts(parseCsv("email\na@x.com")).skipped[0].reason).toMatch(/name/);
    expect(toContacts([]).skipped[0].reason).toMatch(/empty/);
  });
});

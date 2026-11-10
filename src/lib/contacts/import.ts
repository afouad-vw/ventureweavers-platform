/** CSV import for contacts: reads the file, maps the columns, checks each row. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === "," || c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export type ImportRow = { name: string; email: string | null; phone: string | null; company: string | null; role: string | null; tags: string[] };
export type ImportResult = { rows: ImportRow[]; skipped: { line: number; reason: string }[] };

const FIELDS: Record<keyof ImportRow, string[]> = {
  name: ["name", "full name", "fullname", "contact"],
  email: ["email", "e-mail", "email address"],
  phone: ["mobile", "phone", "whatsapp", "phone number", "mobile number"],
  company: ["company", "organisation", "organization", "fund"],
  role: ["role", "title", "role · stage", "role/stage"],
  tags: ["tags", "spaces", "space"],
};
const SPACES = ["Outloud", "TVS", "BRICKR", "QuidQuo"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MAX_ROWS = 1000;

/** Map a parsed CSV to contacts. Rows without a name, with a bad email, or repeating an email are skipped. */
export function toContacts(table: string[][], existingEmails: Set<string> = new Set()): ImportResult {
  const skipped: ImportResult["skipped"] = [];
  if (!table.length) return { rows: [], skipped: [{ line: 1, reason: "The file is empty." }] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (k: keyof ImportRow) => header.findIndex((h) => FIELDS[k].includes(h));
  const idx = { name: col("name"), email: col("email"), phone: col("phone"), company: col("company"), role: col("role"), tags: col("tags") };
  if (idx.name < 0) return { rows: [], skipped: [{ line: 1, reason: "Add a header row with at least a “name” column." }] };
  const seen = new Set(Array.from(existingEmails, (e) => e.toLowerCase()));
  const rows: ImportRow[] = [];
  table.slice(1).forEach((r, n) => {
    const line = n + 2;
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const name = get(idx.name).slice(0, 120);
    if (!name) return skipped.push({ line, reason: "No name" });
    const email = get(idx.email).toLowerCase() || null;
    if (email && !EMAIL.test(email)) return skipped.push({ line, reason: `Email doesn't look right: ${email}` });
    if (email && seen.has(email)) return skipped.push({ line, reason: `Already in contacts: ${email}` });
    if (rows.length >= MAX_ROWS) return skipped.push({ line, reason: `More than ${MAX_ROWS} rows` });
    if (email) seen.add(email);
    const tags = get(idx.tags)
      .split(/[|,/]/)
      .map((t) => SPACES.find((s) => s.toLowerCase() === t.trim().toLowerCase()))
      .filter((t): t is string => Boolean(t));
    rows.push({
      name,
      email,
      phone: get(idx.phone).replace(/[^\d+ ()-]/g, "").slice(0, 40) || null,
      company: get(idx.company).slice(0, 120) || null,
      role: get(idx.role).slice(0, 80) || null,
      tags: Array.from(new Set(tags)),
    });
  });
  return { rows, skipped };
}

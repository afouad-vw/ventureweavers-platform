import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("csv", () => {
  it("quotes cells and escapes quotes", () => {
    expect(toCsv(["Name", "Note"], [["Nour", 'Said "hi"'], [null, 3]])).toBe('"Name","Note"\r\n"Nour","Said ""hi"""\r\n"","3"\r\n');
  });
  it("defuses spreadsheet formulas", () => {
    expect(toCsv(["x"], [["=HYPERLINK(1)"], ["+20 100"], ["-1"], ["@cmd"]])).toBe('"x"\r\n"\'=HYPERLINK(1)"\r\n"\'+20 100"\r\n"\'-1"\r\n"\'@cmd"\r\n');
  });
});

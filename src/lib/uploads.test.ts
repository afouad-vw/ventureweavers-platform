import { describe, expect, it } from "vitest";
import { checkUpload, cleanFileName, contentMatches, sniff } from "./uploads";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("upload checks", () => {
  it("accepts the right types and sizes", () => {
    expect(checkUpload("library-files", "Report.PDF", 1000)).toBeNull();
    expect(checkUpload("library-files", "deck.pptx", 20 * 1024 * 1024)).toBeNull();
    expect(checkUpload("library-files", "deck.pptx", 20 * 1024 * 1024 + 1)).toMatch(/20 MB/);
    expect(checkUpload("library-files", "run.exe", 10)).toMatch(/PDF, Word/);
    expect(checkUpload("library-files", "page.html", 10)).toMatch(/PDF, Word/);
    expect(checkUpload("content-images", "banner.webp", 5 * 1024 * 1024)).toBeNull();
    expect(checkUpload("content-images", "banner.svg", 10)).toMatch(/JPG, PNG or WebP/);
    expect(checkUpload("event-banners", "x.jpg", 0)).toMatch(/empty/);
  });

  it("reads what a file really is", () => {
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46))).toBe("pdf");
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
    expect(sniff(bytes(0xd0, 0xcf, 0x11, 0xe0))).toBe("ole");
    expect(sniff(bytes(0xff, 0xd8, 0xff))).toBe("jpg");
    expect(sniff(bytes(0x3c, 0x68, 0x74, 0x6d))).toBeNull(); // "<htm"
  });

  it("matches content to the extension", () => {
    expect(contentMatches("docx", "zip")).toBe(true);
    expect(contentMatches("doc", "ole")).toBe(true);
    expect(contentMatches("pdf", "zip")).toBe(false);
    expect(contentMatches("jpeg", "jpg")).toBe(true);
    expect(contentMatches("png", "jpg")).toBe(false);
    expect(contentMatches("pdf", null)).toBe(false);
  });

  it("tidies download names", () => {
    expect(cleanFileName("Growth  diagnostic <v2>.pdf")).toBe("Growth diagnostic v2.pdf");
    expect(cleanFileName("../../etc/passwd.pdf")).toBe("etcpasswd.pdf");
    expect(cleanFileName("???.zip")).toBe("file.zip");
  });
});

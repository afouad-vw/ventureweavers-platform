/** Upload rules shared by the browser (early checks) and the server (the checks that count). */

export type UploadTarget = "event-banners" | "content-images" | "library-files" | "cohort-files";

export const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const LIBRARY_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

export const UPLOAD_RULES: Record<UploadTarget, { maxBytes: number; types: Record<string, string>; public: boolean }> = {
  "event-banners": { maxBytes: 5 * 1024 * 1024, types: IMAGE_TYPES, public: true },
  "content-images": { maxBytes: 5 * 1024 * 1024, types: IMAGE_TYPES, public: true },
  "library-files": { maxBytes: 20 * 1024 * 1024, types: LIBRARY_TYPES, public: false },
  "cohort-files": { maxBytes: 20 * 1024 * 1024, types: LIBRARY_TYPES, public: false },
};

export const extOf = (name: string) => (/\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1] ?? "").toLowerCase();

/** Checks before uploading. Returns an error to show, or null. */
export function checkUpload(target: UploadTarget, name: string, size: number): string | null {
  const rule = UPLOAD_RULES[target];
  const ext = extOf(name);
  if (!rule.types[ext]) return rule.public ? "Use a JPG, PNG or WebP image." : "Use a PDF, Word, Excel, PowerPoint or ZIP file.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > rule.maxBytes) return `The file is larger than ${rule.maxBytes / 1024 / 1024} MB.`;
  return null;
}

/**
 * What the first bytes of a file say it is. Office files from 2007 on (docx, xlsx, pptx) are ZIP
 * archives; older ones (doc, xls, ppt) share one container format.
 */
export function sniff(b: Uint8Array): "jpg" | "png" | "webp" | "pdf" | "zip" | "ole" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06)) return "zip";
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "ole";
  return null;
}

/** Does the content match the file's extension? */
export function contentMatches(ext: string, kind: ReturnType<typeof sniff>): boolean {
  if (!kind) return false;
  if (ext === "jpg" || ext === "jpeg") return kind === "jpg";
  if (ext === "png" || ext === "webp" || ext === "pdf" || ext === "zip") return kind === ext;
  if (["docx", "xlsx", "pptx"].includes(ext)) return kind === "zip";
  if (["doc", "xls", "ppt"].includes(ext)) return kind === "ole";
  return false;
}

/** A tidy download name: letters, digits, spaces, dots, dashes; keeps the extension. */
export function cleanFileName(name: string): string {
  const ext = extOf(name);
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^\w .-]+/g, "").replace(/\s+/g, " ").replace(/^[. ]+/, "").trim().slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

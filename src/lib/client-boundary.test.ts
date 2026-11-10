import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Server pages can render components from "use client" files, but can't call their plain functions:
// that throws at request time ("Attempted to call X() from the server"). So client files may only
// export components (Capitalised), hooks (useX) and plain values, never helper functions.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("client boundary", () => {
  it("client files export no helper functions", () => {
    const offenders: string[] = [];
    for (const f of files(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      for (const m of src.matchAll(/^export (?:async )?function ([a-z]\w*)/gm)) {
        if (!/^use[A-Z]/.test(m[1])) offenders.push(`${f.replace(process.cwd() + "/", "")}: ${m[1]}`);
      }
      for (const m of src.matchAll(/^export const ([a-z]\w*)\s*=\s*(?:async\s*)?\(/gm)) offenders.push(`${f.replace(process.cwd() + "/", "")}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * A small Markdown reader for blog posts. It turns text into a list of blocks and inline pieces,
 * which the page renders as React elements. Raw HTML is never passed through: anything that
 * looks like a tag is shown as text, and links only work for https, mailto and paths in the app.
 *
 * Supported: ## and ### headings, paragraphs, **bold**, *italic* or _italic_, `code`,
 * [links](https://…), - or * bullet lists, 1. numbered lists, > quotes, and --- dividers.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "h2" | "h3"; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "quote"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "hr" };

/** Only these links are made clickable. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https:\/\/[^\s<>"]+$/i.test(href)) return href;
  if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(href)) return href;
  if (/^\/(?!\/)[^\s<>"]*$/.test(href)) return href;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    // escaped character
    if (rest[0] === "\\" && rest.length > 1 && /[\\`*_[\]()#>-]/.test(rest[1])) {
      buf += rest[1];
      i += 2;
      continue;
    }
    if (rest[0] === "`") {
      const end = rest.indexOf("`", 1);
      if (end > 1) {
        flush();
        out.push({ t: "code", v: rest.slice(1, end) });
        i += end + 1;
        continue;
      }
    }
    if (rest.startsWith("**")) {
      const end = rest.indexOf("**", 2);
      if (end > 2) {
        flush();
        out.push({ t: "strong", c: parseInline(rest.slice(2, end)) });
        i += end + 2;
        continue;
      }
    }
    if ((rest[0] === "*" || rest[0] === "_") && rest[1] !== rest[0] && rest[1] !== " ") {
      const end = rest.indexOf(rest[0], 1);
      if (end > 1 && rest[end - 1] !== " ") {
        flush();
        out.push({ t: "em", c: parseInline(rest.slice(1, end)) });
        i += end + 1;
        continue;
      }
    }
    if (rest[0] === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
      if (m) {
        flush();
        const href = safeHref(m[2]);
        const label = parseInline(m[1]);
        if (href) out.push({ t: "link", href, c: label });
        else out.push(...label);
        i += m[0].length;
        continue;
      }
    }
    buf += rest[0];
    i += 1;
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const endPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ").trim()) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      endPara();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      endPara();
      // One page title already exists, so # and ## both become section headings.
      blocks.push({ t: h[1].length === 3 ? "h3" : "h2", c: parseInline(h[2].replace(/\s+#+$/, "")) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      endPara();
      blocks.push({ t: "hr" });
      continue;
    }
    if (trimmed.startsWith(">")) {
      endPara();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        q.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ t: "quote", c: parseInline(q.join(" ").trim()) });
      continue;
    }
    const isUl = (s: string) => /^[-*+]\s+/.test(s.trim());
    const isOl = (s: string) => /^\d{1,3}[.)]\s+/.test(s.trim());
    if (isUl(trimmed) || isOl(trimmed)) {
      endPara();
      const ordered = isOl(trimmed);
      const test = ordered ? isOl : isUl;
      const items: Inline[][] = [];
      while (i < lines.length && lines[i].trim() && test(lines[i])) {
        items.push(parseInline(lines[i].trim().replace(ordered ? /^\d{1,3}[.)]\s+/ : /^[-*+]\s+/, "")));
        i++;
      }
      i--;
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    para.push(trimmed);
  }
  endPara();
  return blocks;
}

/** Plain text of the body, for summaries and read time. */
export function markdownText(src: string): string {
  const walk = (c: Inline[]): string => c.map((x) => (x.t === "text" || x.t === "code" ? x.v : walk(x.c))).join("");
  return parseMarkdown(src)
    .map((b) => ("items" in b ? b.items.map(walk).join(" ") : "c" in b ? walk(b.c) : ""))
    .filter(Boolean)
    .join("\n\n");
}

/** "4 min" at about 200 words a minute, never less than 1. */
export function readTime(src: string): string {
  const words = markdownText(src).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min`;
}

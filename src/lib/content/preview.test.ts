import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { allowedPreview, ogImage } from "./preview";

describe("post previews", () => {
  it("reads og:image in either attribute order", () => {
    expect(ogImage('<meta property="og:image" content="https://scontent.cdninstagram.com/a.jpg?x=1&amp;y=2">')).toBe("https://scontent.cdninstagram.com/a.jpg?x=1&y=2");
    expect(ogImage('<meta content="https://media.licdn.com/b.jpg" property="og:image" />')).toBe("https://media.licdn.com/b.jpg");
    expect(ogImage("<title>none</title>")).toBeNull();
  });
  it("only keeps images from the platforms' own image servers", () => {
    expect(allowedPreview("https://p16-sign-va.tiktokcdn.com/x.jpeg")).not.toBeNull();
    expect(allowedPreview("https://i.ytimg.com/vi/abc/hqdefault.jpg")).not.toBeNull();
    expect(allowedPreview("https://evil.example/x.jpg")).toBeNull();
    expect(allowedPreview("http://media.licdn.com/x.jpg")).toBeNull();
    expect(allowedPreview(42)).toBeNull();
  });
});

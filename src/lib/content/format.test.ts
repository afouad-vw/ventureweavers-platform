import { describe, expect, it } from "vitest";

import { youtubeThumb } from "./format";
describe("YouTube thumbnails", () => {
  it("finds the video in common links", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1", "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/embed/dQw4w9WgXcQ"]) {
      expect(youtubeThumb(u)).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    }
  });
  it("ignores other links", () => {
    expect(youtubeThumb("https://www.instagram.com/p/abc")).toBeNull();
    expect(youtubeThumb("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeThumb(null)).toBeNull();
  });
});

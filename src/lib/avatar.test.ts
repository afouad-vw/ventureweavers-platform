import { describe, expect, it } from "vitest";
import { sharpAvatar } from "./avatar";

describe("sharpAvatar", () => {
  it("asks Google for a larger photo", () => {
    expect(sharpAvatar("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")).toBe("https://lh3.googleusercontent.com/a/ACg8ocK=s640-c");
    expect(sharpAvatar("https://lh3.googleusercontent.com/a/ACg8ocK")).toBe("https://lh3.googleusercontent.com/a/ACg8ocK=s640-c");
  });
  it("leaves other photos alone", () => {
    const li = "https://media.licdn.com/dms/image/x/profile-displayphoto-shrink_100_100/0?e=1&v=beta&t=abc";
    expect(sharpAvatar(li)).toBe(li);
    expect(sharpAvatar("https://x.supabase.co/storage/v1/object/public/avatars/a.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/avatars/a.jpg");
    expect(sharpAvatar(null)).toBeNull();
  });
});

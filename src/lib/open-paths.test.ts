import { describe, expect, it } from "vitest";
import { isOpenPath } from "./open-paths";

describe("sign-in wall", () => {
  it("keeps sign-in, join, password reset, auth callbacks, APIs and the privacy and terms pages open", () => {
    for (const p of ["/sign-in", "/join", "/forgot-password", "/reset-password", "/auth/confirm", "/auth/callback", "/api/unsubscribe", "/api/cron/reminders", "/privacy", "/terms"]) expect(isOpenPath(p)).toBe(true);
  });
  it("puts every member page behind sign-in", () => {
    for (const p of ["/", "/outloud", "/outloud/blog/x", "/outloud/events/show-01", "/tvs", "/tvs/programs/tvac", "/brickr/services/x", "/library", "/search", "/live", "/my-space", "/welcome", "/sign-in-x", "/joinus", "/privacy-x", "/termsx"]) expect(isOpenPath(p)).toBe(false);
  });
});

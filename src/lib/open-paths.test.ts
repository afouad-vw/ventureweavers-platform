import { describe, expect, it } from "vitest";
import { isOpenPath } from "./open-paths";

describe("sign-in wall", () => {
  it("keeps sign-in, join, password reset, auth callbacks and APIs open", () => {
    for (const p of ["/sign-in", "/join", "/forgot-password", "/reset-password", "/auth/confirm", "/auth/callback", "/api/unsubscribe", "/api/cron/reminders"]) expect(isOpenPath(p)).toBe(true);
  });
  it("puts every member page behind sign-in", () => {
    for (const p of ["/", "/outloud", "/outloud/blog/x", "/outloud/events/show-01", "/tvs", "/tvs/programs/tvac", "/brickr/services/x", "/library", "/search", "/live", "/my-space", "/welcome", "/sign-in-x", "/joinus"]) expect(isOpenPath(p)).toBe(false);
  });
});

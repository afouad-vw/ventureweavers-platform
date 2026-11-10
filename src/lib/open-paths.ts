/** Member-app paths open to people who aren't signed in. Everything else sends them to sign in (Phase 12). */
const OPEN = ["/sign-in", "/join", "/forgot-password", "/reset-password", "/auth", "/api", "/__not-found", "/site", "/dev"];

export const isOpenPath = (p: string) => OPEN.some((o) => p === o || p.startsWith(o + "/"));

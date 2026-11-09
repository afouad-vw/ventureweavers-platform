/** Pure rules for sign-in and admin sessions. Kept free of I/O so they can be unit tested. */

export const LOCKOUT = { windowMinutes: 15, maxFailures: 5 } as const;
export const ADMIN_SESSION = { idleHours: 12, maxDays: 7, touchEveryMinutes: 5 } as const;
export const PASSWORD_MIN = { member: 10, admin: 12 } as const;

/** Locked when either the username or the IP has too many failures in the window. */
export function isLockedOut(failures: { byUsername: number; byIp: number }) {
  return failures.byUsername >= LOCKOUT.maxFailures || failures.byIp >= LOCKOUT.maxFailures;
}

export type SessionVerdict = "ok" | "touch" | "expired";

/** Decide what to do with an admin session: keep it, record activity, or end it. */
export function adminSessionVerdict(
  s: { createdAt: Date; lastSeenAt: Date; revokedAt: Date | null },
  now: Date = new Date(),
): SessionVerdict {
  const h = 3_600_000;
  if (s.revokedAt) return "expired";
  if (now.getTime() - s.lastSeenAt.getTime() > ADMIN_SESSION.idleHours * h) return "expired";
  if (now.getTime() - s.createdAt.getTime() > ADMIN_SESSION.maxDays * 24 * h) return "expired";
  if (now.getTime() - s.lastSeenAt.getTime() > ADMIN_SESSION.touchEveryMinutes * 60_000) return "touch";
  return "ok";
}

/** Only allow same-site relative paths as a post-sign-in destination (blocks open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** First IP in X-Forwarded-For (set by Vercel), or X-Real-IP. Returns null when unknown or malformed. */
export function clientIp(h: { get(name: string): string | null }) {
  const raw = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

/** Which email link types each surface accepts. Admin invites only on the admin host; member links only on the app. */
export function allowedOtpType(surface: string | null, type: string | null) {
  if (surface === "admin") return type === "invite";
  return type === "email" || type === "signup" || type === "recovery" || type === "email_change";
}

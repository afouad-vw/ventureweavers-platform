# Phase 2 plan: accounts, access and the data model

Status: **waiting for approval** (CLAUDE.md: plan first for database, auth and access rules).

## 1. Addresses (done in code, live once domains are connected)

| Address | Serves | Notes |
| --- | --- | --- |
| `ventureweavers.com` | Landing page | Any other path redirects to the app. `www` redirects here. |
| `app.ventureweavers.com` | Member app | `/admin…` returns 404. |
| `admin.ventureweavers.com` | Admin console | Clean URLs (`/contacts`), `noindex`, `/admin…` redirects to the clean form. |
| `*.vercel.app`, previews | Path mode for testing | `noindex`. Set `HOST_MODE=strict` in Vercel production once domains work, so the vercel.app address forwards to the app and never shows admin. |

Routing lives in `src/lib/hosts.ts` (tested in `hosts.test.ts`) and `src/middleware.ts`.
Security headers (CSP, HSTS, frame blocking, nosniff, referrer and permissions policies) are in `next.config.ts`.

## 2. Member accounts

- Sign in with **Google**, **LinkedIn** (OpenID Connect) or **email and password**.
- Email accounts must confirm their email before first sign-in. Passwords: at least 10 characters; leaked-password check turned on.
- Password reset by emailed link (`/forgot-password`).
- Bot protection on sign-up and reset: Cloudflare Turnstile (Supabase supports it natively).
- After first sign-in: short onboarding (role, stage, interests, consent for email/WhatsApp), stored in `profiles`.
- Auth emails sent through Resend from our domain (Supabase's built-in sender is rate-limited and lands in spam).

## 3. Admin accounts

- Two accounts: Ahmed and Karim. No public sign-up; no Google/LinkedIn for admins.
- Created by invite to each partner's email. Each sets their own password on first visit; nobody else sees it.
- Sign in with **username + password** at `admin.ventureweavers.com/sign-in`. The server looks the username up in `admin_users`; wrong username and wrong password give the same message.
- **2-step verification required** (authenticator app, Supabase MFA). No admin page or action works until the session has passed it (`aal2`).
- Separate sessions: cookies are host-only, so being signed in on the app never signs you in to admin, and the reverse.
- Lockout: 5 failed attempts per username or IP in 15 minutes blocks further tries for 15 minutes. Attempts are recorded.
- Idle timeout: admin sessions end after 12 hours without activity; absolute limit 7 days.
- Every admin change is written to an append-only `audit_log` (who, what, before/after, when, IP).

## 4. How access is enforced

Three layers, so one mistake doesn't expose data:

1. **Address**: the middleware above (admin pages only exist on the admin host).
2. **Server**: every admin page and server action calls `requireAdmin()` (signed in + listed in `admin_users` + `aal2`). Member pages that need an account call `requireMember()`.
3. **Database**: Row Level Security on every table.
   - Published content is readable by anyone; drafts only by admins.
   - Members read and change only their own rows (profile, tickets, enrolments, submissions, requests, saved items, waitlist entry).
   - Classroom material only for learners enrolled in that cohort; Library items by access level (members, learners, clients, waitlist).
   - Payments are written only by the server (gateway webhooks); members read their own.
   - `is_admin()` checks `admin_users` and `aal2` from the token, so admin rights can't come from a member account.
   - `admin_users`, `audit_log` and `auth_attempts` have no write path from the browser at all.
   - The service key stays on the server (Vercel env); it is never sent to the browser.

Tests: unit tests for routing and guards, plus database tests that sign in as anonymous, member, other member and admin and check every table allows and blocks the right things.

## 5. Tables

Core (built in Phase 2):

- `profiles`: one per account: name, photo, role, stage, city, interests, phone, consents.
- `admin_users`: username, display name, link to the account.
- `audit_log`, `auth_attempts`.

Planned now, created with each feature phase (all content tables share `status` Published/Draft, `created_by`, timestamps):

- **Outloud**: `events`, `tickets`, `private_session_requests`, `content_items`, `blog_posts`, `topic_suggestions`; live mode: `live_questions`, `question_votes`, `polls`, `poll_votes`.
- **TVS**: `programs`, `masterclasses`, `applications`, `enrolments`, `cohorts`, `modules`, `lessons`, `assignments`, `submissions`, `live_sessions` (Meet links), `documents`, `recordings`, `lesson_progress`.
- **BRICKR**: `services`, `requests` with `request_events` (stage history: New, Intro call, Proposal, Won, Declined), `client_spaces`.
- **QuidQuo**: `qq_stages`, `build_log`, `waitlist`.
- **Shared**: `library_resources`, `saved_items`, `announcements`, `updates` (Publishing), `notifications`, `payments`, `refunds`.

## 6. What Ahmed needs to set up (step by step guidance will follow)

1. **Supabase**: create the project (region Frankfurt, closest to MENA). Some protections above (leaked-password check, session limits) need the paid plan.
2. **Google Cloud**: OAuth client for "Sign in with Google".
3. **LinkedIn Developers**: app with "Sign In with LinkedIn using OpenID Connect".
4. **Resend**: account and domain verification for auth emails.
5. **Cloudflare Turnstile**: site key for bot protection.
6. **Vercel**: add `ventureweavers.com`, `www`, `app.` and `admin.` under Domains, then the DNS records at your registrar. Paste Supabase keys into Environment Variables (Google, LinkedIn and Resend secrets go into the Supabase dashboard, not the code).

# VentureWeavers Platform

One Next.js app serving three addresses: `ventureweavers.com` (landing page), `app.ventureweavers.com` (member app) and `admin.ventureweavers.com` (admin console). Members and admins have separate logins; the member app never links to the admin console. Host routing is in `src/lib/hosts.ts` and `src/middleware.ts`.

- **Member app**: Home, Outloud, TVS, BRICKR, QuidQuo, Library, My space, Live mode, Join.
- **Admin console** (`admin.` host; `/admin` paths in local and preview path mode; login with username and password): Overview, Contacts, Requests, Payments, one section per space (Outloud, TVS, BRICKR, QuidQuo), Library, Publishing.

`reference/prototype.html` is the clickable spec. Its Member/Admin switch exists only for convenience in the prototype; the real product has no switch. Every screen and flow in it must exist in the real product. Open it in a browser before building any screen, and match its layout and copy.

## Who we are

VentureWeavers is Ahmed Fouad and Karim Hemdan. We bring our experience, knowledge and access to MENA's venture ecosystem through four spaces:

| Space | What it is | Colour |
| --- | --- | --- |
| Outloud | Content, shows & events. Open Floor is its first format. | amber `#E39B2D` |
| TVS (The Venture School) | Programs, masterclasses and the classroom (LMS). TVAC is the foundation for every 360 program. | Egyptian blue `#1F4FA3` |
| BRICKR | Fractional leadership: hands-on work with partners on building and growing ventures and portfolios. | brick `#B5532F` |
| QuidQuo | AI for capital formation. In development: progress tracker + waitlist. | lime `#8DBF2E` |

VentureWeavers house branding leads; spaces appear as coloured tags.

## Stack

- Next.js 15 (App Router, TypeScript, `src/` directory), React 19
- Tailwind CSS v4 (tokens in `src/app/globals.css` under `@theme`)
- Own UI components in `src/components/ui` (no component library); icons from `lucide-react`
- Fonts from `@fontsource` (no network call at build time)
- Coming next: Supabase (Postgres, Auth, Storage, Realtime), Paymob + Fawry, Resend, WhatsApp Cloud API, web push, Google Calendar API (Meet links), Mux for recordings. Hosting on Vercel.

## Brand rules

- Colours: ink `#071112`, deep `#02686F`, teal `#29BE9C`, mint `#DCF1DD`, paper `#F3F8F5`.
- Fonts: Chakra Petch for headings and big numbers, Nunito Sans for everything else.
- Base text 14px. Compact controls (36px buttons on desktop, 40px+ touch targets on mobile).
- Never use the words "free" or "Dubai". We are based in Cairo and work across MENA.
- Do not use "companion" as positioning.
- No illustrations or 3D images. Use photos, brand patterns and icons. Interface depth is welcome: liquid-glass surfaces, layered shadows, gentle card tilt and hover motion (always off for reduced motion). Never stretch or squash images (`object-fit: cover`).
- Copy is plain and direct. Prices, dates and venues we don't know are placeholders like `[PRICE]`.

## Layout rules

- Member shell: fixed ink sidebar (228px, never scrolls) from 900px up; sticky top bar with search, notifications and profile; below 900px the sidebar becomes a slide-out menu and a bottom bar shows Home, Outloud, TVS, BRICKR, More.
- Admin shell: same structure with admin navigation.
- Pages start with a page header (title, one line, actions), then tabs, then content in cards, lists and tables. Wide tables scroll inside their own box. The page itself never scrolls sideways.
- Every content item (program, masterclass, service, blog post) is a content card: banner, title, short description, tags, CTA button.

## Working rules

- Plan first and wait for approval on anything touching the database, payments, auth or access rules.
- Small commits with clear messages. Run `npm run build`, `npm run lint` and `npm test` before every push.
- Write tests for money, capacity and access logic.
- Secrets live in environment variables only (`.env.local`, Vercel settings). Never commit keys.
- Every admin list supports create, edit, duplicate, delete and Published/Draft status through the shared editor drawer.

## Decisions log

Add product decisions here as they are made (prices, refund policy, roles, languages).

- Build phases follow the development guide: Phase 0 setup, Phase 1 design system and shells, Phase 2 data model and auth, then features.
- Member sign-up and sign-in: Google, LinkedIn (`google`, `linkedin_oidc`) or email and password. Screens at `/join`, `/sign-in`, `/forgot-password`; wiring comes in Phase 2. (2026-11-09)
- Admin console is separate from the member app: its own login (username and password) at `/admin/sign-in`, no Member/Admin switch, no link from the member app. Access rules come in the Phase 2 plan. (2026-11-09)
- Admin logins: one account per partner (Ahmed, Karim), no shared login. Admin console served on its own subdomain (`admin.[DOMAIN]`), same codebase; member host never serves `/admin`. (2026-11-09)
- Addresses: `ventureweavers.com` landing page, `app.` member app, `admin.` console. Admins set their own passwords on first sign-in. Security measures and access rules: `docs/phase-2-plan.md`. (2026-11-09)
- Services: Supabase project `ventureweavers-platform` (Frankfurt, Free plan until launch). Auth emails via Resend from `no-reply@mail.ventureweavers.com`; templates in `supabase/templates`. `app.` and `admin.` live on Vercel; `ventureweavers.com`/`www` stay on the old site until launch. `HOST_MODE=strict` in production. (2026-11-09)
- Admin usernames: `ahmed.fouad`, `karim.hemdan`. (2026-11-09)
- Sign-in providers live: Google (Cloud project `ventureweavers-platform` under a.fouad@), LinkedIn (app "VentureWeavers Sign In", company page ventureweavers), email. Turnstile widget "VentureWeavers sign-in" on all password forms incl. admin; Supabase captcha on. Before launch: Supabase Pro (leaked-password check, custom auth domain). (2026-11-09)
- Event booking (Phase 3a): pay by bank transfer only until Paymob is live; admin marks paid. Unpaid reservations release after 48 hours (or 24 hours before the show if sooner). Max 2 seats per booking. Refund policy undecided: build cancel/refund tools, show `[REFUND POLICY]`. Show prices stay `[PRICE]` until set. (2026-11-09)
- Phase 3a live (2026-11-09): events/bookings migration applied in Supabase; seeded Show 01, Show 02 (published, `[PRICE]`), Founder breakfast (draft), Private session. Booking opens per event once an admin sets a price. Optional env: `RESEND_API_KEY` (booking emails), `CRON_SECRET` (daily reminders).
- Event banners: admins upload JPG/PNG/WebP up to 5 MB, recommended 1600 × 900 (16:9), min 1200 × 675; stored in public Supabase Storage bucket `event-banners` (admin-only writes); preset photo/pattern is the fallback. (2026-11-09)
- Phase 5 (2026-11-09): blog in Markdown with live preview, public; digital content public (scheduled shows "Coming [date]"); Library uploads up to 20 MB (PDF, Word, Excel, PowerPoint, ZIP) or links, private bucket `library-files`, 5-minute download links; only "All members" access opens until Phases 6–7. Publishing sends to the feed and The Floor Notes email (opt-ins only, unsubscribe link). All uploads go browser → Storage via signed upload links, checked on the server after. Public bucket `content-images` for blog and post images.
- Phase 6 approved (2026-11-10): TVAC joining is apply → intro call → offer → pay (bank transfer, admin marks paid) → enrolled; masterclasses use the events booking engine; Meet and recording links are pasted by admins for now (Google Calendar API and Mux later); cohort number and dates stay `[NO.]`/`[DATE]` until set. Notifications bell parked.
- Phase 7 approved (2026-11-10): BRICKR meeting requests pick a preferred slot (next 5 working days Sun–Thu, 10:00–18:00 Cairo), partners confirm with a Meet link; QuidQuo waitlist for signed-in members (admins can add people); email alerts to both partners for new requests, applications and waitlist sign-ups; a request at Won makes the member a BRICKR client (Library level); full client space later.
- Phase 7b approved (2026-11-10): Admin Overview and Contacts (CRM). Contacts = members + people the partners add (CSV import up to 1,000 rows, duplicates by email skipped); spaces worked out from activity plus admin tags; admins add notes and tags only to members, never edit member profiles; Email/WhatsApp buttons open the partner's own apps.
- Phase 8 approved (2026-11-10): Live mode for shows. Any confirmed ticket holder joins while an admin has it open; askers choose first name or anonymous; Pick is random from approved, not yet picked; one poll open at a time; ending the show emails the feedback link (opt-ins) and shows it in live mode; admin screen view for the projector; Supabase Realtime with 10-second refresh fallback.
- Phase 9 approved (2026-11-10): Payments. One admin list of seats, program seats and payment requests (admin-only view), Mark paid / cancel / full refund from the drawer, CSV export. Payment requests (`VWP-` reference, bank transfer, admin marks paid) go to members only and show in My space › Payments; Paymob links replace the transfer step later. Full refunds only until the refund policy is set.
- Phase 10 approved (2026-11-10): Notifications bell for members (personal events only, written by database triggers, latest 20, kept 90 days). Admin 2-step verification removed at Ahmed's request: admin sign-in is username + password (Turnstile, lockout, 12-character minimum and audit log stay); `is_admin()` no longer requires aal2; every admin sign-in emails that admin an alert with time and IP.
- Phase 11 approved (2026-11-10): glass and depth UI (shown on Home and TVS first); cards show an overview with View details pages for programs, masterclasses and services; program dates, capacity, price, format, location and Meet link live on each cohort; brochures (PDF 10 MB, public bucket `brochures`); show photo galleries (up to 12, public bucket `event-gallery`); TVS custom programs use a form emailed to the custom-programs inbox set in admin settings; Live mode card on show pages.
- Phase 12 approved (2026-11-10): whole member app behind sign-in (open: auth pages, unsubscribe, landing page; blog and content no longer public). "About you" sign-up step for every member: name, mobile with country code, email, LinkedIn (optional), country, role, interests (Education, Services, Content, QuidQuo), how we communicate (WhatsApp, Email, Call); existing members asked once. Meeting requests (BRICKR, private shows & sponsorships, TVS custom programs) open Karim's Calendly (link in admin settings) and are recorded in the Requests inbox; `CALENDLY_TOKEN` and `CALENDLY_SIGNING_KEY` in Vercel. Digital content preview images (upload or YouTube thumbnail).

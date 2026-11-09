# VentureWeavers Platform

One Next.js app serving three addresses: `ventureweavers.com` (landing page), `app.ventureweavers.com` (member app) and `admin.ventureweavers.com` (admin console). Members and admins have separate logins; the member app never links to the admin console. Host routing is in `src/lib/hosts.ts` and `src/middleware.ts`.

- **Member app**: Home, Outloud, TVS, BRICKR, QuidQuo, Library, My space, Live mode, Join.
- **Admin console** (`admin.` host; `/admin` paths in local and preview path mode; login with username, password and 2-step code): Overview, Contacts, Requests, Payments, one section per space (Outloud, TVS, BRICKR, QuidQuo), Library, Publishing.

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
- No illustrations or 3D. Use photos, brand patterns and icons. Never stretch or squash images (`object-fit: cover`).
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

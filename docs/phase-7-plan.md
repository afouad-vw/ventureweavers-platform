# Phase 7 plan: BRICKR services and requests, QuidQuo tracker and waitlist, Requests inbox

Status: **waiting for approval** (new tables, access rules, member data).

Spec: `reference/prototype.html` → BRICKR, the "Request a meeting" pop-up, QuidQuo, My space › Requests, Admin › BRICKR, Admin › QuidQuo, Admin › Requests.

## What members get

- **BRICKR**: service cards (banner, name, who it's for, format, description, tags, **Request a meeting**). The rail from the prototype: How it works, "Not sure where to start? Book a diagnostic". The locked **Client space** card ("Opens when you become a client").
- **Request a meeting** pop-up: choose a day (the next 5 working days, Sunday to Thursday) and a time (10:00 to 18:00 Cairo), company, and what you'd like to solve. The partners confirm within 1–2 working days.
- **Outloud › Private session**: "Request a session" opens the same pop-up for the Open Floor private session service (today it opens an email).
- **My space › Requests**: each request with its stage (New, Intro call, Proposal, Won, Declined) and, once confirmed, the meeting time and Meet link. TVS applications show here too.
- **QuidQuo**: "Where we are" (stages with progress bars), the build log, and **Join the waitlist** (role: founder raising capital, investor or angel, ecosystem partner; feedback calls yes/no). After joining: "You're on the list" with a **Copy invite link** (we record who invited whom).
- Library: **BRICKR clients** items unlock once one of your requests is **Won**; **QuidQuo waitlist** items unlock once you join the waitlist.

## What admins get

- **Admin › BRICKR**: Requests board (BRICKR and Outloud private sessions) and the Services list (create, edit, duplicate, delete, Published/Draft).
- **Admin › Requests**: one inbox for every request and TVS application. Counts per stage, filter by space, table or board view, owner (Ahmed / Karim), move stage, **Confirm meeting** (set the time and paste a Meet link; the member gets an email), notes for the partners only, CSV export.
- **Admin › QuidQuo**: Stages (name, description, progress, order), Build log (date, title, text, Published/Draft), Waitlist (name, email, role, feedback calls, invited by, date; add, remove, CSV export).
- **Email alerts to both partners** for each new request, TVS application and waitlist sign-up (optional, see decisions).
- Every change in the audit log.

## Data

| Table | Holds |
| --- | --- |
| `services` | name, space (BRICKR or Outloud), audience, format, description, tags, banner, status, order |
| `requests` | member, service, preferred time, company, note, stage, owner, confirmed meeting time, Meet link |
| `request_notes` | partner-only notes on a request (members never see these) |
| `qq_stages` | order, name, description, progress 0–100 |
| `qq_log` | date, title, text, status |
| `waitlist` | member, role, feedback calls, invite code, invited by, joined at |

## Access rules (tested)

- Published services, QuidQuo stages and published build log entries are public.
- Requests: members create their own and see only their own (stage, meeting time, Meet link); they can't change the stage or see partner notes. Admins see and change everything.
- Waitlist: members join and leave for themselves and see only their own entry; admins see all.
- At most 5 open requests per member, and 10 new requests a day, to keep the inbox useful.
- BRICKR clients level = a request at Won; QuidQuo waitlist level = on the waitlist. Both are worked out in the database.

## Decisions needed

1. **Meeting times**: members pick a preferred slot from the next 5 working days and you confirm (recommended, as in the prototype), or live availability from your Google Calendar (needs the Calendar setup, later).
2. **Waitlist**: signed-in members only (recommended: ties into the Library level and stops fake sign-ups), or also visitors with just an email.
3. **Email alerts** to both partners for new requests, applications and waitlist sign-ups: yes (recommended) or no.
4. **Won = BRICKR client**: a request moved to Won makes the member a BRICKR client (unlocks client Library items). The full client space (action plan, requirements sheet, files, monthly reviews) is shown locked in the prototype; build it in a later phase (recommended), or now.

## Not in this phase

- Admin › Overview and Contacts (CRM): next phase, as they pull from everything built so far.
- The notifications bell (parked).

## Tests

Access tests for every new table (owner vs other members vs visitors vs admins, 2-step required for admins), request limits, stage changes only by admins, partner notes hidden, waitlist and client levels in `my_access_levels()`; unit tests for the day and time slots (Sunday–Thursday, Cairo time).

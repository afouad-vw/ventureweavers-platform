# Phase 7b plan: Admin Overview and Contacts

Status: **approved 2026-11-10**.

Spec: `reference/prototype.html` → Admin › Overview, Admin › Contacts.

## Overview

- **Numbers**: contacts, seats booked (shows and masterclasses), open requests, hand-ins to review, waitlist. ("Questions waiting" joins with Live mode in Phase 8.)
- **Seats by event**: a bar per upcoming show and masterclass (booked of capacity).
- **Latest activity**: the newest sign-ups, bookings, payments, applications, requests, waitlist joins and topic suggestions, in one list.
- **Needs attention**, each linking to the right screen: new requests, new applications, payments waiting (reserved seats and offered program seats), hand-ins to review, new topic suggestions, drafts not published.
- **Contacts by space**: a bar chart of how many contacts touch each space.

## Contacts

- One list of **everyone**: members who signed up, plus people you add yourselves (a speaker, an investor, a partner) who don't have an account yet.
- Columns as in the prototype: name and company, role and stage, spaces, source, last activity. Tabs by space (All, Outloud, TVS, BRICKR, QuidQuo) and a filter box.
- **Spaces are worked out from what people did** (booked a show = Outloud; applied, enrolled or booked a masterclass = TVS; requested a service = BRICKR, or Outloud for private sessions; joined the waitlist = QuidQuo), plus tags you add.
- **Source**: how they arrived (Google, LinkedIn, email sign-up, invited to the waitlist by someone, added by Ahmed or Karim, CSV import).
- **Side panel** for the selected person: email, phone, consent (from their notification choices), spaces, their bookings, applications and requests with stages, a **private note** (partners only), and **Email** / **WhatsApp** buttons that open your own mail app or WhatsApp with their address or number (nothing is sent by the platform).
- **Add contact** and **Import CSV** (name, email, mobile, company, role, tags; up to 1,000 rows; duplicates by email are skipped). Added contacts can be edited and deleted.
- **Export CSV** of the current filter.

## Data

| Table | Holds |
| --- | --- |
| `contacts` | people added by the partners: name, email, phone, company, role, source, tags, consent |
| `contact_notes` | one private note per member or added contact, and admin tags for members |

Everything else is read from what's already there (profiles, bookings, enrolments, applications, requests, waitlist).

## Access rules (tested)

- Both tables are **admins only** (2-step required). Members never see contacts, notes or tags, including their own.
- Member email and phone are read on the server for admins only.
- An added contact who later signs up with the same email shows as **one person** (their account takes over; your note and tags stay).

## Decisions (answered 2026-11-10)

- **CSV import** built now.
- Admins add **notes and tags only** to members; members keep control of their own profile.

## Original questions

1. **CSV import** now (recommended), or later.
2. **Editing members' details**: admins add notes and tags only; members keep control of their own name, phone and profile (recommended). Or let admins edit member profiles too.

## Tests

Access tests for both tables (admins with 2-step vs admins without vs members vs visitors), email matching between added contacts and members, CSV parsing (quotes, commas, bad rows, duplicates) as unit tests.

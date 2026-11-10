# Phase 13 plan: contact pages, editing member details, password resets

Status: **approved 2026-11-10**. From Ahmed's comments, 2026-11-10.

## Decisions (answered 2026-11-10)

- Partners edit **profile details only**; the sign-in email stays the member's to change.
- Password: **send a reset email** only (the member chooses the new password).
- Members are **told in their bell** when a partner edits their details.
- Added at approval: **suspend an account and lift the suspension**.


## 1. Contacts list → contact page

- The Contacts list becomes a full-width table: no details panel on the right.
- Each row's name is a link and has a **View details** button that opens the contact's page: `admin.ventureweavers.com/contacts/<id>`.
- The list keeps search, the space tabs, Add contact, Import CSV, Export CSV, Email and WhatsApp buttons.

### The contact page

- **Header:** name, initials, space tags, how they joined, joined date. Actions: Email, WhatsApp, **Edit details**, **Send password reset** (members only), and More (delete, for contacts the partners added).
- **Overview tab:** every detail: email, mobile, country, role and stage, LinkedIn, interests, how we communicate, newsletter opt-in, sign-in method, last sign-in. Below that, the partners' notes and tags (as today).
- **Activity tab:** one timeline, newest first:
  - joined
  - bookings (with status, seats and payment)
  - program applications and enrolments
  - masterclasses
  - BRICKR, show and custom-program requests (and Calendly meetings)
  - payment requests, paid, cancelled and refunded
  - QuidQuo waitlist
  - Live mode questions asked
  - topics suggested
  - classroom hand-ins
  - partner actions on the person: details edited, password reset sent, notes changed (each with which partner and when).
  - Filter by space.
- **Payments tab:** the person's seats, program seats and payment requests with totals (from the Payments list).

## 2. Editing member details

- **Edit details** opens a drawer with the same fields as the "About you" step: name, mobile (country code), country, role, LinkedIn, interests, how we communicate. Email and the newsletter choice stay the member's.
- Same checks as when members edit themselves (LinkedIn must be a linkedin.com link, mobile in international format, and so on).
- Done through one database function that checks the caller is an admin and records every change (old value → new value, which partner, when) in the audit log. Member profiles stay locked to everyone else.
- People the partners added (not members) can already be edited; that stays as is.

## 3. Password reset

- **Send password reset** emails the member our reset email: a link that works for 2 hours and lets *them* choose a new password. Nobody else sees or sets it.
- Works for email members and for Google or LinkedIn members (it lets them add a password; their Google or LinkedIn sign-in keeps working).
- Asks to confirm first ("Send a reset link to name@email?"). Limited to 3 per member per hour. Logged in the audit log and shown in Activity.
- Not for admin accounts (Ahmed and Karim reset through the admin sign-in page).

## 4. Suspend and lift

- **Suspend** (with an optional reason, partners only) signs the member out on every device and blocks sign-in (email, Google and LinkedIn). The app also checks on every page, so an open tab stops working at once; sign-in shows "This account is suspended. If you think this is a mistake, email us at info@ventureweavers.com."
- Bookings, payments, notes and history stay. **Lift suspension** restores sign-in at once.
- Both are recorded in the audit log and Activity (with the reason). Admin accounts can't be suspended from Contacts.

## Tests

- Database: only admins can edit member details; members still can't edit other members; every edit is logged; reset limit holds; admin accounts can't be changed from Contacts.
- Unit: activity timeline merging and sorting, edit form checks.


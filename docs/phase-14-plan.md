# Phase 14 plan: profile photos, business details, host photos, tailored applications, admin team access

Status: **approved 2026-11-10**. From Ahmed's comments, 2026-11-10.

## Decisions (answered 2026-11-10)

- TVS applications: **questions change by role** (founders, investors, corporate, others).
- Business types: **Venture, Corporate, Capital, Government & non-profit, Education, Other**.
- Super admins are **fixed: Ahmed and Karim only** (enforced in the database).
- Build order: team access levels first, then photos and business details, then host photos and applications.
- Door staff read nothing directly; the check-in function returns what the door needs. Masterclasses are events, so program managers can also edit events.

Already done without approval (2026-11-10):
- "Receive newsletters by email" replaces "The Floor Notes newsletter by email" (sign-up and My space).
- Contacts: new **Requests & meetings** tab (upcoming meetings with Meet links, every request with status, owner and Calendly) and a **Notes & tags** tab; Overview shows the next meeting and your note.
- TVS LinkedIn links: no host or guest had a link saved. The editor dropped links it didn't recognise without saying so; it now shows an error naming the person. Re-add the links in TVS › Programs.

## 1. Member profile photo

- Members add or change a photo in **My space › Profile**, and optionally in the "About you" sign-up step.
- JPG, PNG or WebP up to 2 MB. Always shown as a cropped circle, never stretched. Remove photo goes back to initials.
- Google and LinkedIn photos stay as the starting photo until the member uploads their own.
- Shown in the top bar, My space, classroom discussions and admin Contacts.
- Stored in a new public bucket `avatars`. Members can only write their own folder.

## 2. Business details at sign-up (optional)

- New optional fields in "About you" and My space: **Business name**, **Website**, **Type**.
- Shown in admin Contacts and included in the CSV export.

## 3. Host and guest photos (TVS and Outloud)

- Each host and guest in the program, masterclass and show editors gets a **photo** (square crop, JPG/PNG/WebP up to 2 MB) next to name, title and LinkedIn.
- Details pages show the photo, falling back to initials, plus the LinkedIn icon when a link is set.
- Stored in the existing public `content-images` bucket (admin-only writes).

## 4. TVS application form

See question 1. Answers stay in the Applications board and the contact's Activity.

## 5. Admin team and access levels

**Super admins:** Ahmed and Karim. Full access, including the Team page, settings, payments, and suspending or editing members.

**Team members:** Super admins add them from a new **Admin › Team** page with name, email and username. They get the invite email (2-hour link) and set their own password. They sign in on the same admin sign-in page with the same protections: Turnstile, lockout, 12-character minimum and a sign-in alert email.

**What each team member can open** is a set of ticked areas, each view-only or manage:

| Area | View | Manage |
| --- | --- | --- |
| Overview | ✓ | — |
| Contacts | see people and activity | notes and tags, edit details, password reset, suspend |
| Requests | see the inbox | move, assign, confirm meetings |
| Payments | see the list | mark paid, cancel, refund, payment requests |
| Outloud events & shows | see | create and edit, bookings |
| Door check-in | — | scan tickets only |
| Live mode | — | run a show's live mode |
| Outloud content & blog | see | create and edit |
| TVS programs, cohorts & applications | see | create and edit, move applications |
| TVS classroom | see | modules, sessions, review hand-ins |
| BRICKR services | see | create and edit |
| QuidQuo | see | stages, log, waitlist |
| Library | see | upload and edit |
| Publishing | — | send to feed and email |
| Settings (bank details, Calendly, custom-program inbox) | — | super admins only |

- **Ready-made presets** you can tick in one go and then adjust:
  - **Door staff:** check-in only. They see the scanner and the name on each ticket.
  - **Requests manager:** Requests (manage) and Contacts (view).
  - **Content editor:** Outloud content, blog, Library and Publishing.
  - **Program manager:** TVS (manage) and Contacts (view).
- The menu shows only what a person can open. Other pages and actions are blocked on the server and in the database, not just hidden.
- Super admins can change a team member's access, pause their access, or remove them at any time. Changes apply on their next click.
- Every action stays in the audit log with who did it. Each contact's Activity names the team member.
- This replaces "admin = Ahmed or Karim" across the database: about 130 admin checks become area checks. Every area gets database tests.

## Tests

- Database: each area's view and manage rights; team members can't reach other areas, settings or the Team page; door staff can only check in; only super admins manage the team; a paused team member is blocked at once.
- Unit: permission presets and menu filtering, photo and business-detail checks.

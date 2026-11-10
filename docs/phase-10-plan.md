# Phase 10 plan: Notifications bell, and admin sign-in without 2-step

Status: **approved 2026-11-10**.

## Decisions (answered 2026-11-10)

- Admin 2-step **removed**: username and password only (bot check, lockout, 12-character passwords and the audit log stay).
- **Sign-in alert email** to the admin on every admin sign-in.
- Bell shows **personal events only** (no feed announcements).

Spec: `reference/prototype.html` → member top bar (bell, panel, "Mark all read").

## Part A: Notifications bell (members)

- The bell in the member top bar shows a count of unread notifications.
- Tapping it opens a panel with the latest notifications (newest first); unread ones are highlighted. Tapping one marks it read and opens the right page. **Mark all read** clears the count.
- A short list of the latest 20; older ones are kept for 90 days, then removed by the daily job.
- The count updates when the page loads and every 60 seconds while the app is open.
- The admin console has no bell (as in the prototype); partners keep getting email alerts.

### What creates a notification

Written by the database whenever these happen, so nothing is missed whichever screen made the change:

| Event | Text (example) | Opens |
| --- | --- | --- |
| Seat confirmed (paid or no charge) | Your seat for Open Floor · Show 01 is confirmed. | My space › Tickets |
| Seat reserved, payment due | Seat reserved for Show 02. Transfer by [date] with VWB-XXXXXX. | My space › Tickets |
| Booking cancelled or refunded by us | Your booking for Show 01 was cancelled. | My space › Tickets |
| Program seat offered | You're offered a seat in TVAC · Cohort [NO.]. | My space › Learning |
| Enrolled (payment received) | You're enrolled in TVAC. The classroom is open. | Classroom |
| Application moved on (intro call, declined) | Your TVAC application moved to Intro call. | My space › Learning |
| Hand-in reviewed or reopened | Your hand-in for Module 2 was reviewed. | Classroom |
| BRICKR or private session meeting confirmed | BRICKR confirmed your meeting for Tue 17 Nov, 11:30. | My space › Requests |
| Payment request received or paid | New payment request: Growth diagnostic, EGP 15,000. | My space › Payments |
| Live mode opened for a show you're booked on | Live mode is open for Show 01. | Live mode |
| A program you asked to hear about opens | Angel360 is now open for applications. | TVS |

## Part B: Admin sign-in without 2-step

You asked to remove the 2-step code from admin sign-in. Today an admin needs **username + password + a 6-digit code** from an authenticator app.

After the change:

- Admins sign in with **username and password** only, then land straight on the Overview. The Verify page is removed; first-time setup becomes "set your password" then in.
- What stays: the bot check (Turnstile), lockout after 5 failed tries per username or IP for 15 minutes, 12-character minimum passwords, the leaked-password check, separate admin sessions (12 hours idle, 7 days maximum), and the audit log.
- The database rule `is_admin()` stops requiring the 2-step level; it still requires the account to be one of the two listed admins.

**The trade-off, so it's a clear choice:** the console holds every member's contact details, payments and CSV exports. Without the code, anyone who gets an admin password (phishing, a reused password, a shared laptop) gets all of that. The code is asked once per sign-in, not on every page.

To make up for part of that, I suggest adding:

- **Sign-in alert email** to the admin each time their account signs in, with time and IP, so a sign-in you didn't make is noticed fast.

## Data and access rules (tested)

| Table | Holds |
| --- | --- |
| `notifications` | member, text, link, created time, read time |

- Members read and mark read only their own notifications; they can't create, edit or delete them. Only database triggers write them.
- `is_admin()` changes as described in Part B; all existing access tests are updated and re-run.

## Questions

1. **Admin 2-step**: remove it as you asked, or keep it but ask far less often (once every 30 days on the same browser)?
2. **Sign-in alert email** to the admin on each admin sign-in: yes (recommended) or no?
3. **Notifications**: also notify everyone when a new announcement is posted to the feed, or only personal events (recommended)?

## Tests

Access tests for notifications (own vs others, no direct writes), one test per trigger above, admin access with and without 2-step after the change; unit tests for the unread count and relative times.

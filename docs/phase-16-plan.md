# Phase 16 plan: booking options, Coming soon with waitlists, private programs and classes

Status: approved and live 2026-11-17 (migrations `20261117000009` and `20261117000010` applied).

## Part 1. BRICKR services: request a meeting or book from the calendar

**Today:** one Calendly link in admin settings (Karim's) applies to every service. When it is set, every "Request a meeting" button opens it. Without it, members pick a preferred slot instead.

**Change:** each service decides how members meet us.

- New columns on `services`:
  - `booking`, one of:
    - `request`: the member sends a meeting request with a preferred slot.
    - `calendar`: the member books a time directly from that service's Calendly.
    - `both`: two buttons, "Book a time" and "Send a request".
  - `calendly_url`: optional, must start with `https://calendly.com/`.
  - A database check requires a link when booking is `calendar` or `both`.
- **Admin › BRICKR › service editor:**
  - "How members meet you", with the three options above.
  - The Calendly link field, shown when it's needed.
  - Each service can use a different calendar (Ahmed's, Karim's, a shared team event).
- **Member app:**
  - Service cards and detail pages show the right button or buttons.
  - Bookings and requests both land in Admin › Requests, as today.
- **Moving existing services:**
  - If the global Calendly link is set, each published service gets it with booking `calendar`, so nothing changes for members on day one.
  - The global link stays in settings as the default suggested for new services.
- **Limit:** Calendly only sends booking notices (webhooks) for the account that has `CALENDLY_TOKEN`, which is Karim's. Bookings made on other accounts' links are still recorded from the member's browser at booking time (as today), but cancellations on those accounts won't sync automatically.

## Part 2. "Coming soon" status with "Notify me" waitlists

**Applies to:** services, programs, and events (shows, masterclasses, private sessions). Blog posts and Library are unchanged.

- **Statuses:** Draft / Coming soon / Published.
  - Events and services use `pub_status`, which gets the new value `coming_soon`.
  - Programs: the current "In development" status becomes "Coming soon", and existing in-development programs move to it.
- **Members:**
  - A Coming soon item is visible wherever a published item would be. The same rules for public and private items apply.
  - It carries a "Coming soon" chip. Dates, prices and venues show TBA.
  - Its call to action is **Notify me**. After joining it reads "You're on the list", with an option to leave.
  - Booking, applying and requesting stay blocked on the server until the item is live. The existing guards already require Published/Open.
- **Waitlists:** new table `waitlist_entries`.
  - Columns: item type (service / program / event), item id, member, joined at, notified at.
  - One entry per member per item. At most 30 joins a day per member.
  - Members add and remove only their own entries, and only on items they can see that are Coming soon.
- **Admin:**
  - Each list row shows the waitlist count.
  - The editor drawer has a Waitlist tab: names, emails and date joined, a CSV export, and "Add people" (members, as with the QuidQuo waitlist).
  - Viewing a waitlist needs view access to that item's area; adding or removing people needs manage access.
- **Going live:** when an item changes from Coming soon to Published/Open:
  - A database trigger sends a bell notification to everyone on its waitlist and marks them notified, so nobody is notified twice.
  - The same save sends each person an email with a link to the item. It is a service email they asked for, so it goes to everyone on the list, not only newsletter opt-ins.
  - A daily cron job sends any emails that failed.
  - Moving an item back to Coming soon keeps the list; only people not yet notified are told next time.
- **QuidQuo:** its existing waitlist stays as it is.

## Part 3. TVS: Private programs and Private classes

- **Private programs:** "Custom programs" becomes **Private programs** in the TVS section title, the request window, emails and admin settings ("Private programs inbox"). The stored slug `custom-program` stays.
- **Private classes:** a new box in the Masterclasses tab, built the same way.
  - It runs through a new hidden TVS service, `private-class`, so it follows the Part 1 setting (Calendly, request, or both).
  - Without a calendar, a short form goes to the same inbox, marked "Private class".
- **Admin › Requests** shows whether each request is for a program or a class.

## Security and access

- `waitlist_entries` has row level security on:
  - Members see and change only their own entries.
  - Admins need the item's area (BRICKR, TVS, Outloud events) with view access to read and manage access to change.
- Visibility policies on services, programs and events treat `coming_soon` like published for reading, and only for reading. Booking, apply and request functions keep checking for Published/Open.
- Calendly links are checked in the database (https, calendly.com only, length limit).

## Tests

- **Database tests:**
  - Waitlist rules: own entries only, Coming soon items only, visibility respected.
  - The daily limit on joins.
  - Notifications are sent once when an item goes live.
  - Booking is blocked while an item is Coming soon.
  - The Calendly link check.
- **Unit tests:** which call to action shows for each status and booking setting.

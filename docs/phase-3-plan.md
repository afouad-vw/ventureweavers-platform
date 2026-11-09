# Phase 3 plan: My space and Outloud events with booking

Status: **waiting for approval** (touches the database, payments and access rules).

Spec: `reference/prototype.html` → Outloud › Shows & events, the booking pop-up, My space, and Admin › Outloud › Events.

## Split into two parts

| Part | What | Needs from you |
| --- | --- | --- |
| **3a, now** | My space (profile, settings, saved, tickets), events from the database, the admin events editor, the booking engine with capacity, tickets with QR codes, door check-in. Payment is **"reserve now, pay by bank transfer or on the day"**, and an admin marks it paid. | Decisions below |
| **3b, when the merchant account is ready** | Online payment through Paymob (card, mobile wallets) and Fawry reference codes, automatic confirmation, refunds, receipts. | Paymob merchant account (needs company papers, which can take days) |

This lets us run real bookings for the first Open Floor shows while the payment accounts are approved.

## 3a: what members get

- **Outloud › Shows & events**: upcoming published events as content cards (banner, title, date, venue, seats left, price, Book). Event page with full details and the hosts. Private sessions show "Request a session" instead of Book.
- **Booking pop-up** (as in the prototype): choose seats, see total, confirm. Seats are held for the member right away.
- **My space**:
  - **Tickets**: each ticket with its QR code and code (e.g. `OF01-7K4Q`), status (Reserved, Confirmed, Checked in), Add to calendar (.ics).
  - **Saved**: blog posts and resources saved with the bookmark button.
  - **Profile & settings**: name, photo, role, stage, interests, phone, notification choices, change email/password, delete my account.
- **Emails** (through Resend): booking received, payment confirmed with the ticket, reminder the day before.

## 3a: what admins get

- **Admin › Outloud › Events**: list with seats booked/capacity; create, edit, duplicate, delete, Published/Draft, through the shared editor drawer.
- **Bookings per event**: who booked, seats, status; mark as paid; cancel (frees the seats).
- **Check-in**: scan a ticket QR with the phone camera or type the code; shows name and seats, marks checked in, warns on a ticket already used.
- Every change written to the audit log.

## Data

| Table | Holds |
| --- | --- |
| `events` | title, type (public show, workshop, private session), start time, venue, capacity, price in EGP, hosts, guest, description, banner, status |
| `bookings` | event, member, seats, amount, status (reserved, confirmed, cancelled, expired, refunded), when the hold expires |
| `tickets` | one per booking: unique code, checked-in time and by whom |
| `payments` | booking, method (bank transfer, cash on the day; later card, wallet, Fawry), amount, status, reference, who marked it paid |
| `saved_items` | member, item type, item |

Money is stored in piasters (whole numbers), never as decimals.

## Capacity rules (tested)

- Booking runs in one database step that locks the event, counts confirmed seats plus unexpired holds, and refuses if the new seats don't fit. Two people booking the last seat at the same moment: one gets it, the other sees "Sold out".
- A reservation that isn't paid by the deadline expires and its seats return automatically.
- Members can't book drafts, past events or private sessions; maximum seats per booking (see decisions).
- Tests: last-seat race with parallel bookings, expiry returning seats, cancel freeing seats, limits per booking, check-in twice refused.

## Access rules (tested)

- Anyone can see published upcoming events. Drafts only in the admin console.
- Members see only their own bookings, tickets and payments. Nobody can change a booking's status or amount from the browser; only the booking step and admins can.
- Ticket codes are random and unguessable; the QR holds only the code, and check-in requires an admin session.

## 3b: payments (planned now, built later)

- Paymob for card (Visa, Mastercard, Meeza) and mobile wallets; Fawry reference codes paid at any outlet.
- Card and wallet: seats held 15 minutes during checkout. Fawry: held 48 hours, as in the prototype.
- Payment confirmation only from the provider's signed server notification (never from the browser), recorded once even if sent twice.
- Refunds from Admin › Payments with confirmation; receipts by email.

## Decisions (answered 2026-11-09)

- Payment until Paymob: **bank transfer only**; an admin marks it paid.
- Deadline: **48 hours**, or 24 hours before the show if sooner.
- Maximum **2 seats** per booking.
- Refund policy: **decide later**; tools built, text shows `[REFUND POLICY]`.
- Prices: `[PRICE]` until set.

## Original questions

1. **Payment until Paymob is ready**: bank transfer (we show your bank details and a reference), cash at the door, or both?
2. **Deadline to pay a reservation** before seats are released (suggest 48 hours, or 24 hours if the show is within 2 days).
3. **Maximum seats per booking** (suggest 4).
4. **Cancellation and refund policy** (e.g. full refund up to 48 hours before the show, none after; or no refunds, transfer the ticket to someone else).
5. **Prices** for Show 01 and Show 02, or keep `[PRICE]` until you decide.

## What you'll need to do

- 3a: one more Resend key for sending booking emails (pasted into Vercel, like before).
- 3b: open a Paymob merchant account (commercial register and tax card) and, if separate, a Fawry account. I'll guide you through the dashboard settings once approved.

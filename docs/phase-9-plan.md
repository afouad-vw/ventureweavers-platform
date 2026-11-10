# Phase 9 plan: Payments

Status: **approved 2026-11-10**.

## Decisions (answered 2026-11-10)

- Payment requests go to **members only** (email plus My space › Payments).
- **Full refunds only** until the refund policy is set.

Spec: `reference/prototype.html` → Admin › Payments.

Today the Payments page shows bank transfers waiting for show and masterclass seats, a short list of recent payments, and the bank details and refund policy members see. Program seats (TVAC) are paid and marked in TVS › Learners, and there is no way to ask for money for a BRICKR service or anything else.

## What changes

### One payments list (admin)

- Every payment in one table: **show and masterclass seats**, **program seats** and **payment requests** (below).
- Columns as in the prototype: date, member, item (and what kind), method, amount, status, reference, and **Mark paid** on pending rows.
- Numbers at the top: **Collected**, **Pending** (amount and count), **Refunded**, **Transactions**.
- Status chips: All, Paid, Pending, Refunded, Cancelled, Expired; a search box (name, item, reference); filter by space.
- Click a row to open it in the side drawer: details, history (who marked it paid and when), Mark paid, Cancel, Mark refunded.
- **Export CSV** of the current filter, for the accountant.
- The bank details and refund policy editor stays on this page.

### Payment requests (new, the prototype's "New payment link")

- Ask a member to pay for anything: a BRICKR engagement, a private session, a sponsored seat. You set the item, space, amount in EGP, due date and an optional note.
- Each request gets a reference (`VWP-XXXXXX`). The member gets an email and sees it in **My space › Payments** with the bank details and reference, the same way seat reservations work.
- You mark it paid when the transfer arrives; the member gets a receipt email.
- Card, wallet and Fawry payment links replace this flow once Paymob is live; the requests and references stay.

### My space › Payments (members)

- One list of everything the member has paid or owes: seats, program seats, payment requests, with status and reference.

## Data

| Table | Holds |
| --- | --- |
| `payment_requests` | member, item, space, amount, due date, note, reference, status (pending/paid/cancelled/refunded), who marked it and when |

Show seats and program seats keep their own tables. The list reads all three together through one database view that only admins can read.

## Access rules (tested)

- Only admins (2-step) create, mark paid, cancel or refund requests, and only admins read the combined list.
- Members see only their own requests and can't change them.
- Amounts are whole piasters, never negative, at most EGP 10,000,000; the reference is unique.
- Every change is written to the audit log.

## Questions

1. **Who can get a payment request**: members only (recommended, they see it in My space), or also people in Contacts who have no account (email only)?
2. **Refunds**: record full refunds only for now (recommended, refund policy still undecided), or allow partial refund amounts?

## Tests

Access tests for requests and the combined list (admin with 2-step vs without vs the member vs other members), reference format, amount limits, status changes only in allowed order; unit tests for the totals and the CSV.

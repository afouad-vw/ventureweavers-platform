# Phase 12 plan: sign-in wall, sign-up details, Calendly, content previews

Status: **for approval**. From Ahmed's comments, 2026-11-10.

Done already (no approval needed): LinkedIn link for each host and guest (editor + details pages); Outloud's "For teams" card is now **Private Shows & Sponsorships** without naming a format; the "Your hosts" card is removed from Outloud.

## 1. Sign-in wall

- Anyone not signed in who opens **any member app link** (Home, spaces, details pages, Library, search, Live mode…) lands on the **sign-in page**, and comes back to the page they wanted after signing in.
- Still open without signing in: sign-in, join, forgot and reset password, email confirmation, the unsubscribe link from emails, and the landing page `ventureweavers.com`.
- Pages are marked "do not index" so search engines don't list member pages.
- This replaces earlier decisions that kept the blog and digital content public.

## 2. Sign-up details

Every new member (email, Google or LinkedIn) completes one short **"About you"** step before entering the app:

| Field | Notes |
| --- | --- |
| Name | prefilled from Google/LinkedIn |
| Mobile number | **country code drop-down** (Egypt first, then MENA, then all countries) + number; stored in international format |
| Email | from the account, shown read-only |
| LinkedIn | profile link |
| Country | drop-down |
| Role | Founder, Operator / executive, Investor / angel, Corporate / intrapreneur, Expert / mentor, Student, Other |
| Interests | Education, Services, Content, QuidQuo (pick any) |
| How we communicate | WhatsApp, Email, Call (pick any) |

- Existing members are asked for the missing details once, the next time they open the app.
- Members can change everything later in My space › Profile; partners see it in Contacts.
- "How we communicate" replaces the WhatsApp/email switches (newsletter opt-in stays as its own choice).

## 3. Calendly for meeting requests

- **Request a meeting** opens Karim's **Calendly** inside the platform, with the member's name and email filled in, so they pick a real free slot and it lands straight in his calendar (with the Meet link Calendly creates).
- When they book, the request is saved in the **Requests inbox** with the service and member, and both partners get the usual email.
- Exact meeting time in the inbox: Calendly tells the page the booking happened; to read the time and catch cancellations we add a Calendly **webhook** (listed on all plans). You create a Calendly access token and paste it into Vercel (`CALENDLY_TOKEN`); I never see it.
- Our own slot picker stays as a fallback if Calendly isn't set.

## 4. Digital content preview images

- Each digital content item gets a **preview image** (upload, JPG/PNG/WebP up to 5 MB, at least 1280 × 720, 16:9 recommended). For YouTube links, the high-resolution YouTube thumbnail is used automatically when no image is uploaded.
- Shown on the Outloud content cards and in search.

## Data (tested)

| Where | Adds |
| --- | --- |
| `profiles` | country, LinkedIn, communication preferences (WhatsApp / Email / Call), interests from the new list; phone stored with country code |
| `requests` | Calendly event link and scheduled time (from the webhook) |
| `content_items` | preview image |

Access rules don't change for data: members still read and edit only their own profile.

## Questions

1. **Sign-in wall**: everything behind sign-in (recommended as you asked), or keep blog articles open so they can be shared on LinkedIn?
2. **Sign-up fields**: all required except LinkedIn (recommended), or all required?
3. **Calendly**: Karim's Calendly link, and which buttons use it (BRICKR services, private shows and sponsorships, TVS custom programs)?

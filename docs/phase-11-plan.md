# Phase 11 plan: modern UI, detail pages, richer programs, services and shows

Status: **approved 2026-11-10**. From Ahmed's comments, 2026-11-10.

## Decisions (answered 2026-11-10)

- Program **dates, capacity, price per seat, format, location and Meet link live on each cohort** (a program can run several times with different dates and prices). The program editor holds the content; the cohort editor holds the run.
- **3D means interface depth only** (glass, shadows, tilt); no 3D images.
- **Custom programs**: a form asking for the key information with a Send button; it emails the custom-programs inbox (set in admin settings, Karim's address) instead of the Requests inbox.

Done already (no approval needed): the pointer cursor now shows on every button, link and control, and "not allowed" on disabled ones.

## 1. Modern UI: glass, depth and hover

Applied to both the member app and the admin console, keeping the brand colours and fonts.

- **Liquid glass surfaces**: the top bar, mobile bottom bar, side menu, drawers, dialogs, the notifications panel and the live mode panels become frosted, translucent glass (background blur, a thin light edge, soft inner highlight). Behind them, a subtle brand-tinted gradient in place of the flat paper colour, so the glass has something to show through.
- **Depth (3D effects)**: layered soft shadows so cards sit above the page; content cards **tilt gently toward the cursor** with a light sheen as you move over them; buttons press in slightly on click.
- **Hover effects**: cards lift and their banner photo zooms slowly; buttons brighten with a soft teal glow; table rows and list items highlight; links underline smoothly; sidebar items slide a little.
- **Harmony and comfort**: one set of shared tokens (blur, glass tints, shadows, motion timing) so every screen matches; text stays fully readable on glass (contrast checked); all motion turns off for people who set "reduce motion"; touch screens get the lift without the tilt.
- **How we roll it out**: I build it on Home and TVS first and send you screenshots (desktop and phone) before applying it everywhere.

The brand rules say "No illustrations or 3D". I read that as *no 3D illustrations or renders*; the depth effects above are part of the interface, not images. I'll reword the rule to say so once you confirm.

## 2. TVS

- **Cards show an overview only**: banner, name, kind, short description, weeks/format/date line, price, status, tags, and a **View details** button (plus the main action: Apply, Book or Notify me).
- **Detail pages**: `/tvs/programs/[slug]` and `/tvs/masterclasses/[slug]` with everything below, the hosts and guests, the outline, and the brochure download.
- **Custom programs** replaces "Train your team": "For teams, portfolios, cohorts and organisations" with a **Request a meeting** button (same slot picker as BRICKR; it lands in the Requests inbox as a TVS request).
- **"Built for" section removed** from the TVS page; target audience moves into each program and masterclass.

### Creating a program or masterclass (admin editor)

| Field | Notes |
| --- | --- |
| Short description | up to 300 characters, shown on the card |
| Program details | longer text (Markdown with preview, like the blog) |
| Target audience | who it's for |
| Program outline | sessions, each with a title and duration in hours; add, remove and reorder |
| Pre-requisites | list |
| Activities | list |
| Format | Online or In person |
| Location | for in person; or **TBA** |
| Google Meet link | for online; or **TBA**; shown only to enrolled learners / confirmed ticket holders |
| Capacity | attendees |
| Dates | start and end |
| Price per seat | EGP; empty shows `[PRICE]` |
| Hosts | one or more (name and short title) |
| Guests | one or more (name and short title) |
| Brochure | PDF up to 10 MB, downloadable from the detail page |

## 3. BRICKR

- **Cards show an overview only** with a **View details** button; detail page `/brickr/services/[slug]`.
- **Creating a service**: short description, **offerings** (numbered list: add, remove, reorder), target audience ("for"), pre-requisites, brochure (PDF up to 10 MB).

## 4. Outloud

- **Image gallery on each show**: admins upload up to 12 photos per show (JPG, PNG or WebP, 5 MB each, reorder, delete). The show page shows them as a grid that opens full screen, swipeable on phones. Shown only when there are photos.
- **Where members ask questions and give feedback** (your question): it's **Live mode** (`/live`). It opens when an admin presses *Open live mode* for a show; ticket holders then see "Live now" in the sidebar, a button on Home and on their ticket, and a notification. To make it easier to find, I'll add a **Live mode** card to the show page itself for ticket holders: before the show it says "Opens when doors open", during the show it opens live mode, and after the show it opens the feedback form.

## Data (all changes tested)

| Where | Adds |
| --- | --- |
| `programs` | short description, details, audience, outline (sessions with hours), pre-requisites, activities, format, location (or TBA), capacity, start and end dates, hosts, guests, brochure; the Meet link in a separate table visible only to enrolled learners |
| `events` (masterclasses and shows) | short description, details, audience, outline, pre-requisites, activities, end date and time, hosts and guests as lists, brochure, location TBA, gallery |
| `services` | short description, offerings, audience, pre-requisites, brochure |
| `requests` | can be a TVS custom program request |
| Storage | public bucket `brochures` (PDF, 10 MB, admin-only uploads), public bucket `event-gallery` (images, 5 MB, admin-only uploads) |

Existing programs, masterclasses and services keep their text; current descriptions become the short description.

## Questions

1. **Program dates, capacity, price, format and location**: keep them on the program itself (recommended: one form, one place; the cohort keeps the classroom), or on each cohort (better if the same program runs several times a year with different dates)?
2. **"3D"**: depth and motion in the interface only, no 3D illustrations (recommended), or also allow 3D images?
3. **Custom programs → Request a meeting** goes into the Requests inbox like BRICKR (recommended)?

## Tests

Access tests for the new Meet link table, the two buckets (admin-only writes, public reads, type and size limits) and TVS requests; unit tests for the outline totals (hours), list editing and the card overview text.

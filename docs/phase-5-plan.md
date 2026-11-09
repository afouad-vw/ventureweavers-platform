# Phase 5 plan: Home feed, Outloud content and blog, Library, Publishing

Status: **waiting for approval** (new tables, file storage and access rules).

Spec: `reference/prototype.html` → Home, Outloud › Digital content and Blog, Library, My space › Saved, Admin › Outloud, Library and Publishing.

## What members get

- **Home**
  - Greeting with the member's first name and the line "Your feed is tuned to …" from their profile, plus Edit interests.
  - **Next up**: their nearest booked event with the ticket button.
  - **Reminders**: payment deadlines, events in the next 7 days, and (later) live sessions and assignments.
  - **Announcements**: items the partners pin from Publishing, shown first until they expire.
  - **Feed**: updates from all four spaces as cards (space tag, kind, title, short text, image, button), filtered by space with chips.
- **Outloud › Digital content**: tiles for shorts, carousels, reels and episodes, filtered by format, each linking to Instagram, TikTok, LinkedIn or YouTube. "Scheduled" items show "Coming [date]".
- **Outloud › Blog**: content cards (banner, category, title, summary, tags), article page with author, date and read time, Save and Copy link.
- **Library**: search and type filters (Report, Guide, Template, AI skill); each item shows its space and access level. Members open or download what their level allows; locked items show a lock.
- **Suggest a topic** (Outloud): a short form; the partners see suggestions in the admin console.
- **My space › Saved**: blog posts and Library items saved with the bookmark button.

## What admins get

- **Admin › Outloud**: Digital content and Blog lists with create, edit, duplicate, delete and Published/Draft (plus Scheduled for content) through the editor drawer; blog banners use the same upload as events. Topic suggestions list.
- **Admin › Library**: resources with title, type, space, access level, description, and either an uploaded file or a link.
- **Admin › Publishing**: compose an update (space, kind, title, text, optional image and button link), choose where it goes (Feed; Email to members who opted into The Floor Notes), optionally pin it as an announcement until a date, and see the sent history.
- Every change in the audit log.

## Data

| Table | Holds |
| --- | --- |
| `posts` | feed updates: space, kind, title, body, image, button label and link, pinned until, status, published at |
| `content_items` | title, series, format, platform, link, publish date, status (published, scheduled, draft) |
| `blog_posts` | slug, title, category, author, date, read time, summary, body, banner, tags, status |
| `library_resources` | title, type, space, access level, description, file path or link, status |
| `topic_suggestions` | member, text, status (new, picked, archived) |
| `publish_log` | what was sent, to which channels and audience, by whom, how many emails |

`saved_items` (already built) gets used for blog posts and resources.

## Access rules (tested)

- Published blog posts and digital content are **public** (good for search and sharing). Drafts and scheduled items only in the admin console.
- The Home feed, announcements and Library list are for **signed-in members**.
- Library files sit in **private** storage. A download link is created on the server only after checking the member's level, and it expires after a few minutes, so links can't be passed around.
- Access levels: **All members** works now. **TVS learners**, **BRICKR clients** and **QuidQuo waitlist** show as locked until those features exist (Phases 6 and 7); admins can already tag resources with them.
- Topic suggestions: members create their own and see only their own; admins see all.
- Only admins create, edit or publish anything.

## Blog writing

The body is written in a simple format with headings, bold, italics, lists, links and quotes (Markdown), with a live preview in the editor. Pasted text works as plain paragraphs.

## Email from Publishing

Uses Resend (the `RESEND_API_KEY` you'd add for booking emails). Sent only to members who ticked The Floor Notes, with an unsubscribe link that turns the setting off. Sent in batches; the count is recorded.

## Decisions needed

1. **Blog format**: Markdown with preview (recommended), or plain text paragraphs only.
2. **Library files**: uploads up to 20 MB (PDF, Word, Excel, PowerPoint, ZIP) plus links (recommended), or links only.
3. **Email from Publishing**: build it now, or Feed only for now.
4. **Blog visibility**: public (recommended) or members only.

## Tests

Access tests for every new table and the private file storage; unit tests for Markdown rendering (no unsafe HTML), reminders, feed filtering and the unsubscribe token.

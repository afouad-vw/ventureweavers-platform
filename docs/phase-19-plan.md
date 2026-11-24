# Phase 19 plan: BLong controls, moderation, posts and filters

Status: **waiting for approval** (2026-11-24). Asked by Ahmed. Touches the database and access rules, so nothing here is built until approved.

Answers already given: engagement goes on **discussion messages** and a **new post wall in each community**; the admin switch turns **whole sections** (Communities, Discussions) off into Coming soon; moderation covers **blocked words, links and spam, new member limits and auto-hide after reports**.

Four steps, each released on its own: 19a admin controls, 19b automatic moderation, 19c community posts and engagement, 19d filters.

---

## 19a. Admin controls: section switches, approval, analysis

### Section switches (Coming soon)
- New single-row table `blong_settings` (super admins and staff with Community (manage) change it; every change goes to the audit log).
- Two switches: **Communities on/off** and **Discussions on/off**. Networking stays on.
- When a section is off, members see a Coming soon page for it (the house dock icon stays, with a "Coming soon" chip) and a **Notify me** button. Everything in that section is hidden from members and nothing can be created, joined or posted (the database refuses with `section_off`, not just the screen). Content is kept; switching back on brings it all back as it was.
- Discussions inside communities follow the Communities switch too (a community room is hidden if either section is off).
- Notify me: `waitlist_entries.item_type` gains `blong_section`, with a fixed id per section. Switching a section on sends a bell notification once (database trigger) and the usual email (app, retried daily by cron within 3 days), same as other Coming soon items. Admins see the list (CSV, add, remove) from Admin › Community › Settings.
- BLong activity in Networking › Feed and member pages leaves out items from a switched-off section.

### Approval before anything goes live
- `communities.status` and `discussions.status` gain `pending` and `declined`.
- Two settings (both on by default): **New communities need approval**, **New discussions need approval**.
- A new community or discussion starts `pending`: only its creator sees it (Owned tab, "Waiting for approval" chip). It can be edited but not joined, shared, invited to or posted in. The daily limits (3 communities, 10 discussions) count pending ones.
- Admin › Community › **Approvals** tab: name, creator, type or category, description, cover, privacy, created. Actions: **Approve** (goes live; creator told in their bell) or **Decline with a note** (creator told with the note; they can edit and resubmit once, which puts it back to pending). Partners get the usual email alert for new items waiting.
- Edits after approval go live without a second review; auto-moderation (19b) still checks the new text.
- Existing communities and discussions stay live.

### Analysis
Admin › Community › **Overview** tab (counts only; staff never read chats):
- Totals and last 30 days: members on BLong (Public/Private split), follows, communities, discussions, posts, messages, comments, likes, active members (posted or reacted in the last 7 and 30 days), joins.
- A daily chart for the last 30 days (new members active, messages and posts).
- Top 10 communities and discussions by activity in the last 30 days.
- Moderation: reports open and handled, items held and auto-hidden, average time to handle.
- One database function `blong_stats()` for staff with Community (view); nothing personal beyond names of communities and discussions.

Admin › Community also gets a **Settings** tab (switches, approval, moderation rules) and the existing Reports, Communities and Discussions tabs gain search and status filters (Pending, Active, Archived, Declined, Hidden).

---

## 19b. Automatic moderation (rules the admin sets)

Rules live in `blong_settings` and are checked inside the database functions that post (room messages, community posts, comments, community and discussion names and descriptions), so they can't be skipped.

| Rule | What it does | Default |
| --- | --- | --- |
| **Blocked words** | A list (English and Arabic, whole words, case-insensitive). Choose per list: **Hold for review** or **Reject** (the member is told to rephrase). | Empty list, Hold |
| **Links** | Members newer than N days can't post links (held for review). Anyone: at most N links per message. Blocked link domains list. | 7 days, 2 links |
| **Spam** | The same text posted again within 10 minutes is refused. More than N messages a minute slows the member down. | 6 a minute |
| **New member limits** | Accounts younger than N days can't create communities or discussions, can only message people who follow them, and their first N posts are held for review. | 3 days, first 2 posts |
| **Auto-hide after reports** | An item reported by N different members is hidden from everyone but its author until staff review it (messages, posts, comments, communities, discussions). | 3 reports |

- **Held for review**: the author sees their item with "Waiting for review"; nobody else sees it. Admin › Community › **Held** queue shows the item, the rule that caught it and the author. Actions: **Publish** or **Remove** (author told in their bell). Held items never publish on their own.
- Hosts and admins of a community or discussion can also approve held items in their own space (optional, off by default).
- **Member messages (Messages › Members) are never held**, because staff never read private chats: blocked words and link rules there **refuse** the message with a note instead. Reported chat messages work as today.
- Every automatic action is logged (`moderation_log`: rule, item, member, action, time), shown in the Overview and on the item in the queue.
- Members repeatedly caught (for example 5 held items in a week) appear in a "Watch" list for staff; staff decide (warn, suspend through Contacts). No automatic suspensions.

---

## 19c. Community post wall and engagement

### Posts inside each community
- New **Posts** tab, first on a community page (About, Posts, Discussions, Members).
- `community_posts`: text (up to 3,000), optional link with preview, optional image (content-images `communities/<community>/posts/`, 5 MB), pinned, status (live, held, hidden, removed).
- Community members post; owners and admins can switch the community to **Only admins post** (announcements). Owners and admins pin, remove and close comments on a post. Authors edit or delete their own.
- `post_comments`: comments with one level of replies (1,000 characters).
- Limits: 20 posts a day, 60 comments an hour per member.

### Engagement on posts and on discussion messages
| | Community posts | Discussion messages |
| --- | --- | --- |
| **Like** | Yes (and on comments) | Yes |
| **Comment** | Comments and replies under the post | A reply thread under the message (builds on today's replies; shows "3 replies") |
| **Share** | Copy link, the phone's share sheet, or send to a member in Messages | Same, linking to the message in the room |
| **Views** | Unique members who saw it | Unique members who saw it |
| **Bookmark** | Saved to My space › Saved › BLong | Same |

- Tables: `blong_likes`, `blong_bookmarks`, `blong_views` (one row per member and item, so views are unique viewers), `blong_shares` (counted once per member, item and channel a day). Only people who can see the item can like, comment, share, view or save it (same checks as reading it).
- Shared links open only for people allowed to see the item; others see the community or discussion's join page.
- Notifications: the author is told about comments and replies (grouped, one notice per item per hour), not about each like or view.
- Likes: 300 an hour per member. Counts show on each post and message; the list of who liked is shown to community members.
- The Networking feed shows posts from communities you're in and from people you follow (new "Posts" kind).

---

## 19d. Filters

Filters sit above each list, are kept in the address (shareable), and open as a sheet on phones. Each list also gets **Sort**.

- **Communities**: type, topic, audience (Ecosystem Role), Public or Private, size (under 50, 50–200, 200+), sort by Most active, Newest, Most members.
- **Discussions**: category, community, who can join (Public, Request, Invite), Open or Closed, has room to join, tag, sort by Active now, Newest, Most members.
- **Networking › Members**: Ecosystem Role, country, business type, venture stage, interests, Public or Private, people who follow you, sort by Newest, Name. Only what the member's privacy already shows is filterable (a Private member's details are never matched).
- **Networking › Feed**: by kind (Events, Programs, BLong, News, Posts).
- Database: `list_communities`, `list_discussions` and `member_directory` take the new filters (replacing the functions, same names).

---

## Decisions to confirm (recommended answers)
1. A switched-off section is **hidden** for members (not read-only), content kept. *Recommended.*
2. Approval is for **new** communities and discussions only; existing ones stay live; edits after approval don't need a second review. *Recommended.*
3. Member-to-member messages are **refused, never held** by the rules, so staff never read private chats. *Recommended.*
4. Defaults: auto-hide at **3** reports; new member = account younger than **3 days** for creating and messaging, **7 days** for links; blocked words **hold** for review.
5. Likes and views **don't** notify; comments and replies do (grouped hourly).
6. Views count **unique members**, not page loads.

## Tests
Database tests for: section switches (every create, join, post and list function refuses when off), approval (pending visible only to creator and staff, can't join or post), each moderation rule (hold, reject, auto-hide, DM refuse), engagement access (no like/view/save on items you can't see), view uniqueness and limits. Unit tests for filter parsing and the rule matcher (blocked words in English and Arabic, link counting).

## Order and size
19a and 19b first (one migration each), then 19c (largest: new tables, post wall, threads, Saved), then 19d. Each is checked with build, lint and tests, applied in Supabase hash-verified, and shown before release.

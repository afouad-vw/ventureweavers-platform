# Phase 18 plan: BLong, the community space

Status: **approved 2026-11-24** with the six recommendations below as written. 18a (networking) built; 18b–18d next.

BLong is the fifth space: where members meet, talk and follow each other. It has three sections, Communities, Discussions and Networking, plus member-to-member messages in the top-bar Messages button. It appears in the house look (web and iPhone app) as a sixth slide between QuidQuo and My space, in the middle of the house where the staircase is today.

## 1. What members can do

### Communities
- **Create** a community: name, description (up to 1,000 characters), type, topics (tags, up to 8), target audience (Ecosystem Roles, several), Public or Private, cover image (optional).
  - Types: Interest, Industry or sector, Role (for example founders or angels), Location, Program alumni, Other.
- **Explore**: search and filter by type, topic and audience. Public communities show their members and posts to every member; private ones show their name, description and member count only.
- **Join**: Public communities join at once; Private ones take a request that a community admin accepts or declines (or the admin invites people).
- **Inside a community**: its discussions, a members list, and an About tab.
- **My space › Communities**: Joined and Owned. Owners and admins can edit, archive or delete, see members, make someone an admin or remove them, and accept requests. Members can leave. An owner hands ownership to an admin before leaving.

### Discussions (rooms)
- **Create** a discussion: title or topic, description, category, tags, member limit (2 to 500), privacy (Public, Request to join, Invite only). It can sit inside a community (then only its members can find it) or stand alone.
  - Categories: Fundraising, Building and growth, Investing, Careers and hiring, Programs and learning, Events, Other.
- **Explore**: open and request-to-join rooms, with how many have joined and how many places are left.
- **The room**: a live conversation (messages up to 2,000 characters, replies to a message, links), with Supabase Realtime and a 10-second refresh fallback, as in Live mode. Owners and admins can pin a message, remove messages, close the room (read-only) or delete it.
- **My space › Discussions**: Joined and Owned, with the same view, edit, delete, leave, members and roles tools as communities.

### Networking and messaging
- **Account privacy** (Profile settings › Privacy): Public or Private.
  - **Public**: anyone in BLong can follow you and message you, and sees your card (name, photo, Ecosystem Roles, businesses, short bio, social links) and your VW activity.
  - **Private**: people see your name, photo and roles only. To follow you they send a request; until you accept, they can't see your links, details or activity, and can't message you.
- **Members**: a directory to search by name, role, business type and country, with Follow, Requested, Following and Message buttons.
- **Member page**: card, links and VW activity, as far as their privacy allows.
- **VW activity** shown on a member's page and in the feed:
  - shows they are going to or went to, programs and masterclasses they joined, communities and discussions they joined, and their published news and posts;
  - each member chooses which of these kinds to show (all on by default for Public accounts);
  - never shown: payments, requests to the team, BRICKR client projects, private (invited-only) items, email or phone.
- **Feed**: updates from the people you follow (BLong › Networking › Feed).
- **Messages button**: two tabs.
  - **VentureWeavers**: today's conversation with the team, unchanged.
  - **Members**: one-to-one chats with other members. You can message a Public account, or a Private one that has accepted your follow.
- **Safety**: Block (they can't see your page, follow or message you, and their messages to you stop) and Report (on a member, community, discussion or message). Reports land in the admin console.

## 2. Recommendations that need your decision

1. **New accounts start Private**, and existing members too. Members switch to Public themselves. *(Alternative: start Public.)*
2. **Any member can create communities and discussions** with the limits below. *(Alternative: only after the team approves each community.)*
3. **Moderation**: a new admin area "Community" (view, manage). From it, staff can see reports, archive a community or discussion, remove a message, and suspend a member (the existing suspension). Staff can't read one-to-one member chats unless one of the two people reports a message.
4. **Limits per member**: 3 new communities a day, 10 new discussions a day, 60 room messages an hour, 50 member messages an hour, 30 follow requests an hour.
5. **Colour**: BLong is violet `#7C5CE0` (tint `#B4A2F5`), so it stands apart from the other four spaces and the teal house colour.
6. **Community guidelines**: a short section added to the Terms of Use (be respectful, no spam or selling without consent, no sharing others' private details), linked from Create and Report.

## 3. Data model (Supabase)

New tables, each with row level security:

| Table | Holds |
| --- | --- |
| `profiles` (new columns) | `visibility` (`public`/`private`, default `private`), `bio` (300), `links` (up to 5: label + https URL), `show_activity` (which kinds to show) |
| `follows` | follower, followee, status (`pending`/`accepted`), created and accepted times |
| `blocks` | blocker, blocked |
| `communities` | name, slug, description, type, topics, audience, visibility, cover, owner, status (`active`/`archived`) |
| `community_members` | community, member, role (`owner`/`admin`/`member`), status (`active`/`requested`/`invited`) |
| `discussions` | title, description, category, tags, member limit, privacy, community (optional), owner, status (`open`/`closed`/`archived`), pinned message |
| `discussion_members` | discussion, member, role, status |
| `discussion_messages` | discussion, author, body, reply to, created, edited, removed by |
| `dm_threads` | two members (stored in a fixed order), last message time, each side's read time |
| `dm_messages` | thread, author, body, created |
| `reports` | reporter, what was reported (member, community, discussion, message), reason, details, status, handled by |

How the access rules work:

- **Member cards** come from a database function that returns only what the viewer may see: public fields for Public accounts and accepted followers; name, photo and roles otherwise. It returns nothing to anyone who has been blocked. Email and phone are never returned.
- **Activity** comes from a function that joins existing bookings, applications, enrolments and posts with community and discussion membership, filtered by the member's privacy, their `show_activity` choices and the viewer's follow status. It never includes payments, requests, projects or private items.
- **Communities and discussions**:
  - Public ones can be read by any signed-in member.
  - Private, request-only and invite-only content can be read by active members only.
  - Writes go through functions that check roles (owner or admin), member limits and the daily limits.
- **Member messages**: a chat can only be started when the other member is Public or has accepted your follow, and neither has blocked the other. Only the two people in a chat can read it.
- **Admins**: every Community policy and function checks the new `community.view` / `community.manage` permissions, as every other admin area does. Super admins have both.
- **Suspended members** can't post, follow or message, and their content is hidden.

## 4. Notifications

Bell notifications (written by database triggers, as today):
- someone follows you, or asks to;
- your request is accepted;
- an invite to, or request for, a community or discussion;
- you are made an admin;
- a reply to your message in a room;
- a new member message, which also shows as a count on the Messages button.

No emails at first. A weekly BLong digest email can come later.

## 5. In the app (house look)

- **House**: the staircase in the middle of the house becomes a lounge with people networking, with a violet light. A sixth spot, BLong, joins the four on the house.
- **New BLong slide** between QuidQuo and My space: its own 3D close-up scene, kicker "Community · Engage and connect", line "Where members meet, talk and grow together." Icons: Communities, Discussions, Networking.
- **Top row**: House · Outloud · TVS · BRICKR · QuidQuo · BLong · My space.
- **My space**: two new icons, My communities and My discussions; the row already scrolls.
- **Profile settings**: a Privacy tab.
- **Messages**: a panel with two tabs, VentureWeavers and Members.
- **Phones**: everything works on phones, in the iPhone app too.

## 6. Build order (each step shown to you before it goes live)

1. **18a Networking**: privacy setting, member cards, follows and requests, blocks, reports, member messages, the Messages tabs, and the admin Community area (reports).
2. **18b Communities**: create, explore, join or request, members and roles, and My space › Communities.
3. **18c Discussions**: rooms with live chat, roles, limits, and My space › Discussions.
4. **18d Feed and activity**: activity on member pages, the Followed members feed, and the BLong house scenes and slide.

Tests cover the access rules (who can see a card, activity, a private community or a room; who can message whom), member limits and roles, as with money and capacity today.

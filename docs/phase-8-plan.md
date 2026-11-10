# Phase 8 plan: Live mode

Status: **for approval**.

Spec: `reference/prototype.html` → Member › Live mode, Admin › Outloud › Live control.

## What members get (`/live`)

- Opens only while an admin has **opened live mode** for a show, and only for people holding a confirmed ticket to it. A "Live now" link appears in the sidebar, on Home and on the ticket.
- **On stage now**: the current moment (1. The Pick, 2. Answered Together, 3. Guest on Stage, 4. Your Voice) and the question the hosts picked, with the asker's name.
- **Poll**: "What should we discuss next?" Tap to vote, tap again to change or take it back; results show after you vote.
- **Questions from the room**: approved questions, top voted first, with upvotes (one per person per question). Your own questions show to you with "Waiting for approval" until the hosts approve them.
- **Ask the floor**: up to 280 characters, at most 5 questions per person per show.
- **Your voice** (moment 4): "What should the next show be about?" goes into the existing topic suggestions.
- Everything updates on its own without refreshing (Supabase Realtime, with a 10-second refresh as backup).

## What admins get (Outloud › Live control)

- Pick the show; **Open live mode** / **End live mode**; checked-in count (from door check-in, already built).
- **Question queue**: waiting questions first, then by votes. Approve, Hide, or put back.
- **Stage control**: the four moments; **Pick a question** chooses at random from approved questions not yet picked and puts it on stage.
- **Polls**: write the question and 2–4 options before or during the show; one poll open at a time; close and reopen; live counts.
- **End show · send feedback form**: closes the poll, moves to Your Voice, and emails attendees who opted in a link to the feedback form.
- **Screen view**: a full-screen page for the venue projector showing the current moment, the picked question and poll results (admin sign-in, so it isn't public).

## Data

| Table | Holds |
| --- | --- |
| `live_sessions` | one per show: open/closed, current moment, picked question, opened and ended times |
| `live_questions` | question text, asker, status (waiting/approved/hidden), picked time |
| `live_votes` | one upvote per member per question |
| `live_polls`, `live_poll_options`, `live_poll_votes` | the poll, its options, one vote per member per poll |

## Access rules (tested)

- Members read and write only while live mode is open for a show they hold a confirmed ticket to.
- Members see approved questions and their own; never other people's waiting or hidden ones.
- Only admins (2-step) approve, hide, pick, change the moment and run polls.
- Vote and question limits are checked in the database, so they can't be bypassed.
- Realtime only sends members what the rules already let them read.

## Questions

1. **Who can join live mode**: everyone with a confirmed ticket (recommended, so people still in the queue at the door can ask), or only people checked in at the door?
2. **Names on questions**: show the asker's first name (recommended), full name, or let each person choose to ask anonymously?
3. **Feedback at the end**: email attendees the feedback link (recommended, the bell is parked), or only show it in live mode?

## Tests

Access tests (ticket holder vs no ticket vs live closed vs admin without 2-step), vote and question limits, one vote per poll, random pick only from approved and not yet picked; unit tests for poll percentages and queue ordering.

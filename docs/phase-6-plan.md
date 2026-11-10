# Phase 6 plan: TVS (programs, masterclasses, classroom)

Status: **waiting for approval** (new tables, payments, file storage and access rules).

Spec: `reference/prototype.html` → TVS (Programs, Masterclasses), TVAC classroom, My space › My learning, Admin › TVS (Programs, Masterclasses, Classroom, Learners, Applications).

## Split into two parts

| Part | What |
| --- | --- |
| **6a** | Programs catalogue, applications to TVAC, "Notify me" for programs in development, masterclasses with booking (same booking, payment and ticket engine as Open Floor shows). |
| **6b** | The classroom for enrolled learners: cohorts, modules, steps and progress, assignments with file upload and feedback, live sessions (Google Meet), documents and recordings, cohort discussion, reminders. |

6a can go live first; 6b follows on top of it.

## 6a: what members get

- **TVS › Programs**: content cards (banner, name, type, description, tags, length, `[PRICE]`). TVAC is marked "Start here" and comes first.
  - **TVAC**: Apply → a short form (role, stage, what you're building, why now). The application shows in My space › Requests with its stage.
  - **360 programs that are open**: "See dates" (intake dates follow each TVAC cohort); programs marked "Requires TVAC".
  - **Programs in development**: "Notify me" (toggle). The partners see who asked.
  - The rail from the prototype: How joining works, Built for, Train your team.
- **TVS › Masterclasses**: cards filtered by Online / In person, with date, host, seats left and Book. Booking, tickets, QR, calendar file and check-in work exactly like shows. Online masterclasses show the Meet link on the ticket after payment.
- **My space › My learning**: applications and their stage, enrolments with progress, masterclass tickets.

## 6a: what admins get

- **Admin › TVS › Programs**: create, edit, duplicate, delete, status (Open, In development, Closed) through the editor drawer; type (Foundation, 360 program), length, price, "Requires TVAC", banner. "Notify me" list per program.
- **Admin › TVS › Masterclasses**: same editor as events (they are events of type masterclass with a host, format and Meet link); bookings, mark paid, cancel, check-in.
- **Admin › TVS › Applications**: board with the prototype's stages **New → Intro call → Proposal → Won / Declined**. Moving to **Won** offers the learner a seat in a cohort: the member sees "Pay to confirm your seat" with bank details and a reference (as for shows); an admin marks it paid, and the member is enrolled.

## 6b: the classroom (enrolled learners only)

- **Header**: "TVAC classroom · Cohort [NO.]" with overall progress.
- **Modules & progress**: the 6 TVAC modules. Each opens on a date set by the admins ("Opens next week", "Locked"). Inside a module: steps (reading, case, assignment, Library link) the learner ticks off; progress counts ticked steps.
- **Assignments**: due date, status (Locked, Due, Submitted, Reviewed); upload a file (PDF, Word, PowerPoint, Excel, ZIP up to 20 MB, private); replace until reviewed; feedback from the partners shown under it.
- **Live sessions**: next session card with **Join with Google Meet**, Add to calendar, upcoming and past sessions with recordings.
- **Documents & recordings**: files for the cohort (private, 5-minute download links) and recordings.
- **Reminders** rail: assignments due (day before) and live sessions (1 hour before), by email now; WhatsApp and push come with Phase 10.
- **Cohort discussion**: one thread per cohort; learners and hosts post; host posts are highlighted; admins can remove posts.
- Library items marked **TVS learners** unlock for enrolled learners.

## 6b: what admins get

- **Admin › TVS › Classroom** (per cohort): modules and their opening dates, steps, assignments (create, edit, due date), live sessions (title, time, Meet link, recording link), documents (upload), discussion moderation.
- **Review work**: each submission with download, a feedback box and "Mark reviewed" (the learner gets an email).
- **Admin › TVS › Learners**: everyone enrolled, program and cohort, progress, last activity, Review work.

## Data

| Table | Holds |
| --- | --- |
| `programs` | name, type, description, length, price (piasters), requires TVAC, banner, status |
| `program_interest` | member, program ("Notify me") |
| `applications` | member, program, answers, stage (new, intro_call, proposal, won, declined), owner, notes |
| `cohorts` | program, number, start date, status |
| `enrolments` | member, cohort, status (offered, confirmed, cancelled), amount, payment reference, paid by |
| `modules`, `module_steps` | per cohort: title, order, opens at; steps with kind and link |
| `step_progress` | member, step, done |
| `assignments`, `submissions` | per module: title, due; per learner: file, status, feedback, reviewed by |
| `class_sessions` | cohort, title, start time, Meet link, recording link |
| `cohort_files` | cohort, module, title, file |
| `cohort_posts` | cohort, member, text, host flag, removed |

Masterclasses reuse `events` (new type `masterclass`, with `space`, `host`, `format`, `meet_url`), `bookings`, `tickets` and `payments`.

## Access rules (tested)

- Programs and masterclasses are public once published.
- Applications, enrolments, progress and submissions: members see only their own; admins see all. Only admins move stages, mark paid or write feedback.
- Everything inside a cohort (modules, steps, sessions and Meet links, files, recordings, posts) only for learners **confirmed** in that cohort, and admins.
- Submissions and cohort files sit in private storage; download links are made on the server after the check and expire in 5 minutes.
- Learners can't change an assignment after it is reviewed.
- Masterclass Meet links are visible only to members with a confirmed ticket.

## Decisions needed

1. **Joining TVAC**: apply → intro call → offer → pay → enrolled (as in the prototype, recommended), or apply → pay straight away.
2. **Payment** for programs and masterclasses until Paymob is live: bank transfer, admin marks paid (same as shows, recommended).
3. **Google Meet links**: you paste the link when scheduling a session (recommended now), or I set up the Google Calendar API so links and invites are created automatically (needs a Google Workspace setup step with you).
4. **Recordings**: paste a link (YouTube unlisted or Google Drive, recommended now), or host them in Mux (paid per minute, private player).
5. **Cohort number and dates**: keep `[NO.]` and `[DATE]` placeholders until you set them in the admin console (recommended).

## Not in this phase

- The notifications bell in the top bar (asked about 2026-11-10; parked).
- Card and wallet payments (Phase 3b, waiting for Paymob).
- WhatsApp and push reminders (Phase 10).

## Tests

Access tests for every new table and both private buckets (cohort members vs other members vs visitors vs admins), capacity and payment tests for masterclasses (shared with shows), enrolment payment and stage rules, assignment lock after review, unit tests for progress and module opening.

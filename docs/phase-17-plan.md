# Phase 17 plan: BRICKR client projects (fractional leadership)

Status: approved 2026-11-17 (client approves quotes; Drive folder link with embedded view; retainer invoices drafted automatically, partner reviews and issues). 17a live (migration `20261117000011`). 17b project management live (migration `20261117000012`, see "17b: project management" below).

## 17b: project management (approved 2026-11-17)

- **Statuses** (replace Set-up/Assessment): Proposal → Pending approval → Approved → Situation assessment → Active → Renewal due → Completed, plus Paused and Cancelled.
  - Automatic moves: proposal uploaded → Pending approval; client lead accepts → Approved; start date → Situation assessment; one month after the start → Active; one month before the term ends → Renewal due (daily cron and after each save).
  - Partners change the status by hand at any time and can switch automatic moves off per project. Every change is logged (history on the overview); client people are told in their bell for Approved, Situation assessment, Active, Renewal due and Completed.
- **Requests have a category:** Extra work and Scope change (quoted; the client lead approves), Meeting or call (with preferred times; partners schedule it into Meetings and the request closes), Question or advice, Document or data, Other (answered and closed, never quoted; enforced in the database).
- **Notes:** partner notes (team only) and shared notes. Partners tick "Share with the client team"; client people read shared notes and add their own (30 a day) on the Notes tab.
- **People:** client leads add team members by email (members join straight away; others are invited and join when they sign up with that email; 10 a day, 40 people per project) and remove team members. Only partners make someone a client lead. The invitee gets an email; the partners get an alert.
- **Plan & tasks:** milestones (dimension, due date, status) and tasks (our side or the client's, assignee, due date, status To do / In progress / Blocked / Done, priority, team-only option). Client people see shared tasks and update the status of client-side tasks; a named client assignee is told in their bell. Progress by milestone and dimension; overdue and blocked counts.
  - "Add Month 1 onboarding plan" adds the proposal's onboarding: before kick-off, kick-off, three weeks of deep-dives (one per dimension), the readout, a week for direction and roadmap, and the four Month 1 outputs, dated from the start date.
  - Meetings have action items (tasks linked to the meeting).
  - Weekly wrap-ups (summary, done, next, open points): saved as drafts, published to the client team (bell and email).
- **Project folder:** any https link (Google Drive, SharePoint, Dropbox), set inline on the admin overview; Google Drive folders also show their files on the client's page.
- Next: assessment (requirements sheet answers and scorecard), then 17c invoices and analysis.

Reference: "TCS - VW Fractional Leadership" (the proposal for The Cooking School, latest version 2026-11-17). That proposal sets out:
- **Four dimensions:** Portfolio Strategy, Venture Building (new ventures, idea to launch), Venture Scaling (existing ventures: diagnose, rebalance or grow), Positioning. Governance and support run through all four.
- **AAA framework:** Assess, Advise, Access.
- **Timeline:** Month 1 onboarding (three weeks of situation assessment, then a week to set direction), then a weekly rhythm.
- **Weekly cadence:** 4–5 hours of sessions, with updates shared 2–3 working days ahead and emails answered within 1–2 working days.
- **Commercials:** a USD 3,000 monthly retainer, billed at the end of each month, on a 12-month term.
- **Extras:** anything beyond the scope is quoted separately.

## Projects and who sees them

- **A project** belongs to a client business from Admin › Businesses, and usually comes from a Won deal.
  - Kinds: **Portfolio**, or **Venture**.
  - Type: Fractional leadership or Mentorship.
- **Portfolios:** a portfolio project has a child project for each of its ventures, so The Cooking School has one portfolio project plus one per venture. The portfolio view rolls up its ventures' progress, requests, meetings and invoices.
- **Client people:** partners add members to a project (from Contacts, or by email until they join).
  - Roles: **Client lead** (approves quotes and the proposal, sees invoices) and **Team member** (works on tasks, requests and meetings).
  - Portfolio people see the portfolio and every venture under it.
  - A venture's people see only their venture.
- **Statuses:** see 17b above.
- **Health:** each project shows green, amber or red, set by the partners.
- **Where it lives:**
  - Members: My space › Projects, and a "My projects" card on BRICKR.
  - Admin: Admin › BRICKR › Projects.
  - A new access area, **Projects** (view / manage), so team members can be given it separately. Invoices also need Payments.

## The project workspace (tabs)

1. **Overview**
   - Goals, dimensions, term, the team on both sides and health.
   - This week's meetings, open requests and tasks due.
   - The latest status update.
2. **Assessment: data collection**
   - **Requirements sheet:** questions grouped by dimension. The client answers in text, numbers, choices, links or files; files go to a private store with 5-minute download links.
     - Templates: Portfolio, following the proposal's situation assessment (the portfolio, existing ventures, new ideas and pipeline, positioning, assets, capabilities, resources), and Venture (strategy, market, operations, finances, team, capital, positioning, AI and tools).
     - Suggested for 17b: a **track** on each venture project (New venture: Building, from validation to launch; Existing venture: Rebalance or Grow), so the venture's plan, assessment and stage follow the right path.
     - Partners edit the questions per project and send the sheet. The client lead sees progress and submits.
   - **Partner scorecard:** a 1–5 score for each dimension, with findings and recommendations. Partners can share it with the client or keep it internal.
   - **Re-assessments** (for example quarterly) are compared with the starting point.
3. **Proposal and scope**
   - The proposal PDF, with a **Download proposal** button (private store, short-lived link).
   - Scope listed by dimension: what's included, outputs, cadence and key terms. The commercial terms come from the project: retainer amount and currency (EGP or USD), billing day and term.
   - The client lead presses **Accept proposal**, which is recorded with time and name.
   - A clear note: **requests beyond this scope are priced separately.**
4. **Plan and progress**
   - Workstreams (the dimensions), milestones and tasks: owner on our side or the client's, assignee, due date, status (To do, In progress, Blocked, Done).
   - Tasks can be marked internal.
   - Board and list views, and progress by workstream and milestone.
   - A weekly status update ("Weekly wrap-up": summary, open points, next week's agenda) that partners post and the client sees.
5. **Requests**
   - Extra requests, raised by the **client** in the app, or by the **team** on the client's behalf (for example "received verbally on 12 Nov from…").
   - **Flow:**
     1. Submitted.
     2. In review.
     3. We respond with **price, details, requirements and timeline**, or decline with a reason.
     4. The client lead approves or declines the quote.
     5. Approved requests become in progress, then done.
   - An approved paid request creates an invoice.
6. **Notes and comments**
   - Comments on tasks, requests, meetings and the assessment, with a team-only option.
   - Internal project notes that only partners see.
7. **Project assets (Google Drive)**
   - Partners paste the project's Google Drive folder link.
   - Members get **Open project folder** and, when the folder is shared with their Google account, the folder's file list inside the page (Google's embedded folder view).
   - Access stays controlled in Google Drive by who the folder is shared with. See question 2 for the deeper option.
8. **Meetings**
   - Partners schedule a meeting: type (kick-off, weekly session, review, check-in), date and time in Cairo, length, Meet link, agenda and attendees.
   - Each project can also have its own Calendly link, so the client books slots themselves; bookings land in the project.
   - After a meeting, partners add minutes and action items, which become tasks.
   - Members see upcoming meetings and get bell notifications and email reminders.
   - Creating Meet links automatically through the Google Calendar API stays for later.
9. **Payments and invoices**
   - Invoices extend the existing payment requests (`VWP-` reference, bank transfer, admin marks paid) with a project, an invoice number (`VWI-2026-001`), period, currency (EGP or USD) and line items.
   - Retainer invoices are created from the project terms at the end of each month (or the start, if set), plus invoices for approved extra requests.
   - Each invoice has a printable or downloadable page. The client lead sees the list with paid and outstanding totals.
   - Paymob payment links replace the transfer step later.
10. **Project analysis**
    - Progress over time and milestones on track.
    - Scorecard compared with the starting point (radar chart).
    - Client KPIs entered monthly (for example revenue, burn, runway, customers) as charts.
    - Meetings held and hours against the planned 4–5 a week.
    - Request turnaround and extra revenue.
    - Invoices paid and outstanding.
    - Portfolio projects roll up across their ventures.

## Data

New tables:
- `projects` (with `parent_id` for ventures under a portfolio)
- `project_members`
- `project_assessments`, `assessment_items`, `assessment_scores`
- `project_scope_items`
- `project_workstreams`, `project_milestones`, `project_tasks`
- `project_updates`
- `project_requests`
- `project_comments`, `project_notes`
- `project_meetings`
- `project_kpis`, `project_kpi_values`

Existing tables:
- `payment_requests` gets: `project_id`, `invoice_no`, `currency`, `period_start`, `period_end`, `lines`.

Storage: a private bucket `project-files` (proposal and assessment files, 20 MB each).

## Security

- Row level security on every table:
  - Client people see only the projects they belong to (portfolio people also see its ventures). They never see internal tasks, notes or comments.
  - Staff need the Projects area. Invoices also need Payments.
- Only the client lead accepts the proposal and approves quotes. Only staff respond to requests or change prices.
- Money logic is checked in the database and covered by tests:
  - Invoice totals and currency.
  - One retainer invoice per period.
  - No invoice for declined requests.
- Bell notifications for: new requests and responses, quotes waiting for approval, meetings booked, invoices issued, and the sheet sent.

## Build order (each part shipped and checked before the next)

- **17a:** projects, people and access, overview, proposal and scope (download and accept), requests with quotes, comments and notes, Google Drive folder, meetings.
- **17b:** assessment (requirements sheet, scorecard, re-assessment), plan and progress (workstreams, milestones, tasks, weekly updates).
- **17c:** invoices (retainers, extra requests, invoice pages), KPIs, project analysis.
- The Cooking School is set up as the first real project (portfolio plus its ventures) once 17a is live, with your confirmation of the details.

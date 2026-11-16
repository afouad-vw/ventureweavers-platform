# Phase 15 plan: Business CRM, private items, BRICKR service providers

Status: waiting for approval (2026-11-17).

## 1. Business CRM (Admin › Businesses)

A new admin section next to Contacts for the companies we work with and the B2B deals with them.

**Businesses**
- Fields: name, type (Venture, Angel Investor, Institutional investor, Corporate, Institutional Enabler, Venture Studio, Expert, Mentor, Other), stage (ventures only), website, LinkedIn page, country, tags, notes, owner (a partner or team member), status (Active or Archived).
- List with search, filters (type, tag, owner, open deals), CSV export, and create, edit, duplicate, delete in the shared editor drawer.

**Connected to people**
- Each business lists its people: members and added contacts, each with their role there (for example, Co-founder).
- When members list a business in their profile, the CRM suggests the match (same website, or same name) and a partner links it with one click. A "New from member businesses" list shows member businesses not yet in the CRM.
- A contact's page shows the businesses they're linked to.

**Business page: Overview, Deals, Activity**
- Overview: details, people, open deals and their total value.
- Deals (B2B): title, type (Revenue-based, Acquisition, Co-creation, Branding/sponsorship), stage (Lead, Qualified, Proposal, Negotiation, Won, Lost), value and currency (EGP or USD), expected close date, owner, linked service or program (optional), notes. A Deals board across all businesses, by stage.
- Activity timeline: notes, calls, meetings, emails and tasks (with due dates) logged by the team, plus deal stage changes, and what the linked people did on the platform (bookings, applications, requests).
- Admin Overview gets "Open deals" and "Tasks due" counts.

**Access**: a new access area, "Businesses & deals" (view or manage), for team members. Every change goes to the audit log.

## 2. Private items

- Every program, masterclass, show/event, BRICKR service, blog post and Library resource gets **Visibility: Public or Private**.
- A private item is seen only by the people added to it, picked from Contacts. Everyone else can't see it anywhere: not in lists, search, Home or by link (they get "not found").
- People who are added contacts but not yet members are matched by email when they join.
- Adding someone sends them a bell notification and an email ("You're invited to …"), which can be switched off per item.
- Enforced in the database (row level security), with tests for each item type, not just hidden in the app.

## 3. BRICKR service providers

- Each service gets a Providers list: name, title, photo (upload), short brief (up to 400 characters), LinkedIn.
- Shown on the service card (photos and names) and on the service's details page.
- The current services get Ahmed Fouad and Karim Hemdan, using the photos already on the site.

## Order

1. Service providers (small, ships first).
2. Private items.
3. Business CRM.

Each part ships when its tests pass.

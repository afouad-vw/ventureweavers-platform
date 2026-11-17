-- Phase 16 (approved 2026-11-17), step 1 of 2: the "Coming soon" status for events and services.
-- A new enum value can't be used in the same transaction that adds it, so it gets its own migration.
-- Plan: docs/phase-16-plan.md.

alter type public.pub_status add value if not exists 'coming_soon';

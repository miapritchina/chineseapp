# ADR-0005 — Migrations are additive-only; front-end queries widest-shape-first

**Status:** Accepted · **Date:** 2025-Q3

## Context

Supabase migrations run via a Setup Supabase workflow that loops over
every `migrations/*.sql` in order. Any migration might run twice. A
new deployment ships before the migration has been applied — there's a
window where the front-end runs against the *previous* schema.

## Decision

Every Supabase migration is **idempotent** and **additive-only**:

- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`
- `DROP FUNCTION IF EXISTS` before `CREATE FUNCTION` (Postgres won't
  let you change a `RETURNS TABLE` shape via `CREATE OR REPLACE`)
- **Never** drop or rename columns. Never write a destructive migration.

The front-end **always queries the widest shape first** and falls back
on `column not found` / `relation does not exist` errors to a narrower
shape. The app degrades silently rather than 500ing when a migration
lags the deployment.

## Consequences

- Schema can only grow. Cruft accumulates over time — accepted cost.
- PRs that include a migration get a "re-run Setup Supabase" note.
  Don't auto-merge them.
- The error-suppression pattern in hooks is intentional, not a bug to
  fix.

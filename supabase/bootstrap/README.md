# Supabase bootstrap

This directory contains the SQL bootstrap for the new Supabase project `nvdvcjsiizqzmakbirfs`.

## Files

- `new-project-bootstrap.sql`: consolidated schema + seed data for a blank project

## Generate again

```powershell
npm run supabase:bootstrap
```

## Apply to the remote database

You need one real administrative credential:

- a `SUPABASE_ACCESS_TOKEN`, or
- the database password for the `postgres` user

Example using direct Postgres access:

```powershell
psql "postgresql://postgres:<DB_PASSWORD>@db.nvdvcjsiizqzmakbirfs.supabase.co:5432/postgres?sslmode=require" -f supabase/bootstrap/new-project-bootstrap.sql
```

## Scope

- Covers tables, SQL functions, triggers, policies, and seed data versioned in `supabase/migrations`
- Does not deploy any Supabase Edge Function, because this repository does not contain a `supabase/functions` directory

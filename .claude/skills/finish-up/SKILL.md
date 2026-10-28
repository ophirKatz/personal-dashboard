---
name: finish-up
description: Ship the backend half of a reviewed change — apply its Supabase migrations and deploy its edge functions to production. Use when the user writes "accept" (or /finish-up) after reviewing a PR's test results. Never merges the PR.
allowed-tools: Bash, Read, Grep, Glob, mcp__Supabase__list_migrations, mcp__Supabase__apply_migration, mcp__Supabase__execute_sql, mcp__Supabase__get_advisors, mcp__Supabase__list_edge_functions, mcp__Supabase__get_edge_function, mcp__Supabase__deploy_edge_function, mcp__Supabase__query_logs
---

# Finish up

The workflow this closes out: Claude builds a change on a branch, opens a PR **without merging
it**, shows the user the Playwright results, and waits. The user writing **"accept"** is the
go-ahead to touch production — apply the migrations and deploy the edge functions the branch
adds. Nothing hits production before that word.

Supabase project: `tjjvrqamitwtoslinrxy` (see root `CLAUDE.md`).

**Scope: migrations and edge functions only.** Do not merge the PR, push new code, or edit the
PR. Merging stays with the user; say the PR is still open when you report.

## 0. Check the starting point

- `git status` is clean and the branch is pushed. If not, stop and say so — what is applied to
  production must match what is in the PR the user reviewed.
- `git fetch origin main`, then diff against `origin/main...HEAD` (three dots, the merge base),
  so unrelated commits on main don't show up as this change's.

## 1. Find what is pending

```bash
git diff --name-only origin/main...HEAD -- supabase/migrations supabase/functions
```

If the list is empty, say there is nothing to apply or deploy and stop.

**Migrations.** Call `list_migrations`. Production names a migration by its snake_case title with
a timestamp it assigns when applying, so `20261028_add_workout_tracking.sql` appears as
`add_workout_tracking`. Match on that name. Any file whose name is already listed is applied —
skip it. If a name is missing but the objects clearly exist (`select to_regclass('public.<table>')`),
ask before doing anything.

**Edge functions.** A changed `supabase/functions/<name>/...` file means function `<name>` needs
deploying. A changed `supabase/functions/_shared/<file>` means **every function that imports it**:

```bash
grep -rl "_shared/<file>" supabase/functions --include=*.ts
```

Show the user the list of migrations and functions before you start; it is cheap and catches a
surprise early.

## 2. Apply migrations (oldest first)

For each pending file, in filename order, `apply_migration` with:

- `name`: the file name minus the date prefix and `.sql`
- `query`: the file's **exact** contents. Read it; never rewrite it. The committed `.sql` and
  what runs in production must stay identical so replaying the files reproduces production.

Known trap — read the "Applying Supabase migrations from a session" section of `CLAUDE.md`
first. The MCP holds any statement containing `DROP` or `DELETE` for a confirmation nobody can
answer, and the call times out after 60s with nothing applied. If a pending migration contains
either:

- Don't strip them from the file, and don't retry.
- Stop, tell the user which statements and which file, and hand them the SQL to run themselves
  (Supabase SQL editor). Resume from the next step once they confirm.

After a timeout or any error, assume **nothing** was applied. Confirm with a read-only query
(`list_migrations`, `to_regclass`, `information_schema`) before deciding what to do. Stop at the
first failure; do not deploy functions on top of a migration that didn't land.

## 3. Verify the database

Read-only checks, no test rows (`DELETE` would hang, see above):

- `list_migrations` now includes each new name.
- New tables exist and have RLS on:
  `select relname, relrowsecurity from pg_class where relname in ('<new tables>')`.
- `get_advisors` with `type: security`. Report anything touching the new objects. New `public`
  functions are granted EXECUTE to `anon` and `authenticated` directly, so `revoke ... from public`
  does not make them private — trigger/internal functions need
  `revoke execute on function ... from anon, authenticated`.

## 4. Deploy edge functions

Only after migrations succeeded (a function may read the new tables).

For each function:

1. `list_edge_functions` — note its current `verify_jwt`. **Keep it as it is.** Functions called
   by cron with the cron secret (`send-notifications` and similar) are `verify_jwt: false`; do
   not flip that to `true` by accepting the tool's default.
2. `get_edge_function` — see how the live version lays out its files, and mirror it.
3. `deploy_edge_function` with `entrypoint_path: index.ts`, the function's own files, and every
   `_shared` file it imports, keeping the **relative paths its imports use** (e.g. `index.ts` plus
   `../_shared/time.ts`). The deploy only takes what you pass, so a missing `_shared` file fails at
   runtime, not at deploy.

## 5. Verify the deploy

- `list_edge_functions`: the new version is ACTIVE and `verify_jwt` is unchanged.
- `get_edge_function`: the deployed source matches the file on the branch.
- For cron-driven functions, wait a minute or two, then `query_logs` for the function and look
  for errors. The first real run is the only run that exercises the new code, so say that
  honestly in the report.

## 6. Report

One short list:

- Migrations applied (or skipped as already present), with the verification result.
- Functions deployed, with versions.
- Anything not done and why (a held `DROP`, an advisor finding, a log error).
- The PR is **still open** — merging is the user's call.

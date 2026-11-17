---
name: finish-up
description: Ship a reviewed change — apply its Supabase migrations, deploy its edge functions, then open the PR (if there isn't one), check CI passes and merge it. Use when the user writes "accept" (or /finish-up) after reviewing a change's test results.
allowed-tools: Bash, Read, Grep, Glob, mcp__Supabase__list_migrations, mcp__Supabase__apply_migration, mcp__Supabase__execute_sql, mcp__Supabase__get_advisors, mcp__Supabase__list_edge_functions, mcp__Supabase__get_edge_function, mcp__Supabase__deploy_edge_function, mcp__Supabase__query_logs, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__pull_request_read, mcp__github__get_check_run, mcp__github__merge_pull_request, mcp__claude-code-remote__subscribe_pr_activity, mcp__claude-code-remote__unsubscribe_pr_activity
---

# Finish up

The workflow this closes out: Claude builds a change on a branch, shows the user the Playwright
results, and waits. The user writing **"accept"** is the go-ahead to ship it — apply the
migrations, deploy the edge functions, then open the PR (if there isn't one yet), check CI and
merge it. Nothing hits production or `main` before that word.

Supabase project: `tjjvrqamitwtoslinrxy` (see root `CLAUDE.md`). GitHub repo:
`ophirKatz/personal-dashboard`, PRs target `main`.

**Scope: migrations, edge functions, and the PR for the branch you are on (create → CI → merge).**
Do not push new code or edit an existing PR's title or description. Never merge on a failing or
still-pending check and never get around one: no admin merge, no skipping or disabling tests, no
empty commits to re-run CI.

## 0. Check the starting point

- `git status` is clean and the branch is pushed. If not, stop and say so — what is applied to
  production must match what is in the PR the user reviewed.
- `git fetch origin main`, then diff against `origin/main...HEAD` (three dots, the merge base),
  so unrelated commits on main don't show up as this change's.
- Run `npm test` (`npm install` first if `node_modules` is missing). No GitHub workflow runs the
  tests — CI is only Vercel's build — so this is the one place they gate a merge. If it fails,
  stop before touching production.
- Find the PR: `list_pull_requests` with `state: open` and `head: ophirKatz:<branch>`. If there is
  one, use it. If not, create it now with `create_pull_request` (base `main`) — the user's
  "accept" is the explicit request for it, and creating it first lets Vercel build while the
  backend steps run. The repo has no PR template; follow what its merged PRs do: **Summary**,
  **What changed**, **Verification**, **After merging** (anything the user must do in the app
  once it is live, if there is something), **Notes**. End the body with the attribution lines
  from the session's attribution reminder.
- If a check on the PR has already failed (see step 6), stop here: don't change production for a
  branch that doesn't build.

## 1. Find what is pending

```bash
git diff --name-only origin/main...HEAD -- supabase/migrations supabase/functions
```

If the list is empty, there is nothing to apply or deploy: skip to step 6.

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
first failure; do not deploy functions on top of a migration that didn't land, and do not merge.

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

## 6. Check CI, then merge

Merging comes last on purpose: the backend must be live before the frontend that uses it.

1. **CI.** This repo has no GitHub Actions workflows. CI is Vercel: its deployment status (which
   runs `npm run build`, i.e. `tsc -b` and the Vite build) and its check runs. Read them with
   `pull_request_read` — `get_status` and `get_check_runs` — on the PR.
   - **Pass:** the combined status is `success` and every check run is `success`, `skipped` or
     `neutral`. `Supabase Preview` is normally `skipped`; that is fine.
   - **Still running** (`pending`, `queued`, `in_progress`): call `subscribe_pr_activity` for the
     PR and end your turn. The result arrives as an event; pick up here when it does. Don't poll
     or sleep.
   - **Failed:** do not merge. Use `get_check_run` for the reason, report it, and stop. Say that
     production already has steps 2–5; they are additive and meant to go ahead of the frontend.
2. **Mergeable.** `pull_request_read` `get`: if it has conflicts or can't merge cleanly, stop and
   report. Don't rebase or force-push.
3. **Merge.** `merge_pull_request` with `merge_method: "merge"` (the repo's history is merge
   commits, "Merge pull request #N from …") and `expectedHeadSha` set to the commit whose checks
   you just read, so what merges is what was checked. If it is refused (branch protection, a
   required review), report the reason as given and stop.
4. If you subscribed to the PR, `unsubscribe_pr_activity` now.

Merging to `main` starts Vercel's production deploy of the frontend. Don't wait for it, and say
in the report that it was not verified.

## 7. Report

One short list:

- Migrations applied (or skipped as already present), with the verification result.
- Functions deployed, with versions.
- The PR: number and link, which checks passed, and the merge — or why it was not merged.
- What the user still has to do once it is live (the PR's **After merging**), if anything.
- Anything not done and why (a held `DROP`, an advisor finding, a log error, a failed check).

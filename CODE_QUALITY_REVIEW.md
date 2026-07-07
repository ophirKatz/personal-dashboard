# Code Quality Review

Scope: documentation, reliability, performance, debugability (not features or security).
Codebase: ~13.7k lines across 99 `src/` files, 9 Vercel serverless functions (`api/`), 16 Supabase
Edge Functions (`supabase/functions/`). Single-user personal app, so severity is judged against
"will this cause a confusing silent failure / make a future change dangerous," not "will this
break under load."

Each item lists the evidence, the concrete failure it enables, and a specific fix.

---

## 1. Documentation

### 1.1 Database schema exists only in Supabase itself, not in the repo
There is no `supabase/migrations/` directory and no generated types file. The only representations
of the schema are: (a) hand-written TypeScript types in `src/supabase.ts` (307 lines, one `type`
per table, manually kept in sync), and (b) a prose table in `SETUP.md:736-763` describing each
table's columns in English. Every schema change made through Supabase MCP tooling has to be
manually transcribed into both places, and nothing catches drift — a column renamed or dropped in
the database silently stops matching `src/supabase.ts`, and TypeScript has no way to notice because
the "types" are just asserted, not derived.

**Fix:**
- Run `supabase db pull` (or `supabase gen types typescript --project-id tjjvrqamitwtoslinrxy`) and
  commit the generated `database.types.ts`. Use `Database['public']['Tables']['habits']['Row']`-style
  types (or a thin re-export) in place of the hand-written types in `src/supabase.ts`.
- Start committing schema changes as SQL migrations under `supabase/migrations/` going forward
  (`supabase db diff -f <name>` after applying a change via MCP/dashboard), so the schema has a
  reviewable history instead of living only as live state in the Supabase project plus prose in
  `SETUP.md`.
- Add a CI/pre-commit check (even a simple script) that fails if `database.types.ts` is older than
  the newest migration file, so drift is caught instead of discovered at runtime.

### 1.2 No architecture overview
`README.md` is one line (`# personal-dashboard`). `SETUP.md` is 975 lines of manual setup
instructions interleaved with the only reference documentation that exists (schema table, RLS
policy, storage buckets, feature-to-route map) — useful, but structured for "set this up once,"
not for "understand the system." There's no diagram or summary of the actual request flow (browser
→ Vercel function → Supabase Edge Function → Postgres/pg_cron), and no single place listing all 16
Edge Functions, what triggers each one (HTTP call from client vs. `pg_cron` vs. a Postgres trigger),
and on what schedule.

**Fix:** Add an `ARCHITECTURE.md` (or a top section in `README.md`) with: a one-paragraph system
diagram, a table of the 16 Edge Functions with their trigger type (client call / cron / DB trigger)
and cron schedule, and a pointer into `SETUP.md` for the setup mechanics. This is the natural place
to also record the `Asia/Jerusalem` timezone assumption called out in §2.3, since it's currently
only discoverable by reading Edge Function source.

### 1.3 No documented contract for the `api/*` and `supabase/functions/*` HTTP endpoints
Request/response shapes for the 9 Vercel functions and 16 Edge Functions exist only as inferred
TypeScript inline types at each call site — there's no single reference for e.g. what
`POST /functions/v1/voice-todo` accepts/returns, so understanding an endpoint means reading both
the handler and every caller.

**Fix:** A lightweight JSDoc block above each `handler`/`serve` entry point (method, body shape,
status codes and their meaning) would cover this cheaply without introducing an OpenAPI toolchain
that's overkill for a single-user app.

---

## 2. Reliability

### 2.1 Supabase query errors are discarded almost everywhere
Of 122 `supabase.from(...)` call sites in `src/`, 45 destructure only `{ data }` (never `error`),
and most others don't check `error` either — e.g. `src/pages/Dashboard.tsx:74-89` runs six queries
in `Promise.all` and feeds every result straight into `useState` via `res.data ?? []`, with no
branch for `res.error`. If a query fails — expired session, a dropped connection, an RLS policy
rejecting the request — the page just renders as if the user has no habits, no todos, no events
today, indistinguishable from the empty state. There is no toast, no console line, nothing.

**Fix:** Add a small wrapper, e.g.
```ts
async function must<T>(q: PromiseLike<{ data: T | null; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await q
  if (error) { console.error(error); throw error }
  return data as T
}
```
and use it at the ~10 highest-traffic load sites (Dashboard, Todos, Habits, Friends, Files) first.
Pair with §4.1 (error boundary) so a thrown error becomes a visible "couldn't load" state instead
of a silent empty one.

### 2.2 No React error boundary anywhere in the app
`src/App.tsx` wraps all lazy-loaded routes in `<Suspense>` for loading state, but there is no
`ErrorBoundary`/`componentDidCatch` anywhere in `src/` (confirmed by search). Any unhandled render
error in any page — a `null` dereference in `RecipeDetail`, a bad date parse in `Calendar` — blanks
the entire app to a white screen with no recovery path short of a manual reload, and no record of
what happened beyond the browser console (which the user, on their phone, will never see).

**Fix:** Add one `ErrorBoundary` component wrapping `<Routes>` in `App.tsx` with a minimal fallback
UI ("Something went wrong — reload") and a `console.error` (or a write to `notifications`/a
dedicated `client_errors` table) in `componentDidCatch`, so at least one crash report survives past
the tab closing.

### 2.3 Client "today" and server "today" can disagree
`src/utils.ts:21-23` — `today()` formats `new Date()` in the **browser's local timezone**. Every
server-side date-boundary calculation (habit debt accrual, "due today," focus summaries, rain
notifications, friend-interaction logging) instead hardcodes `Asia/Jerusalem`
(`supabase/functions/accrue-habit-debt`, `fetch-weather`, `generate-focus-summary`,
`fetch-google-calendar`, `log-event-friend-interactions`, `send-rain-notification` — 15 occurrences
across 6 files). If the browser's timezone differs from `Asia/Jerusalem` (travel, a phone set to
UTC, a laptop with the wrong system timezone), the client and server compute different calendar
dates for "today" near midnight — a habit can show as "done today" in the UI while the server's
debt-accrual cron still counts yesterday as missed, or vice versa.

**Fix:** Introduce a single `APP_TIMEZONE = 'Asia/Jerusalem'` constant (document *why* it's fixed —
this is a single-user app for one person in one place — in `ARCHITECTURE.md` per §1.2), and make
`today()`/`tomorrow()` in `src/utils.ts` compute in that timezone explicitly (e.g. via
`date-fns-tz`'s `formatInTimeZone`) instead of the browser's local zone, matching the server-side
functions exactly.

### 2.4 The same location constant is hand-duplicated in two Edge Functions
`supabase/functions/fetch-weather/index.ts:5` and `supabase/functions/send-rain-notification/index.ts:5`
both independently define `const LOCATION = { latitude: 32.0853, longitude: 34.7818 }`. Nothing
ties them together; updating one and forgetting the other would make the Dashboard's weather widget
and the rain-notification cron silently disagree about where "here" is.

**Fix:** Deno Edge Functions can import from a shared module — add
`supabase/functions/_shared/constants.ts` exporting `LOCATION`/`APP_TIMEZONE` and import it from
both functions (and any future weather-dependent function).

### 2.5 Client-triggered notification checks can double-fire and can silently never fire
`checkStockAlerts`/`checkFriendReminders` (`src/features/notifications/notifications.ts`) run from
a `useEffect` on every app mount (`src/App.tsx:58-64`) — i.e., once per browser tab/device the user
opens, not on a schedule. Two consequences:
- **Race:** opening the app in two tabs (or two devices) near-simultaneously can have both reads see
  `alert.triggered_at === null` / `friend.reminder_notified_at === null` before either write lands,
  producing two `notifications` rows for the same event (`notifications.ts:10-27`, `:44-57`).
- **Missed notifications:** unlike every other notification path in this app (habits, todos, rain —
  all driven by `pg_cron` per `SETUP.md` step 1g/1m), a stock crossing its alert threshold while the
  user simply never opens the app never notifies, since nothing server-side checks it.

**Fix:** Move both checks into a cron-driven Edge Function following the exact pattern already
established by `send-notifications`/`send-rain-notification`, and delete the client-side
`useEffect` call. This also removes the duplicate-write race since a single cron invocation replaces
N concurrent client copies.

### 2.6 Unhandled promise rejection on sign-in
`src/App.tsx:52` — `upsertPrimaryGoogleAccount({...}).then()` has no `.catch`. If this insert fails
(RLS denial, network error), it becomes a silent unhandled promise rejection; the user sees a
successful login with no indication their Google account linkage didn't save, and later
Calendar/Tasks/Drive features will fail with "Connect Google Account" prompts that look unrelated
to the original failure.

**Fix:** `.catch(err => console.error('Failed to save Google account link', err))` at minimum.

### 2.7 One silent per-item failure path in Drive sync
`api/google-drive-sync.ts:210-214` — a per-file `catch {}` around download/upload only has a code
comment ("Skip files that fail... they'll be retried"), no logging. A folder that consistently fails
on the same files (e.g. a permissions issue on one Drive file) will "sync successfully" forever
while quietly never syncing that file, with nothing in Vercel's function logs to show it happened.

**Fix:** `console.error('drive-sync: failed on file', item.id, item.name, err)` before the `continue`
— cheap, and turns an invisible steady-state failure into something visible in Vercel logs (see
§4.2, which found `api/` has essentially no logging at all).

### 2.8 Near-zero automated test coverage
`vitest` is configured (`package.json`) but there is exactly one test file in the whole repository,
`src/features/habits/habitTaps.test.ts`. Meanwhile `src/utils.ts` alone contains nontrivial,
easy-to-silently-regress pure logic — habit period/debt math (`habitPeriodLengthDays`,
`isHabitDoneThisPeriod`, `habitDebtOwedToday`), recurrence advancement (`advanceRecurrence`), friend
overdue calculation (`friendTargetIntervalDays`, `isFriendOverdue`) — none of it tested, despite
being pure functions that need no mocking to test.

**Fix:** Prioritize unit tests for `src/utils.ts`'s date/recurrence/debt functions first — they're
the cheapest to test (pure, no I/O) and the most likely to silently regress since a wrong day-count
or off-by-one in the period math has no visible symptom until debt/streak numbers look wrong weeks
later.

### 2.9 No CI
There is no `.github/workflows/`. `npm run build` (`tsc -b && vite build`) and the one `vitest` test
only ever run locally/manually — nothing blocks a broken build or type error from landing on `main`,
which auto-deploys to production on every push (`SETUP.md:717-725`).

**Fix:** Add a GitHub Actions workflow running `npm run build` and `npm test` on pushes/PRs. Cheap
and directly prevents the failure mode `SETUP.md`'s own troubleshooting section anticipates
("Build fails (`tsc` errors)" is already a documented recovery step — CI would catch it before
deploy instead of after).

---

## 3. Performance

*(Proportionate note: this is a single-user app, so none of these are urgent — they're flagged as
hygiene that will matter if data volume grows, e.g. years of habit logs / calendar events / files.)*

### 3.1 Mutations trigger full-table refetches instead of local state updates
`src/pages/Dashboard.tsx:100-109` — `toggleHabit` re-fetches **all** habits and **all** recent habit
logs after toggling a single habit, instead of updating the one changed record in local state. Same
`select('*').order('created_at')` round-trip that `loadLocalData` already just did, repeated on every
tap. Harmless at current scale, but it's a pattern that compounds as habit/log history grows (the
logs query already does a 7-day lookback, so it grows with habit count × 7, not with total history —
but the todos/events lists in `loadLocalData` are unbounded reloads on every mutation elsewhere in
the app too).

**Fix:** Update the toggled habit/log in local React state directly from the mutation's response
instead of re-querying; reserve full refetches for initial mount.

### 3.2 `select('*')` used far more than targeted column selection
46 of 57 `.select(...)` calls in `src/` use `select('*')` vs. 11 using specific columns (e.g.
`src/pages/Files.tsx:52` pulls every column of `files` just to render a list). Not a problem today,
but combined with §1.1 (no migrations), there's no guard against a future large column (e.g. an
extracted-text or JSON blob) silently bloating every list-page load that happens to `select('*')`
on that table.

**Fix:** No urgent action; when adding any large/rarely-needed column to a table, audit existing
`select('*')` call sites against that table and narrow them.

### 3.3 No verified indexes behind the app's most common filters
Because there are no migration files (§1.1), there's no way to review from the repo whether
`due_date`, `event_date`, `logged_date`, and the RLS-driving `user_id` columns are indexed — all of
which are range/equality-filtered on nearly every page load (`Dashboard.tsx:77-78`:
`due_date.eq/is.null`, `event_date` range). This is really a consequence of §1.1: schema and index
decisions currently live only in Supabase's live state, invisible to code review.

**Fix:** Once migrations exist (§1.1), explicitly add and document indexes on `(user_id, due_date)`,
`(user_id, event_date)`, `(user_id, logged_date)` etc. so they're reviewable and reproducible instead
of implicit.

---

## 4. Debugability

### 4.1 13 of 16 Edge Functions have zero logging
```
accrue-habit-debt              0     fetch-google-tasks             0
extract-shopping-items         0     fetch-weather                  0
fetch-google-calendar          0     generate-focus-summary         0
import-recipe                  0     log-event-friend-interactions  0
send-notifications             0     send-rain-notification         0
voice-climbing                 0     voice-shopping                 0
voice-todo                     0
create-task-friend-interactions   2
google-connect-callback           8
summarize-friend-interactions    11
```
These are exactly the functions `SETUP.md`'s troubleshooting section repeatedly tells the user to
debug by "checking the Edge Function's logs" (e.g. `SETUP.md:908-914` for
`generate-focus-summary`, `:948-957` for `send-notifications`, `:964-970` for
`send-rain-notification`) — but most of them log nothing beyond Supabase's default request-level
line, so "check the logs" currently means checking an HTTP status code with no context about *why*
a call inside the function (Claude API call, Google token refresh, DB write) failed. These are also
all cron-triggered with no human watching in real time, which makes silent failure the worst case:
a bad run just doesn't happen, and nothing surfaces that fact anywhere.

**Fix:** Add `console.error` (Edge Function logs capture this automatically) at minimum around every
external call (Anthropic, Google, `fetch`) and every non-2xx branch, including enough context to
diagnose without re-running (user id, what was being attempted). `summarize-friend-interactions` and
`google-connect-callback` already do this reasonably well — use them as the template for the rest.

### 4.2 `api/` (Vercel functions) has no logging at all
Zero `console.*` calls across all 9 files in `api/` (confirmed by search — contrast with `src/`,
which has some, and `supabase/functions/`, which has 21 total). Combined with the silent catch in
§2.7, a failing Drive sync, stock quote, or Google token refresh produces nothing in Vercel's
function logs beyond the HTTP status returned to the client — which the user, especially on a phone
PWA, will never see directly.

**Fix:** Add `console.error` at the same failure points identified in §2.7 and at every `catch`
block across `api/*.ts` (e.g. `api/_googleAuth.ts:73-75`'s refresh-token fetch failure, currently a
bare `catch { return { ok: false, ... } }` with no trace of what the upstream error actually was).

### 4.3 No linter configured
There is no ESLint (or any linter) config anywhere in the repo, despite this being a TypeScript +
React codebase where a linter would catch real bugs cheaply — unused variables are explicitly
disabled in `tsconfig.app.json` (`noUnusedLocals: false`, `noUnusedParameters: false`, with a comment
in `SETUP.md:837` explaining this is intentional to avoid build failures), which also means dead
code and unused imports can accumulate invisibly since nothing flags them either.

**Fix:** Add `eslint` with `@typescript-eslint` and `eslint-plugin-react-hooks` (the latter in
particular would catch stale-closure bugs in the many `useEffect`s across `src/pages/`). Keep
`noUnusedLocals`/`noUnusedParameters` off in `tsconfig` if the build-failure friction is the
concern, but let the linter warn (not error) on both instead of nothing catching them at all.

---

## Summary — suggested priority order

1. **§1.1 DB schema in code** — generate and commit `database.types.ts`; start committing migrations.
   Everything else in this review (indexes, reliability of types, onboarding) gets easier once this
   exists.
2. **§2.1 + §2.2** — error-checked query helper + one top-level ErrorBoundary. Small diff, converts
   the app's most common failure mode (silent empty state / white screen) into a visible one.
3. **§4.1 + §4.2** — logging in Edge/Vercel functions. Also small, and directly unblocks debugging
   everything else without needing to reproduce failures locally.
4. **§2.3 + §2.4** — centralize timezone/location constants; low effort, removes a real correctness
   footgun.
5. Remaining items (§2.5–2.9, §3.x, §4.3) as ongoing hygiene — none are urgent at current scale.

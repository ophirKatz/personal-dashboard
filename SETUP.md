# Personal Dashboard — Setup & Manual Steps

This document covers every manual configuration step required to get the dashboard fully running. Code and infrastructure (Supabase schema, storage) were handled via MCPs; the steps below require browser-based configuration that MCPs cannot perform.

---

## What was done automatically (via MCPs)

- **Supabase project** created: `personal-dashboard` (ID: `tjjvrqamitwtoslinrxy`, region: eu-central-1)
- **Database schema** applied: all 10 tables with RLS policies
- **Storage bucket** created: `user-files` (private, 50MB limit per file, with RLS)
- **Code** written, committed, and pushed to branch `claude/life-dashboard-plan-fsz8sq`

## What still requires manual action

- **Vercel project creation** — there is no MCP tool to create a new Vercel project from a GitHub import; this must be done once via the Vercel dashboard (step 0 below)
- **Google OAuth credentials** — must be created in Google Cloud Console (step 1 below)
- **Environment variables** — must be set in the Vercel dashboard after the project is created (step 2 below)

---

## 0. Vercel — Import the Project

1. Go to [Vercel Dashboard → New Project](https://vercel.com/new)
2. Select **Import Git Repository** and choose `ophirKatz/personal-dashboard`
3. Set **Production Branch** to `claude/life-dashboard-plan-fsz8sq` (or merge this branch into `main` first and use `main`)
4. Framework Preset: Vercel should auto-detect **Vite**. If not, set manually:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Before clicking Deploy, add the environment variables from step 2 below (or add them after and redeploy)
6. Click **Deploy**

Once this one-time import is done, every future `git push` to the connected branch triggers an automatic deployment — no manual redeploy needed.

---

## 1. Supabase — Google OAuth Setup

This **cannot** be done via MCP and requires manual steps in the Supabase and Google Cloud dashboards.

### 1a. Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or reuse an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth client ID**
5. Application type: **Web application**
6. Name: `personal-dashboard` (or anything)
7. **Authorized JavaScript origins** — add:
   - `http://localhost:5173`
   - `https://<your-vercel-app>.vercel.app` ← add after Vercel deploy
8. **Authorized redirect URIs** — add:
   - `https://tjjvrqamitwtoslinrxy.supabase.co/auth/v1/callback`
   - `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/google-connect-callback` ← needed for step 1k (connecting additional Google accounts)
9. Click **Create**
10. Copy the **Client ID** and **Client Secret**

### 1b. Enable Google provider in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/tjjvrqamitwtoslinrxy)
2. Navigate to **Authentication → Providers**
3. Find **Google** and toggle it on
4. Paste your **Client ID** and **Client Secret** from above
5. Click **Save**

### 1c. Set allowed redirect URLs in Supabase

1. Still in Supabase Dashboard, go to **Authentication → URL Configuration**
2. Set **Site URL** to your production Vercel URL:
   ```
   https://<your-vercel-app>.vercel.app
   ```
3. Under **Redirect URLs**, add:
   ```
   http://localhost:5173/**
   https://<your-vercel-app>.vercel.app/**
   ```
4. Click **Save**

---

## 1d. Google Calendar — Enable the integration

The Calendar page and Dashboard can show your real Google Calendar events. This reuses
the same Google OAuth client from step 1a, but needs two extra things:

1. **Enable the Calendar API** — in [Google Cloud Console](https://console.cloud.google.com/),
   go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
2. **Add the Calendar scope to the OAuth consent screen** — go to **APIs & Services → OAuth
   consent screen → Data Access → Add or Remove Scopes**, and add:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   ```
   This is a "sensitive" scope. If your OAuth consent screen is in **Testing** mode, make sure
   your own Google account is listed under **Test users** (Audience tab) — otherwise Google will
   block the login with an "access blocked" error. Testing mode is fine for personal use; full
   verification is only required if you want random users to be able to sign in.
3. **Copy the Client ID and Client Secret** from the same OAuth client created in step 1a — you'll
   add them to Vercel in step 2 below (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). These are
   needed server-side because Supabase only hands the app a Google access/refresh token once, at
   login — refreshing it later requires the client secret, which must never reach the browser.

> **Why a re-login is needed:** the app requests Calendar access (and offline/refresh access)
> as part of the Google sign-in flow. If you already signed in before this feature existed, log
> out and back in once (or use the "Connect Google Calendar" button that appears on the Calendar
> page) so Google issues a new token with the calendar scope.

---

## 1e. Google Tasks — Enable the integration

The Todos page can mirror your Google Tasks **"My Tasks"** list, and checking/unchecking a
task in the app toggles its completion in Google Tasks too. This reuses the same Google OAuth
client and the same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from step 1d — no new env vars
are needed. Two extra things are required:

1. **Enable the Tasks API** — in [Google Cloud Console](https://console.cloud.google.com/),
   go to **APIs & Services → Library**, search for **Google Tasks API**, and click **Enable**.
2. **Add the Tasks scope to the OAuth consent screen** — go to **APIs & Services → OAuth
   consent screen → Data Access → Add or Remove Scopes**, and add:
   ```
   https://www.googleapis.com/auth/tasks
   ```
   This is the full read/write scope (not `.readonly`), since checking off a task in the app
   needs to write the completion status back to Google. It's a "sensitive" scope — same Testing
   mode / Test users consideration as the Calendar scope in step 1d applies here too.

> **Re-login required:** if you already connected Google Calendar before this feature existed,
> you must reconnect once to grant the additional Tasks scope. Log out and back in, or use the
> "Connect Google Tasks" button that appears on the Todos page — either flow now requests both
> the Calendar and Tasks scopes together in a single consent screen.

**Scope note:** only the list view and the completion checkbox are synced. Creating, editing,
or deleting a task in the app stays local-only, and the same applies in reverse — new tasks
added in Google Tasks will appear in the app's list, but deleting them must still be done in
Google Tasks (or in the app, for tasks created in the app).

---

## 1f. Google Drive — Enable the integration

The Files page can recursively sync specific Google Drive folders — click "Sync a Google Drive
folder", browse/search your Drive, and pick a folder. The app then walks that folder and all of
its subfolders, downloads every file's actual content, and uploads it into the same Supabase
Storage bucket used for local uploads. Synced folders show up alongside your local folders
(badged "Google"); opening one lists real, locally-stored files — viewable/downloadable exactly
like local files, not links back to Drive. Re-syncing (automatic on add, or via the refresh
button) only re-downloads files that changed and removes local copies of anything deleted from
Drive. This reuses the same Google OAuth client and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
from step 1d — no new env vars are needed. Two extra things are required:

1. **Enable the Drive API** — in [Google Cloud Console](https://console.cloud.google.com/),
   go to **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
2. **Add the Drive readonly scope to the OAuth consent screen** — go to **APIs & Services → OAuth
   consent screen → Data Access → Add or Remove Scopes**, and add:
   ```
   https://www.googleapis.com/auth/drive.readonly
   ```
   This is a "sensitive" scope. Same Testing mode / Test users consideration as the Calendar
   scope in step 1d applies here too. `drive.readonly` is sufficient for downloading file content
   (`files.get?alt=media` / `files.export`), so no scope change or re-login is needed for this
   feature if Drive was already connected.

> **Re-login required (only if Drive was never connected before):** if you haven't connected
> Google Drive yet, click "Connect Google Drive" on the Files page (or log out and back in) to
> grant the Drive scope alongside Calendar/Tasks in a single consent screen.

**Scope note:** the app only ever syncs folders you explicitly add via the folder picker —
nothing is read or synced automatically. `drive.readonly` technically grants read access to your
whole Drive (Google does not offer a scope limited to "files inside folder X"), but the app's own
folder-selection list (stored in Supabase, RLS-protected) is what gates which folders its sync
endpoint will actually walk and download. Removing a folder from the list deletes its downloaded
copies from Storage immediately, even though the OAuth grant itself is broader.

**Google Docs/Sheets/Slides:** these have no raw binary content in Drive, so they're exported on
download — Docs → PDF, Sheets → `.xlsx`, Slides → `.pptx`, Drawings → `.png`. Other native Google
types with no file-like export (Forms, Sites, Maps, Apps Script, shortcuts) are skipped.

**Large folders:** each sync request only processes a bounded batch of files before returning, so
the client loops automatically until the whole tree is synced — large folders just take more
round trips, with no risk of hitting a serverless function timeout. The 50 MB per-file Storage
limit (see step 5 below) still applies; oversized files are skipped and retried on the next sync.

---

## 1g. Push Notifications — Enable the integration

Habits (with a reminder time set) and Todos (with a due date/time and reminder enabled) can send
a real push notification to your iPhone's lock screen / notification center — not just an in-app
banner. This works because the app is a PWA with a custom service worker (`src/sw.ts`) that
listens for `push` events.

**How it works end-to-end:**
- The browser/PWA subscribes to push via the Web Push API and stores the subscription
  (endpoint + keys) in the new `push_subscriptions` table (Settings page → "Enable notifications")
- A Postgres cron job (`pg_cron` + `pg_net`, both already enabled on the Supabase project) runs
  every minute and calls a **Supabase Edge Function** (`supabase/functions/send-notifications`)
  over HTTP — not a Vercel function. This avoids ever putting the Supabase service-role key into
  Vercel: Edge Functions get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` injected automatically
  by Supabase, scoped to that project only.
- That function checks for incomplete todos with a reminder enabled (`remind_at <= now()` and not
  yet notified), and habits with a matching `reminder_time` that haven't been logged today, then
  sends a push via the `web-push` library to every stored subscription for that user

**This was already set up for you (via MCPs), no action needed:**
- `pg_cron` and `pg_net` extensions enabled on the Supabase project
- A `cron_secret` stored in Supabase Vault, and a `send-due-notifications` cron job scheduled to
  call the deployed `send-notifications` Edge Function every minute
- The Edge Function itself, deployed at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/send-notifications`
- The `push_subscriptions` table (RLS-protected, one row per device) and new columns:
  `habits.reminder_enabled`, `habits.reminder_time`, `habits.last_notified_date`,
  `todos.reminder_enabled`, `todos.remind_at`, `todos.notified_at`

**What still requires manual action — there's no MCP tool that can write Vercel environment
variables or Supabase Edge Function secrets, so these must be added by hand:**

In **Vercel** (Settings → Environment Variables, step 2 below) — only needed by the browser and
the subscribe/unsubscribe endpoints, never by the notification sender itself:

| Name | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | `BCPyVmqKJ3SIxbQt9JYkCPV8FkTF6pFytctsl1DTVBSusLRMKgcLxjtttX-MA7HARDqNo7zUr37vGntNZEn5tLQ` — the browser needs this to call `pushManager.subscribe()` |

In **Supabase** (Dashboard → your project → **Edge Functions → Manage secrets**, or
`supabase secrets set` via the CLI) — these are read by the `send-notifications` function:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BCPyVmqKJ3SIxbQt9JYkCPV8FkTF6pFytctsl1DTVBSusLRMKgcLxjtttX-MA7HARDqNo7zUr37vGntNZEn5tLQ` |
| `VAPID_PRIVATE_KEY` | `-lSYIueFwVAgIs_RFzfBDvvIR5ctM33zABnf_tATcIs` |
| `VAPID_SUBJECT` | `mailto:ophirk8396@gmail.com` (or any contact address — required by the Web Push spec) |
| `CRON_SECRET` | `fa6e9b50a5ce3a434177549e919a2dc9e53f3600e1420b2ee13e2e72361249db` — must match exactly what's stored in Supabase Vault; only change this if you also update the Vault secret and the cron job |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` do **not** need to be set manually — Supabase
injects both into every Edge Function automatically, scoped to this project.

**Enabling notifications on iPhone:**
1. Open the deployed app in Safari and tap **Share → Add to Home Screen** (push notifications
   only work for installed PWAs on iOS — Safari tabs can't receive them, per Apple's WebKit
   restriction since iOS 16.4)
2. Open the app from the Home Screen icon (not from Safari)
3. Go to **Settings** in the app's nav and tap **Enable notifications**, then accept the
   permission prompt
4. Set a reminder time on a habit (Habits → edit a habit → toggle **Reminder**), or set a due
   date/time and toggle **Remind me** on a task (Tasks → edit a task), and wait — it should
   arrive as a real lock-screen notification

**If the Edge Function's project changes** (e.g. a different Supabase project), update the cron
job's target URL with:
```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'send-due-notifications'),
  command := $$
  select net.http_post(
    url := 'https://<new-project-ref>.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 1h. Focus Summaries — Enable the AI focus section

The Dashboard's "Focus" section (Tomorrow / This Week tabs) replaces the old "Upcoming Events" list
with a short AI-generated briefing of what's relevant for each period, built from your local todos
and calendar events (plus Google Calendar, if connected). It's powered by Anthropic's Claude API
and cached in a new `focus_summaries` table.

**How it works end-to-end:**
- A Supabase Edge Function (`supabase/functions/generate-focus-summary`) builds a small JSON context
  (todos due in the period, local `events` rows in range, and — if you've connected Google Calendar —
  matching Google Calendar events, fetched by the function itself using a direct OAuth refresh) and
  asks Claude Haiku to write a short prioritized briefing, then upserts it into `focus_summaries`
  (one row per user per period).
- **Daily 7am refresh:** a `pg_cron` job (`generate-daily-focus-summaries`) calls the function every
  day at 4am UTC (≈7am Asia/Jerusalem during daylight saving; ≈6am in winter, since `pg_cron` has no
  timezone-aware scheduling — adjust the cron schedule yourself if the seasonal drift bothers you).
- **Triggered refresh:** Postgres triggers on `todos` (insert/update of `due_date`) and `events`
  (insert/update of `event_date`) call the same function whenever an item lands tomorrow or within the
  next 7 days, so adding something relevant updates the cached summary without waiting for 7am.
- **Manual refresh:** the refresh icon in the Focus section calls the function directly
  (`supabase.functions.invoke`), authenticated with your own session — it only ever regenerates your
  own summary for the active tab.
- Both the cron job and the DB triggers authenticate to the function the same way
  `send-due-notifications` does — via the `cron_secret` already stored in Supabase Vault.
- The daily refresh and the triggered refresh are each gated by a pair of per-period toggles in
  Settings, one for the "Tomorrow" period and one for "This Week" —
  `auto_generate_focus_summaries_daily_today` / `_week` (checked by the edge function before the
  cron sweep) and `auto_generate_focus_summaries_on_change_today` / `_week` (checked by the
  `notify_focus_refresh` trigger function) — so you can e.g. disable auto-generation for the weekly
  summary while keeping it on for tomorrow's.

**This was already set up for you (via MCPs), no action needed:**
- The `focus_summaries` table (RLS: read-only for the owning user; all writes go through the edge
  function's service-role key)
- The `notify_focus_refresh` Postgres function and the `todos_focus_refresh` / `events_focus_refresh`
  triggers
- The `generate-daily-focus-summaries` cron job
- The `generate-focus-summary` Edge Function itself, deployed at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/generate-focus-summary`

**What still requires manual action** — there's no MCP tool that can write Supabase Edge Function
secrets, so these must be added by hand in **Supabase Dashboard → your project → Edge Functions →
Manage secrets** (or `supabase secrets set` via the CLI):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key from [console.anthropic.com](https://console.anthropic.com/) — required for the function to generate anything; without it, only the "nothing scheduled" fallback message is produced |
| `GOOGLE_CLIENT_ID` | The same OAuth Client ID used in step 1a/1d — needed so the function can refresh your Google token itself and read Calendar events server-side. **This is a separate copy from the Vercel env var of the same name** — Edge Functions and Vercel don't share secrets |
| `GOOGLE_CLIENT_SECRET` | The same OAuth Client Secret as above — same "separate copy" note applies |

If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set, the Focus section still works — it just
won't include Google Calendar events in the summary, only local app events.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` do **not** need to be set manually —
the first two are injected automatically by Supabase, and `CRON_SECRET` was already configured as
part of the push notifications setup (step 1g) and is reused here.

---

## 1i. Shopping List Photo Import

The Shopping page's "Import from photo" button lets you upload a photo of a shopping list (handwritten,
printed, or a recipe's ingredients) and have Claude extract the items, which are then inserted directly
into your `shopping_items`.

**How it works:** the button calls the `extract-shopping-items` Supabase Edge Function
(`supabase/functions/extract-shopping-items`) via `supabase.functions.invoke`, authenticated with your
own session. The function sends the image to Claude, parses the returned JSON list of item names, and
inserts them for your user only.

**No additional manual setup needed** — the function reuses the same `ANTHROPIC_API_KEY` Edge Function
secret configured in step 1h, and `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

---

## 1n. Recipe Import (AI)

The Recipes page's "+" button offers three AI-assisted ways to start a new recipe, alongside a manual
form: **Prompt to recipe** (describe a dish, Claude invents a full recipe), **Paste recipe text** (Claude
parses freeform pasted text), and **Paste a link** (the function fetches the page server-side, strips it
to plain text, and Claude extracts the recipe). All three share one Edge Function,
`supabase/functions/import-recipe`, taking `{ mode: 'prompt' | 'paste' | 'link', input: string }` and
using the `claude-haiku-4-5-20251001` model (same family as the Focus Summary and Friends summarization
features). Unlike Shopping's photo import, this function returns a parsed **draft only** — nothing is
written to the database. The client lands on the manual recipe editor pre-filled with the draft so you
can review and adjust before saving.

**No additional manual setup needed** — reuses the same `ANTHROPIC_API_KEY` Edge Function secret as the
other AI features.

---

## 1j. Voice Shortcuts (Siri) — Add to shopping list / log a climb / add a todo by voice

You can say "Hey Siri, add to shopping list", "Hey Siri, log a climb", or "Hey Siri, add a todo"
and dictate freeform text (e.g. "milk, eggs, and bananas", "three v three, one v five six", or "call
the dentist tomorrow at 3pm, high priority") — it gets parsed by Claude and written directly into
your `shopping_items` / `climbing_sessions`+`climbing_attempts` / `todos` tables, no need to open
the app.

**How it works:** three Supabase Edge Functions, `voice-shopping`, `voice-climbing`, and
`voice-todo`, each take a `{"transcript": "..."}` POST body. Since a Siri Shortcut can't hold a
short-lived Supabase session JWT, they authenticate with a separate long-lived **personal API
token** instead (`api_tokens` table — `token_hash` only, the raw token is never stored). Generate
one in **Settings → Voice shortcuts (Siri) → Generate new token**; it's shown once, so copy it
immediately.

**This was already set up for you (via MCPs), no action needed:**
- The `api_tokens` table (RLS: each user manages only their own rows)
- The `voice-shopping`, `voice-climbing`, and `voice-todo` Edge Functions, deployed with
  `verify_jwt: false` (they do their own auth via the token hash, not Supabase's built-in JWT
  check), at:
  - `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-shopping`
  - `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-climbing`
  - `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-todo`
- All three reuse the existing `ANTHROPIC_API_KEY` Edge Function secret (step 1h) — no new secret
  needed

**What still requires manual action — building the iOS Shortcuts themselves can't be done via
MCP, it's a one-time setup in the Shortcuts app on your iPhone.**

### Step 1 — Generate your token

Open **Settings** in the app → **Voice shortcuts (Siri)** → **Generate new token**. Copy it
immediately; it's shown once and isn't recoverable (revoke and generate a new one if you lose it).
You'll paste this into both Shortcuts below as `<YOUR_TOKEN>`.

### Step 2 — Build "Add to Shopping List"

In the iOS **Shortcuts** app, tap **+** to create a new shortcut, name it `Add to Shopping List`,
and add these actions in order:

**Action 1: Dictate Text**
- Language: your choice
- Stop Listening: "After Pause" (default is fine)

**Action 2: Get Contents of URL**

Tap to expand it and set:

| Field | Value |
|---|---|
| URL | `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-shopping` |
| Method | `POST` |
| Headers | `Authorization` = `Bearer <YOUR_TOKEN>` |
| Headers | `Content-Type` = `application/json` |
| Request Body | `JSON` |

In the JSON body editor, add one field:

```
Key: transcript
Value: [tap the variable picker, select "Dictated Text" from Action 1]
```

The body should render as (with the variable chip in place of the bracket):

```json
{"transcript": [Dictated Text]}
```

**Action 3: Get Dictionary Value**
- Add action **Get Dictionary Value**, set Get → `Value for Key`, key = `message`, dictionary =
  the output of Action 2 ("Contents of URL")

**Action 4: Speak Text**
- Add action **Speak Text**, set its input to the output of Action 3 (the `message` value)

**Action 5: name it so Siri can trigger it**
- On current iOS, any shortcut is automatically invocable by saying **"Hey Siri" + its exact
  name** — there's no separate "Add to Siri" phrase-recording step anymore. Just make sure the
  shortcut is named exactly the phrase you want to say, e.g. `Add to shopping list`.
- (Some iOS versions still expose a "Siri Phrases" option under the shortcut's Details/settings
  icon if you want a phrase different from the name — but renaming is the reliable, version-proof
  way.)

### Step 3 — Build "Log a climb"

Duplicate the shortcut and rename it `Log a climb`, then edit Action 2:

| Field | Value |
|---|---|
| URL | `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-climbing` |
| Method | `POST` |
| Headers | `Authorization` = `Bearer <YOUR_TOKEN>` |
| Headers | `Content-Type` = `application/json` |
| Request Body (JSON) | `{"transcript": [Dictated Text]}` (same as before) |

Leave Actions 3–4 (Get Dictionary Value on `message`, then Speak Text) as-is.

### Step 4 — Build "Add a todo"

Duplicate the shortcut again and rename it `Add a todo`, then edit Action 2:

| Field | Value |
|---|---|
| URL | `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/voice-todo` |
| Method | `POST` |
| Headers | `Authorization` = `Bearer <YOUR_TOKEN>` |
| Headers | `Content-Type` = `application/json` |
| Request Body (JSON) | `{"transcript": [Dictated Text]}` (same as before) |

Leave Actions 3–4 as-is.

### Step 5 — Use it

Say **"Hey Siri, add to shopping list"**, **"Hey Siri, log a climb"**, or **"Hey Siri, add a
todo"**, then speak naturally:

- Shopping: *"milk, eggs, and bananas"*
- Climbing: *"three v three, one v five six, fell on a v six seven"*
- Todo: *"call the dentist tomorrow at 3pm, high priority"*

Siri dictates, sends it to the matching Edge Function, and speaks back a confirmation like
*"Added Milk, Eggs, Bananas to your shopping list."*, *"Logged 3 climbs: v2-3, v5-6, v6-7
(project)."*, or *"Added 1 task: Call the dentist."* Entries appear in the app the next time the
Shopping, Climbing, or Todos page loads.

**Climbing grade parsing rule:** a single spoken grade always rounds *up* to the band where it's
the upper bound — "v4" → `v3-4`, "v7" → `v6-7` — except "v0", which has no band below it and maps
to `v0-1`. A spoken range like "five six" maps directly to `v5-6`.

**Todo parsing:** relative dates/times ("tomorrow", "next Friday", "3pm") are resolved to absolute
values relative to the day you spoke. Priority defaults to "medium" unless you say "high
priority"/"urgent" or "low priority"/"whenever". If a date and time are both given, a reminder is
automatically enabled (matching the in-app "add a time to get a reminder" behavior).

**Troubleshooting a Shortcut that fails silently:** temporarily replace the final **Speak Text**
action with **Show Result** on the raw output of "Get Contents of URL" — this surfaces the actual
JSON response (or HTTP error) instead of silence, which is the fastest way to tell whether the
token, URL, or JSON body is wrong.

**Revoking access:** delete a token from the Settings page at any time — any Shortcut using it
immediately stops working (the Edge Functions return `401 UNAUTHORIZED`).

---

## 1k. Multiple Google Calendar accounts

The Calendar page can show events from more than one Google account at once — for example, a
personal Gmail and a work account — merged into a single list/month view, each event badged and
color-coded by which account it came from. **This applies only to Calendar.** Google Tasks and
Google Drive still only ever sync the primary account (the one used to log into the dashboard).

**How it works:** the account used to log into the dashboard (via Google Sign-In) is always the
first/"primary" connected account. To connect additional accounts, go to **Settings → Connected
Google accounts → Connect another Google account** — this kicks off a separate, standalone OAuth
flow (`/api/google-connect-start`, a Vercel function → Google's consent screen →
`supabase/functions/google-connect-callback`, a **Supabase Edge Function**) that does **not**
touch your dashboard login session, so connecting a second account never logs you out or switches
who you're signed in as. The callback runs as an Edge Function rather than a Vercel function
specifically so it can use the auto-injected `SUPABASE_SERVICE_ROLE_KEY` without that key ever
needing to be pasted into Vercel — Google's redirect carries no Supabase session/JWT, so something
has to bypass RLS to write the new account's tokens, and Supabase's own injection is the least
exposure for that. Each connected account gets an auto-assigned color (in connection order) used
consistently across the Calendar list and month views. Disconnecting an account (the "×" next to
it in Settings) stops syncing its events and deletes its previously synced events from the app.

**This was already set up for you (via MCPs), no action needed:**
- The `google_accounts` table (renamed from `google_oauth_tokens`) now supports multiple rows per
  user, with a `color` column and a unique constraint on `(user_id, email)`
- The new `google_oauth_states` table — short-lived CSRF/nonce rows used to bridge the stateless
  OAuth callback back to the user who started it; rows expire and are unusable after ~10 minutes
- `events.google_account_id`, identifying which connected account each synced event came from,
  backfilled for any events that existed before this feature
- The `fetch-google-calendar` Edge Function now loops over every connected account per user, not
  just one
- The `google-connect-callback` Edge Function itself, deployed (`verify_jwt: false`, since Google's
  redirect carries no Supabase JWT) at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/google-connect-callback`

**What still requires manual action:**

1. **Add the new redirect URI** in Google Cloud Console — see the updated step 1a above
   (`https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/google-connect-callback`). Without
   this, clicking "Connect another Google account" will fail at Google's consent screen with a
   redirect URI mismatch error.
2. **Add a new Supabase Edge Function secret**, `APP_URL` — in **Supabase Dashboard → your
   project → Edge Functions → Manage secrets** (or `supabase secrets set`), set it to your
   deployed app's URL, e.g. `https://<your-vercel-app>.vercel.app`. The callback needs this to
   know where to redirect back to (`/settings?google_connect=...`) after finishing — it has no
   incoming request from your app to infer the host from, since Google calls it directly.
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must also be set as Edge Function secrets (the
   same ones already used in step 1h, but Edge Functions and Vercel keep separate copies).
   `SUPABASE_SERVICE_ROLE_KEY` does **not** need to be set anywhere by hand — Supabase injects it
   into every Edge Function automatically.

---

## 1l. Climbing-session auto-tasks and habit debt tracking

Two small quality-of-life additions, both fully server-side — no new secrets, no manual steps.

**Climbing-session auto-tasks:** every time the calendar sync runs and finds an event whose title
contains "אימון" or "טיפוס" (Hebrew for "training"/"climbing"), it creates a "Log a climb" task due
15 minutes after that event ends, with a push reminder enabled for that time. This runs inside the
existing `fetch-google-calendar` Edge Function, right after it upserts the synced events, so it
needs no separate cron job. Each task is deduped against the calendar event via the new
`todos.source_event_id` column, so re-syncing the same event (it runs every 15 minutes) never
creates duplicate tasks. If the event has no end time (an all-day entry), the task is just due on
the event's end date with no specific time and no reminder.

**Habit debt:** daily habits now accrue "debt" — one point for every calendar day (Asia/Jerusalem)
they're not logged. Debt is shown per habit — next to it on the Habits page, and as a badge on its
avatar on the Dashboard's Today card; there's no cross-habit aggregate. Marking a habit complete
pays down debt 1-for-1 (un-marking it the same day
restores the debt it paid, so toggling doesn't let you grind the counter down for free); debt does
not reset completion requirements, it's purely informational — e.g. missing a push-up day once just
shows "1 owed" next to the habit, it doesn't change what counts as "done" today. If debt remains
after today's completion (multiple missed days, only one paid down per log), the habit icon shows a
dashed border instead of a solid one, and the "owed" label adds "paid 1 today" — so it's visually
clear today's log only partially cleared the debt.
- A new `accrue-habit-debt` Edge Function checks, for every daily habit, whether yesterday
  (Asia/Jerusalem calendar date) has a `habit_logs` row; if not, it increments that habit's `debt`
  by 1. It records the date it last checked in `habits.debt_checked_date` so re-running it for the
  same day is a no-op (idempotent), matching the pattern used elsewhere in this codebase
  (`habits.last_notified_date`).
- **Daily 7am check:** a `pg_cron` job (`accrue-habit-debt-daily`) calls the function every day at
  4am UTC — same ≈7am Asia/Jerusalem during daylight saving / ≈6am in winter caveat as the Focus
  summaries cron in step 1h, since `pg_cron` has no timezone-aware scheduling.
- The cron job authenticates the same way every other cron-triggered function in this app does —
  via the `cron_secret` already stored in Supabase Vault. No new secret was needed.

**This was already set up for you (via MCPs), no action needed:**
- `habits.debt` (integer, defaults to 0) and `habits.debt_checked_date` (date, nullable)
- `habit_logs.paid_debt` (boolean) — tracks whether a given day's log paid down debt, so un-marking
  it can correctly restore that debt
- `todos.source_event_id` (text, nullable) — links an auto-created "Log a climb" task back to the
  calendar event that spawned it
- The `accrue-habit-debt` Edge Function, deployed at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/accrue-habit-debt`
- The `accrue-habit-debt-daily` cron job
- The updated `fetch-google-calendar` Edge Function (climbing-session task creation)

---

## 1m. Morning rain notification

Every morning, if today's forecast calls for rain, you get a push notification — "It's raining
today" / "Take an umbrella with you." — the same way habit/todo reminders arrive (step 1g), no
in-app action needed.

**How it works:** a new Edge Function (`supabase/functions/send-rain-notification`) calls
Open-Meteo's `daily` forecast endpoint (not just current conditions) for the fixed Jerusalem
location, for today only (`forecast_days=1`). It flags rain if the day's WMO weather code is any
drizzle/rain/thunderstorm code (51–57, 61–67, 80–82, 95–99 — the same codes that drive
`WeatherWidget`'s rain icon) or if `precipitation_probability_max` is at least 50%. If so, it sends
a push via `web-push` to every stored subscription, using the same `push_subscriptions` table and
`VAPID_*` secrets as the existing notification sender.
- **Daily 7am check:** a `pg_cron` job (`send-rain-notification-daily`) calls the function every
  day at 4am UTC — same ≈7am Asia/Jerusalem during daylight saving / ≈6am in winter caveat as the
  other 4am-UTC crons (steps 1h, 1l), since `pg_cron` has no timezone-aware scheduling.
- **Idempotency:** `weather_cache.rain_notified_date` records the Asia/Jerusalem calendar date a
  rain notification was last sent for, so re-running the function the same day (a manual retry, or
  a delayed cron run) never double-sends — same pattern as `habits.last_notified_date`.
- Authenticates the same way every other cron-triggered function in this app does — via the
  `cron_secret` already stored in Supabase Vault. No new secret was needed.

**This was already set up for you (via MCPs), no action needed:**
- `weather_cache.rain_notified_date` (date, nullable)
- The `send-rain-notification` Edge Function, deployed at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/send-rain-notification`
- The `send-rain-notification-daily` cron job

**No manual action required** — it reuses the existing `push_subscriptions` table and
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`CRON_SECRET` Edge Function secrets from
step 1g. If you've already enabled notifications there, this works automatically; if not, follow
step 1g's "Enabling notifications on iPhone" instructions once.

---

## 1n. Friend interactions from passed calendar events

When a calendar event with linked friends (the "Friends" picker on an event, backed by the
`event_friends` table) moves into the past, each linked friend automatically gets a
`friend_interactions` row logged for it — the event's title as the note, the event's date as the
interaction date. No in-app action needed; this is purely time-based, the same way habit debt and
rain notifications are.

**How it works:** a new Edge Function (`supabase/functions/log-event-friend-interactions`) starts
from `event_friends` (only events a friend was ever explicitly linked to — small, regardless of how
large `events` grows from calendar sync) and joins into `events` to find any whose `event_date` is
before today (Asia/Jerusalem calendar date, same helper as `accrue-habit-debt`). For every match it
upserts a `friend_interactions` row per friend, deduped via the new `friend_id, source_event_id`
unique index so re-running it is a no-op for events already logged.
- **Daily 7am check:** a `pg_cron` job (`log-event-friend-interactions-daily`) calls the function
  every day at 4am UTC — same ≈7am Asia/Jerusalem during daylight saving / ≈6am in winter caveat as
  the other 4am-UTC crons (steps 1h, 1l, 1m).
- Authenticates the same way every other cron-triggered function in this app does — via the
  `cron_secret` already stored in Supabase Vault. No new secret was needed.

**This was already set up for you (via MCPs), no action needed:**
- `friend_interactions.source_event_id` (uuid, nullable, references `events.id` on delete set null)
  and a `friend_interactions(friend_id, source_event_id)` unique index
- The `log-event-friend-interactions` Edge Function, deployed at
  `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/log-event-friend-interactions`
- The `log-event-friend-interactions-daily` cron job

**No manual action required.**

---

## 2. Vercel — Environment Variables

As part of the import in step 0 (or right after), set these environment variables in the Vercel dashboard:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables**
2. Add the following (for all environments: Production, Preview, Development):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://tjjvrqamitwtoslinrxy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqanZycWFtaXR3dG9zbGlucnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mzg1OTYsImV4cCI6MjA5NzIxNDU5Nn0.jl6QgjKL4amur6X0WzjeebBHnUBr09fB92eHs5f77oo` |
| `FINNHUB_API_KEY` | Free key from [finnhub.io/register](https://finnhub.io/register) — powers the TENB stock quote on the Finance page. **No `VITE_` prefix** — this one stays server-side, read only by the `/api/stock-quote` serverless function, never shipped to the browser bundle |
| `GOOGLE_CLIENT_ID` | The same OAuth **Client ID** from step 1a / 1d. **No `VITE_` prefix.** |
| `GOOGLE_CLIENT_SECRET` | The same OAuth **Client Secret** from step 1a / 1d. **No `VITE_` prefix** — used only by the `/api/calendar-events` serverless function to refresh the Google access token, never shipped to the browser bundle |
| `VITE_VAPID_PUBLIC_KEY` | See step 1g above. The other push-notification secrets (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`) live in Supabase Edge Function secrets, not Vercel — see step 1g |

3. After saving, **redeploy** the project for env vars to take effect:
   - Go to **Deployments** tab → latest deployment → **⋯ → Redeploy**

> **Note:** The `.env.local` file in the repo already has these values for local development. It is gitignored and will NOT be committed.

---

## 3. Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → App runs at http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

### Prerequisites
- Node.js 18+ and npm
- A Google account (for OAuth login)

---

## 4. Redeploying Later

Once the Vercel project is imported (step 0), every `git push` to the connected branch triggers an automatic deployment. No CLI or manual redeploy is needed:

```bash
git push origin claude/life-dashboard-plan-fsz8sq
```

The `vercel.json` in this repo configures SPA routing (all paths → `index.html`).

---

## 5. Database Reference

**Supabase Project:** `personal-dashboard`
**Project ID:** `tjjvrqamitwtoslinrxy`
**Region:** eu-central-1
**API URL:** `https://tjjvrqamitwtoslinrxy.supabase.co`

### Tables

| Table | Description |
|---|---|
| `habits` | Habit definitions (name, emoji, color, frequency, optional `reminder_time`/`reminder_enabled` for push reminders). `debt` tracks accumulated missed days for daily habits (see step 1l); `debt_checked_date` is the idempotency marker for the daily `accrue-habit-debt` cron |
| `habit_logs` | Daily check-offs per habit. `paid_debt` marks whether that day's check-off paid down the habit's debt counter (see step 1l), so un-marking it can restore the debt correctly |
| `todos` | Tasks with priority, due date, notes, optional `reminder_enabled`/`remind_at` for push reminders; `notified_at` tracks whether a push was already sent. `recurrence_interval`/`recurrence_unit` (`day`/`week`/`month`) make a task recur — completing it advances `due_date` by that interval instead of marking it done. `source` distinguishes local tasks from synced Google Tasks; Google rows carry `google_task_id` and get their `due_date` synced from Google on every `/api/google-tasks` fetch, which is what lets push notifications and due-date-aware features see them. `source_event_id` links an auto-created "Log a climb" task back to the calendar event that spawned it (see step 1l) |
| `climbing_sessions` | Bouldering session records |
| `climbing_attempts` | Individual attempts within a session |
| `shopping_items` | Flat shopping list items (single list per user) |
| `events` | Calendar events (manually created, local to the app, or synced from any connected Google account). `google_account_id` identifies which connected account a synced event came from (null for local events) |
| `files` | File metadata (actual files in Storage). `source` distinguishes local uploads from recursively-synced Google Drive files; Drive rows also carry `root_folder_id`, `drive_file_id`, `relative_path` (subfolder path within the synced root), and `drive_modified_time` (used to skip re-downloading unchanged files) |
| `google_accounts` | One row per connected Google account (a user can have several — see step 1k); each row holds that account's OAuth refresh/access token, `email`, and an auto-assigned `color` used for Calendar badges. The oldest row per user (`created_at` ascending) is the "primary" account, used for Google Tasks and Google Drive, which stay single-account |
| `google_oauth_states` | Short-lived nonce rows for the standalone "connect another account" OAuth flow (step 1k) — bridges the stateless Google redirect callback back to the user who started it. Rows are single-use and expire after a few minutes |
| `google_drive_folders` | The Drive root folders a user has chosen to sync (Drive folder ID + name), plus `sync_status` / `sync_error` / `last_synced_at` for the recursive sync job. Deleting a row cascades to delete its synced `files` rows |
| `stock_alerts` | Price thresholds per stock symbol |
| `notifications` | In-app notification banners (e.g. triggered stock alerts, friend interaction reminders). `type` distinguishes `stock_alert` vs `friend_reminder`. Friend-reminder banners navigate to `/friends` when clicked |
| `push_subscriptions` | One row per subscribed browser/device (Web Push endpoint + keys), used by `/api/send-notifications` to deliver habit/todo/friend pushes |
| `friends` | People to stay in touch with. `goal_count`/`goal_unit` encode a frequency goal (e.g. 2x per week). `reminder_enabled` gates both in-app banners and push notifications. `last_notified_date` deduplicates push notifications (one per calendar day); `reminder_notified_at` arms/disarms the in-app banner (set when overdue, cleared when back on track) |
| `friend_interactions` | One row per logged interaction with a friend: `interaction_date` + optional `note`. Used to compute days-since-last-interaction and decide overdue status |
| `focus_summaries` | Cached AI-generated focus briefing per user per `period` (`today`/`week` — covering tomorrow and the week ahead, respectively), written by the `generate-focus-summary` Edge Function; `status`/`error` track the last generation attempt, `generated_at` is shown in the UI as "Updated X ago" |
| `api_tokens` | Long-lived personal API tokens (hashed, `token_hash` only) used by external callers like an iOS Shortcut that can't hold a short-lived Supabase session JWT — see step 1j |
| `recipes` | Recipe records: title, description, `servings` (base serving count the ingredient quantities are written for), `image_url` (uploaded to the `recipe-images` bucket or a pasted external URL), `source_url` (set when imported via "paste a link"), `import_method` (`manual`/`prompt`/`paste`/`link`), `last_viewed_at` (powers the "Recently viewed" rail) |
| `recipe_ingredients` | Ingredient lines per recipe: nullable `quantity`/`unit` (e.g. "salt, to taste" has neither), `name`, optional `note`, `position` for display order |
| `recipe_steps` | Ordered directions per recipe: `position` + `instruction` |
| `recipe_collections` | User-defined recipe collections/tags (e.g. "Baking", "Dessert") — `name` + `emoji`, unique per user |
| `recipe_collection_items` | Many-to-many join between `recipes` and `recipe_collections` |

### Storage

**Bucket:** `user-files` (private)
**Path convention:** `{user_id}/{folder_name}/{timestamp}.{ext}` for local uploads, `{user_id}/google-drive/{drive_file_id}` for files synced from Google Drive
**Max file size:** 50 MB (enforced at bucket level) — oversized Drive files are skipped on sync

Files are accessed via signed URLs (1-hour expiry), generated on demand when a user taps Download.

**Bucket:** `avatars` (public)
**Path convention:** `{user_id}/{friend_id}.{ext}`
**Max file size:** 5 MB (enforced in the client before upload)

Avatar images are served via public URLs (`getPublicUrl`), no signed URLs needed. RLS on the storage policy restricts writes to the owning user's folder (`(storage.foldername(name))[1] = auth.uid()::text`) while reads are public.

**Bucket:** `recipe-images` (public)
**Path convention:** `{user_id}/{recipe_id}.{ext}`
**Max file size:** 8 MB (enforced in the client before upload)

Recipe hero images work the same as avatars — public URLs, writes restricted to the owning user's folder. A recipe's `image_url` can also point at an external URL (pasted by the user, or carried over from a "paste a link" import); the app only ever attempts to delete from this bucket when the URL matches its own public-URL prefix, never for an external URL.

### RLS

All tables use the same policy pattern:
```sql
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```
`google_oauth_states` uses the same owner policy — a user can only insert/read/delete their own
nonce row. (The callback Edge Function uses the auto-injected service-role key since it has no
user session to act as, but the policy still applies to the `/api/google-connect-start` insert,
which runs as the user.)

Storage objects are scoped to `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 6. Feature Summary

| Module | Route | Notes |
|---|---|---|
| Dashboard | `/` | Today's habits, tasks, and an AI-generated Focus section (Today / This Week tabs) summarizing relevant todos and calendar events, cached and refreshed daily at 7am, on relevant todo/event changes, and via a manual refresh icon (see step 1h) |
| Habits | `/habits` | Create/edit/delete, heatmap, streak, optional daily push reminder at a chosen time. Daily habits accrue "debt" for missed days, shown next to the habit and paid down 1-for-1 when completed (see step 1l) |
| Todos | `/todos` | Filters: Today / Upcoming / All / Done. Merges local tasks with your Google Tasks "My Tasks" list (badged "Google"). Checking the box syncs completion back to Google, proxied server-side through `/api/google-tasks` so tokens never reach the browser. Create/edit/delete stays local-only. Local tasks with a due date can toggle **Remind me** for a push notification at the due date/time, and set a recurrence (daily/weekly/monthly/custom interval) — completing a recurring task advances its due date instead of marking it done. Google Tasks get their due date synced into the database on every fetch and automatically send a push notification on their due date (no toggle needed, since Google Tasks have no time-of-day) |
| Climbing | `/climbing` | Log / History / Stats tabs |
| Shopping | `/shopping` | Single flat list |
| Calendar | `/calendar` | Upcoming events only (past hidden), plus a Month view. Merges local events with real Google Calendar events from every connected account, each color-coded by account (see step 1k); Calendar's per-account sync runs via the `fetch-google-calendar` Edge Function, not a Vercel function |
| Files | `/files` | Folder-based file storage. Also lets you recursively sync Google Drive folders (and all their subfolders/files) via a folder-tree picker — synced folders appear alongside local ones (badged "Google"); files are downloaded and stored in Supabase Storage, so they're viewable/downloadable exactly like local files, not links to Drive. Proxied server-side through `/api/google-drive-browse`, `/api/google-drive-folders`, and `/api/google-drive-sync` so tokens never reach the browser |
| Finance | `/finance` | USD/EUR/NIS converter (free, no-key [currency-api](https://github.com/fawazahmed0/currency-api)) + TENB stock quote, proxied server-side through `/api/stock-quote` (Finnhub, needs `FINNHUB_API_KEY`) so the key never reaches the browser |
| Settings | `/settings` | Enable/disable push notifications for habits and todos (see step 1g); manage connected Google accounts for Calendar (see step 1k); independently toggle the Focus section's daily and on-change auto-refresh (see step 1h) |
| Recipes | `/recipes` | Collections rail, search, and a recipe grid. Add a recipe via AI (prompt/paste text/paste a link — see step 1n) or a manual form with an Ingredients/Directions editor. Recipe detail (`/recipes/:id`) has a servings scaler that multiplies ingredient quantities for display only |

---

## 7. Troubleshooting

**Login loop / OAuth not working:**
- Check Supabase → Authentication → URL Configuration (Site URL + Redirect URLs)
- Verify Google Cloud Console OAuth credentials have the correct redirect URI: `https://tjjvrqamitwtoslinrxy.supabase.co/auth/v1/callback`
- Make sure Google provider is enabled in Supabase

**"Row violates RLS policy" errors:**
- Make sure you are logged in (the user session exists)
- Check that `user_id` is being passed correctly in insert operations

**File upload fails:**
- Confirm `user-files` bucket exists in Supabase → Storage
- Confirm the storage RLS policy is applied
- File size must be under 50 MB

**Build fails (`tsc` errors):**
```bash
npm run build 2>&1 | head -50
```
Common causes: unused imports (the tsconfig is set to `noUnusedLocals: false` to avoid this).

**Vite env vars not picked up:**
- Env var names must start with `VITE_`
- Restart the dev server after changing `.env.local`

**Google Calendar shows "Connect Google Calendar" / events never appear:**
- You logged in before this feature existed, or denied the calendar permission — click
  **Connect Google Calendar** on the Calendar page (or log out and back in) and accept the consent screen
- Confirm the Calendar API is enabled in Google Cloud Console (step 1d)
- Confirm `https://www.googleapis.com/auth/calendar.readonly` is listed under OAuth consent screen scopes
- If your OAuth consent screen is in Testing mode, confirm your account is listed as a test user
- Check that `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set in Vercel (no `VITE_` prefix) and redeploy

**`/api/calendar-events` 404s in local dev:**
- Same cause as the stock quote endpoint: `npm run dev` doesn't run serverless functions.
  Use `vercel dev` locally with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set in `.env.local` to test it.

**Google Tasks shows "Connect Google Tasks" / tasks never appear, or checking a box fails:**
- Click **Connect Google Tasks** on the Todos page (or log out and back in) and accept the consent
  screen — this is required even if Calendar is already connected, since Tasks is a separate scope
- Confirm the Tasks API is enabled in Google Cloud Console (step 1e)
- Confirm `https://www.googleapis.com/auth/tasks` is listed under OAuth consent screen scopes
- If your OAuth consent screen is in Testing mode, confirm your account is listed as a test user
- A 403 from `/api/google-tasks` means the stored token doesn't have the Tasks scope yet — reconnect

**`/api/google-tasks` 404s in local dev:**
- Same cause as the stock quote endpoint: `npm run dev` doesn't run serverless functions.
  Use `vercel dev` locally with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set in `.env.local` to test it.

**Google Drive shows "Connect Google Drive" / folder picker is empty, or no files appear:**
- Click **Connect Google Drive** on the Files page (or log out and back in) and accept the consent
  screen — required even if Calendar/Tasks are already connected, since Drive is a separate scope
- Confirm the Drive API is enabled in Google Cloud Console (step 1f)
- Confirm `https://www.googleapis.com/auth/drive.readonly` is listed under OAuth consent screen scopes
- If your OAuth consent screen is in Testing mode, confirm your account is listed as a test user
- A 403 from `/api/google-drive-browse` or `/api/google-drive-sync` means the stored token doesn't
  have the Drive scope yet — reconnect
- If a folder's card shows "sync failed", open it to see the error, then tap the refresh icon to retry

**`/api/google-drive-browse`, `/api/google-drive-folders`, or `/api/google-drive-sync` 404s in local dev:**
- Same cause as the stock quote endpoint: `npm run dev` doesn't run serverless functions.
  Use `vercel dev` locally with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set in `.env.local` to test it.

**"Connect another Google account" fails / redirects to `/settings?google_connect=error`:**
- Confirm the redirect URI `https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/google-connect-callback`
  is added in Google Cloud Console (step 1a) — a mismatch shows as an error on Google's own
  consent page, before it ever reaches the app
- Confirm `APP_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are set as **Supabase Edge
  Function secrets** (step 1k) — without them, the `google-connect-callback` function returns
  `500 Missing server configuration.` instead of redirecting. Check its logs (Dashboard → Edge
  Functions → `google-connect-callback` → Logs) for the exact failure
- `?google_connect=expired` means the OAuth flow took too long (the `google_oauth_states` nonce
  row expired) — just click "Connect another Google account" again
- `?google_connect=no_refresh_token` means Google didn't grant offline access, usually because the
  account had already approved this app's scopes before without `prompt=consent` forcing a fresh
  grant — revoke the app's access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and try connecting again

**`/api/google-connect-start` 404s in local dev:**
- Same cause as the stock quote endpoint: `npm run dev` doesn't run serverless functions.
  Use `vercel dev` locally with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set in `.env.local` to
  test it. The callback itself (`google-connect-callback`) is a Supabase Edge Function reachable
  directly at its Supabase URL — it isn't proxied through Vercel/local dev at all, so it works the
  same in local dev as in production as long as it's deployed and its secrets are set (step 1k).

**Stock quote returns 404 in local dev:**
- `npm run dev` runs plain Vite, which doesn't execute serverless functions — `/api/stock-quote` will 404
- To test it locally, install the Vercel CLI (`npm i -g vercel`) and run `vercel dev` instead, with `FINNHUB_API_KEY` set in `.env.local`
- It works normally once deployed to Vercel, no extra steps needed there

**Focus section shows "Couldn't generate a summary" / never says more than "nothing scheduled":**
- Confirm `ANTHROPIC_API_KEY` is set as a **Supabase Edge Function secret** (Dashboard → Edge
  Functions → Manage secrets) — without it, every period with at least one todo/event falls back to
  an error rather than a real summary
- Check the Edge Function's logs (Dashboard → Edge Functions → `generate-focus-summary` → Logs) for
  the actual error (e.g. `MISSING_ANTHROPIC_API_KEY` or an Anthropic API error with a status code)
- Tap the refresh icon in the Focus section to retry after fixing the secret

**Focus summary never includes Google Calendar events:**
- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set as **Supabase Edge Function
  secrets** — these are a separate copy from the same-named Vercel env vars (step 1d), since Edge
  Functions and Vercel don't share secrets
- Confirm Google Calendar is connected for your account (Calendar page → "Connect Google Calendar")
- This is a soft dependency — if it's not configured, the summary just uses local app events instead
  of failing outright

**Focus summary doesn't update right after adding a todo/event:**
- Check `select * from cron.job_run_details where jobid = (select jobid from cron.job where
  jobname = 'generate-daily-focus-summaries') order by start_time desc limit 5;` for the daily run,
  or check the Edge Function logs for trigger-originated calls (body will include a `user_id` and
  `period`)
- The triggers only fire on **insert** or on an **update that changes `due_date`/`event_date`** —
  toggling a todo's completed state or editing its title doesn't re-trigger a refresh
- Use the refresh icon for an immediate update in the meantime

**"Enable notifications" button does nothing / shows "Could not enable push notifications":**
- Confirm `VITE_VAPID_PUBLIC_KEY` is set in Vercel and you've redeployed since adding it
- On iPhone, the app must be opened from the Home Screen icon (added via Share → Add to Home
  Screen), not from a regular Safari tab — iOS only allows push for installed PWAs
- Check the browser's notification permission for the site hasn't been previously denied

**Voice shortcut says nothing happened / Siri shortcut fails:**
- A `401` from `voice-shopping`/`voice-climbing` means the token in the Shortcut's Authorization
  header doesn't match any row in `api_tokens` — regenerate one in Settings and update the Shortcut
- A `502 EXTRACTION_FAILED` means Claude couldn't parse the transcript as JSON, or didn't return any
  items/attempts — try dictating more clearly (e.g. "milk, eggs" or "three v three")
- Check the Edge Function's logs (Dashboard → Edge Functions → `voice-shopping` / `voice-climbing`
  → Logs) for the exact error
- Confirm `ANTHROPIC_API_KEY` is set as a Supabase Edge Function secret (step 1h)

**Notifications never arrive even though "Enable notifications" succeeded:**
- Confirm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` are all set
  as **Supabase Edge Function secrets** (Dashboard → Edge Functions → Manage secrets) — these are
  separate from Vercel's env vars and from each other
- Confirm the `send-due-notifications` cron job exists and is active:
  `select * from cron.job where jobname = 'send-due-notifications';` in the Supabase SQL editor
- Check recent runs: `select * from cron.job_run_details order by start_time desc limit 5;`
- Check the Edge Function's own logs (Dashboard → Edge Functions → `send-notifications` → Logs)
  for errors like `MISSING_CONFIG` (a secret isn't set) or `UNAUTHORIZED` (the `CRON_SECRET`
  secret doesn't match the one in Supabase Vault)
- A habit's `reminder_time` is stored in UTC (converted from your local time at save time) — if
  your habit reminder never fires, double check the time you picked actually matches an upcoming
  UTC minute, e.g. via the Habits page reminder display
- If a reminder/habit was already due *before* you enabled notifications, it won't retroactively
  send — only checks done after the subscription exists will fire

**Rain notification never arrives on a rainy day:**
- Confirm the `send-rain-notification-daily` cron job exists and is active:
  `select * from cron.job where jobname = 'send-rain-notification-daily';`
- Check the Edge Function's logs (Dashboard → Edge Functions → `send-rain-notification` → Logs) —
  the response body includes the day's `forecast` (weather code + max precipitation probability)
  even when no notification was sent, which is the fastest way to tell whether Open-Meteo just
  isn't forecasting rain today vs. something failing
- It only ever sends once per Asia/Jerusalem calendar day (`weather_cache.rain_notified_date`) — if
  you already got today's notification, a second manual run is expected to report
  `"skipped": "already notified today"`
- Same secret/subscription requirements as step 1g apply — no separate setup

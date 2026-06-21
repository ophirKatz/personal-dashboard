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

Habits (with a reminder time set) and Reminders can send a real push notification to your
iPhone's lock screen / notification center — not just an in-app banner. This works because the
app is a PWA with a custom service worker (`src/sw.ts`) that listens for `push` events.

**How it works end-to-end:**
- The browser/PWA subscribes to push via the Web Push API and stores the subscription
  (endpoint + keys) in the new `push_subscriptions` table (Settings page → "Enable notifications")
- A Postgres cron job (`pg_cron` + `pg_net`, both already enabled on the Supabase project) runs
  every minute and calls a new `/api/send-notifications` serverless function over HTTP
- That function checks for due reminders (`remind_at <= now()` and not yet notified) and habits
  with a matching `reminder_time` that haven't been logged today, then sends a push via the
  `web-push` library to every stored subscription for that user

**This was already set up for you (via MCPs), no action needed:**
- `pg_cron` and `pg_net` extensions enabled on the Supabase project
- A `cron_secret` stored in Supabase Vault, and a `send-due-notifications` cron job scheduled to
  call `https://personal-dashboard-azure-omega.vercel.app/api/send-notifications` every minute
- The `push_subscriptions` table (RLS-protected, one row per device) and new columns:
  `habits.reminder_enabled`, `habits.reminder_time`, `habits.last_notified_date`,
  `reminders.notified_at`

**What still requires manual action — add these to Vercel (step 2 below), there's no MCP tool
that can write Vercel environment variables:**

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BCPyVmqKJ3SIxbQt9JYkCPV8FkTF6pFytctsl1DTVBSusLRMKgcLxjtttX-MA7HARDqNo7zUr37vGntNZEn5tLQ` |
| `VAPID_PRIVATE_KEY` | `-lSYIueFwVAgIs_RFzfBDvvIR5ctM33zABnf_tATcIs` |
| `VAPID_SUBJECT` | `mailto:ophirk8396@gmail.com` (or any contact address — required by the Web Push spec) |
| `CRON_SECRET` | `fa6e9b50a5ce3a434177549e919a2dc9e53f3600e1420b2ee13e2e72361249db` — must match exactly what's stored in Supabase Vault; only change this if you also update the Vault secret and the cron job |
| `SUPABASE_SERVICE_ROLE_KEY` | From [Supabase Dashboard](https://supabase.com/dashboard/project/tjjvrqamitwtoslinrxy/settings/api) → **Project Settings → API → service_role secret**. This bypasses RLS so the cron function can read every user's subscriptions/habits/reminders — never expose it to the browser (no `VITE_` prefix) |
| `VITE_VAPID_PUBLIC_KEY` | Same value as `VAPID_PUBLIC_KEY` above — this one **does** get the `VITE_` prefix since the browser needs it to call `pushManager.subscribe()` |

**Enabling notifications on iPhone:**
1. Open the deployed app in Safari and tap **Share → Add to Home Screen** (push notifications
   only work for installed PWAs on iOS — Safari tabs can't receive them, per Apple's WebKit
   restriction since iOS 16.4)
2. Open the app from the Home Screen icon (not from Safari)
3. Go to **Settings** in the app's nav and tap **Enable notifications**, then accept the
   permission prompt
4. Set a reminder time on a habit (Habits → edit a habit → toggle **Reminder**), or create a
   Reminder for a few minutes out, and wait — it should arrive as a real lock-screen notification

**If the cron job's target URL changes** (e.g. a different production domain), update it with:
```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'send-due-notifications'),
  command := $$
  select net.http_post(
    url := 'https://<new-domain>/api/send-notifications',
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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_VAPID_PUBLIC_KEY` | See step 1g above for exact values and what each one does |

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
| `habits` | Habit definitions (name, emoji, color, frequency, optional `reminder_time`/`reminder_enabled` for push reminders) |
| `habit_logs` | Daily check-offs per habit |
| `todos` | Tasks with priority, due date, notes |
| `reminders` | Time-based reminders with optional repeat; `notified_at` tracks whether a push was already sent for the current `remind_at` |
| `climbing_sessions` | Bouldering session records |
| `climbing_attempts` | Individual attempts within a session |
| `shopping_items` | Flat shopping list items (single list per user) |
| `events` | Calendar events (manually created, local to the app) |
| `files` | File metadata (actual files in Storage). `source` distinguishes local uploads from recursively-synced Google Drive files; Drive rows also carry `root_folder_id`, `drive_file_id`, `relative_path` (subfolder path within the synced root), and `drive_modified_time` (used to skip re-downloading unchanged files) |
| `google_oauth_tokens` | One row per user: Google OAuth refresh/access token used to read their Google Calendar, Google Tasks, and Google Drive |
| `google_drive_folders` | The Drive root folders a user has chosen to sync (Drive folder ID + name), plus `sync_status` / `sync_error` / `last_synced_at` for the recursive sync job. Deleting a row cascades to delete its synced `files` rows |
| `stock_alerts` | Price thresholds per stock symbol |
| `notifications` | In-app notification banners (e.g. triggered stock alerts) |
| `push_subscriptions` | One row per subscribed browser/device (Web Push endpoint + keys), used by `/api/send-notifications` to deliver habit/reminder pushes |

### Storage

**Bucket:** `user-files` (private)
**Path convention:** `{user_id}/{folder_name}/{timestamp}.{ext}` for local uploads, `{user_id}/google-drive/{drive_file_id}` for files synced from Google Drive
**Max file size:** 50 MB (enforced at bucket level) — oversized Drive files are skipped on sync

Files are accessed via signed URLs (1-hour expiry), generated on demand when a user taps Download.

### RLS

All tables use the same policy pattern:
```sql
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```
(`google_oauth_tokens` uses `user_id` as its primary key instead of a separate `id` column,
but the same ownership policy.)

Storage objects are scoped to `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 6. Feature Summary

| Module | Route | Notes |
|---|---|---|
| Dashboard | `/` | Today's habits, tasks, reminders, events |
| Habits | `/habits` | Create/edit/delete, heatmap, streak, optional daily push reminder at a chosen time |
| Todos | `/todos` | Filters: Today / Upcoming / All / Done. Merges local tasks with your Google Tasks "My Tasks" list (badged "Google"). Checking the box syncs completion back to Google, proxied server-side through `/api/google-tasks` so tokens never reach the browser. Create/edit/delete stays local-only |
| Reminders | `/reminders` | Overdue highlighted, dismiss advances repeat, sends a push notification when due |
| Climbing | `/climbing` | Log / History / Stats tabs |
| Shopping | `/shopping` | Single flat list |
| Calendar | `/calendar` | Upcoming events only (past hidden). Merges local events with real Google Calendar events (badged "Google"), proxied server-side through `/api/calendar-events` so tokens never reach the browser |
| Files | `/files` | Folder-based file storage. Also lets you recursively sync Google Drive folders (and all their subfolders/files) via a folder-tree picker — synced folders appear alongside local ones (badged "Google"); files are downloaded and stored in Supabase Storage, so they're viewable/downloadable exactly like local files, not links to Drive. Proxied server-side through `/api/google-drive-browse`, `/api/google-drive-folders`, and `/api/google-drive-sync` so tokens never reach the browser |
| Finance | `/finance` | USD/EUR/NIS converter (free, no-key [currency-api](https://github.com/fawazahmed0/currency-api)) + TENB stock quote, proxied server-side through `/api/stock-quote` (Finnhub, needs `FINNHUB_API_KEY`) so the key never reaches the browser |
| Settings | `/settings` | Enable/disable push notifications for habits and reminders (see step 1g) |

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

**Stock quote returns 404 in local dev:**
- `npm run dev` runs plain Vite, which doesn't execute serverless functions — `/api/stock-quote` will 404
- To test it locally, install the Vercel CLI (`npm i -g vercel`) and run `vercel dev` instead, with `FINNHUB_API_KEY` set in `.env.local`
- It works normally once deployed to Vercel, no extra steps needed there

**"Enable notifications" button does nothing / shows "Could not enable push notifications":**
- Confirm `VITE_VAPID_PUBLIC_KEY` is set in Vercel and you've redeployed since adding it
- On iPhone, the app must be opened from the Home Screen icon (added via Share → Add to Home
  Screen), not from a regular Safari tab — iOS only allows push for installed PWAs
- Check the browser's notification permission for the site hasn't been previously denied

**Notifications never arrive even though "Enable notifications" succeeded:**
- Confirm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, and
  `SUPABASE_SERVICE_ROLE_KEY` are all set in Vercel and you've redeployed
- Confirm the `send-due-notifications` cron job exists and is active:
  `select * from cron.job where jobname = 'send-due-notifications';` in the Supabase SQL editor
- Check recent runs: `select * from cron.job_run_details order by start_time desc limit 5;`
- A habit's `reminder_time` is stored in UTC (converted from your local time at save time) — if
  your habit reminder never fires, double check the time you picked actually matches an upcoming
  UTC minute, e.g. via the Habits page reminder display
- If a reminder/habit was already due *before* you enabled notifications, it won't retroactively
  send — only checks done after the subscription exists will fire

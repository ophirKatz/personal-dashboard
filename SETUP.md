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
| `habits` | Habit definitions (name, emoji, color, frequency) |
| `habit_logs` | Daily check-offs per habit |
| `todos` | Tasks with priority, due date, notes |
| `reminders` | Time-based reminders with optional repeat |
| `climbing_sessions` | Bouldering session records |
| `climbing_attempts` | Individual attempts within a session |
| `shopping_items` | Flat shopping list items (single list per user) |
| `events` | Calendar events (manually created, local to the app) |
| `files` | File metadata (actual files in Storage) |
| `google_calendar_tokens` | One row per user: Google OAuth refresh/access token used to read their Google Calendar |

### Storage

**Bucket:** `user-files` (private)
**Path convention:** `{user_id}/{folder_name}/{timestamp}.{ext}`
**Max file size:** 50 MB (enforced at bucket level)

Files are accessed via signed URLs (1-hour expiry), generated on demand when a user taps Download.

### RLS

All tables use the same policy pattern:
```sql
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```
(`google_calendar_tokens` uses `user_id` as its primary key instead of a separate `id` column,
but the same ownership policy.)

Storage objects are scoped to `(storage.foldername(name))[1] = auth.uid()::text`.

---

## 6. Feature Summary

| Module | Route | Notes |
|---|---|---|
| Dashboard | `/` | Today's habits, tasks, reminders, events |
| Habits | `/habits` | Create/edit/delete, heatmap, streak |
| Todos | `/todos` | Filters: Today / Upcoming / All / Done |
| Reminders | `/reminders` | Overdue highlighted, dismiss advances repeat |
| Climbing | `/climbing` | Log / History / Stats tabs |
| Shopping | `/shopping` | Single flat list |
| Calendar | `/calendar` | Upcoming events only (past hidden). Merges local events with real Google Calendar events (badged "Google"), proxied server-side through `/api/calendar-events` so tokens never reach the browser |
| Files | `/files` | Folder-based file storage |
| Finance | `/finance` | USD/EUR/NIS converter (free, no-key [currency-api](https://github.com/fawazahmed0/currency-api)) + TENB stock quote, proxied server-side through `/api/stock-quote` (Finnhub, needs `FINNHUB_API_KEY`) so the key never reaches the browser |

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

**Stock quote returns 404 in local dev:**
- `npm run dev` runs plain Vite, which doesn't execute serverless functions — `/api/stock-quote` will 404
- To test it locally, install the Vercel CLI (`npm i -g vercel`) and run `vercel dev` instead, with `FINNHUB_API_KEY` set in `.env.local`
- It works normally once deployed to Vercel, no extra steps needed there

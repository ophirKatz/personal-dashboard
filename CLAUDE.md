# Testing the UI in this sandbox

This is a Vite + React SPA (not Next.js). `src/main.tsx` renders `<App />`,
which gates everything behind Supabase auth (`src/App.tsx`) — if there's no
session, it renders `<Login />` and nothing else. There are no `.env*` files
checked in, so `src/supabase.ts`'s `createClient(...)` call will throw at
import time without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

To visually verify a page's UI (e.g. with Playwright) without real Supabase
credentials or a logged-in session:

1. **Stub Supabase env vars** so the client doesn't throw at module load.
   Create `.env.local` (already gitignored) with placeholder values:
   ```
   VITE_SUPABASE_URL=https://placeholder.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder
   ```
   These never need to resolve to anything real — they just need to satisfy
   `createClient`'s URL parsing so the module doesn't crash.

2. **Bypass the auth gate** by temporarily editing `src/main.tsx` to render
   the page under test directly instead of `<App />`:
   ```tsx
   import Converter from './pages/Converter'
   // ...
   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       <BrowserRouter>
         <Converter />
       </BrowserRouter>
     </StrictMode>,
   )
   ```
   Swap in whichever page/component you're testing. Revert this and delete
   `.env.local` once you're done — neither should be committed.

3. **Run the dev server**: `npm install` (if `node_modules` isn't present
   yet), then `npm run dev -- --port 5173 --strictPort` (run in background).

4. **Drive it with Playwright.** It isn't a project dependency here, but is
   installed globally — import it by absolute path:
   ```js
   import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
   ```
   Run scripts with `node script.mjs` (not `npx playwright`, which isn't on
   PATH as a project binary).

5. **Proxy setup for outbound network calls.** This sandbox routes outbound
   HTTPS through a local proxy (`$HTTPS_PROXY`, typically
   `http://127.0.0.1:<port>`), which only speaks HTTPS CONNECT — it rejects
   plain-HTTP requests outright. Two gotchas when launching Chromium:
   - You need the proxy configured on the browser so in-page `fetch()` calls
     to external APIs (currency rates, stock quotes, etc.) can reach the
     internet at all:
     ```js
     chromium.launch({
       proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' },
     })
     ```
   - Playwright unconditionally force-routes loopback traffic through the
     proxy unless you opt out, which breaks loading the local dev server
     itself (plain HTTP to `localhost:5173` gets rejected by the HTTPS-only
     proxy). Set this env var on the node process running the script:
     ```
     PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1
     ```

6. **Ignore "could not load" / blocked-API states.** This sandbox's egress
   policy denies (403) the external APIs this app calls — the currency
   conversion API (`cdn.jsdelivr.net`, `latest.currency-api.pages.dev`) and
   the stock quote API (Finnhub, via `/api/stock-quote`, which itself isn't
   served by Vite's dev server anyway since it's a Vercel serverless
   function). Expect to see loading-error states (e.g. "Could not load
   exchange rate", "—" placeholders) in screenshots for anything that
   depends on these. That's an artifact of this environment, not a bug —
   verify layout, interaction, and state transitions; don't chase these
   errors as regressions.

7. **Clean up**: kill the dev server, delete `.env.local`, and revert
   `src/main.tsx` before finishing.

# Supabase Project Details

- **Project ID**: `tjjvrqamitwtoslinrxy`
- **Project URL**: `https://tjjvrqamitwtoslinrxy.supabase.co`
- **Dashboard**: https://supabase.com/dashboard/project/tjjvrqamitwtoslinrxy

# Applying Supabase migrations from a session (MCP tools)

The Supabase MCP tools (`apply_migration`, `execute_sql`) **hold any statement
containing `DROP` (and `DELETE`) for a confirmation that never reaches the
user**. The call fails after 60s with "The server asked the user a question, and
no answer came before the time limit". There is nothing for the user to answer,
and retrying doesn't help. Seen in the `add_rs_pvm_progress` and
`add_meal_shares` sessions (several timeouts each).

- **Don't put `drop policy/trigger ... if exists` in migrations.** For new
  objects plain `create` is enough, and the call then goes through instantly.
  Keep the committed `.sql` identical to what you apply, so replaying the files
  reproduces production.
- **Avoid `DELETE`/`DROP` in `execute_sql` too.** Don't create test rows you'd
  need to delete: use rows that expire on their own, or ask the user to remove
  them in the app.
- **After a timeout nothing was applied.** Confirm with a read-only query
  (`select ... from information_schema.tables` / `supabase_migrations.schema_migrations`)
  before doing anything else.
- **Run `get_advisors` (security) after DDL.** Supabase grants EXECUTE on new
  `public` functions to `anon` and `authenticated` directly, so
  `revoke ... from public` does not make a function private. Trigger/internal
  functions need `revoke execute on function ... from anon, authenticated`.
- **The sandbox can't reach `*.supabase.co`** (egress is blocked), so you can't
  `curl` the REST API. Test the anonymous path in SQL with one call such as
  `set local role anon; select ...;` (the role resets when the call ends).
- Edge Functions called with the cron secret deploy with `verify_jwt: false`,
  like `send-notifications`.

# Debugging Recipe Import Issues

If "Prompt to recipe" or "Paste recipe text" fail with "Failed to send a request to the Edge Function":

1. **Check browser console** (F12 → Console tab):
   - Look for the full error object logged by ImportRecipeDialog
   - The error will contain details about what failed

2. **Check browser Network tab** (F12 → Network tab):
   - Look for a failed request to `/functions/v1/import-recipe`
   - Check the response status code and body
   - This shows the actual HTTP error from the edge function

3. **Check Supabase Edge Function logs**:
   - Dashboard → Edge Functions → `import-recipe` → Logs
   - Look for recent execution records and any error messages
   - This shows what happened inside the function itself

4. **Verify prerequisites**:
   - Other ANTHROPIC_API_KEY features work (Focus Summaries, Shopping photo import)
   - User is logged in (auth is working for other features)
   - Browser has active internet connection

5. **If no logs appear**:
   - The request isn't reaching the edge function
   - Check Supabase client configuration in `src/supabase.ts`
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set

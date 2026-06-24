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
   import Finance from './pages/Finance'
   // ...
   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       <BrowserRouter>
         <Finance />
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

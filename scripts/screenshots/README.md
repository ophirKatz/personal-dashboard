# UI screenshots

Playwright scripts that regenerate `screenshots/` (every screen, plus the Home Screen's features and states).

They need no Supabase credentials and don't touch `src/`. A fake session is put in `localStorage`, and every
backend call (Supabase REST/auth/functions/storage, the currency, stock and RuneScape APIs, book covers) is answered
from the seeded data in `seed.mjs` / `seed2.mjs`. The clock is fixed to **Thu 29 Oct 2026, 10:30 Israel time**
(some Home scenarios override it, e.g. 21:30 for the Tomorrow banner), so the output is deterministic.

## Run

```sh
# 1. Placeholder env so src/supabase.ts doesn't throw at import (gitignored; delete it afterwards)
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder
EOF

# 2. Dev server (port 5173 is what the scripts expect)
npm install
npm run dev -- --port 5173 --strictPort &

# 3. Capture. Playwright isn't a project dependency: a global install is used, or set PLAYWRIGHT_PATH.
node scripts/screenshots/home.mjs     # screenshots/home/
node scripts/screenshots/pages.mjs    # screenshots/screens/  (each route's main view, lock flow, tabs)
node scripts/screenshots/states.mjs   # screenshots/screens/  (drawers, dialogs, empty/error states, sub-pages)

# 4. Optional: shrink the PNGs to a 256-colour palette (what's committed; needs Pillow)
python3 scripts/screenshots/optimize.py screenshots
```

Each script takes an optional name filter, which runs only the scenarios whose name contains it:
`node scripts/screenshots/home.mjs "weather"`. Set `SCREENSHOT_OUT=/some/dir` to write somewhere other than
`screenshots/`.

## Files

| File | Purpose |
| --- | --- |
| `mock.mjs` | Network-level fake backend: a small PostgREST filter engine plus auth, functions, storage and external APIs |
| `lib.mjs` | Browser/page setup (390×844 @2x, Israel time zone, fixed clock) and the `shot` / `shotEl` helpers |
| `seed.mjs` | Base data used by every scenario (Home Screen content) |
| `seed2.mjs` | Extra data for the other pages (friends, recipes, wealth, RuneScape, ...) and canned API responses |
| `home.mjs` | Home Screen states |
| `pages.mjs`, `states.mjs` | The other screens and their states |

Mutate the seed per scenario (e.g. `s.events = []`) to show an empty state; the file names describe what each image shows.

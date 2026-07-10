# Recipe Import — Fix for "Failed to send a request to the Edge Function"

## Problem

The "Prompt to recipe" and "Paste recipe text" features fail with the error:
```
Failed to send a request to the Edge Function
```

## Root Cause

The `import-recipe` Supabase Edge Function requires the `ANTHROPIC_API_KEY` to be set as a secret in your Supabase project. Without it, the function returns a 500 error when invoked.

**Evidence:**
- The function is deployed and ACTIVE in the project
- The function checks for `ANTHROPIC_API_KEY` at runtime (supabase/functions/import-recipe/index.ts:178)
- If missing, it returns: `{error: 'MISSING_ANTHROPIC_API_KEY', status: 500}`
- This causes the Supabase client to fail the function invocation with "Failed to send a request to the Edge Function"

## Solution

Set the `ANTHROPIC_API_KEY` as an Edge Function secret in your Supabase project.

### Step 1: Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in with your account
3. Navigate to the **API Keys** section
4. Copy your active API key (or create a new one if you don't have one)

### Step 2: Set the secret in Supabase

**Option A: Via Supabase Dashboard (easiest)**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/tjjvrqamitwtoslinrxy)
2. Navigate to **Edge Functions → Manage Secrets**
3. Click **+ New Secret**
4. Enter:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** (paste your API key from step 1)
5. Click **Save**

**Option B: Via Supabase CLI (if you prefer the command line)**

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key>
```

Replace `<your-api-key>` with your actual Anthropic API key.

### Step 3: Verify

After setting the secret, try using "Prompt to recipe" or "Paste recipe text" again. The feature should now work.

## Related Features

The same `ANTHROPIC_API_KEY` secret is also used by:
- **Focus Summaries** (`/focus` on the Dashboard) — AI-generated briefings
- **Shopping List Photo Import** (Shopping page) — extract items from photos
- **Voice Shortcuts** (Siri) — add todos/climbs/shopping items by voice

All of these share the same secret and will work once it's configured.

## More Information

See `SETUP.md` section 1h (Focus Summaries) and 1n (Recipe Import) for additional context on Edge Function secret configuration.

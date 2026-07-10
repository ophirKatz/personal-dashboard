---
name: deploy-edge-function
description: Deploy or redeploy Supabase edge functions
allowed_tools:
  - Read
  - Bash
  - mcp__Supabase__deploy_edge_function
  - mcp__Supabase__get_edge_function
  - mcp__Supabase__list_edge_functions
---

Deploy one or more Supabase edge functions. Reads function code from the local supabase/functions directory and deploys to the configured project.

## Usage

Ask me to deploy or redeploy edge functions by name:
- `/deploy-edge-function google-connect-callback`
- `/deploy-edge-function google-connect-callback fetch-google-calendar`
- `deploy the google-connect-callback function`

## What happens

1. Reads the function code from `supabase/functions/<function-name>/index.ts`
2. Deploys to Supabase project (tjjvrqamitwtoslinrxy)
3. Reports version number, status, and deployment URL

## Examples

✅ Success: Version 11, ACTIVE
❌ Error: File not found or deployment failed

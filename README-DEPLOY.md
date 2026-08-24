# mosaed-push-worker — ready to deploy

Files:
- worker.js — original uploaded Worker source (unchanged)
- package.json — original uploaded package file (unchanged)
- wrangler.jsonc — Wrangler configuration added for deployment

## Deploy

From this folder:

1. npm install
2. npx wrangler login
3. npx wrangler deploy

Wrangler will bundle npm dependencies from package.json.

## Secrets / variables

Do NOT put secret values in these files.

Configure these in Cloudflare Worker settings:
- SUPABASE_URL — variable
- SUPABASE_SERVICE_ROLE_KEY — secret
- VAPID_PUBLIC_KEY — variable
- VAPID_PRIVATE_KEY — secret
- VAPID_SUBJECT — variable

Then deploy again if the bindings are added after the first deployment.

## Test

After deployment, test:
GET /vapid-public-key

It should return the configured VAPID public key.

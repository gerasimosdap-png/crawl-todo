# Tally AI — one-time setup (owner only)
*~10 minutes. Users never do any of this. I'll walk you through each step live.*

## Step 1 — Get a free Gemini API key
1. Go to **aistudio.google.com/apikey** (Google AI Studio), sign in with your Google account.
2. Click **Create API key** → copy it. No credit card needed.
   (Free tier: ~1,500 requests/day — plenty.)

## Step 2 — Create the Cloudflare Worker
1. Create a free account at **dash.cloudflare.com** (no card).
2. **Workers & Pages → Create → Workers → Create Worker.** Name it e.g. `tally-ai`. Deploy the starter.
3. **Edit code** → delete the sample → paste the contents of `worker.js` → **Deploy**.

## Step 3 — Add your key as a secret
1. In the Worker: **Settings → Variables and Secrets → Add variable.**
2. Name: `GEMINI_API_KEY` · Value: your key from Step 1 · tick **Encrypt** (secret) · **Deploy**.

## Step 4 — Wire the URL into Tally
1. Copy the Worker URL (looks like `https://tally-ai.<your-subdomain>.workers.dev`).
2. In `app.js`, set: `let AI_WORKER_URL = 'https://tally-ai.<your-subdomain>.workers.dev';`
3. Commit + push. Done — the "Get a suggestion" button now works for everyone.

## Notes
- The Worker only accepts requests from `gerasimosdap-png.github.io` (set in `ALLOWED_ORIGIN`) and never exposes the key.
- If you move Tally to a different domain, update `ALLOWED_ORIGIN` in `worker.js`.
- Optional later: add a per-day rate cap with a Cloudflare KV namespace if usage grows.

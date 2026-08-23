# Deploying Saisha OS to Cloudflare (100% Free, No Credit Card Required)

This guide walks you through deploying **Saisha OS** to **Cloudflare** using either **Cloudflare Workers (with Static Assets)** or **Cloudflare Pages**.

---

## Architecture Summary
- **Frontend**: Vite + React static build (`/dist`) served via Cloudflare Workers Static Assets.
- **Worker Entry**: `/worker.ts` routing `/api/saisha/interact` to the serverless Gemini backend and serving static assets for all other routes.
- **AI Intelligence**: `gemini-3.6-flash` running server-side with Gemini Function Calling (`create_task`).
- **Database & Auth**: Supabase (PostgreSQL + Auth) with Row Level Security (RLS).
- **Cost**: **$0.00 / month** on Cloudflare Free Tier (Unlimited bandwidth, 100,000 function requests/day).

---

## Method A: Deploy as a Cloudflare Worker (Recommended)

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create Application** → **Workers** (or Connect Git).
2. Set the build settings:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
3. Wrangler will automatically read `wrangler.json` which specifies:
   - `"main": "worker.ts"` (the backend routing entry point)
   - `"assets": { "directory": "./dist", "binding": "ASSETS", "not_found_handling": "single-page-application" }` (frontend SPA assets)

---

## Method B: Deploy as Cloudflare Pages

1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
2. Set build configuration:
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

---

## Required Environment Variables & Secrets

In **Cloudflare Dashboard > Workers & Pages > Your Project > Settings > Variables and Secrets**:

| Variable Name | Type | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Secret** (Encrypted) | Server-side Gemini API key (never exposed to browser) |
| `VITE_SUPABASE_URL` | Plaintext | Supabase Project URL (`https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Plaintext | Supabase Anon Public Key |
| `SUPABASE_URL` | Plaintext | Supabase Project URL (backend fallback) |
| `SUPABASE_ANON_KEY` | Plaintext | Supabase Anon Public Key (backend fallback) |

---

## Verification After Deployment

Once deployed:
1. Open your assigned Cloudflare URL.
2. Sign in to your account.
3. Chat with Saisha OS: *"Add a career milestone to complete the project presentation by Friday."*
4. Confirm the task is automatically saved and appears in your dashboard in real time.

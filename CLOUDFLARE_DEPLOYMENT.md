# Deploying Saisha OS to Cloudflare Pages (100% Free, No Credit Card Required)

This guide walks you through deploying **Saisha OS** to **Cloudflare Pages** with serverless **Pages Functions** for the Gemini API backend.

---

## Architecture Summary
- **Frontend**: Vite + React static build (`/dist`) deployed globally across Cloudflare's edge network.
- **Backend API**: Cloudflare Pages Function at `/functions/api/saisha/interact.ts` handling `POST /api/saisha/interact`.
- **AI Intelligence**: `gemini-3.6-flash` executed securely on the server with Gemini Function Calling (`create_task`).
- **Database & Auth**: Supabase (PostgreSQL + Auth) with Row Level Security (RLS).
- **Cost**: **$0.00 / month** on Cloudflare Free Tier (Unlimited bandwidth, 100,000 function invocations/day).

---

## Step 1: Connect Repository to Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) (Sign up for free if you don't have an account).
2. In the left navigation, click **Workers & Pages**.
3. Click **Create Application** → Select the **Pages** tab → Click **Connect to Git**.
4. Select your Saisha OS repository.

---

## Step 2: Configure Build Settings

Set the following build configuration:

- **Framework preset**: `Vite` (or `None`)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`

---

## Step 3: Configure Environment Variables

Under **Environment Variables (Advanced)** in Cloudflare Pages:

| Variable Name | Environment | Description | Example / Notes |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Production & Preview | **Secret** - Server-side Gemini API key | `AIzaSy...` (Never exposed to browser) |
| `VITE_SUPABASE_URL` | Production & Preview | Supabase Project URL | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Production & Preview | Supabase Anonymous Public Key | `eyJhbGciOi...` |
| `SUPABASE_URL` | Production & Preview | Supabase Project URL (backend fallback) | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Production & Preview | Supabase Anonymous Key (backend fallback) | `eyJhbGciOi...` |

> 🔒 **Security Note**: `GEMINI_API_KEY` is only accessed inside `/functions/api/saisha/interact.ts` and will **never** be included in the client JavaScript bundle.

---

## Step 4: Deploy & Verify

1. Click **Save and Deploy**.
2. Once the build finishes, Cloudflare will assign a live URL (e.g. `https://saisha-os.pages.dev`).
3. Open your deployed URL, log in via Supabase, and test:
   - *"Add a career task to research AI internships in Auckland."*
4. Verify that the task is created and appears in your dashboard in real time.

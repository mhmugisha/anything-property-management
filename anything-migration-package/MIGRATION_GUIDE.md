# Anything Property Management — Migration Guide

## What This Package Contains

| File | Purpose |
|------|---------|
| `server/index.ts` | Replacement server entry point (removes Create platform dependency) |
| `server/auth.js` | Replacement auth helper (removes @auth/create dependency) |
| `.env.example` | All environment variables you need with instructions |
| `scripts/import-database.sh` | Script to import your database into Neon |
| `MIGRATION_GUIDE.md` | This file |

---

## Step 1 — Set Up Your GitHub Repository

1. Go to **github.com** and sign in
2. Click the **+** button → **New repository**
3. Name it: `anything-property-management`
4. Set it to **Private**
5. Click **Create repository**
6. On your computer, open a terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/anything-property-management.git
git push -u origin main
```

---

## Step 2 — Replace the Proprietary Server Files

In your project, replace these files with the ones in this migration package:

1. Copy `server/index.ts` → replace `apps/web/__create/index.ts`
2. Copy `server/auth.js` → replace `apps/web/src/__create/@auth/create.js`

---

## Step 3 — Import Your Database into Neon

### Option A — Using the Script (Mac/Linux)
1. Extract your `production.sql` from the zip file you provided
2. Place `production.sql` and `scripts/import-database.sh` in the same folder
3. Open terminal in that folder and run:
```bash
bash import-database.sh
```

### Option B — Using Neon Dashboard (Easiest for Windows)
1. Go to your Neon project dashboard
2. Click **"SQL Editor"** in the left menu
3. Open your `production.sql` file in a text editor
4. Copy and paste the contents into the SQL Editor
5. Click **Run**

> ⚠️ The production.sql is 115MB — for large files Option A (the script) is more reliable

---

## Step 4 — Set Up Your Environment Variables

1. Copy `.env.example` to `.env` in your `apps/web/` folder
2. Fill in these values:

| Variable | Where to Get It |
|----------|----------------|
| `DATABASE_URL` | Your Neon dashboard → Connection Details |
| `AUTH_SECRET` | Already generated for you in the .env.example |
| `AUTH_URL` | Your Vercel app URL (set after deploying) |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same Stripe page |
| `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY` | uploadcare.com → Dashboard |

---

## Step 5 — Deploy to Vercel

1. Go to **vercel.com** and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `anything-property-management` repository
4. Set the **Root Directory** to `apps/web`
5. Add all your environment variables (from your `.env` file)
6. Click **Deploy**

Once deployed, come back and update `AUTH_URL` in your Vercel environment variables to your new app URL (e.g. `https://anything-property-management.vercel.app`)

---

## Step 6 — Verify Everything Works

After deployment, test these pages:
- `/account/signin` — Login page loads
- `/dashboard` — Redirects to login if not signed in
- `/api/staff/profile` — Returns auth error (expected if not logged in)

---

## Step 7 — Rotate Your Credentials

Since your connection string was shared during migration, update your Neon password:
1. Go to Neon dashboard → **Settings** → **Reset Password**
2. Update `DATABASE_URL` in your Vercel environment variables
3. Redeploy

---

## Cron Jobs (Automatic on Vercel)

Your `vercel.json` already has these scheduled tasks configured:
- **1st of every month** — Generates monthly rent invoices automatically
- **Every day at 8am** — Checks and sends landlord due date notifications

These will work automatically once deployed on Vercel.

---

## Getting Help

For any issues, bugs, or new features — come back to Claude with:
- A description of what's wrong or what you want
- Claude Code installed will let Claude fix it directly in your codebase

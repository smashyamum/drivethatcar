# Car Booking CRM

A booking app for a single car dealer. Customers click a per-car link, pick a slot, leave their details. Admin manages stock from a private dashboard. Confirmations + reminders by email, sync to Google Calendar.

This is **Milestone 1** — admin can add cars, public car detail page renders. Bookings, photos, email and calendar arrive in M2–M5.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth) · Resend (M4) · Google Calendar (M5) · Vercel.

See `DESIGN.md` for UI conventions.

## One-time setup

### 1. Create a Supabase project

1. Go to https://supabase.com → **New project** → free tier is fine.
2. Wait ~1 minute for it to provision.
3. **Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (this one is secret — never commit)

### 2. Run the migration

In the Supabase dashboard:

1. **SQL Editor → New query**
2. Paste the contents of `supabase/migrations/0001_init.sql`
3. **Run**

(Or, if you install the Supabase CLI locally, `supabase link` + `supabase db push`.)

### 3. Create your admin user

Supabase **Authentication → Users → Add user → Create new user**.
Enter your email + a password. Tick **Auto Confirm User**.

### 4. Local env

```bash
cp .env.example .env.local
# Edit .env.local with the values from step 1
```

### 5. Run

```bash
npm install      # if you haven't already
npm run dev
```

Open http://localhost:3000

- `/` — public landing
- `/cars` — public stock list
- `/car/<slug>` — public car detail
- `/login` — admin sign-in
- `/admin` — admin dashboard (after sign-in)

## Smoke test

1. Sign in at `/login` with the admin user you created.
2. **Cars → Add car** → fill make, model, year, price → **Create car**.
3. The slug is auto-generated. Visit `/car/<slug>` in an incognito tab — your car is live.
4. Mark it **Sold** in the edit page → reload `/car/<slug>` → "no longer available."

## Deploying (Vercel)

1. Push this repo to GitHub.
2. **Vercel → Add New → Project → Import** the repo.
3. Add the same env vars from `.env.local` in **Project Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL (or custom domain).
5. Deploy. Re-deploy after every env var change.

## Layout

```
app/
├── (public)/             # /, /cars, /car/[slug]
├── (admin)/              # /login, /admin/*
├── layout.tsx
└── globals.css
components/
├── ui/                   # Button, Input, Card, Badge, Label, Select, Textarea
└── admin/                # CarForm
lib/
├── supabase/             # server / browser / service / types
├── slug.ts
└── utils.ts
supabase/migrations/
└── 0001_init.sql         # cars + car_photos + RLS
proxy.ts                  # gates /admin/* (Next 16's renamed middleware)
DESIGN.md                 # UI source of truth (replace with `npx getdesign@latest add cal`)
```

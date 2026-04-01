# Solar Lead Generator — Replit + Agent 4 Setup

A full-stack AI-powered solar lead generator with:
- Multi-step form capture
- Gemini 2.5 Flash AI lead scoring & engineer briefs
- Supabase database persistence
- Email notifications via Resend

---

## Stack
- **Frontend**: Vanilla HTML/CSS/JS (single file, no build step)
- **Backend**: Node.js + Express
- **Database**: Supabase (Postgres)
- **AI**: Google Gemini 2.5 Flash
- **Email**: Resend

---

## Replit Agent 4 Setup Instructions

Paste this prompt into Replit Agent 4:

```
Build a full-stack solar lead generator app using the files in this project.
- Use Node.js + Express for the backend (server.js)
- Serve the frontend from public/index.html
- Connect to Supabase using @supabase/supabase-js
- Use the Google Gemini SDK (@google/genai) for AI lead scoring
- Use Resend for email notifications
- Install all dependencies from package.json
- Set up environment variables from .env.example
- Run on port 3000
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com → Get API Key |
| `SUPABASE_URL` | Supabase project → Settings → General |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API → Publishable key |
| `RESEND_API_KEY` | resend.com → API Keys |
| `ENGINEER_EMAIL` | Your solar engineer's email address |
| `FROM_EMAIL` | Use `onboarding@resend.dev` for testing |

---

## Supabase Table Setup

Run this SQL in your Supabase SQL editor:

```sql
create table leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  fname text,
  lname text,
  email text,
  phone text,
  address text,
  roof_types text[],
  orientation text,
  roof_area numeric,
  bill text,
  usage text,
  provider text,
  goals text[],
  timeline text,
  notes text,
  ai_score integer,
  ai_tier text,
  ai_system_size text,
  ai_panels integer,
  ai_batteries text,
  ai_roi text,
  ai_priority text,
  ai_engineer_notes text,
  ai_tags text[]
);
```

---

## Project Structure

```
solar-lead-gen/
├── server.js          # Express backend
├── package.json       # Dependencies
├── .env.example       # Environment variable template
└── public/
    └── index.html     # Full frontend app
```

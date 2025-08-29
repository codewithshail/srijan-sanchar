## Story Writing – Life Story Wizard

An end‑to‑end Next.js app where users craft a 7‑stage life story via a guided wizard. The system generates options with AI, stores progress in Postgres (via Drizzle ORM), and produces summaries, images, and TTS audio when complete.

### Key Features
- 7‑step story wizard with option regeneration per step
- Authenticated user flow with Clerk
- Postgres + Drizzle ORM schema for users, stories, stages, summaries, images
- Background summary/image generation on completion
- Image generation via Replicate (configurable model)
- Optional text‑to‑speech via ElevenLabs
- Public/private visibility controls for stories

### High‑Level Architecture
- App Router (Next.js 15) with protected routes enforced in `middleware.ts`
- Server routes under `app/api/**` using Next.js Route Handlers
- Database access via `lib/db.ts` and `lib/schema.ts` (re‑exported under `lib/db/schema.ts`)
- AI helpers in `lib/ai/gemini.ts`

## User Flows

### 1) Sign in and start a story
- Visit `/dashboard` (protected by Clerk)
- Click “Start New Story” → POST `/api/stories` → redirect to `/wizard/{storyId}`

### 2) Progress through the wizard
- Page: `app/wizard/[storyId]/page.tsx`
  - GET `/api/wizard/{storyId}` → returns current stage index, prior selection (if any), and options
  - POST `/api/wizard/{storyId}/regenerate` → regenerates options for current stage
  - POST `/api/wizard/{storyId}/next` with `{ selection }` → saves selection and advances stage
  - After stage 6 (index 6), the server marks story as `draft` and kicks off background generation

### 3) Background generation (server)
- `POST /api/wizard/{storyId}/next` triggers:
  - Fetch all selections from `stages`
  - Generate summaries and steps via Gemini
  - Generate image via Replicate
  - Persist to `summaries` and `images`
  - Update story → `status = 'completed'`

### 4) View the story
- Page: `app/story/[storyId]/page.tsx`
  - GET `/api/stories/{storyId}` returns story with related `summary` and `image` if visible/authorized
  - UI shows loading state while status is `draft`, and then renders final content once `completed`

## API Endpoints

Wizard
- `GET /api/wizard/{storyId}` – current stage data (index, selection, options)
- `POST /api/wizard/{storyId}/regenerate` – regenerate options for current stage
- `POST /api/wizard/{storyId}/next` – save selection and advance, triggers background generation on final stage

Stories
- `GET /api/stories` – list current user’s stories
- `POST /api/stories` – create a new story and return `id`
- `GET /api/stories/{storyId}` – fetch a story by id (checks visibility/ownership)

Media / AI
- `POST /api/image` – generate an image (Replicate)
- `POST /api/tts` – generate TTS (ElevenLabs)

Note: Legacy endpoints `api/ai/*` and legacy pages `app/wizard/page.tsx` and `app/wizard/summary/page.tsx` were removed in favor of the canonical `wizard/{storyId}` flow.

## Data Model (Drizzle)
- `users`: Clerk users, role enum (`user`, `psychiatrist`, `admin`)
- `stories`: ownerId, title, status enum (`draft`, `completed`), visibility enum
- `stages`: per‑story stageIndex 0..6, selection, options[], regenerationCount
- `summaries`: one‑to‑one with story; userSummary, psySummary, actionableSteps[], longForm (reserved)
- `images`: one‑to‑one with story; prompt, url

## Project Structure
- `app/`
  - `dashboard/page.tsx` – list/create stories, route into wizard/story
  - `wizard/[storyId]/page.tsx` – main wizard UI
  - `story/[storyId]/page.tsx` – final story view
  - `api/` – route handlers (wizard, stories, image, tts, etc.)
- `lib/`
  - `ai/gemini.ts` – AI option/summary helpers
  - `db.ts` – Drizzle DB client
  - `schema.ts` – Drizzle schema
- `middleware.ts` – Clerk protection for `/wizard`, `/dashboard`, `/admin`, `/psychiatrist`

## Setup

### 1) Prerequisites
- Node 20+
- Postgres (Neon or local)
- Clerk application (Frontend/API keys)
- Google Gemini API key
- Replicate API token (for images)
- ElevenLabs API key (optional, for TTS)

### 2) Environment
Copy `ENV_SAMPLE` to `.env.local` and fill:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `REPLICATE_API_TOKEN` and optional `REPLICATE_MODEL`
- `ELEVENLABS_API_KEY` (and optional `ELEVENLABS_VOICE_ID`)
- `NEXT_PUBLIC_APP_URL`

### 3) Install & run
```bash
npm install
npm run dev
```
App runs at `http://localhost:3000`.

### 4) Database
Ensure `DATABASE_URL` is set. This project uses Drizzle ORM. If you need migrations, set up `drizzle-kit` per your environment and run migrations against your database. The schema is defined in `lib/schema.ts`.

## Authentication & Authorization
- Middleware protects `/wizard`, `/dashboard`, `/admin`, `/psychiatrist` using Clerk
- API routes validate user via `auth()` and check ownership/visibility where needed

## Development Notes
- Uses React Query for client data fetching/mutations
- Next.js App Router with Route Handlers for APIs
- Tailwind UI components under `components/ui`
- Removed legacy wizard flow to avoid duplication

## Troubleshooting
- 401/redirect: ensure Clerk keys and webhooks are configured and you’re signed in
- Image generation fails: set `REPLICATE_API_TOKEN` and check model permissions
- TTS 503: set `ELEVENLABS_API_KEY` or disable the feature in UI
- DB errors: verify `DATABASE_URL` and that tables exist

## License
Proprietary. All rights reserved.

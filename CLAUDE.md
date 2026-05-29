# CLAUDE.md — Ascesa Analytics
Last updated: 2026-05-29

## What This Is
Multi-sport athlete performance analytics app for two competitive youth athletes.
Event-based model (not daily logging). Primary focus: Rie's fencing development.

## The Athletes
- **Yuta** — Age 13, hockey defense, Everett Jr. Silvertips (PCAHA)
- **Rie** — Age 14, epee fencing, Kaizen Academy, A-rated, nationally ranked

---

## Commands
```bash
bun run dev          # Start Vite dev server → localhost:8080
bun run build        # Production build
bun run build:dev    # Development mode build
bun run lint         # Run ESLint
bun run format       # Format with Prettier (100 char width, double quotes, trailing commas)
```
No test runner configured. Ignore `wrangler.jsonc` — scaffold artifact, not used.

---

## Tech Stack
| Layer | Tech |
|---|---|
| Framework | TanStack Start (SSR) + React 19 + TypeScript |
| Build | Vite 7 |
| Routing | TanStack Router — file-based in `src/routes/` |
| Data fetching | TanStack React Query |
| Hosting | Vercel — `git push` auto-deploys |
| Database | Supabase PostgreSQL — 14 tables, full RLS |
| Auth | Supabase Auth — Google OAuth only |
| AI/Vision | Claude Vision API — claude-sonnet-4-6 |
| Edge Functions | Supabase Deno TypeScript |
| Charts | Recharts |
| Pose Detection | MediaPipe tasks-vision@0.10.35 — PoseLandmarker, VIDEO mode |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york style, Radix primitives) |

---

## Architecture

### Data Flow
```
Client Page (useQuery)
  → src/lib/data.ts (typed query functions)
    → Supabase browser client (src/integrations/supabase/client.ts)
Server functions (TanStack Start)
  → src/integrations/supabase/client.server.ts (service role / admin)
```
Auth state: `src/hooks/use-auth.ts`
Server routes protected by: `src/integrations/supabase/auth-middleware.ts` (validates Bearer JWT)
Client-side route guarding: `RequireAuth` wrapper

### Key Directories
- `src/routes/` — file-based routes; `$id` = dynamic segments, `__root.tsx` = root layout
- `src/lib/data.ts` — **all** Supabase queries live here, typed against generated DB types
- `src/lib/sports.ts` — sport config and field mappings (supports 11 sports; hockey + fencing primary)
- `src/integrations/supabase/types.ts` — generated DB types (do not edit manually)
- `src/components/ui/` — shadcn/ui components (Radix + Tailwind)

### Path Alias
`@/*` maps to `src/*` (configured in `tsconfig.json` and Vite)

### Database
Supabase with Row-Level Security — all tables enforce isolation by `user_id`.
Use `supabaseAdmin` (service role) only in server functions, never expose to client.

---

## Two Supabase Instances — DO NOT MERGE
| Instance | ID | Purpose |
|---|---|---|
| Lovable's | `weajdvklieulmrvnvxjp` | App data + user auth. NOT directly accessible. |
| Yours | `yixcufjaoqofcloccyix` | Schema, RLS, Edge Functions, ANTHROPIC_API_KEY |

Edge Function base URL: `https://yixcufjaoqofcloccyix.supabase.co/functions/v1/`

---

## Infrastructure Migration — IN PROGRESS
Moving from Lovable hosting → Vercel + your own Supabase.

**Done:**
- Repo cloned at `/Users/johnmerriman/Documents/ascesa-analytics`
- `bun install` complete
- App runs locally at `localhost:8080`

**Remaining steps:**
1. Verify `yixcufjaoqofcloccyix` in Supabase dashboard — Table Editor (16 tables?), Auth providers (Google OAuth enabled?), Storage buckets (videos + keyframes?)
2. **Schema gap:** Lovable has 16 tables, yours has 14. Missing: `profiles` (auth user table) and `benchmarks` (reference data). Check `supabase/migrations/*.sql` — may need to write these migrations manually.
3. Enable Google OAuth in your Supabase Auth settings
4. Ensure `videos` + `keyframes` storage buckets exist with private RLS
5. Create `.env.local` with your Supabase URL + anon key, point app to `yixcufjaoqofcloccyix`
6. Test locally — sign in at localhost:8080, create test athlete, confirm data saves to your Supabase
7. Connect GitHub repo to Vercel, set environment variables, deploy
8. Add Vercel domain to Google OAuth authorized redirect URIs in Google Cloud Console

**Lovable credits:** ~3 remaining as of 2026-05-28. Emergencies only.

---

## Build Status

### Complete
- Dashboard, athlete profiles, tab nav, session detail, progress tab, onboarding, seed data
- Full video analysis pipeline: upload → calibrate → mask → select → analyze → results
- MediaPipe skeleton overlay (tasks-vision, VIDEO mode, 33 landmarks)
- Blackout masking (applied to AthleteSelector, PoseOverlay, runAnalysis)
- Switch Athlete, Re-select, Hide Skeleton controls
- Lunge depth angle (hip-knee-ankle, persisted to DB, shows on Progress tab)
- Speed data (ankle landmarks + piste calibration, 12 m/s sanity cap)
- Live score tracking (rieScore/oppScore, Opp Touch button)
- Event grouping, period label dropdown, action success rate charts
- Inline tag editing, back button nav, fleche action type

### Partial
- Mask persistence — saves to DB but Re-select reload needs work
- Lunge depth Progress chart — built, needs data backfill (replay existing sessions with skeleton active)

### Not Started
- **Phase 1: Server-side tracking (Roboflow)** — critical prerequisite for reliable biomechanics
- AI cross-session analysis
- Score pressure analysis
- Coach dashboard
- Freelap CSV import (Yuta)
- Theater mode

---

## What Data Is Actually Reliable

**Use for decisions:**
- Action tagging (manual — attacks, lunges, touches, ripostes, parries)
- Score tracking and win/loss record
- Action success rates (Attack %, Touch %, Riposte % over time)
- Pool vs DE comparison

**Directionally useful:**
- Speed readings (3-12 m/s range, not always Rie's data — MediaPipe loses her)
- Lunge depth (accurate when skeleton is on Rie, unreliable when not)

**Do not use yet:**
- Per-step velocity, arm extension, recovery speed, footwork cadence — all need Phase 1

---

## Phase 1 — Server-Side Tracking (After Migration)
**Problem:** Browser MediaPipe has no frame-to-frame memory. Re-detects from scratch every frame. Loses Rie, jumps to referee. No UI fix solves this permanently.

**Solution:** Roboflow tracking API. Server processes full video with temporal memory. Pick Rie once — tracked for entire video regardless of crowding or camera angle.

**Steps:**
1. Sign up for Roboflow, get API key
2. Supabase Edge Function sends video URL to Roboflow, gets back JSON (person IDs + coordinates per frame)
3. Store tracking data in database
4. PoseOverlay uses stored coordinates instead of live MediaPipe
5. runAnalysis uses stored ankle coordinates for speed

**Cost:** ~$0.01-0.05/video, $5-20/month at current volume

---

## Video Analysis Flow (Current Working State)
1. Upload MP4 (MOV may need QuickTime → Export As 1080p)
2. Calibrate — click two piste points, set 14m distance
3. Mask — draw black rectangles over referee + background people
4. Select athlete — click Select on Rie from unmasked detections
5. Analyze — runAnalysis processes full video, ankle landmarks + piste calibration
6. Results — skeleton overlay, speed chart, lunge depth, action tagging, live score

**Controls in results:** Hide Skeleton | Switch Athlete (toggles targetIndex 0/1) | Re-select (back to mask, no re-upload)

---

## Codebase Rules
- Read the file before editing it. Always.
- One change at a time. Test before the next.
- If something breaks, `git revert` to last good commit (`3de7655`) immediately.
- Never merge the two Supabase instances.
- `useEffect` dependency arrays must be `[]`. Props inside effects go in refs.
- The zone feature was removed 2026-05-23. Do not re-add it.
- Blackout masking is the correct approach for background exclusion.
- Use `supabaseAdmin` (service role) only in server functions, never in client code.

---

## Key References
| | |
|---|---|
| App (Lovable) | https://ascesa-analytics.lovable.app |
| GitHub | github.com/jmsm512/ascesa-analytics (PUBLIC) |
| Last good commit | `3de7655` — Re-select working |
| Supabase (yours) | yixcufjaoqofcloccyix |
| AI model | claude-sonnet-4-6 |

---

## Go-To-Market
- **DuPraw (hockey):** OUT.
- **Kevin Mar / Kaizen Academy:** Potential. Need Phase 1 + real Rie tournament data before demo.
- **Prerequisites:** Phase 1 tracking working, clean onboarding, lunge depth Week 1 vs Week 8 moment, 15-20 tagged bouts.

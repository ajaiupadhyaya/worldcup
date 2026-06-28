# Floodlit — World Cup Intelligence System

A public-facing World Cup dashboard combining live match data, free/open-data
tactical analysis, and transparent frame-review checklists. Built to be
genuinely useful and shareable during a live tournament.

**Live:** <https://worldcup-sable.vercel.app>

> Built in strict phases per the handoff. **All five phases complete and deployed.**

## Stack

- **Frontend + API:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4
- **Data:** API-Football free tier (optional richer source) → ESPN hidden endpoints (fallback, no auth)
- **Analysis:** deterministic free/open-data engine (`lib/free-analysis.ts`)
- **Frame review:** free tactical checklist; optional external frame-analysis service via `CV_SERVICE_URL`
- **State/caching:** Upstash Redis REST when configured, in-memory TTL fallback otherwise

## Getting started

```bash
npm install
cp .env.example .env.local   # keys are OPTIONAL in dev — ESPN works with no auth
npm run dev
```

Open <http://localhost:3000/dev> — the data-confirmation page. It shows live
fixtures, group standings, per-match raw JSON, and a data-health panel.

### Environment

All keys are optional in development:

| Var | Purpose | Phase |
| --- | --- | --- |
| `API_FOOTBALL_KEY` | Optional richer data source. Falls back to ESPN if unset. | 1 |
| `CV_SERVICE_URL` | Optional external frame-analysis service URL. Free mode works without it. | 3 |
| `UPSTASH_REDIS_REST_URL` | Optional distributed cache + rate limiting backend. Falls back to memory if unset. | 5 |
| `UPSTASH_REDIS_REST_TOKEN` | Optional Upstash REST token. Required with `UPSTASH_REDIS_REST_URL`. | 5 |

## Architecture (Phase 1)

```
app/api/*           Route handlers (thin — delegate to lib/data)
lib/types.ts        Normalized domain types (the contract)
lib/api-football.ts Primary provider client  ─┐
lib/espn.ts         Fallback provider client  ─┤→ lib/data.ts (orchestrator:
lib/cache.ts        Redis/memory TTL cache     ┘   source selection + caching)
```

**Source selection:** `lib/data.ts` prefers API-Football when `API_FOOTBALL_KEY`
is set and transparently falls back to ESPN on any failure. Both providers are
normalized into the same `lib/types.ts` shapes, so nothing downstream sees raw
provider payloads. The `DataEnvelope<T>` wrapper reports `source` and `cached`
for every response.

**Caching TTLs:** live 60s · standings 5m · finished 1h · scheduled 5m.

### API routes

| Route | Returns |
| --- | --- |
| `GET /api/matches` | all fixtures |
| `GET /api/matches/live` | live fixtures only |
| `GET /api/matches/[id]` | full match: stats, lineups, events |
| `GET /api/matches/[id]/stats` | stats + xG only |
| `GET /api/matches/[id]/lineups` | lineups only |
| `GET /api/standings` | all group standings |
| `GET /api/health` | per-source health probe |

## Roadmap

- [x] **Phase 1 — Data Layer** (live scores, lineups, stats, standings, caching, `/dev`)
- [x] **Phase 2 — Analysis Engine** (free tactical breakdowns, previews, live reads, streaming Q&A)
- [x] **Phase 3 — Frame Review** (screenshot → tactical checklist, optional FastAPI CV service)
- [x] **Phase 4 — Shareable Cards** (`next/og` match report cards at `/api/og/match/[id]`)
- [x] **Phase 5 — Public Web App** ("FLOODLIT CHALK" tactics-cam UI: `/`, `/match/[id]`, `/standings`)
- [x] **Deployed** — Vercel (<https://worldcup-sable.vercel.app>), auto-deploys from GitHub `main`.
      Analysis runs without paid LLM keys; an external frame-analysis service can be added later via `CV_SERVICE_URL`.
- [x] Phase-5 rate limiting — Upstash-backed when configured, memory fallback in dev

## Design

The UI direction is **FLOODLIT CHALK** — the page *is* the broadcast tactics-cam:
floodlit-grass black-green base, sodium-amber + telestrator-cyan chalk
(home = cyan, away = amber), Anton scoreboard caps / Hanken Grotesk prose /
Spline Sans Mono data. The signature is a self-drawing telestrator chalk overlay
on formation dot-diagrams (`components/FormationPitch.tsx`), reinforced by
kit-colour programme-spine edge bars on every team row.

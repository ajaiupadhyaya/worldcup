# World Cup Intelligence System

A public-facing World Cup dashboard combining live match data, Claude-powered
tactical analysis, and computer-vision formation analysis. Built to be genuinely
useful and shareable during a live tournament.

> Built in strict phases per `handoff`. **Phase 1 (Data Layer) is complete.**

## Stack

- **Frontend + API:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS v4
- **Data:** API-Football (primary, paid) → ESPN hidden endpoints (fallback, no auth)
- **AI:** Anthropic Claude (`claude-sonnet-4-6`) — Phase 2+
- **CV:** FastAPI microservice — Phase 3
- **State/caching:** in-memory TTL cache (Phase 1) → Redis (Phase 5)

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
| `API_FOOTBALL_KEY` | Primary data (richer: xG, ratings). Falls back to ESPN if unset. | 1 |
| `ANTHROPIC_API_KEY` | Tactical analysis + vision | 2, 3 |
| `CV_SERVICE_URL` | FastAPI CV service URL | 3 |
| `UPSTASH_REDIS_REST_*` | Distributed cache + rate limiting | 5 |

## Architecture (Phase 1)

```
app/api/*           Route handlers (thin — delegate to lib/data)
lib/types.ts        Normalized domain types (the contract)
lib/api-football.ts Primary provider client  ─┐
lib/espn.ts         Fallback provider client  ─┤→ lib/data.ts (orchestrator:
lib/cache.ts        In-memory TTL cache        ┘   source selection + caching)
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
- [ ] **Phase 2 — Analysis Engine** (Claude tactical breakdowns, previews, Q&A)
- [ ] **Phase 3 — Computer Vision** (screenshot → formation analysis, FastAPI)
- [ ] **Phase 4 — Shareable Cards** (`@vercel/og` match report cards)
- [ ] **Phase 5 — Public Web App** (full UI, rate limiting, deploy)

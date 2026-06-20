# Deploy

The **Next.js app** (Vercel) is the whole production deployment. The computer-
vision feature runs **in-process** by default — `/api/vision/analyze` calls
Claude vision directly (`lib/vision.ts`), so no second service is required.

```
 Browser ──► Vercel (Next.js) ──► Anthropic / API-Football / ESPN
                                   (vision in-process via lib/vision.ts)
```

The standalone FastAPI service in `cv-service/` remains as an optional external
worker: set `CV_SERVICE_URL` (+ matching `CV_SHARED_SECRET`) and the route
forwards to it instead. Useful for local dev or a dedicated host. The Railway
config below applies only if you take that path.

## 1. (Optional) CV service → Railway

Only if you want the standalone FastAPI worker instead of in-process vision.
Root directory: `cv-service/` (Nixpacks builds from `requirements.txt`,
`.python-version`, and `Procfile`).

Environment variables on the Railway service:

| Var | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `CV_SHARED_SECRET` | a random secret (shared with Vercel) |
| `CV_ALLOWED_ORIGINS` | the Vercel production URL, e.g. `https://worldcup.vercel.app` |

Start command (also in `Procfile` / `railway.json`):
`uvicorn main:app --host 0.0.0.0 --port $PORT`

Health check: `GET https://<railway-url>/health`.

## 2. Next.js app → Vercel

Environment variables on the Vercel project (Production):

| Var | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `API_FOOTBALL_KEY` | your API-Football key (optional — ESPN fallback works without) |
| `CV_SERVICE_URL` | the Railway service URL, e.g. `https://worldcup-cv.up.railway.app` |
| `CV_SHARED_SECRET` | the same secret set on Railway |
| `NEXT_PUBLIC_SITE_URL` | the Vercel production URL (for correct OG image URLs) |
| `ADMIN_TOKEN` | a random secret gating the analysis `?force=1` cache bypass |

## 3. Secrets

`CV_SHARED_SECRET` and `ADMIN_TOKEN` are values you choose (any random string,
e.g. `openssl rand -hex 24`). The two keys come from:
- Anthropic: <https://console.anthropic.com> → API Keys
- API-Football: <https://dashboard.api-football.com> → Profile

Never commit real keys — `.env*` is gitignored; `.env.example` is the template.

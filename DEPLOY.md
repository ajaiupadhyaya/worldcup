# Deploy

Two services: the **Next.js app** on Vercel and the **CV microservice** on
Railway. They talk over HTTPS, authenticated by a shared secret.

```
 Browser ──► Vercel (Next.js)  ──► Railway (FastAPI CV)
                │  X-CV-Token         │
                └─► Anthropic / API-Football / ESPN
```

## 1. CV service → Railway

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

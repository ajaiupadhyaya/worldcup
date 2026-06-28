# Deploy

The **Next.js app** (Vercel) is the whole production deployment. Tactical
analysis runs in-process through the free deterministic engine in
`lib/free-analysis.ts`, so no paid LLM key is required.

```
 Browser ──► Vercel (Next.js) ──► ESPN / optional API-Football free tier
                                   (free analysis in-process)
```

If you later add your own external frame-analysis service, set `CV_SERVICE_URL`
(+ matching `CV_SHARED_SECRET`) and the route forwards uploaded frames to it.
If it is unset, `/api/vision/analyze` returns an auditable tactical checklist
grounded in match context.

## 1. Next.js app → Vercel

Environment variables on the Vercel project (Production):

| Var | Value |
| --- | --- |
| `API_FOOTBALL_KEY` | optional API-Football free-tier key; ESPN fallback works without |
| `CV_SERVICE_URL` | the Railway service URL, e.g. `https://worldcup-cv.up.railway.app` |
| `CV_SHARED_SECRET` | the same secret set on Railway |
| `NEXT_PUBLIC_SITE_URL` | the Vercel production URL (for correct OG image URLs) |
| `ADMIN_TOKEN` | a random secret gating the analysis `?force=1` cache bypass |
| `UPSTASH_REDIS_REST_URL` | optional Upstash Redis REST URL for distributed cache + rate limits |
| `UPSTASH_REDIS_REST_TOKEN` | optional Upstash Redis REST token |

If the Upstash variables are omitted, Floodlit uses the built-in in-memory TTL
cache and per-instance rate limits. That is fine for local development; set
Upstash in production so serverless instances share freshness and abuse limits.

## 2. Secrets

`CV_SHARED_SECRET` and `ADMIN_TOKEN` are values you choose (any random string,
e.g. `openssl rand -hex 24`). The optional API-Football key comes from:
- API-Football: <https://dashboard.api-football.com> → Profile

Never commit real keys — `.env*` is gitignored; `.env.example` is the template.

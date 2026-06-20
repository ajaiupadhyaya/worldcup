# World Cup CV Service (Phase 3)

FastAPI microservice that turns a football broadcast screenshot into a
structured tactical read (formation, pressing shape, defensive line, width, key
patterns) plus a short Claude-written breakdown. Runs separately from the
Next.js app, which calls it via `CV_SERVICE_URL`.

## Run locally (uv)

```bash
cd cv-service
uv sync
ANTHROPIC_API_KEY=sk-ant-... uv run uvicorn main:app --reload --port 8000
```

Health check: `curl localhost:8000/health`

## Endpoint

```
POST /analyze-frame
  body: { image_base64: str, match_context?: str, media_type?: str }
  returns: {
    formation, defensive_shape, press_trigger,
    defensive_line, width, key_patterns[], full_analysis, cached
  }
```

- `image_base64` accepts a raw base64 string or a `data:` URL; media type is
  sniffed from magic bytes if not supplied. 8 MB decoded ceiling.
- Identical (image + context) pairs are cached and never re-analyzed — Claude
  Vision calls are expensive.
- Returns `503` until `ANTHROPIC_API_KEY` is set.

## Deploy (Railway)

`requirements.txt` is exported from `pyproject.toml` via `uv export` for
buildpack/Docker deploys:

```bash
uv export --no-hashes --no-dev -o requirements.txt
```

Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

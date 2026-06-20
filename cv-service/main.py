"""Computer-vision microservice (Phase 3).

A small FastAPI service that takes a football broadcast screenshot and returns a
structured tactical read (formation, pressing shape, line height, width, key
patterns) plus a short Claude-written breakdown.

Runs separately from the Next.js app; the app calls it via CV_SERVICE_URL.
Claude Vision calls are expensive, so identical images are cached and never
re-analyzed.

Run locally:
    uv run uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
from typing import Optional

import hmac

import anthropic
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

VISION_MODEL = "claude-sonnet-4-6"
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB decoded ceiling

app = FastAPI(title="World Cup CV Service", version="0.1.0")

# The Next.js app is the only intended caller. Default CORS to the local app
# origin (NOT "*") so a hostile site can't drive a victim's browser into this
# paid endpoint; override via CV_ALLOWED_ORIGINS in deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CV_ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Optional shared secret. When CV_SHARED_SECRET is set, every /analyze-frame
# call must present a matching X-CV-Token header (the Next.js proxy forwards it).
# Unset = open (dev convenience); set it in any networked deploy.
_SHARED_SECRET = os.environ.get("CV_SHARED_SECRET")


def _check_token(token: str | None) -> None:
    if not _SHARED_SECRET:
        return
    if not token or not hmac.compare_digest(token, _SHARED_SECRET):
        raise HTTPException(status_code=401, detail="invalid or missing X-CV-Token")

# In-process result cache keyed by image content hash. Swap for Redis if this
# service is ever horizontally scaled.
_cache: dict[str, "FrameAnalysis"] = {}


class AnalyzeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (data-URL prefix allowed)")
    match_context: Optional[str] = Field(None, description="Optional match context to ground the read")
    media_type: Optional[str] = Field(None, description="image/png | image/jpeg | image/webp")


class FrameAnalysis(BaseModel):
    formation: str
    defensive_shape: str
    press_trigger: str
    defensive_line: str  # "high line" | "mid" | "low block"
    width: str  # "narrow" | "wide" | "asymmetric"
    key_patterns: list[str]
    full_analysis: str
    cached: bool = False


# JSON schema Claude must conform to (structured outputs guarantee parseable JSON).
_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "formation": {"type": "string", "description": "Formation in possession, e.g. '4-3-3 in possession'"},
        "defensive_shape": {"type": "string", "description": "Shape out of possession, e.g. '4-4-2 mid-block'"},
        "press_trigger": {"type": "string", "description": "What triggers their press"},
        "defensive_line": {"type": "string", "enum": ["high line", "mid", "low block"]},
        "width": {"type": "string", "enum": ["narrow", "wide", "asymmetric"]},
        "key_patterns": {"type": "array", "items": {"type": "string"}},
        "full_analysis": {"type": "string", "description": "200-300 word tactical breakdown"},
    },
    "required": [
        "formation",
        "defensive_shape",
        "press_trigger",
        "defensive_line",
        "width",
        "key_patterns",
        "full_analysis",
    ],
}

_VISION_PROMPT = """You are analyzing a football match broadcast screenshot. Identify:
1. Formation in possession and out of possession
2. Pressing triggers and defensive shape
3. Defensive line height
4. Width and spacing patterns
5. Any notable tactical patterns visible

Be specific and technical. Reference exact player positions visible.
If the image quality is insufficient for certain observations, say so.

Match context (if provided): {match_context}"""


def _has_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


_client: Optional[anthropic.Anthropic] = None


def _anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _normalize_image(image_base64: str, media_type: Optional[str]) -> tuple[str, str]:
    """Strip any data-URL prefix, validate base64, infer media type, enforce size."""
    raw = image_base64.strip()
    inferred = media_type
    if raw.startswith("data:"):
        header, _, data = raw.partition(",")
        raw = data
        if not inferred and ":" in header and ";" in header:
            inferred = header.split(":", 1)[1].split(";", 1)[0]
    try:
        decoded = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="image_base64 is not valid base64")
    if not decoded:
        raise HTTPException(status_code=400, detail="image_base64 is empty")
    if len(decoded) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image exceeds 8MB decoded limit")
    # Sniff a media type from magic bytes if still unknown.
    if not inferred:
        inferred = _sniff_media_type(decoded)
    if inferred not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
        raise HTTPException(status_code=415, detail=f"unsupported media type: {inferred}")
    return raw, inferred


def _sniff_media_type(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/jpeg"  # best-effort default


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "anthropic_key": _has_key(),
        "model": VISION_MODEL,
        "cache_size": len(_cache),
    }


@app.post("/analyze-frame", response_model=FrameAnalysis)
def analyze_frame(
    req: AnalyzeRequest,
    x_cv_token: str | None = Header(default=None),
) -> FrameAnalysis:
    _check_token(x_cv_token)
    if not _has_key():
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    raw_b64, media_type = _normalize_image(req.image_base64, req.media_type)

    # Cache key folds in the image bytes, the resolved media type, AND the
    # context (different media type or context -> different read).
    cache_key = hashlib.sha256(
        "\x00".join([raw_b64, media_type, req.match_context or ""]).encode("utf-8")
    ).hexdigest()
    if cache_key in _cache:
        cached = _cache[cache_key].model_copy(update={"cached": True})
        return cached

    prompt = _VISION_PROMPT.format(match_context=req.match_context or "none provided")

    try:
        message = _anthropic().messages.create(
            model=VISION_MODEL,
            max_tokens=1500,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": raw_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            output_config={"format": {"type": "json_schema", "schema": _ANALYSIS_SCHEMA}},
        )
    except anthropic.RateLimitError as exc:
        print(f"[cv] Claude rate-limited: {exc}")
        raise HTTPException(status_code=429, detail="Claude vision rate-limited; retry shortly") from exc
    except anthropic.APIStatusError as exc:
        print(f"[cv] Claude status error {exc.status_code}: {exc}")
        status = exc.status_code if exc.status_code and exc.status_code < 500 else 502
        raise HTTPException(status_code=status, detail="Claude vision error") from exc
    except anthropic.APIError as exc:  # connection/timeout/etc — don't leak details
        print(f"[cv] Claude unreachable: {exc}")
        raise HTTPException(status_code=502, detail="Claude vision unreachable") from exc

    text = "".join(b.text for b in message.content if b.type == "text").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Claude returned non-JSON output")

    analysis = FrameAnalysis(**parsed, cached=False)
    _cache[cache_key] = analysis
    return analysis

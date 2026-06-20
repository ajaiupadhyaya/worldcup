// Native Claude-vision frame analysis (the CV feature, in-process).
// Mirrors cv-service/main.py so the screenshot→tactics feature runs on Vercel
// without a separate Python service. The FastAPI service remains in the repo
// for local use / Railway deploy; this is the production path.

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_MODEL, hasAnthropicKey } from "./claude";

export { hasAnthropicKey };

export interface FrameAnalysis {
  formation: string;
  defensive_shape: string;
  press_trigger: string;
  defensive_line: string;
  width: string;
  key_patterns: string[];
  full_analysis: string;
  cached: boolean;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!hasAnthropicKey()) throw new Error("ANTHROPIC_API_KEY not configured");
  _client ??= new Anthropic();
  return _client;
}

// Claude Vision calls are expensive — cache identical (image + context) reads.
// Best-effort per server instance; not correctness-critical.
const _cache = new Map<string, FrameAnalysis>();

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    formation: { type: "string", description: "Formation in possession, e.g. '4-3-3 in possession'" },
    defensive_shape: { type: "string", description: "Shape out of possession, e.g. '4-4-2 mid-block'" },
    press_trigger: { type: "string", description: "What triggers their press" },
    defensive_line: { type: "string", enum: ["high line", "mid", "low block"] },
    width: { type: "string", enum: ["narrow", "wide", "asymmetric"] },
    key_patterns: { type: "array", items: { type: "string" } },
    full_analysis: { type: "string", description: "200-300 word tactical breakdown" },
  },
  required: ["formation", "defensive_shape", "press_trigger", "defensive_line", "width", "key_patterns", "full_analysis"],
} as const;

function visionPrompt(matchContext?: string): string {
  return `You are analyzing a football match broadcast screenshot. Identify:
1. Formation in possession and out of possession
2. Pressing triggers and defensive shape
3. Defensive line height
4. Width and spacing patterns
5. Any notable tactical patterns visible

Be specific and technical. Reference exact player positions visible.
If the image quality is insufficient for certain observations, say so.

Match context (if provided): ${matchContext || "none provided"}`;
}

type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** Analyze a base64 frame, returning a structured tactical read. */
export async function analyzeFrame(
  imageBase64: string,
  mediaType: MediaType,
  matchContext?: string,
): Promise<FrameAnalysis> {
  const key = createHash("sha256")
    .update(`${imageBase64}\x00${mediaType}\x00${matchContext ?? ""}`)
    .digest("hex");
  const hit = _cache.get(key);
  if (hit) return { ...hit, cached: true };

  // Stream so a large image + structured output doesn't risk a request timeout.
  const stream = client().messages.stream({
    model: ANALYSIS_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: visionPrompt(matchContext) },
        ],
      },
    ],
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this frame.");
  }
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let parsed: Omit<FrameAnalysis, "cached">;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Claude returned non-JSON vision output.");
  }
  const result: FrameAnalysis = { ...parsed, cached: false };
  _cache.set(key, result);
  return result;
}

"use client";

import { useState } from "react";

interface CVResult {
  formation: string;
  defensive_shape: string;
  press_trigger: string;
  defensive_line: string;
  width: string;
  key_patterns: string[];
  full_analysis: string;
  cached?: boolean;
}

// Upload a broadcast screenshot; the CV microservice (Claude vision) returns a
// structured tactical read of the frozen frame.
export function CVUpload({ matchId }: { matchId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("image", file);
    form.append("matchId", matchId);
    try {
      const res = await fetch("/api/vision/analyze", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(
          res.status === 503
            ? "Vision analysis needs an ANTHROPIC_API_KEY."
            : json.error || "Analysis failed — try a clearer broadcast frame.",
        );
      } else {
        setResult(json);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="art-panel p-5">
      <h2 className="mb-2 border-l-2 border-accent pl-3 font-display text-2xl text-text">Freeze the frame</h2>
      <p className="mb-4 max-w-prose text-sm text-muted">
        Drop a broadcast screenshot and Claude reads the shape off the pitch —
        formation, press triggers, line height, width.
      </p>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0]);
        }}
        className="slash-field flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 border border-border bg-bg/45 p-6 text-center transition-colors hover:border-home"
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="frame to analyze" className="max-h-56 border border-border" />
        ) : (
          <>
            <span className="font-mono text-xs uppercase tracking-widest text-muted">
              drop screenshot · or click
            </span>
            <span className="text-[11px] text-muted">PNG / JPG / WebP, up to 8MB</span>
          </>
        )}
      </label>

      {file && (
        <button
          onClick={analyze}
          disabled={loading}
          className="mt-3 border border-accent px-4 py-2 font-mono text-xs uppercase tracking-widest text-bg disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {loading ? "reading the pitch…" : "Analyze frame"}
        </button>
      )}

      {error && <p className="mt-3 font-mono text-xs text-danger/90">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Formation", result.formation],
              ["Out of possession", result.defensive_shape],
              ["Line", result.defensive_line],
              ["Width", result.width],
              ["Press trigger", result.press_trigger],
            ].map(([k, v]) => (
              <div key={k} className="border border-border bg-bg/45 p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{k}</div>
                <div className="mt-0.5 text-[13px] text-text">{v}</div>
              </div>
            ))}
          </div>
          {result.key_patterns?.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {result.key_patterns.map((p, i) => (
                <li key={i} className="border border-home/40 px-2.5 py-1 text-[11px] text-home">
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="max-w-[64ch] whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">
            {result.full_analysis}
          </p>
        </div>
      )}
    </section>
  );
}

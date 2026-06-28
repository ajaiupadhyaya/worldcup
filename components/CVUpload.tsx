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
            ? "Frame analysis is unavailable."
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
    <section className="border border-[var(--border)] p-5">
      <h2 className="mb-2 font-heading text-2xl font-semibold text-[var(--foreground)]">Freeze the frame</h2>
      <p className="mb-4 max-w-prose text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">
        Drop a broadcast screenshot and get a free tactical frame checklist — formation context, press
        triggers, line height, width.
      </p>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0]);
        }}
        className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 border border-[var(--border)] bg-[var(--row-alt)] p-6 text-center transition-colors hover:border-[var(--border-strong)]"
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="frame to analyze" className="max-h-56 border border-[var(--border)]" />
        ) : (
          <>
            <span className="text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
              DROP SCREENSHOT · OR CLICK
            </span>
            <span className="text-[11px] text-[var(--foreground-secondary)]">PNG / JPG / WebP, up to 8MB</span>
          </>
        )}
      </label>

      {file && (
        <button
          onClick={analyze}
          disabled={loading}
          className="mt-3 border border-[var(--border-strong)] bg-[var(--foreground-accent)] px-4 py-2 text-[10px] tracking-[2px] text-[var(--foreground-inverse)] disabled:opacity-50"
        >
          {loading ? "READING THE PITCH…" : "ANALYZE FRAME"}
        </button>
      )}

      {error && <p className="mt-3 text-xs text-[var(--foreground-accent)]">{error}</p>}

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
              <div key={k} className="border border-[var(--border)] bg-[var(--row-alt)] p-2.5">
                <div className="text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">{k}</div>
                <div className="mt-0.5 text-[13px] text-[var(--foreground)]">{v}</div>
              </div>
            ))}
          </div>
          {result.key_patterns?.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {result.key_patterns.map((p, i) => (
                <li key={i} className="border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]">
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="max-w-[64ch] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--foreground-secondary)]">
            {result.full_analysis}
          </p>
        </div>
      )}
    </section>
  );
}

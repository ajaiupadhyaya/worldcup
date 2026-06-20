"use client";

import { useState } from "react";

// Share the auto-generated match report card. Uses the native share sheet on
// mobile, falls back to copying the card URL.
export function ShareButton({ matchId }: { matchId: string }) {
  const [copied, setCopied] = useState(false);
  const cardUrl = `/api/og/match/${matchId}`;

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "World Cup tactical report", url });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Last resort: open the shareable page (not the raw OG image) so the user
      // can copy the URL from the address bar.
      window.open(url, "_blank");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={share}
        className="rounded-[var(--radius-card)] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:border-home hover:text-text"
      >
        {copied ? "link copied" : "Share report"}
      </button>
      <a
        href={cardUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-[var(--radius-card)] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted transition-colors hover:border-home hover:text-text"
      >
        View card
      </a>
    </div>
  );
}

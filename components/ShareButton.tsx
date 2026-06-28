"use client";

import { useState } from "react";

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
        // user cancelled
      }
    }
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={share}
        className="border border-[var(--border-strong)] px-3 py-1.5 text-[10px] tracking-[2px] text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--row-alt)]"
      >
        {copied ? "LINK COPIED" : "SHARE REPORT"}
      </button>
      <a
        href={cardUrl}
        target="_blank"
        rel="noreferrer"
        className="border border-[var(--border)] px-3 py-1.5 text-[10px] tracking-[2px] text-[var(--foreground-secondary)] transition-colors hover:border-[var(--border-strong)]"
      >
        VIEW CARD
      </a>
    </div>
  );
}

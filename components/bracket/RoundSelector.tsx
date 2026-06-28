"use client";

import { ROUND_ORDER, ROUND_LABELS } from "@/lib/bracketView";

export function RoundSelector({
  index,
  onChange,
}: {
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Knockout round"
      className="sticky top-[60px] z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-2 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ROUND_ORDER.map((round, i) => {
        const active = i === index;
        return (
          <button
            key={round}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(i)}
            className={`shrink-0 px-3 py-1 text-[10px] tracking-[0.2em] transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--foreground-accent)] ${
              active
                ? "bg-[var(--foreground)] text-[var(--foreground-inverse)]"
                : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            {ROUND_LABELS[round].toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

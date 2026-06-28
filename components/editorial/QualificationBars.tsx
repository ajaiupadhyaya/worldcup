"use client";

import { useEffect, useRef, useState } from "react";
import { formatProb } from "@/lib/probability";
import { slugifyTeam } from "@/lib/predictions";

export function QualificationBars({
  teams,
  projected,
}: {
  teams: { name: string; rank: number }[];
  projected: Record<string, number>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && (setInView(true), io.disconnect()),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-[1480px] px-6 py-12 sm:px-12 lg:px-20">
      <div className="section-rule mb-8 flex items-baseline justify-between pt-5">
        <h2 className="section-label">Round of 32 — Qualification Probability</h2>
        <span className="kicker hidden sm:inline">Model-projected</span>
      </div>
      <div ref={ref}>
        {teams.map((team, i) => {
          const prob = projected[slugifyTeam(team.name)] ?? 0;
          const topTwo = team.rank <= 2;
          const fillColor = topTwo ? "var(--foreground-accent)" : "var(--foreground)";
          const textColor = topTwo ? "text-[var(--foreground-accent)]" : "text-[var(--foreground)]";

          return (
            <div
              key={team.name}
              className="group flex items-center gap-4 border-b border-[var(--border)] py-4"
            >
              <span className="w-5 shrink-0 text-[10px] tabular-nums text-[var(--foreground-faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="w-32 shrink-0 font-heading text-[clamp(14px,1.5vw,18px)] font-semibold tracking-[-0.01em] text-[var(--foreground)] sm:w-44">
                {team.name.toUpperCase()}
              </span>
              <div className="hidden h-[3px] flex-1 bg-[var(--row-alt)] sm:block">
                <div
                  className="h-full origin-left transition-[width] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: inView ? `${Math.min(prob * 100, 100)}%` : "0%",
                    background: fillColor,
                    transitionDelay: `${i * 70}ms`,
                  }}
                />
              </div>
              <span
                className={`w-16 text-right font-heading text-[clamp(16px,2vw,22px)] font-bold italic tabular-nums ${textColor}`}
              >
                {formatProb(prob)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

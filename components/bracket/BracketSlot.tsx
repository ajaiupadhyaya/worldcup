"use client";

import { useState } from "react";
import type { BracketMatch } from "@/lib/bracket";
import type { BracketSlotProb, PredTeam } from "@/lib/predictions";
import { formatProb } from "@/lib/probability";
import { ProbBar } from "@/components/predict/ProbBar";
import { collapsedFace, STAGE_BY_ROUND } from "@/lib/bracketView";

export type SlotState = "active" | "dim" | "idle";

export function BracketSlot({
  match,
  name,
  stdErrByTeam,
  selectedTeamId,
  onSelectTeam,
  state = "idle",
}: {
  match: BracketMatch;
  name: (id: string) => string;
  stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
  selectedTeamId?: string | null;
  onSelectTeam?: (id: string) => void;
  state?: SlotState;
}) {
  const [open, setOpen] = useState(false);
  const { top, bottom } = collapsedFace(match);
  const stage = STAGE_BY_ROUND[match.round];
  const stdErr = (id: string) => stdErrByTeam.get(id)?.[stage];

  return (
    <div
      className={`group border bg-[var(--paper-pure)] motion-safe:transition-opacity motion-safe:duration-300 ${
        state === "dim" ? "opacity-30" : "opacity-100"
      } ${
        state === "active"
          ? "border-[var(--foreground-accent)]"
          : "border-[var(--border)]"
      }`}
      data-slot={match.slot}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      {/* Collapsed face: most-likely team per side + advance % */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${name(top.entry?.id ?? "")} vs ${name(bottom.entry?.id ?? "")} — show full distribution`}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}
        className="block w-full text-left"
      >
        <CollapsedSide
          entry={top.entry}
          advancing={top.advancing}
          winProb={top.winProb}
          name={name}
          selectedTeamId={selectedTeamId}
        />
        <div className="h-px bg-[var(--border)]" />
        <CollapsedSide
          entry={bottom.entry}
          advancing={bottom.advancing}
          winProb={bottom.winProb}
          name={name}
          selectedTeamId={selectedTeamId}
        />
      </button>

      {/* Revealed: full per-side distributions + who advances */}
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-3">
          <DistList
            label="Top side"
            dist={match.sides[0]}
            name={name}
            stdErr={stdErr}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
          />
          <DistList
            label="Bottom side"
            dist={match.sides[1]}
            name={name}
            stdErr={stdErr}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
          />
          <DistList
            label="Advances"
            dist={match.winner}
            name={name}
            stdErr={stdErr}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
            accent
          />
        </div>
      )}
    </div>
  );
}

function CollapsedSide({
  entry,
  advancing,
  winProb,
  name,
  selectedTeamId,
}: {
  entry: BracketSlotProb | null;
  advancing: boolean;
  /** P(this side's team wins the match) — shown on both sides, same axis. */
  winProb: number;
  name: (id: string) => string;
  selectedTeamId?: string | null;
}) {
  const selected = !!entry && entry.id === selectedTeamId;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 border-l-2 ${
        selected
          ? "border-[var(--foreground-accent)] bg-[var(--row-alt)]"
          : advancing
            ? "border-[var(--foreground-accent)]"
            : "border-transparent"
      }`}
    >
      <span
        className={`truncate font-heading text-[13px] font-semibold tracking-[-0.01em] ${
          selected || advancing
            ? "text-[var(--foreground)]"
            : "text-[var(--foreground-secondary)]"
        }`}
      >
        {entry ? name(entry.id).toUpperCase() : "—"}
      </span>
      <span
        className={`shrink-0 text-[11px] tabular-nums ${
          advancing
            ? "text-[var(--foreground-accent)]"
            : "text-[var(--foreground-faint)]"
        }`}
      >
        {entry ? formatProb(winProb) : ""}
      </span>
    </div>
  );
}

function DistList({
  label,
  dist,
  name,
  stdErr,
  selectedTeamId,
  onSelectTeam,
  accent = false,
}: {
  label: string;
  dist: BracketSlotProb[];
  name: (id: string) => string;
  stdErr: (id: string) => number | undefined;
  selectedTeamId?: string | null;
  onSelectTeam?: (id: string) => void;
  accent?: boolean;
}) {
  if (!dist || dist.length === 0) return null;
  const max = Math.max(...dist.map((d) => d.prob), 0.0001);
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">
        {label.toUpperCase()}
      </div>
      <div className="flex flex-col gap-1">
        {dist.map((e) => {
          const selected = e.id === selectedTeamId;
          const se = stdErr(e.id);
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectTeam?.(e.id)}
              className={`group/row flex items-center gap-2 px-1 py-0.5 text-left ${
                selected ? "bg-[var(--row-alt)]" : "hover:bg-[var(--row-alt)]"
              }`}
            >
              <span className="w-24 shrink-0 truncate text-[12px] text-[var(--foreground)]">
                {name(e.id)}
              </span>
              <span className="relative flex-1">
                <ProbBar
                  value={e.prob / max}
                  color={
                    accent || selected
                      ? "var(--foreground-accent)"
                      : "var(--foreground)"
                  }
                  label={`${name(e.id)}: ${formatProb(e.prob)}`}
                />
                {/* mcStdErr whisker: ± standard error rendered over the bar */}
                {se != null && se > 0 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 border-x border-[var(--foreground-secondary)]"
                    style={{
                      left: `${Math.max(0, (e.prob - se) / max) * 100}%`,
                      width: `${Math.min(1, (2 * se) / max) * 100}%`,
                    }}
                  />
                )}
              </span>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--foreground-secondary)]">
                {formatProb(e.prob)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

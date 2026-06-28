"use client";

import { useMemo } from "react";
import type { BracketTree, BracketMatch, BracketColumn } from "@/lib/bracket";
import type { PredTeam } from "@/lib/predictions";
import { ROUND_LABELS, prettifyId } from "@/lib/bracketView";
import { BracketSlot } from "@/components/bracket/BracketSlot";

// ---------------------------------------------------------------------------
// Public interface — intentionally narrow for UV1.
// UV2 adds `selectedTeam?: string` (path-trace) and swaps SlotCard for
// <BracketSlot>. UV3 adds SVG connector props. UV4 adds mobile scroll state.
// ---------------------------------------------------------------------------
export interface BracketBoardProps {
  tree: BracketTree;
  teams: PredTeam[];
  generatedAt: string;
}

export function BracketBoard({ tree, teams, generatedAt }: BracketBoardProps) {
  const nameById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name] as const)),
    [teams],
  );
  const stdErrByTeam = useMemo(
    () => new Map(teams.map((t) => [t.id, t.mcStdErr] as const)),
    [teams],
  );
  const name = (id: string) => nameById.get(id) ?? prettifyId(id);

  return (
    <div className="pb-16">
      <BoardHeader generatedAt={generatedAt} />
      <DesktopBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
      <MobileBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header: editorial masthead + dateline + uncertainty disclaimer
// ---------------------------------------------------------------------------
function BoardHeader({ generatedAt }: { generatedAt: string }) {
  return (
    <header className="overflow-hidden px-6 pt-8 sm:px-12">
      <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">
        THE DRAW
      </h1>
      <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
        ROUND OF 32 → FINAL · MONTE-CARLO PROJECTION
      </p>
      <p className="mt-1 text-[10px] tracking-[2px] text-[var(--foreground-faint)]">
        AS OF {generatedAt}
      </p>
      <p className="mt-2 max-w-[520px] text-[11px] leading-[1.7] text-[var(--foreground-secondary)]">
        Projections are probabilistic — every percentage reflects simulated
        frequency, not certainty. Results will differ.
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Desktop layout: rounds as horizontal columns (connectors land in UV3)
// ---------------------------------------------------------------------------
function DesktopBoard({
  tree,
  name,
  stdErrByTeam,
}: {
  tree: BracketTree;
  name: (id: string) => string;
  stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
}) {
  return (
    <div className="hidden overflow-x-auto px-6 pt-8 sm:px-12 lg:block">
      {/* data-bracket-desktop is a hook point for UV3 SVG connector overlay */}
      <div className="mx-auto flex min-w-[1100px] max-w-[1480px]" data-bracket-desktop>
        {tree.columns.map((col) => (
          <RoundColumn key={col.round} col={col} name={name} stdErrByTeam={stdErrByTeam} />
        ))}
      </div>
    </div>
  );
}

function RoundColumn({
  col,
  name,
  stdErrByTeam,
}: {
  col: BracketColumn;
  name: (id: string) => string;
  stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <RoundHeading round={col.round} />
      {/* data-round is a hook for UV3 path-trace highlights */}
      <div
        className="flex flex-1 flex-col justify-around gap-3 py-4"
        data-round={col.round}
      >
        {col.matches.map((m) => (
          <BracketSlot key={m.slot} match={m} name={name} stdErrByTeam={stdErrByTeam} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile layout: rounds stacked (round selector + scroll-snap land in UV4)
// ---------------------------------------------------------------------------
function MobileBoard({
  tree,
  name,
  stdErrByTeam,
}: {
  tree: BracketTree;
  name: (id: string) => string;
  stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
}) {
  return (
    <div className="px-6 pt-8 lg:hidden">
      {tree.columns.map((col) => (
        <section key={col.round} className="mb-8">
          <RoundHeading round={col.round} />
          <div className="mt-3 flex flex-col gap-3">
            {col.matches.map((m) => (
              <BracketSlot key={m.slot} match={m} name={name} stdErrByTeam={stdErrByTeam} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Round heading (shared by desktop + mobile)
// ---------------------------------------------------------------------------
function RoundHeading({ round }: { round: BracketMatch["round"] }) {
  return (
    <div className="section-rule-light flex items-baseline justify-between pb-1 pt-2">
      <span className="section-label">{ROUND_LABELS[round]}</span>
      <span className="text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">{round}</span>
    </div>
  );
}


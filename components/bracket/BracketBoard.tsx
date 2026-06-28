"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BracketTree, BracketMatch } from "@/lib/bracket";
import type { PredTeam } from "@/lib/predictions";
import {
  ROUND_ORDER,
  ROUND_LABELS,
  prettifyId,
  computeLayout,
  slotState,
  clampRoundIndex,
} from "@/lib/bracketView";
import { BracketSlot } from "@/components/bracket/BracketSlot";
import { ChampionPanel } from "@/components/bracket/ChampionPanel";
import { TeamPathProvider, useTeamPath } from "@/components/bracket/TeamPathProvider";
import { RoundSelector } from "@/components/bracket/RoundSelector";

// Desktop canvas geometry (deterministic from computeLayout).
const ROW_H = 80;   // px per logical row unit
const COL_W = 260;  // px between column left-edges
const SLOT_W = 224; // px wide for each slot card
const SLOT_H = 64;  // px tall (for vertical centering within row)

export function BracketBoard({
  tree,
  teams,
}: {
  tree: BracketTree;
  teams: PredTeam[];
}) {
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
    <TeamPathProvider tree={tree}>
      <div className="pb-16">
        <BoardHeader generatedAt={tree.generatedAt} />
        <ChampionPanel champion={tree.champion} name={name} />
        <PathClearBanner name={name} />
        <DesktopBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
        <MobileBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
      </div>
    </TeamPathProvider>
  );
}

// ---------------------------------------------------------------------------
// Header: editorial masthead + AS OF dateline + uncertainty disclaimer
// ---------------------------------------------------------------------------
function BoardHeader({ generatedAt }: { generatedAt: string }) {
  const asOf = (() => {
    try {
      const d = new Date(generatedAt);
      return Number.isFinite(d.getTime()) ? d.toUTCString() : generatedAt;
    } catch {
      return generatedAt;
    }
  })();
  return (
    <header className="overflow-hidden px-6 pt-8 sm:px-12">
      <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">
        THE DRAW
      </h1>
      <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
        AS OF {asOf} · MONTE-CARLO PROJECTION
      </p>
      <p className="mt-2 max-w-prose text-[12px] leading-[1.8] text-[var(--foreground-faint)]">
        Every figure is a simulated frequency, not a certainty — sides and
        advance odds carry Monte-Carlo error (±1σ whiskers shown). Tap a team
        to trace its road through the bracket.
      </p>
      <p className="mt-1 text-[11px] tracking-[0.04em] text-[var(--foreground-faint)]">
        Keyboard: Tab to a team, Enter to trace, Enter again to clear.
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// "Viewing X's road — clear" affordance when a team is selected
// ---------------------------------------------------------------------------
function PathClearBanner({ name }: { name: (id: string) => string }) {
  const { selectedTeamId, selectTeam } = useTeamPath();
  if (!selectedTeamId) return null;
  return (
    <div className="mx-auto mt-4 flex max-w-[1480px] items-center gap-3 px-6 sm:px-12">
      <span className="text-[11px] tracking-[0.12em] text-[var(--foreground-accent)]">
        VIEWING {name(selectedTeamId).toUpperCase()}&apos;S ROAD
      </span>
      <button
        type="button"
        onClick={() => selectTeam(selectedTeamId)}
        className="border border-[var(--foreground-accent)] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[var(--foreground-accent)] hover:bg-[var(--foreground-accent)] hover:text-[var(--foreground-inverse)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--foreground-accent)] motion-safe:transition-colors"
        aria-label={`Clear road trace for ${name(selectedTeamId)}`}
      >
        CLEAR
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop: absolute-canvas layout + SVG connector elbows + path-trace
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
  const { tracedSlots, selectedTeamId, selectTeam } = useTeamPath();
  const layout = useMemo(() => computeLayout(tree), [tree]);
  const pos = useMemo(
    () => new Map(layout.map((n) => [n.slot, n])),
    [layout],
  );

  // Canvas dimensions
  const rows = Math.max(1, ...layout.map((n) => n.row + 1));
  const height = rows * ROW_H;
  const width = (ROUND_ORDER.length - 1) * COL_W + SLOT_W + 32;

  const cy = (row: number) => row * ROW_H + ROW_H / 2;
  const leftX = (col: number) => col * COL_W;
  const rightX = (col: number) => col * COL_W + SLOT_W;

  return (
    <div
      className="hidden overflow-x-auto px-6 pt-10 sm:px-12 lg:block"
      aria-label="Bracket canvas"
    >
      {/* Round headings row */}
      <div
        className="relative mx-auto flex"
        style={{ width, height: ROW_H }}
      >
        {ROUND_ORDER.map((round, col) => (
          <div
            key={round}
            className="absolute"
            style={{ left: leftX(col), width: SLOT_W }}
          >
            <RoundHeading round={round} />
          </div>
        ))}
      </div>

      {/* Absolute canvas for slots + SVG connectors */}
      <div
        className="relative mx-auto"
        style={{ width, height }}
      >
        {/* SVG connector elbows — behind slots */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          aria-hidden
        >
          {layout.flatMap((n) => {
            if (!n.feeders) return [];
            return n.feeders.map((f) => {
              const fn = pos.get(f);
              if (!fn) return null;
              const x1 = rightX(fn.col);
              const y1 = cy(fn.row);
              const x2 = leftX(n.col);
              const y2 = cy(n.row);
              const midX = (x1 + x2) / 2;
              const active =
                !!tracedSlots &&
                tracedSlots.has(n.slot) &&
                tracedSlots.has(f);
              return (
                <path
                  key={`${f}->${n.slot}`}
                  d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                  fill="none"
                  stroke={
                    active
                      ? "var(--foreground-accent)"
                      : "var(--border)"
                  }
                  strokeWidth={active ? 2 : 1}
                  className="motion-safe:transition-[stroke,stroke-width] motion-safe:duration-300"
                />
              );
            });
          })}
        </svg>

        {/* Slot cards */}
        {layout.map((n) => {
          const match = tree.bySlot[n.slot];
          return (
            <div
              key={n.slot}
              className="absolute"
              style={{
                left: leftX(n.col),
                top: n.row * ROW_H + (ROW_H - SLOT_H) / 2,
                width: SLOT_W,
              }}
            >
              <BracketSlot
                match={match}
                name={name}
                stdErrByTeam={stdErrByTeam}
                selectedTeamId={selectedTeamId}
                onSelectTeam={selectTeam}
                state={slotState(n.slot, tracedSlots)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile: one round per screen, horizontal scroll-snap + tab selector (UV4)
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
  const { tracedSlots, selectedTeamId, selectTeam } = useTeamPath();
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Drive the scroller from the tab selection.
  const goTo = (i: number) => {
    const next = clampRoundIndex(i);
    setIndex(next);
    const el = scrollerRef.current;
    const page = el?.children[next] as HTMLElement | undefined;
    page?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  // Keep the selector in sync when the user swipes the scroller.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = clampRoundIndex(Math.round(el.scrollLeft / el.clientWidth));
      setIndex((prev) => (prev === i ? prev : i));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="px-6 pt-6 lg:hidden">
      <RoundSelector index={index} onChange={goTo} />
      <div
        ref={scrollerRef}
        className="mt-4 flex snap-x snap-mandatory overflow-x-auto motion-reduce:overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ROUND_ORDER.map((round) => (
          <section
            key={round}
            className="w-full shrink-0 snap-start pr-2"
            aria-label={ROUND_LABELS[round]}
          >
            <RoundHeading round={round} />
            <div className="mt-3 flex flex-col gap-3">
              {tree.rounds[round].map((m) => (
                <BracketSlot
                  key={m.slot}
                  match={m}
                  name={name}
                  stdErrByTeam={stdErrByTeam}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={selectTeam}
                  state={slotState(m.slot, tracedSlots)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {selectedTeamId && (
        <button
          type="button"
          onClick={() => selectTeam(selectedTeamId)}
          className="mt-4 w-full border border-[var(--foreground-accent)] px-3 py-2 text-[11px] tracking-[0.2em] text-[var(--foreground-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--foreground-accent)]"
        >
          CLEAR {name(selectedTeamId).toUpperCase()}&apos;S ROAD
        </button>
      )}
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
      <span className="text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">
        {round}
      </span>
    </div>
  );
}

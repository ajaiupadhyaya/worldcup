import type { Metadata } from "next";
import { predictions, topology } from "@/lib/predictions";
import { buildBracketTree } from "@/lib/bracket";
import { BracketBoard } from "@/components/bracket/BracketBoard";

export function generateMetadata(): Metadata {
  const title = "THE DRAW — World Cup MMXXVI";
  const description =
    "The full Round of 32 → Final knockout bracket, projected by Monte-Carlo. Trace any team's road to the trophy.";
  return {
    title,
    description,
    openGraph: { title, description, images: ["/api/og/bracket"] },
    twitter: { card: "summary_large_image", title, description, images: ["/api/og/bracket"] },
  };
}

export default function BracketPage() {
  const bracket = predictions.bracket;

  // Graceful empty state: bracket not yet emitted by the model cron
  if (!Array.isArray(bracket) || bracket.length === 0) {
    return <BracketEmpty />;
  }

  const tree = buildBracketTree(bracket, topology, predictions.generatedAt);
  return (
    <BracketBoard
      tree={tree}
      teams={predictions.teams}
    />
  );
}

function BracketEmpty() {
  return (
    <div className="px-6 pt-8 sm:px-12">
      <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">
        THE DRAW
      </h1>
      <div className="mt-10 max-w-prose border border-[var(--border)] bg-[var(--paper-pure)] p-6">
        <p className="section-label">Not yet drawn</p>
        <p className="mt-3 text-[14px] leading-[1.9] text-[var(--foreground-secondary)]">
          The knockout bracket appears once the model emits per-slot
          distributions for the Round of 32 onward. Check back after the next
          snapshot.
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getMatch } from "@/lib/data";
import { MatchDetail } from "@/components/MatchDetail";

// Per-match metadata so a shared link unfurls with the auto-generated OG report
// card and a real title. Best-effort — falls back to a generic title.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { data: m } = await getMatch(id);
    const title = `${m.homeTeam.name} ${m.status === "scheduled" ? "vs" : `${m.score.home}–${m.score.away}`} ${m.awayTeam.name} — World Cup MMXXVI`;
    const description =
      m.status === "finished"
        ? `Full tactical breakdown of ${m.homeTeam.name} vs ${m.awayTeam.name}.`
        : `Live stats, formations, and tactical analysis for ${m.homeTeam.name} vs ${m.awayTeam.name}.`;
    const og = `/api/og/match/${id}`;
    return {
      title,
      description,
      openGraph: { title, description, images: [{ url: og, width: 1200, height: 630 }] },
      twitter: { card: "summary_large_image", title, description, images: [og] },
    };
  } catch {
    return { title: "Match — World Cup MMXXVI" };
  }
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetail id={id} />;
}

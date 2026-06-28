import { ImageResponse } from "next/og";
import { getMatch } from "@/lib/data";
import { peekVerdict } from "@/lib/analysis";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

// A premium 1200x630 match report card. Doubles as the OpenGraph image when a
// match URL is shared on Twitter/Discord. Renders purely from data + any
// already-cached free-engine verdict — never triggers external generation.

const W = 1200;
const H = 630;

function statRow(label: string, home: number, away: number, suffix = "") {
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  return { label, home: `${home}${suffix}`, away: `${away}${suffix}`, homePct };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let match: Match;
  try {
    ({ data: match } = await getMatch(id));
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#09090b",
            color: "#a1a1aa",
            fontSize: 40,
          }}
        >
          Match not found
        </div>
      ),
      { width: W, height: H },
    );
  }

  const s = match.stats;
  const xg = s && (s.xG.home || s.xG.away) ? statRow("xG", s.xG.home, s.xG.away) : null;
  const stats = s
    ? [
        statRow("Possession", s.possession.home, s.possession.away, "%"),
        statRow("Shots on target", s.shotsOnTarget.home, s.shotsOnTarget.away),
        statRow("Corners", s.corners?.home ?? 0, s.corners?.away ?? 0),
      ]
    : [];
  const verdict = await peekVerdict(id);
  const accent = "#10b981";

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          padding: "48px 56px",
          background: "linear-gradient(150deg, #0a0a0f 0%, #0f1117 55%, #131a16 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: accent }} />
            <div style={{ fontSize: 22, letterSpacing: 4, color: "#71717a", fontWeight: 700 }}>
              FIFA WORLD CUP 2026
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: match.status === "live" ? accent : "#52525b",
              fontWeight: 700,
            }}
          >
            {match.status === "live" ? `LIVE ${match.minute ?? ""}'` : match.status}
          </div>
        </div>

        {/* Scoreline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 36,
          }}
        >
          <TeamBlock name={match.homeTeam.shortName || match.homeTeam.name} flag={match.homeTeam.flag} align="flex-start" />
          <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 96, fontWeight: 800 }}>
            <span>{match.score.home}</span>
            <span style={{ color: "#3f3f46", fontSize: 64 }}>–</span>
            <span>{match.score.away}</span>
          </div>
          <TeamBlock name={match.awayTeam.shortName || match.awayTeam.name} flag={match.awayTeam.flag} align="flex-end" />
        </div>

        {/* xG bar */}
        {xg && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#a1a1aa" }}>
              <span>{xg.home} xG</span>
              <span style={{ letterSpacing: 2, fontSize: 16 }}>EXPECTED GOALS</span>
              <span>{xg.away} xG</span>
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#27272a" }}>
              <div style={{ width: `${xg.homePct}%`, background: accent }} />
              <div style={{ width: `${100 - xg.homePct}%`, background: "#6366f1" }} />
            </div>
          </div>
        )}

        {/* Key stats */}
        <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
          {stats.map((st) => (
            <div
              key={st.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "16px 20px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: 15, letterSpacing: 2, color: "#71717a", textTransform: "uppercase" }}>
                {st.label}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 30, fontWeight: 700 }}>
                <span>{st.home}</span>
                <span style={{ color: "#52525b" }}>{st.away}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Free-engine verdict */}
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {verdict && (
              <div style={{ display: "flex", fontSize: 22, fontStyle: "italic", color: "#d4d4d8", lineHeight: 1.35 }}>
                “{verdict}”
              </div>
            )}
            <div style={{ display: "flex", fontSize: 15, color: "#52525b", marginTop: 10, letterSpacing: 1 }}>
              {verdict ? "— tactical verdict · World Cup MMXXVI" : "World Cup Intelligence"}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}

function TeamBlock({ name, flag, align }: { name: string; flag: string; align: "flex-start" | "flex-end" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 12, width: 280 }}>
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} width={84} height={84} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <div style={{ width: 84, height: 84, borderRadius: 12, background: "#27272a" }} />
      )}
      <div style={{ fontSize: 38, fontWeight: 800 }}>{name}</div>
    </div>
  );
}

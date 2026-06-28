import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { predictions, formatProb } from "@/lib/predictions";
import { bracketOgData } from "@/lib/og";

export const dynamic = "force-dynamic";

// 1200x630 share card for THE DRAW: the projected champion + the top-4
// title-odds ladder, in the editorial palette. The champion is the single
// source of truth winCup distribution (== the M104 winner). satori cannot read
// the CSS @import font, so static Bodoni Moda .ttf weights are shipped in
// /public and loaded here via readFile(join(process.cwd(), ...)).

const W = 1200;
const H = 630;
const PAPER = "#f4f3f0";
const INK = "#131318";
const MUTED = "#6b6b73";
const VERMILION = "#ed3419";

export async function GET() {
  const [bodoni, bodoniBold] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/BodoniModa-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/BodoniModa-Bold.ttf")),
  ]);

  const { champion, ladder } = bracketOgData(predictions.teams);
  const lead = champion?.prob || 1;

  const generated = new Date(predictions.generatedAt);
  const asOf = Number.isFinite(generated.getTime())
    ? generated
        .toLocaleDateString("en-GB", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase()
    : "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: PAPER,
          color: INK,
          fontFamily: "Bodoni Moda",
        }}
      >
        {/* Masthead */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 3, width: "100%", background: VERMILION }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 18,
            }}
          >
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, fontWeight: 700 }}>
              FIFA WORLD CUP 26
            </div>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, color: MUTED }}>
              THE DRAW · KNOCKOUT FORECAST
            </div>
          </div>
        </div>

        {/* Projected champion */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, color: MUTED, fontWeight: 700 }}>
            PROJECTED CHAMPION
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 6 }}>
            <div style={{ display: "flex", fontSize: 124, lineHeight: 1, fontWeight: 700, color: VERMILION }}>
              {champion ? champion.name.toUpperCase() : "TO BE DECIDED"}
            </div>
            {champion ? (
              <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: INK }}>
                {formatProb(champion.prob)}
              </div>
            ) : null}
          </div>
        </div>

        {/* Title-odds ladder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ladder.map((row, i) => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  display: "flex",
                  width: 40,
                  fontSize: 26,
                  fontWeight: 700,
                  color: i === 0 ? VERMILION : "#9a9aa2",
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: "flex", width: 360, fontSize: 34, fontWeight: i === 0 ? 700 : 400 }}>
                {row.name}
              </div>
              <div style={{ display: "flex", flex: 1, height: 16, background: "rgba(19,19,24,0.08)" }}>
                <div
                  style={{
                    display: "flex",
                    width: `${Math.max(4, (row.prob / lead) * 100)}%`,
                    background: i === 0 ? VERMILION : INK,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  width: 92,
                  justifyContent: "flex-end",
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {formatProb(row.prob)}
              </div>
            </div>
          ))}
        </div>

        {/* Dateline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 16,
            letterSpacing: 4,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>
            DIXON-COLES · ELO · MONTE-CARLO · {predictions.simCount.toLocaleString()} SIMS
          </div>
          <div style={{ display: "flex" }}>AS OF {asOf}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Bodoni Moda", data: bodoni, weight: 400, style: "normal" },
        { name: "Bodoni Moda", data: bodoniBold, weight: 700, style: "normal" },
      ],
    },
  );
}

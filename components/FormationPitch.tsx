// THE SIGNATURE: the broadcast tactics-cam. A vertical pitch with both teams'
// formation dots (home = telestrator cyan, away = sodium amber) and an
// analyst's chalk overlay — a pressing arrow, a circled player, half-space
// shading — that draws itself on load (stroke-dashoffset), respecting
// prefers-reduced-motion. Pure SVG server component.

const C = { chalk: "var(--chalk)", faint: "var(--chalk-faint)", home: "var(--home)", away: "var(--accent)" };

// Parse "4-3-3" / "4-2-3-1" into outfield line sizes (GK added separately).
function parseFormation(f?: string): number[] {
  if (!f) return [];
  const parts = f.split(/[-\s]/).map((n) => parseInt(n, 10)).filter((n) => n > 0 && n < 6);
  const sum = parts.reduce((a, b) => a + b, 0);
  return sum >= 9 && sum <= 10 ? parts : [];
}

interface Dot { x: number; y: number }

function dots(formation: number[], side: "home" | "away"): Dot[] {
  const out: Dot[] = [];
  // Goalkeeper.
  out.push({ x: 50, y: side === "home" ? 145 : 5 });
  const L = formation.length;
  const yFor = (j: number) => {
    const f = L > 1 ? j / (L - 1) : 0;
    return side === "home" ? 131 - (131 - 85) * f : 19 + (65 - 19) * f;
  };
  formation.forEach((n, j) => {
    const y = yFor(j);
    for (let i = 0; i < n; i++) {
      out.push({ x: 12 + (88 - 12) * ((i + 1) / (n + 1)), y });
    }
  });
  return out;
}

function PitchMarkings() {
  return (
    <g stroke={C.faint} strokeWidth="0.6" fill="none">
      <rect x="3" y="3" width="94" height="144" />
      <line x1="3" y1="75" x2="97" y2="75" />
      <circle cx="50" cy="75" r="11" />
      <circle cx="50" cy="75" r="0.8" fill={C.faint} />
      {/* top box (away defends) */}
      <rect x="24" y="3" width="52" height="20" />
      <rect x="38" y="3" width="24" height="8" />
      <path d="M 36 23 A 14 14 0 0 0 64 23" />
      {/* bottom box (home defends) */}
      <rect x="24" y="127" width="52" height="20" />
      <rect x="38" y="139" width="24" height="8" />
      <path d="M 36 127 A 14 14 0 0 1 64 127" />
      {/* goals */}
      <rect x="44" y="1.5" width="12" height="1.5" stroke={C.chalk} strokeWidth="0.5" />
      <rect x="44" y="147" width="12" height="1.5" stroke={C.chalk} strokeWidth="0.5" />
    </g>
  );
}

export function FormationPitch({
  homeFormation,
  awayFormation,
  className = "",
}: {
  homeFormation?: string;
  awayFormation?: string;
  className?: string;
}) {
  const home = parseFormation(homeFormation);
  const away = parseFormation(awayFormation);
  const hasFormations = home.length > 0 || away.length > 0;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 100 150"
        className="w-full"
        role="img"
        aria-label={
          hasFormations
            ? `Tactics board: home ${homeFormation ?? "unknown"} versus away ${awayFormation ?? "unknown"}`
            : "Tactics board — formations confirmed at kickoff"
        }
      >
        {/* lit-grass vignette */}
        <defs>
          <radialGradient id="grass" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#13201a" />
            <stop offset="100%" stopColor="#0a1410" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="150" fill="url(#grass)" />
        {/* mowing stripes */}
        {Array.from({ length: 6 }).map((_, i) => (
          <rect
            key={i}
            x="3"
            y={3 + i * 24}
            width="94"
            height="12"
            fill="#e8ede6"
            opacity="0.012"
          />
        ))}
        <PitchMarkings />

        {hasFormations && (
          <>
            {dots(home, "home").map((d, i) => (
              <circle key={`h${i}`} cx={d.x} cy={d.y} r="2.6" fill={C.home} opacity="0.9" />
            ))}
            {dots(away, "away").map((d, i) => (
              <circle key={`a${i}`} cx={d.x} cy={d.y} r="2.6" fill={C.away} opacity="0.9" />
            ))}

            {/* ---- telestrator chalk overlay (the signature) ---- */}
            {/* half-space shading (where the press funnels play) */}
            <rect x="64" y="58" width="14" height="40" fill={C.away} opacity="0.06" />
            {/* pressing arrow — away pressing into home's right half-space */}
            <g stroke={C.away} strokeWidth="1.1" fill="none" strokeLinecap="round">
              <path
                className="chalk-stroke chalk-draw"
                style={{ strokeDasharray: 60, strokeDashoffset: 60, animationDelay: "0.15s" }}
                d="M 70 60 C 72 72, 70 84, 66 96"
              />
              <path
                className="chalk-stroke chalk-draw"
                style={{ strokeDasharray: 14, strokeDashoffset: 14, animationDelay: "0.55s" }}
                d="M 66 96 L 70 90 M 66 96 L 61 92"
              />
            </g>
            {/* circled home pivot */}
            <circle
              className="chalk-stroke chalk-draw"
              style={{ strokeDasharray: 44, strokeDashoffset: 44, animationDelay: "0.35s" }}
              cx="50"
              cy="92"
              r="7"
              fill="none"
              stroke={C.home}
              strokeWidth="1.1"
            />
          </>
        )}
      </svg>

      {/* formation labels */}
      <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
        <span style={{ color: C.home }}>{homeFormation || "—"}</span>
        <span className="text-muted">
          {hasFormations ? "tactics board" : "formations confirmed at kickoff"}
        </span>
        <span style={{ color: C.away }}>{awayFormation || "—"}</span>
      </div>
    </div>
  );
}

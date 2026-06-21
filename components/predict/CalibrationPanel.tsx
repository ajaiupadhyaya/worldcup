import type { CalibrationSnapshot } from "@/lib/predictions";

const SIZE = 200;
const PAD = 18;

function xy(v: number) {
  // v in [0,1] -> pixel within the padded plot box (y flipped).
  return PAD + v * (SIZE - 2 * PAD);
}

export function CalibrationPanel({
  cal,
  meta,
}: {
  cal: CalibrationSnapshot;
  meta: { generatedAt: string; simCount: number; seed: number; modelVersion: string };
}) {
  const maxN = Math.max(1, ...cal.reliability.map((b) => b.n));
  return (
    <div className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:grid-cols-[200px_1fr]">
      <svg width={SIZE} height={SIZE} className="shrink-0" role="img" aria-label="Reliability curve">
        {/* perfect-calibration diagonal */}
        <line x1={xy(0)} y1={xy(1)} x2={xy(1)} y2={xy(0)} stroke="var(--chalk-faint)" strokeWidth={1} strokeDasharray="3 3" />
        {/* axes — anchored at the observed=0 baseline (bottom) and predicted=0 edge (left) */}
        <line x1={xy(0)} y1={SIZE - xy(0)} x2={xy(1)} y2={SIZE - xy(0)} stroke="var(--border)" strokeWidth={1} />
        <line x1={xy(0)} y1={SIZE - xy(0)} x2={xy(0)} y2={SIZE - xy(1)} stroke="var(--border)" strokeWidth={1} />
        {cal.reliability.map((b, i) => (
          <circle
            key={i}
            cx={xy(b.predicted)}
            cy={SIZE - xy(b.observed)}
            r={2 + 4 * Math.sqrt(b.n / maxN)}
            fill="var(--home)"
            fillOpacity={0.8}
          />
        ))}
      </svg>

      <div className="font-mono text-[12px] text-muted">
        <div className="mb-3 flex gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]">Brier</div>
            <div className="font-mono text-xl tabular-nums text-text">{cal.brier.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]">Log loss</div>
            <div className="font-mono text-xl tabular-nums text-text">{cal.logloss.toFixed(3)}</div>
          </div>
        </div>
        <p className="mb-3 max-w-prose font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-muted">
          Out-of-sample calibration on held-out historical matches. Dots near the dashed
          diagonal mean predicted probabilities matched real outcome frequencies. Dot size ∝
          sample count.
        </p>
        <div className="text-[11px] leading-relaxed">
          <div>model {meta.modelVersion} · seed {meta.seed} · {meta.simCount.toLocaleString()} sims</div>
          <div>generated {new Date(meta.generatedAt).toUTCString()}</div>
        </div>
      </div>
    </div>
  );
}

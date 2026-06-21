// A flat chalk probability bar: hairline track, telestrator-cyan fill.
export function ProbBar({
  value,
  color = "var(--home)",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--chalk-faint)" }}
      role="img"
      aria-label={label}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ProbBar({
  value,
  color = "var(--foreground-accent)",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-1.5 w-full overflow-hidden bg-[#ebebeb]"
      role="img"
      aria-label={label ?? `${Math.round(pct)}%`}
    >
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

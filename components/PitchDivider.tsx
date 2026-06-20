// A section divider that IS a pitch line — the halfway line with a faint centre
// circle, drawn in chalk. Replaces generic <hr> borders between feed segments.
export function PitchDivider({ label }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center justify-center" aria-hidden>
      <svg viewBox="0 0 400 24" className="w-full" preserveAspectRatio="none" height={24}>
        <line x1="0" y1="12" x2="400" y2="12" stroke="var(--chalk-faint)" strokeWidth="1" />
        <circle cx="200" cy="12" r="9" fill="none" stroke="var(--chalk-faint)" strokeWidth="1" />
        <circle cx="200" cy="12" r="1.4" fill="var(--chalk-faint)" />
      </svg>
      {label && (
        <span className="absolute bg-bg px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

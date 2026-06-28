export function PitchDivider({ label }: { label?: string }) {
  return (
    <div className="relative my-8">
      <div className="section-rule" />
      {label && (
        <p className="absolute left-6 top-0 -translate-y-1/2 bg-[var(--background)] px-3 section-label sm:left-12">
          {label.toUpperCase()}
        </p>
      )}
    </div>
  );
}

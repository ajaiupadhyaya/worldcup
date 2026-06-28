export function HomeMasthead() {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).toUpperCase();

  return (
    <section className="relative h-[200px] overflow-hidden bg-[var(--surface-dark)]">
      <div className="absolute left-0 top-0 h-[3px] w-[240px] bg-[var(--foreground-accent)]" />
      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col justify-between px-6 py-4 sm:px-12">
        <p className="text-[9px] tracking-[3px] text-[var(--foreground-secondary)]">
          NO. 48 · GROUP STAGE
        </p>
        <div className="overflow-hidden">
          <h1 className="headline-bleed text-[clamp(80px,14vw,196px)] text-[var(--foreground-inverse)]">
            WORLD CUP
          </h1>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-[11px] tracking-[4px] text-[var(--foreground-secondary)]">MMXXVI</span>
          <span className="hidden text-[10px] tracking-[1.5px] text-[var(--foreground-secondary)] sm:inline">
            {today}
          </span>
        </div>
      </div>
    </section>
  );
}

export function HomeMasthead() {
  // Fixed editorial dateline timezone keeps the server/client render identical.
  const today = new Date()
    .toLocaleDateString("en-GB", {
      timeZone: "America/New_York",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <section className="relative overflow-hidden bg-[var(--surface-dark)] text-[var(--foreground-inverse)]">
      {/* vertical issue spine — magazine margin furniture */}
      <div className="pointer-events-none absolute left-3 top-0 hidden h-full items-center lg:flex">
        <span className="rotate-180 text-[9px] tracking-[0.42em] text-[var(--foreground-inverse-dim)] [writing-mode:vertical-rl]">
          N° 48 · THE GROUP-STAGE DOSSIER
        </span>
      </div>

      <div className="relative mx-auto flex min-h-[clamp(440px,64vh,640px)] max-w-[1480px] flex-col justify-between px-6 py-7 sm:px-12 lg:px-20">
        {/* top edition line */}
        <div className="flex items-start justify-between">
          <p className="kicker max-w-[12rem] leading-[1.8]">
            The 2026 World Cup
            <br />
            Tactical Review
          </p>
          <p className="text-right text-[9px] tracking-[0.3em] text-[var(--foreground-inverse-dim)]">
            EDITION MMXXVI
            <br />
            <span className="text-[var(--foreground-accent)]">VOL. I</span>
          </p>
        </div>

        {/* the cover headline */}
        <div className="my-6">
          <div className="overflow-hidden">
            <h1 className="headline-bleed wipe-in text-[clamp(72px,15vw,210px)]">WORLD</h1>
          </div>
          <div className="-mt-[0.06em] flex items-end gap-[0.18em] overflow-hidden pl-[8vw]">
            <h1 className="headline-bleed wipe-in text-[clamp(72px,15vw,210px)] text-[var(--foreground-accent)] [animation-delay:120ms]">
              CUP
            </h1>
            <span className="mb-[0.18em] font-heading text-[clamp(20px,3vw,46px)] font-light italic text-[var(--foreground-inverse-dim)]">
              ’26
            </span>
          </div>
        </div>

        {/* bottom credits */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border-dark)] pt-4">
          <p className="max-w-md font-heading text-[clamp(15px,1.7vw,22px)] font-light italic leading-[1.25] text-[var(--foreground-inverse)]">
            Forty-eight nations, sixteen host cities, one trophy — read through the lens of the model.
          </p>
          <div className="text-right">
            <p className="text-[9px] tracking-[0.3em] text-[var(--foreground-inverse-dim)]">UPDATED</p>
            <p suppressHydrationWarning className="mt-1 text-[10px] tracking-[0.18em] text-[var(--foreground-inverse)]">
              {today}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

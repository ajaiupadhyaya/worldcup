export function SiteFooter() {
  return (
    <footer className="bg-[var(--surface-deep)] text-[var(--foreground-inverse)]">
      <div className="h-[2px] w-full bg-[var(--foreground-accent)]" />
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-6 py-10 sm:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-6">
          <span className="font-heading text-[clamp(28px,5vw,56px)] font-black italic leading-none tracking-[-0.03em] misreg-soft">
            WORLD CUP
          </span>
          <span className="text-right text-[9px] tracking-[0.26em] text-[var(--foreground-inverse-dim)]">
            EDITION
            <br />
            MMXXVI
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-dark)] pt-5 text-[9px] tracking-[0.22em] text-[var(--foreground-inverse-dim)]">
          <span>© 2026 — A TACTICAL DOSSIER</span>
          <span className="hidden h-1 w-1 rounded-full bg-[var(--foreground-accent)] sm:inline-block" aria-hidden />
          <span>PREDICTIVE MODEL · UPDATED DAILY</span>
        </div>
      </div>
    </footer>
  );
}

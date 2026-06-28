export function SiteFooter() {
  return (
    <>
      <div className="border-t border-[var(--border-strong)]" />
      <footer className="flex h-[60px] items-center justify-between bg-[var(--surface-dark)] px-6 text-[10px] tracking-[2px] text-[var(--foreground-inverse)] sm:px-12">
        <span>© 2026 WORLD CUP MMXXVI</span>
        <span className="hidden h-1.5 w-1.5 rounded-full bg-[var(--foreground-accent)] sm:inline-block" aria-hidden />
        <span className="text-right">PREDICTIVE MODEL — UPDATED DAILY</span>
      </footer>
    </>
  );
}

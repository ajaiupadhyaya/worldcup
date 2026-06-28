export function EditorialPull({
  quote,
  note,
  dark = false,
}: {
  quote: string;
  note: string;
  dark?: boolean;
}) {
  return (
    <section
      className={
        dark
          ? "bg-[var(--surface-dark)] text-[var(--foreground-inverse)]"
          : "bg-[var(--paper-pure)] text-[var(--foreground)]"
      }
    >
      <div className="mx-auto grid max-w-[1480px] items-end gap-8 px-6 py-16 sm:px-12 sm:py-20 md:grid-cols-[1.4fr_1fr] lg:px-20">
        <div>
          <span
            className={`mb-4 block font-heading text-[64px] leading-none ${
              dark ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-accent)]"
            }`}
            aria-hidden
          >
            “
          </span>
          <h2
            className={`misreg-soft whitespace-pre-line font-heading text-[clamp(38px,6.4vw,82px)] font-extrabold italic leading-[0.92] tracking-[-0.025em] ${
              dark ? "text-[var(--foreground-inverse)]" : "text-[var(--foreground)]"
            }`}
          >
            {quote}
          </h2>
        </div>
        <p
          className={`max-w-sm text-[12px] leading-[2] tracking-[0.04em] ${
            dark ? "text-[var(--foreground-inverse-dim)]" : "text-[var(--foreground-secondary)]"
          }`}
        >
          {note}
        </p>
      </div>
    </section>
  );
}

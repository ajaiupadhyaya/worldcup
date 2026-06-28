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
      className={`mx-auto grid max-w-[1440px] gap-8 px-6 py-12 sm:grid-cols-2 sm:px-12 ${
        dark ? "bg-[var(--surface-dark)] text-[var(--foreground-inverse)]" : ""
      }`}
    >
      <h2
        className={`whitespace-pre-line font-heading text-[clamp(40px,6vw,64px)] font-bold leading-[0.88] tracking-[-0.02em] ${
          dark ? "text-[var(--foreground-inverse)]" : "text-[var(--foreground)]"
        }`}
      >
        {quote}
      </h2>
      <p className="self-end text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">{note}</p>
    </section>
  );
}

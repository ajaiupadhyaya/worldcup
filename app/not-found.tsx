import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-12">
      <section className="border border-[var(--border)] p-6">
        <p className="text-[11px] tracking-[2px] text-[var(--foreground-secondary)]">404 · OFF THE BOARD</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-[var(--foreground)]">Match not found</h1>
        <p className="mt-3 text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">
          That route is not in the current tournament board.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block border border-[var(--border-strong)] px-4 py-2 text-[10px] tracking-[2px] hover:bg-[var(--row-alt)]"
        >
          BACK TO THE BOARD
        </Link>
      </section>
    </div>
  );
}

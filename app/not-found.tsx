import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <section className="art-panel p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          404 · off the board
        </p>
        <h1 className="mt-2 font-display text-4xl text-text">Match not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          That route is not in the current tournament board.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block border border-home px-4 py-2 font-mono text-xs uppercase tracking-widest text-home hover:bg-home hover:text-bg"
        >
          Back to the board
        </Link>
      </section>
    </div>
  );
}

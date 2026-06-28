"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-12">
      <section className="border border-[var(--border)] p-6">
        <p className="text-[11px] tracking-[2px] text-[var(--foreground-accent)]">MATCH FEED INTERRUPTED</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-[var(--foreground)]">Something went wrong</h1>
        <p className="mt-3 max-w-prose text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">
          The dashboard could not render this view. The live feed may have changed shape or a provider may be
          unavailable for the moment.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="mt-5 border border-[var(--border-strong)] bg-[var(--foreground)] px-4 py-2 text-[10px] tracking-[2px] text-[var(--foreground-inverse)]"
        >
          TRY AGAIN
        </button>
      </section>
    </div>
  );
}

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
    <div className="mx-auto max-w-3xl px-4 py-16">
      <section className="art-panel p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-danger">
          Match feed interrupted
        </p>
        <h1 className="mt-2 font-display text-4xl text-text">Something went wrong</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          Floodlit could not render this view. The live feed may have changed shape or
          a provider may be unavailable for the moment.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="mt-5 border border-home px-4 py-2 font-mono text-xs uppercase tracking-widest text-home hover:bg-home hover:text-bg"
        >
          Try again
        </button>
      </section>
    </div>
  );
}

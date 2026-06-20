/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";

// Team crest/flag with a graceful fallback to the short code on a chip — used
// both when there's no URL and when a remote crest fails to load. Plain <img>
// (sources span many remote hosts; next/image would need each allow-listed).
export function Flag({ team, size = 28 }: { team: Team; size?: number }) {
  const [errored, setErrored] = useState(false);

  if (!team.flag || errored) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[2px] font-mono text-[9px] text-text/80"
        style={{ width: size, height: size, background: "var(--surface-2)" }}
      >
        {team.shortName?.slice(0, 3) || "?"}
      </span>
    );
  }
  return (
    <img
      src={team.flag}
      alt={team.name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className="rounded-[2px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

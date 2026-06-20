/* eslint-disable @next/next/no-img-element */
import type { Team } from "@/lib/types";

// Team crest/flag with a graceful fallback to the short code on a kit-coloured
// chip. Uses a plain <img> (sources are many remote hosts; next/image config
// would need every one allow-listed).
export function Flag({ team, size = 28 }: { team: Team; size?: number }) {
  if (!team.flag) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-[2px] font-mono text-[9px] text-text/80"
        style={{ width: size, height: size, background: "var(--surface-2)" }}
      >
        {team.shortName?.slice(0, 3)}
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
      className="rounded-[2px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

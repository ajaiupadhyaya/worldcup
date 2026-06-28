export function LiveDot({ size = 8 }: { size?: number }) {
  return (
    <span
      className="live-dot inline-block shrink-0 rounded-full bg-[var(--foreground-accent)]"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

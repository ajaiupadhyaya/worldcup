// The breathing sodium-amber floodlight dot — the live indicator. The only
// ambient motion on the page (paired with the chalk-draw signature).
export function LiveDot({ size = 8 }: { size?: number }) {
  return (
    <span
      className="live-dot inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
      aria-hidden
    />
  );
}

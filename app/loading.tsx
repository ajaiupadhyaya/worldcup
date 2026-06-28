export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-7">
      <div className="art-panel h-48 animate-pulse" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

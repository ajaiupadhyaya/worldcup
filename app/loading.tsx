export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-12">
      <div className="h-48 animate-pulse bg-[var(--row-alt)]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse bg-[var(--row-alt)]" />
        ))}
      </div>
    </div>
  );
}

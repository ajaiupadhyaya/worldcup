export default function Loading() {
  return (
    <div className="px-6 pt-8 sm:px-12">
      <div className="h-32 w-2/3 animate-pulse bg-[var(--row-alt)]" />
      <div className="mt-10 flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, c) => (
          <div key={c} className="flex flex-1 flex-col gap-3">
            {Array.from({ length: Math.max(1, 8 >> c) }, (_, r) => (
              <div key={r} className="h-16 animate-pulse bg-[var(--row-alt)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

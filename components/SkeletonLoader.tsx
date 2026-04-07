export function SkeletonCard() {
  return (
    <div
      className="bg-bg-card rounded-[var(--radius-card)] border border-border p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="skeleton h-3.5 w-28 mb-4" />
      <div className="space-y-3">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonReportFilters() {
  return (
    <div
      className="bg-bg-card rounded-[var(--radius-card)] border border-border p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="skeleton h-4 w-32 mb-4" />
      <div className="flex gap-4">
        <div className="skeleton h-9 w-44" />
        <div className="skeleton h-9 w-36" />
        <div className="skeleton h-9 w-36" />
        <div className="skeleton h-9 w-32" />
        <div className="ml-auto flex gap-2">
          <div className="skeleton h-9 w-20" />
          <div className="skeleton h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonReportTable() {
  return (
    <div
      className="bg-bg-card rounded-[var(--radius-card)] border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="px-6 py-4 border-b border-border flex justify-between items-center">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-3 w-36" />
      </div>
      <div className="px-4 py-3 bg-bg-page/60 flex justify-between">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-16" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div
              className="skeleton h-3"
              style={{ width: `${160 + (i * 15) % 80}px`, marginLeft: `${(i % 3) * 24}px` }}
            />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div
      className="bg-bg-card rounded-[var(--radius-card)] border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="px-6 py-4 border-b border-border">
        <div className="skeleton h-5 w-32" />
      </div>
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex gap-4 pb-3 border-b border-border-light">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-3 flex-1" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="skeleton h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

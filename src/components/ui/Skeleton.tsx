interface SkeletonProps {
  className?: string
  count?: number
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: 'var(--bg-surface-2)' }}
    />
  )
}

export default function Skeleton({ className = 'h-4 w-full', count = 1 }: SkeletonProps) {
  if (count === 1) return <SkeletonLine className={className} />

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} className={className} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-2/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonLine className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

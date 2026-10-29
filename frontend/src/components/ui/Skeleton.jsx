/**
 * MUI-inspired Skeleton loader component
 * Replaces "Loading..." text with beautiful shimmer placeholders
 */
export function Skeleton({ variant = 'text', width, height, className = '', animation = 'shimmer' }) {
  const baseClass = 'bg-slate-200/60 dark:bg-slate-700/40'
  const animClass = animation === 'shimmer'
    ? 'relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent before:animate-[shimmer_1.5s_infinite]'
    : 'animate-pulse'

  const variants = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    rounded: 'rounded-2xl',
  }

  const style = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClass} ${animClass} ${variants[variant] || variants.text} ${className}`}
      style={style}
    />
  )
}

/** Pre-built skeleton patterns for common UI elements */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 15}%`} height={12} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 border-b border-slate-100 dark:border-slate-800/40 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${100 / cols}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonKPI({ count = 5 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton width={48} height={10} />
          </div>
          <Skeleton width="70%" height={24} />
          <Skeleton width="50%" height={10} />
        </div>
      ))}
    </div>
  )
}

export default Skeleton

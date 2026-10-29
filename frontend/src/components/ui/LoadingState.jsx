/**
 * Enhanced LoadingState with MUI-inspired skeletons
 * Replaces plain "Loading..." text with beautiful shimmer placeholders
 */
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonKPI } from './Skeleton'
import { CircularProgress } from './Progress'

export default function LoadingState({ text, card = false, variant = 'default', className = '' }) {
  // If variant specified, render that skeleton pattern
  if (variant === 'cards') return <SkeletonKPI count={5} />
  if (variant === 'table') return <SkeletonTable rows={5} cols={4} />
  if (variant === 'card') return <SkeletonCard lines={3} />
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => <SkeletonCard key={i} lines={2} />)}
      </div>
    )
  }

  // Default: spinner with optional text
  const containerClass = card
    ? 'glass-card p-6'
    : 'p-6'

  return (
    <div className={`${containerClass} flex flex-col items-center justify-center gap-3 ${className}`}>
      <CircularProgress variant="indeterminate" size={36} color="primary" />
      {text && <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">{text}</p>}
    </div>
  )
}

/**
 * MUI-inspired Progress components
 * Linear and Circular progress indicators
 */
import { motion } from 'framer-motion'

export function LinearProgress({
  value,
  variant = 'determinate',
  color = 'primary',
  size = 'md',
  showLabel = false,
  className = '',
}) {
  const colors = {
    primary: 'from-brand-500 to-brand-400',
    success: 'from-emerald-500 to-emerald-400',
    warning: 'from-amber-500 to-amber-400',
    error: 'from-rose-500 to-rose-400',
    info: 'from-brand-500 to-brand-400',
    gradient: 'from-brand-500 via-brand-700 to-emerald-500',
  }

  const sizes = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  const bgColors = {
    primary: 'bg-brand-100 dark:bg-brand-950/30',
    success: 'bg-emerald-100 dark:bg-emerald-950/30',
    warning: 'bg-amber-100 dark:bg-amber-950/30',
    error: 'bg-rose-100 dark:bg-rose-950/30',
    info: 'bg-brand-100 dark:bg-brand-950/30',
    gradient: 'bg-slate-100 dark:bg-slate-800/50',
  }

  if (variant === 'indeterminate') {
    return (
      <div className={`w-full ${sizes[size]} ${bgColors[color]} rounded-full overflow-hidden ${className}`}>
        <div
          className={`h-full w-1/3 bg-gradient-to-r ${colors[color]} rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]`}
        />
      </div>
    )
  }

  const clamped = Math.min(100, Math.max(0, value ?? 0))

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={`w-full ${sizes[size]} ${bgColors[color]} rounded-full overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${colors[color]} rounded-full shadow-sm`}
        />
      </div>
    </div>
  )
}

export function CircularProgress({
  value,
  variant = 'determinate',
  size = 40,
  thickness = 3.5,
  color = 'primary',
  showLabel = false,
  className = '',
}) {
  const colors = {
    primary: 'stroke-brand-500',
    success: 'stroke-emerald-500',
    warning: 'stroke-amber-500',
    error: 'stroke-rose-500',
    info: 'stroke-brand-500',
  }

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value ?? 0))
  const offset = circumference - (clamped / 100) * circumference

  if (variant === 'indeterminate') {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`animate-spin ${className}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
          strokeLinecap="round"
          className={colors[color]}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    )
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          strokeLinecap="round"
          className={colors[color]}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-300">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  )
}

export default LinearProgress

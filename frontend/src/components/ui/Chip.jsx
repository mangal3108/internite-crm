/**
 * MUI-inspired Chip component
 * For status tags, filters, and categorical labels
 */
import { X } from 'lucide-react'

const VARIANTS = {
  filled: {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    primary: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    error: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    info: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300',
  },
  outlined: {
    default: 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400',
    primary: 'border border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400',
    success: 'border border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400',
    warning: 'border border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
    error: 'border border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400',
    info: 'border border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400',
  },
  soft: {
    default: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/40',
    primary: 'bg-brand-50/60 text-brand-600 ring-1 ring-brand-200/60 dark:bg-brand-950/30 dark:text-brand-400 dark:ring-brand-800/40',
    success: 'bg-emerald-50/60 text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/40',
    warning: 'bg-amber-50/60 text-amber-600 ring-1 ring-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40',
    error: 'bg-rose-50/60 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-800/40',
    info: 'bg-brand-50/60 text-brand-600 ring-1 ring-brand-200/60 dark:bg-brand-950/30 dark:text-brand-400 dark:ring-brand-800/40',
  },
}

const SIZES = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
}

export default function Chip({
  label,
  variant = 'filled',
  color = 'default',
  size = 'md',
  icon,
  avatar,
  onDelete,
  onClick,
  className = '',
}) {
  const colorCls = VARIANTS[variant]?.[color] || VARIANTS.filled.default
  const sizeCls = SIZES[size] || SIZES.md
  const interactive = onClick ? 'cursor-pointer hover:shadow-sm active:scale-95 transition-all' : ''

  return (
    <span
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap select-none ${colorCls} ${sizeCls} ${interactive} ${className}`}
    >
      {avatar && (
        <span className="w-5 h-5 -ml-0.5 rounded-full overflow-hidden flex-shrink-0">
          {typeof avatar === 'string' ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : avatar}
        </span>
      )}
      {icon && <span className="flex-shrink-0 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>}
      {label}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label={`Remove ${label}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

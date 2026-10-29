/**
 * MUI-inspired Alert component
 * Info, success, warning, and error alert banners
 */
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

const VARIANTS = {
  info: {
    filled: 'bg-accent-400 text-slate-950',
    outlined: 'border border-brand-300 dark:border-brand-800 text-brand-800 dark:text-brand-300 bg-transparent',
    standard: 'bg-brand-50 dark:bg-brand-950/20 text-brand-800 dark:text-brand-300',
  },
  success: {
    filled: 'bg-emerald-600 text-white',
    outlined: 'border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-transparent',
    standard: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300',
  },
  warning: {
    filled: 'bg-amber-500 text-white',
    outlined: 'border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-transparent',
    standard: 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300',
  },
  error: {
    filled: 'bg-rose-600 text-white',
    outlined: 'border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 bg-transparent',
    standard: 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300',
  },
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
}

export default function Alert({
  severity = 'info',
  variant = 'standard',
  title,
  children,
  icon,
  onClose,
  action,
  className = '',
}) {
  const Icon = icon || ICONS[severity]
  const colorCls = VARIANTS[severity]?.[variant] || VARIANTS.info.standard

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${colorCls} ${className}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-90" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold leading-tight">{title}</p>}
        {children && <div className={`${title ? 'mt-0.5' : ''} text-[13px] leading-relaxed opacity-90`}>{children}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

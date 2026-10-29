/**
 * MUI-inspired Timeline component
 * Vertical timeline for activity feeds and history
 */

export function Timeline({ children, className = '' }) {
  return (
    <div className={`relative space-y-0 ${className}`}>
      {children}
    </div>
  )
}

export function TimelineItem({
  icon,
  color = 'primary',
  title,
  subtitle,
  time,
  children,
  isLast = false,
}) {
  const colors = {
    primary: 'bg-accent-400 text-slate-950',
    success: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-rose-500 text-white',
    info: 'bg-accent-400 text-slate-950',
    neutral: 'bg-slate-400 text-white dark:bg-slate-600',
  }

  const lineColors = {
    primary: 'bg-brand-200 dark:bg-brand-900/40',
    success: 'bg-emerald-200 dark:bg-emerald-900/40',
    warning: 'bg-amber-200 dark:bg-amber-900/40',
    error: 'bg-rose-200 dark:bg-rose-900/40',
    info: 'bg-brand-200 dark:bg-brand-900/40',
    neutral: 'bg-slate-200 dark:bg-slate-700',
  }

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {/* Connector line */}
      {!isLast && (
        <div
          className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${lineColors[color]}`}
        />
      )}

      {/* Dot / Icon */}
      <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${colors[color]} flex items-center justify-center shadow-sm`}>
        {icon ? (
          <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{title}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {time && (
            <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0 pt-0.5">{time}</span>
          )}
        </div>
        {children && (
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export default Timeline

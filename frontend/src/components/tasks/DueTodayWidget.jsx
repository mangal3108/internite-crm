import { CalendarClock, ArrowRight } from 'lucide-react'

export default function DueTodayWidget({ tasks = [], onOpenTask }) {
  const dueToday = tasks.filter((task) => {
    if (!task?.dueDate) return false
    const date = new Date(task.dueDate)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  })

  return (
    <div className="kpi-card flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Due Today</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{dueToday.length}</h3>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CalendarClock className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {dueToday.slice(0, 3).map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask?.(task)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-800/70 dark:bg-slate-950/40 dark:hover:bg-slate-900/60"
          >
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">{task.title}</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
        {dueToday.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
            No due-today tasks
          </div>
        )}
      </div>
    </div>
  )
}

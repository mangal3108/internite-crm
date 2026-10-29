import { TriangleAlert, ArrowRight } from 'lucide-react'

export default function OverdueTasksWidget({ tasks = [], onOpenTask }) {
  const overdue = tasks.filter((task) => {
    if (!task?.dueDate) return false
    const date = new Date(task.dueDate)
    return date < new Date() && String(task?.status ?? '').toUpperCase() !== 'COMPLETED'
  })

  return (
    <div className="kpi-card flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Overdue</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{overdue.length}</h3>
        </div>
        <div className="rounded-2xl bg-rose-50 p-3 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <TriangleAlert className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {overdue.slice(0, 3).map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask?.(task)}
            className="flex w-full items-center justify-between rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-left text-sm transition hover:border-rose-300 hover:bg-rose-100/60 dark:border-rose-900/30 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
          >
            <span className="truncate font-medium text-rose-800 dark:text-rose-200">{task.title}</span>
            <ArrowRight className="h-4 w-4 text-rose-400" />
          </button>
        ))}
        {overdue.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
            Nothing overdue right now
          </div>
        )}
      </div>
    </div>
  )
}

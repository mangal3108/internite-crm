import InfoHint from '../ui/InfoHint'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const pad = (value) => String(value).padStart(2, '0')
const toDateKey = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function TaskCalendar({ tasks = [], selectedDate = null, onDateSelect }) {
  const [cursor, setCursor] = useState(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const taskBuckets = useMemo(() => {
    const buckets = new Map()
    for (const task of tasks) {
      const key = toDateKey(task?.dueDate)
      if (!key) continue
      buckets.set(key, (buckets.get(key) || 0) + 1)
    }
    return buckets
  }, [tasks])

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    const firstWeekday = (start.getDay() + 6) % 7
    const daysInMonth = end.getDate()
    const cells = []

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null)
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day))
    }
    while (cells.length % 7 !== 0) {
      cells.push(null)
    }
    return cells
  }, [cursor])

  const selectedKey = toDateKey(selectedDate)

  return (
    <div className="glass-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Task Calendar<InfoHint text="Track due dates and follow-up slots" /></p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="btn-ghost h-9 w-9 p-0">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="btn-secondary h-9 px-3 text-xs">
            <CalendarDays className="h-4 w-4" />
            Today
          </button>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="btn-ghost h-9 w-9 p-0">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {cursor.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {taskBuckets.size} active date{taskBuckets.size === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {monthDays.map((date, index) => {
          const key = date ? toDateKey(date) : null
          const count = key ? taskBuckets.get(key) || 0 : 0
          const isSelected = key && key === selectedKey
          const isToday = key === toDateKey(new Date())

          return (
            <button
              key={`${key || 'blank'}-${index}`}
              type="button"
              onClick={() => date && onDateSelect?.(key)}
              disabled={!date}
              className={`min-h-20 rounded-xl border p-2 text-left transition ${
                !date
                  ? 'border-transparent bg-transparent'
                  : isSelected
                    ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-500 dark:bg-brand-950/30 dark:text-brand-300'
                    : 'border-slate-200/80 bg-white/70 hover:border-brand-200 hover:bg-brand-50/60 dark:border-slate-800/70 dark:bg-slate-950/40 dark:hover:bg-slate-900/60'
              } ${isToday ? 'ring-1 ring-brand-400/50' : ''}`}
            >
              {date && (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{date.getDate()}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                        {count}
                      </span>
                    )}
                  </div>
                  {count > 0 && (
                    <div className="mt-2 space-y-1">
                      {count > 1 ? (
                        <div className="h-1.5 w-10 rounded-full bg-brand-500/60" />
                      ) : (
                        <div className="h-1.5 w-6 rounded-full bg-brand-300 dark:bg-brand-500/70" />
                      )}
                    </div>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

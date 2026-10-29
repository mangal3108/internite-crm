import { CalendarDays, X } from 'lucide-react'
import { emptyDateRange, hasDateRangeFilter } from '../../utils/dateRangeFilter'

const PRESETS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
]

export default function DateRangeFilter({ value, onChange, className = '', compact = false }) {
  const range = value || emptyDateRange()
  const isCustom = range.preset === 'custom'

  const update = (patch) => onChange({ ...range, ...patch })
  const clear = () => onChange(emptyDateRange())

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <select
          value={range.preset || 'all'}
          onChange={(event) => {
            const preset = event.target.value
            onChange({
              preset,
              startDate: preset === 'custom' ? range.startDate : '',
              endDate: preset === 'custom' ? range.endDate : '',
            })
          }}
          className={`input min-w-[140px] pl-8 text-xs ${compact ? 'h-9 py-1.5' : ''}`}
          aria-label="Date filter"
        >
          {PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>{preset.label}</option>
          ))}
        </select>
      </div>

      {isCustom && (
        <>
          <input
            aria-label="Start date"
            type="date"
            value={range.startDate || ''}
            onChange={(event) => update({ startDate: event.target.value })}
            className={`input w-[145px] text-xs ${compact ? 'h-9 py-1.5' : ''}`}
          />
          <input
            aria-label="End date"
            type="date"
            value={range.endDate || ''}
            onChange={(event) => update({ endDate: event.target.value })}
            className={`input w-[145px] text-xs ${compact ? 'h-9 py-1.5' : ''}`}
          />
        </>
      )}

      {hasDateRangeFilter(range) && (
        <button
          type="button"
          onClick={clear}
          className="btn-ghost h-9 px-2 text-xs"
          aria-label="Clear date filter"
          title="Clear date filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

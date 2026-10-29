export const emptyDateRange = () => ({ preset: 'all', startDate: '', endDate: '' })

export const hasDateRangeFilter = (range) => Boolean(
  range && (range.preset !== 'all' || range.startDate || range.endDate)
)

const pad = (value) => String(value).padStart(2, '0')

export const toDateKey = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + days)
  return next
}

export const resolveDateRange = (range) => {
  const preset = range?.preset || 'all'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (preset === 'today') {
    const key = toDateKey(today)
    return { startDate: key, endDate: key }
  }
  if (preset === 'yesterday') {
    const key = toDateKey(addDays(today, -1))
    return { startDate: key, endDate: key }
  }
  if (preset === 'last7') {
    return { startDate: toDateKey(addDays(today, -6)), endDate: toDateKey(today) }
  }
  if (preset === 'last30') {
    return { startDate: toDateKey(addDays(today, -29)), endDate: toDateKey(today) }
  }

  return {
    startDate: range?.startDate || '',
    endDate: range?.endDate || '',
  }
}

export const isWithinDateRange = (value, range) => {
  if (!hasDateRangeFilter(range)) return true
  const key = toDateKey(value)
  if (!key) return false

  const { startDate, endDate } = resolveDateRange(range)
  if (startDate && key < startDate) return false
  if (endDate && key > endDate) return false
  return true
}


export const SLA_BANDS_MINUTES = {
  freshMax: 15,
  warningMax: 60,
}

const safeDateMs = (value) => {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

export const getLeadReferenceMs = (lead) => {
  return safeDateMs(lead?.lastActivityAtTs) ?? safeDateMs(lead?.createdAtTs) ?? safeDateMs(lead?.createdAt)
}

export const getLeadAgeMinutes = (lead, nowMs = Date.now()) => {
  const refMs = getLeadReferenceMs(lead)
  if (!refMs) return null
  return Math.max(0, Math.floor((nowMs - refMs) / (60 * 1000)))
}

export const getLeadSlaMinutes = (lead, defaultMinutes = 60) => {
  const parsed = Number(lead?.followUpSlaMinutes)
  return parsed > 0 ? parsed : defaultMinutes
}

export const getLeadAgingLevel = (lead, nowMs = Date.now()) => {
  const isNew = String(lead?.status ?? '').toLowerCase() === 'new'
  if (!isNew) return 'resolved'
  const minutes = getLeadAgeMinutes(lead, nowMs)
  if (minutes === null) return 'unknown'
  if (minutes <= SLA_BANDS_MINUTES.freshMax) return 'fresh'
  if (minutes <= SLA_BANDS_MINUTES.warningMax) return 'warning'
  return 'critical'
}

export const getLeadAgingMeta = (lead, nowMs = Date.now()) => {
  const level = getLeadAgingLevel(lead, nowMs)
  const minutes = getLeadAgeMinutes(lead, nowMs)
  const text = minutes === null ? 'No timer' : `${minutes} min`

  if (level === 'fresh') {
    return {
      level,
      label: `Fresh · ${text}`,
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    }
  }
  if (level === 'warning') {
    return {
      level,
      label: `Warning · ${text}`,
      dot: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    }
  }
  if (level === 'critical') {
    return {
      level,
      label: `Critical · ${text}`,
      dot: 'bg-red-500',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
  }
  if (level === 'resolved') {
    return {
      level,
      label: 'Responded',
      dot: 'bg-brand-500',
      badge: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
    }
  }
  return {
    level,
    label: 'No timer',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
}

export const getSlaOutcome = (lead) => {
  const createdMs = safeDateMs(lead?.createdAtTs ?? lead?.createdAt)
  const firstResponseMs = safeDateMs(lead?.firstResponseAtTs)
  if (!createdMs || !firstResponseMs) return 'pending'
  const responseMinutes = (firstResponseMs - createdMs) / (60 * 1000)
  return responseMinutes <= getLeadSlaMinutes(lead) ? 'met' : 'breached'
}

export const computeLeadSlaSummary = (leads) => {
  const all = leads ?? []
  const total = all.length
  const unattendedCritical = all.filter((l) => getLeadAgingLevel(l) === 'critical').length
  const pending = all.filter((l) => getSlaOutcome(l) === 'pending').length
  const met = all.filter((l) => getSlaOutcome(l) === 'met').length
  const breached = all.filter((l) => getSlaOutcome(l) === 'breached').length

  const responded = all
    .map((l) => {
      const created = safeDateMs(l?.createdAtTs ?? l?.createdAt)
      const first = safeDateMs(l?.firstResponseAtTs)
      if (!created || !first) return null
      return Math.max(0, (first - created) / (60 * 1000))
    })
    .filter((v) => v !== null)
  const avgResponseMinutes = responded.length
    ? responded.reduce((sum, v) => sum + v, 0) / responded.length
    : null

  return { total, unattendedCritical, pending, met, breached, avgResponseMinutes }
}

export const computeEmployeeSlaPerformance = (leads) => {
  const bucket = new Map()
  for (const lead of leads ?? []) {
    const owner = lead?.assignedTo || 'Unassigned'
    if (!bucket.has(owner)) {
      bucket.set(owner, { owner, total: 0, unattended: 0, met: 0, breached: 0, pending: 0 })
    }
    const row = bucket.get(owner)
    row.total += 1
    if (getLeadAgingLevel(lead) === 'critical') row.unattended += 1
    const outcome = getSlaOutcome(lead)
    if (outcome === 'met') row.met += 1
    else if (outcome === 'breached') row.breached += 1
    else row.pending += 1
  }
  return [...bucket.values()].sort((a, b) => {
    if (a.unattended !== b.unattended) return b.unattended - a.unattended
    return b.breached - a.breached
  })
}

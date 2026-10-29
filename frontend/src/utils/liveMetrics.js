const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' })

const normalizeText = (value) => String(value ?? '').trim().toLowerCase()

const toDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const monthLabel = (date) => `${MONTH_FORMATTER.format(date)} ${date.getFullYear()}`

const monthWindow = (months = 6, referenceDate = new Date()) => {
  const items = []
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(ref.getFullYear(), ref.getMonth() - offset, 1)
    items.push({ key: monthKey(date), label: monthLabel(date) })
  }
  return items
}

const seriesByMonth = (rows = [], dateAccessor, valueAccessor = () => 1, months = 6) => {
  const buckets = new Map(monthWindow(months).map((item) => [item.key, { ...item, value: 0 }]))
  for (const row of rows) {
    const date = toDate(dateAccessor(row))
    if (!date) continue
    const key = monthKey(date)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.value += Number(valueAccessor(row) ?? 0) || 0
  }
  return Array.from(buckets.values())
}

export const buildLeadTrend = (leads = [], months = 6) =>
  seriesByMonth(leads, (lead) => lead.createdAt || lead.createdAtTs, () => 1, months).map((row) => ({
    month: row.label,
    leads: row.value,
  }))

export const buildRevenueTrend = (invoices = [], months = 6) =>
  seriesByMonth(
    invoices.filter((invoice) => normalizeText(invoice.status) === 'paid'),
    (invoice) => invoice.paidDate || invoice.issueDate || invoice.createdAt,
    (invoice) => Number(invoice.total ?? invoice.subtotal ?? 0),
    months
  ).map((row) => ({
    month: row.label,
    revenue: row.value,
  }))

export const buildLeadSourceBreakdown = (leads = []) => {
  const counts = new Map()
  for (const lead of leads) {
    const source = String(lead.source || 'Other').trim() || 'Other'
    counts.set(source, (counts.get(source) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export const buildFunnelBreakdown = (leads = []) => {
  const order = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const counts = new Map(order.map((stage) => [stage, 0]))
  for (const lead of leads) {
    const status = normalizeText(lead.status) || 'new'
    counts.set(status, (counts.get(status) || 0) + 1)
  }
  return order.map((stage) => ({
    stage: stage.replace(/^\w/, (char) => char.toUpperCase()),
    count: counts.get(stage) || 0,
  }))
}

export const buildTeamLeaderboard = ({ users = [], leads = [], deals = [] } = {}) => {
  const normalizedLeads = leads ?? []
  const normalizedDeals = deals ?? []

  const team = (users ?? [])
    .filter((user) => user && user.id && user.name && user.isActive !== false)
    .map((user) => {
      const aliases = [user.id, user.name, user.email].map(normalizeText)
      const leadRows = normalizedLeads.filter((lead) =>
        [lead.assignedTo, lead.assignedToName, lead.owner, lead.ownerName, lead.ownerId]
          .map(normalizeText)
          .some((value) => aliases.includes(value))
      )
      const ownedDeals = normalizedDeals.filter((deal) =>
        [deal.owner, deal.ownerName, deal.ownerId, deal.assignedTo, deal.assignedToName]
          .map(normalizeText)
          .some((value) => aliases.includes(value))
      )
      const wonDeals = ownedDeals.filter((deal) => normalizeText(deal.stage || deal.status) === 'won')
      const revenue = wonDeals.reduce((sum, deal) => sum + Number(deal.dealValue ?? deal.value ?? 0), 0)

      return {
        id: user.id,
        name: user.name,
        role: user.role || 'SALES_EXEC',
        leads: leadRows.length,
        deals: ownedDeals.length,
        revenue,
        convRate: leadRows.length ? Math.round((ownedDeals.length / leadRows.length) * 1000) / 10 : 0,
      }
    })

  const sorted = team.sort((left, right) => right.revenue - left.revenue || right.deals - left.deals || right.leads - left.leads)

  return sorted.map((member, index) => ({
    ...member,
    rank: index + 1,
    badge: index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`,
  }))
}

export const buildCustomerMetrics = ({ customers = [], deals = [], invoices = [] } = {}) => {
  const metrics = new Map()

  const addMetric = (key, updater) => {
    const current = metrics.get(key) || { revenue: 0, deals: 0 }
    updater(current)
    metrics.set(key, current)
  }

  for (const deal of deals) {
    const key = normalizeText(deal.company || deal.customerName || deal.customer || deal.accountName)
    if (!key) continue
    addMetric(key, (current) => {
      current.deals += 1
      if (normalizeText(deal.stage || deal.status) === 'won') {
        current.revenue += Number(deal.dealValue ?? deal.value ?? 0)
      }
    })
  }

  for (const invoice of invoices) {
    const key = normalizeText(invoice.customerName || invoice.company || invoice.customer || invoice.customerId)
    if (!key) continue
    addMetric(key, (current) => {
      if (normalizeText(invoice.status) === 'paid') {
        current.revenue += Number(invoice.total ?? invoice.subtotal ?? 0)
      }
    })
  }

  return (customers ?? []).map((customer) => {
    const key = normalizeText(customer.company || customer.name || customer.id)
    const metric = metrics.get(key) || { revenue: 0, deals: 0 }
    return {
      revenue: metric.revenue,
      deals: metric.deals,
    }
  })
}


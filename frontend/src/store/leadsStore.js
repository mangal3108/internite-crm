import { create } from 'zustand'
import { leadsAPI } from '../services/api'

const DEFAULT_SLA_MINUTES = 60
const DEFAULT_PAGE_SIZE = 200

const toIso = (value) => {
  if (!value) return null
  const s = typeof value === 'string' && !value.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(value)
    ? value + 'Z'
    : value
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const toBackendLocalDateTime = (value) => {
  const iso = toIso(value)
  if (!iso) return null
  return iso.slice(0, 19)
}

const formatCreatedDate = (value) => {
  const iso = toIso(value)
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
}

const sourceLabelToEnum = (source) => {
  const s = String(source || '').trim().toLowerCase()
  if (s === 'facebook') return 'FACEBOOK'
  if (s === 'instagram') return 'INSTAGRAM'
  if (s === 'linkedin') return 'LINKEDIN'
  if (s === 'website') return 'WEBSITE'
  if (s === 'whatsapp') return 'WHATSAPP'
  if (s === 'google ads') return 'GOOGLE_ADS'
  if (s === 'meta ads') return 'META_ADS'
  if (s === 'referral' || s.startsWith('referral:')) return 'REFERRAL'
  if (s === 'email') return 'EMAIL'
  return 'OTHER'
}

const referralNameFromDisplay = (source) => String(source || '').replace(/^referral:\s*/i, '').trim()

const sourceEnumToLabel = (source) => {
  const s = String(source || '').toUpperCase()
  if (s === 'GOOGLE_ADS') return 'Google Ads'
  if (s === 'META_ADS') return 'Meta Ads'
  return s ? `${s.charAt(0)}${s.slice(1).toLowerCase().replace('_', ' ')}` : 'Other'
}

const sourceDisplayLabel = (lead) => {
  const custom = String(lead?.sourceLabel || '').trim()
  const source = String(lead?.source || '').toUpperCase()
  if (source === 'REFERRAL' && custom) return `Referral: ${custom}`
  if (source === 'OTHER' && custom) return custom
  return sourceEnumToLabel(lead?.source)
}

const customSourceLabel = (lead) => {
  const source = String(lead?.source || '').trim()
  const sourceLabel = String(lead?.sourceLabel || '').trim()
  const sourceEnum = sourceLabelToEnum(source)
  if (sourceEnum !== 'OTHER' && sourceEnum !== 'REFERRAL') return null
  const custom = sourceLabel || (sourceEnum === 'REFERRAL' ? referralNameFromDisplay(source) : source)
  const blockedLabel = sourceEnum === 'REFERRAL' ? 'referral' : 'other'
  return custom && custom.toLowerCase() !== blockedLabel ? custom : null
}

const toFrontendLead = (lead, index = 0) => {
  const now = Date.now()
  const status = String(lead?.status || 'NEW').toLowerCase()
  const existingCreated = toIso(lead?.createdAtTs ?? lead?.createdAt)
  let createdAtTs = existingCreated

  if (!createdAtTs) {
    const offsetMinutes = status === 'new' ? (10 + (index * 23) % 120) : (5 + (index * 11) % 70)
    createdAtTs = new Date(now - offsetMinutes * 60 * 1000).toISOString()
  }

  const followUpSlaMinutes = Number(lead?.followUpSlaMinutes) > 0
    ? Number(lead.followUpSlaMinutes)
    : DEFAULT_SLA_MINUTES

  const firstResponseAtTs = toIso(lead?.firstResponseAtTs)
  const lastContactedAtTs = toIso(lead?.lastContactedAt)
  const lastActivityAtTs = toIso(lead?.lastActivityAtTs) ?? lastContactedAtTs ?? firstResponseAtTs ?? createdAtTs

  return {
    id: lead?.id,
    name: lead?.name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    service: lead?.service || '',
    specialization: lead?.specialization || lead?.subService || '',
    source: sourceDisplayLabel(lead),
    sourceLabel: lead?.sourceLabel || '',
    score: String(lead?.score || 'COLD').toLowerCase(),
    status,
    value: Number(lead?.dealValue ?? lead?.value ?? 0),
    assignedTo: lead?.assignedToName || lead?.assignedTo || '',
    assignedToId: lead?.assignedToId || null,
    tags: Array.isArray(lead?.tags) ? lead.tags.join(', ') : (lead?.tags || ''),
    notes: lead?.notes || '',
    createdAt: formatCreatedDate(createdAtTs),
    createdAtTs,
    lastActivityAtTs,
    lastContactedAtTs,
    firstResponseAtTs,
    followUpSlaMinutes,
    reminder15SentAt: toIso(lead?.reminder15SentAt),
    reminder45SentAt: toIso(lead?.reminder45SentAt),
    reminder60SentAt: toIso(lead?.reminder60SentAt),
    escalatedAt: toIso(lead?.escalatedAt),
    reassignedAt: toIso(lead?.reassignedAt),
    expectedCloseTimeline: lead?.expectedCloseTimeline || '',
    activityStageIndex: Number.isFinite(Number(lead?.activityStageIndex)) ? Number(lead.activityStageIndex) : null,
    activityLogs: Array.isArray(lead?.activityLogs) ? lead.activityLogs : [],
  }
}

const toBackendLead = (lead) => ({
  name: lead?.name || '',
  email: lead?.email || '',
  phone: lead?.phone || '',
  company: lead?.company || '',
  service: lead?.service || '',
  specialization: lead?.specialization || lead?.subService || '',
  source: sourceLabelToEnum(lead?.source),
  sourceLabel: customSourceLabel(lead),
  score: String(lead?.score || 'cold').toUpperCase(),
  status: String(lead?.status || 'new').toUpperCase(),
  dealValue: Number(lead?.value || 0),
  assignedToId: lead?.assignedToId || null,
  tags: String(lead?.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean),
  notes: lead?.notes || null,
  expectedCloseTimeline: lead?.expectedCloseTimeline || null,
  lastContactedAt: toBackendLocalDateTime(lead?.lastContactedAtTs || lead?.lastActivityAtTs),
  reminder15SentAt: lead?.reminder15SentAt || null,
  reminder45SentAt: lead?.reminder45SentAt || null,
  reminder60SentAt: lead?.reminder60SentAt || null,
  escalatedAt: lead?.escalatedAt || null,
  reassignedAt: lead?.reassignedAt || null,
})

export const useLeadsStore = create((set, get) => ({
  leads: [],
  loading: false,
  error: null,
  pagination: { page: 0, size: 20, total: 0 },
  filters: { search: '', score: 'all', status: 'all', source: 'all', assignedTo: 'all' },

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  replaceLeads: (leads) =>
    set(() => ({ leads: (leads ?? []).map((lead, i) => toFrontendLead(lead, i)) })),

  patchLeadLocal: (id, patch) =>
    set((s) => ({
      leads: s.leads.map((lead, i) => {
        if (lead.id !== id) return lead
        const next = typeof patch === 'function' ? patch(lead) : { ...lead, ...patch }
        return toFrontendLead(next, i)
      }),
    })),

  fetchLeads: async (params) => {
    set({ loading: true, error: null })
    try {
      const stateFilters = get().filters
      const query = { ...stateFilters, ...params }

      if (query.score === 'all') delete query.score
      if (query.status === 'all') delete query.status
      if (query.source === 'all') delete query.source
      if (query.assignedTo === 'all') delete query.assignedTo
      if (!query.search) delete query.search

      const hasExplicitPage = query.page !== undefined || query.size !== undefined
      let rows = []
      let pageInfo = { page: 0, size: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 }

      if (hasExplicitPage) {
        const data = await leadsAPI.getAll(query)
        rows = data?.content ?? []
        pageInfo = {
          page: data?.page ?? 0,
          size: data?.size ?? (Number(query.size) || DEFAULT_PAGE_SIZE),
          total: data?.total ?? rows.length,
          totalPages: data?.totalPages ?? 1,
        }
      } else {
        const pageSize = Number(query.size) > 0 ? Number(query.size) : DEFAULT_PAGE_SIZE
        const firstPage = await leadsAPI.getAll({ ...query, page: 0, size: pageSize })
        rows = firstPage?.content ?? []

        const totalPages = Math.max(1, Number(firstPage?.totalPages ?? 1))
        const total = Number(firstPage?.total ?? rows.length)

        if (totalPages > 1) {
          const requests = []
          for (let page = 1; page < totalPages; page += 1) {
            requests.push(leadsAPI.getAll({ ...query, page, size: pageSize }))
          }
          const remainingPages = await Promise.all(requests)
          for (const pageData of remainingPages) {
            rows = rows.concat(pageData?.content ?? [])
          }
        }

        pageInfo = { page: 0, size: pageSize, total: total || rows.length, totalPages }
      }

      const leads = rows.map((lead, i) => toFrontendLead(lead, i))
      set({
        leads,
        pagination: { page: pageInfo.page, size: pageInfo.size, total: pageInfo.total },
        loading: false,
      })
      return leads
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to fetch leads' })
      throw err
    }
  },

  fetchPipelineBoard: async (params) => {
    set({ loading: true, error: null })
    try {
      const stateFilters = get().filters
      const query = { ...stateFilters, ...params }
      const append = Boolean(query.append)
      delete query.append

      if (query.score === 'all') delete query.score
      if (query.status === 'all') delete query.status
      if (query.source === 'all') delete query.source
      if (query.assignedTo === 'all') delete query.assignedTo
      if (!query.search) delete query.search

      const pageSize = Number(query.size) > 0 ? Number(query.size) : DEFAULT_PAGE_SIZE
      const firstPage = await leadsAPI.getPipelineBoard({ ...query, page: query.page ?? 0, size: pageSize })
      const rows = firstPage?.content ?? []
      const activities = { ...(firstPage?.activities ?? {}) }

      const leads = rows.map((lead, i) => toFrontendLead(lead, i))
      const currentLeads = append ? get().leads : []
      const seenIds = new Set(currentLeads.map((lead) => String(lead.id)))
      const nextLeads = append
        ? currentLeads.concat(leads.filter((lead) => !seenIds.has(String(lead.id))))
        : leads

      set({
        leads: nextLeads,
        pagination: {
          page: firstPage?.page ?? 0,
          size: firstPage?.size ?? pageSize,
          total: firstPage?.total ?? rows.length,
        },
        loading: false,
      })

      return {
        leads,
        allLeads: nextLeads,
        activities,
        pageInfo: {
          page: firstPage?.page ?? 0,
          size: firstPage?.size ?? pageSize,
          total: firstPage?.total ?? nextLeads.length,
          totalPages: firstPage?.totalPages ?? 1,
          last: Boolean(firstPage?.last),
        },
        hasMore: firstPage?.last !== true,
      }
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to fetch pipeline board' })
      throw err
    }
  },

  createLead: async (data) => {
    set({ loading: true, error: null })
    try {
      const created = await leadsAPI.create(toBackendLead(data))
      const lead = toFrontendLead(created)
      set((s) => ({ leads: [lead, ...s.leads], loading: false }))
      return lead
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to create lead' })
      throw err
    }
  },

  updateLead: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const updated = await leadsAPI.update(id, toBackendLead(data))
      const lead = toFrontendLead(updated)
      set((s) => ({
        leads: s.leads.map((l) => (l.id === id ? lead : l)),
        loading: false,
      }))
      return lead
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to update lead' })
      throw err
    }
  },

  deleteLead: async (id) => {
    set({ loading: true, error: null })
    try {
      await leadsAPI.delete(id)
      set((s) => ({ leads: s.leads.filter((l) => l.id !== id), loading: false }))
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to delete lead' })
      throw err
    }
  },

  bulkDelete: async (ids) => {
    set({ loading: true, error: null })
    try {
      await leadsAPI.bulkDelete(ids)
      set((s) => ({ leads: s.leads.filter((l) => !ids.includes(l.id)), loading: false }))
    } catch (err) {
      set({ loading: false, error: err?.message || 'Failed to delete leads' })
      throw err
    }
  },
}))

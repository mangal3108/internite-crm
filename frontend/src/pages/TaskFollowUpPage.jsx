import InfoHint from '../components/ui/InfoHint'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  RefreshCw,
  Search,
  User,
  Phone,
  Trophy,
  Clock,
  X,
  Building2,
  CalendarDays,
  CalendarCheck,
  Eye,
  History,
  FileText,
  Upload,
  Download,
  PlayCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import LeadActivitiesModal from '../components/LeadActivitiesModal'
import ScreenModalPortal from '../components/ui/ScreenModalPortal'
import CopyableContact from '../components/ui/CopyableContact'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { leadsAPI, tasksAPI } from '../services/api'
import { anyFieldMatchesSearch } from '../utils/search'
import { emptyDateRange, isWithinDateRange } from '../utils/dateRangeFilter'

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

const readJsonFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      resolve(JSON.parse(String(reader.result || '{}')))
    } catch {
      reject(new Error('Please choose a valid Task Follow-up JSON export.'))
    }
  }
  reader.onerror = () => reject(new Error('Unable to read import file.'))
  reader.readAsText(file)
})

const downloadBlobFile = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const pickFields = (row, fields) => fields.reduce((acc, field) => {
  if (row?.[field] !== undefined) acc[field] = row[field]
  return acc
}, {})

const todayIST = () => {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
}

const dateOnlyStr = (d) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const getLeadFollowUpDate = (lead) => {
  const vals = lead.stageValues || []
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i]
    const d = v?.nextFollowUpDate || v?.followUpDate
    if (d && String(d).trim()) return String(d).trim().slice(0, 10)
  }
  if (lead.followUpDate) return String(lead.followUpDate).trim().slice(0, 10)
  return null
}

const TABS = [
  { key: 'welcome_call', label: 'Welcome Call', stageIdx: 0 },
  { key: 'followup_meeting', label: 'Follow-up Meeting', stageIdx: 1 },
  { key: 'meeting_outcome', label: 'Meeting Outcome', stageIdx: 2 },
  { key: 'todays_followup', label: "Today's Followup", stageIdx: -1 },
]

const LEADS_PER_PAGE = 8

const ACTIVITY_DEFS = [
  { idx: 0, id: 'act01', label: 'Activity 01', title: 'Welcome Call', icon: Phone, color: 'red' },
  { idx: 1, id: 'act02', label: 'Activity 02', title: 'Follow Up for Meeting', icon: Clock, color: 'blue' },
  { idx: 2, id: 'act03', label: 'Activity 03', title: 'Meeting Outcome', icon: Trophy, color: 'green' },
]

const COLOR_MAP = {
  red: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ring: 'ring-red-400/40',
  },
  blue: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ring: 'ring-blue-400/40',
  },
  sky: {
    dot: 'bg-brand-500',
    badge: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
    ring: 'ring-brand-400/40',
  },
  green: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    ring: 'ring-emerald-400/40',
  },
}

const normalizeOutcome = (v) => String(v || '').trim().toLowerCase()
const normalizeStatusText = (v) => normalizeOutcome(v).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

const activityTimestamp = (activity, fallback = 0) => {
  const time = new Date(activity?.savedAt || activity?.createdAt || activity?.updatedAt || 0).getTime()
  return Number.isNaN(time) ? fallback : time
}

const getActivityIndex = (activity) => {
  const numeric = Number(activity?.activityIndex)
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) return numeric

  const label = `${activity?.activityLabel || ''} ${activity?.activityTitle || ''} ${activity?.summary || ''}`.toLowerCase()
  if (label.includes('01') || label.includes('welcome call') || label.includes('call outcome')) return 0
  if (label.includes('02') || label.includes('follow up for meeting')) return 1
  if (label.includes('03') || label.includes('allowed person')) return 2
  if (label.includes('04') || label.includes('meeting outcome')) return 3
  return -1
}

const getStageStatus = (stageIdx, values = {}) => {
  const status = normalizeStatusText(values.status || values.connectionStatus || values.callOutcome || values.outcome || values.meetingStatus || '')
  if (stageIdx === 0) {
    if (status === 'connected') return 'connected'
    if (status === 'not connected' || status === 'non connected' || status === 'no answer') return 'not_connected'
    if (status === 'callback' || status === 'call back' || status === 'call-back' || status === 'callback requested') return 'callback'
    return 'done'
  }
  if (stageIdx === 1) {
    if (status === 'meeting' || status === 'allowed person for meeting' || status === 'allowed person') return 'allowed_person'
    if (status === 'follow up' || status === 'followup') return 'follow_up'
    if (status === 'not interested') return 'not_interested'
    if (status === 'lost' || status === 'close lost' || status === 'closed lost') return 'lost'
    return 'done'
  }
  if (stageIdx === 2) {
    if (status === 'successful' || status === 'success') return 'successful'
    if (status === 'reschedule' || status === 'rescheduled' || status === 'failed' || status === 'failure') return 'reschedule'
    return 'done'
  }
  if (stageIdx === 3) {
    if (status === 'won' || status === 'win' || status === 'closed won') return 'won'
    if (status === 'lost' || status === 'close lost' || status === 'closed lost') return 'lost'
    if (status === 'negotiation') return 'negotiation'
    if (status === 'hold' || status === 'follow up' || status === 'followup') return 'hold'
    if (status === 'pending' || status === 'pending review' || status === 'pending decision') return 'pending_review'
    return 'done'
  }
  return 'done'
}

function parseLeadActivities(activities) {
  const stages = [null, null, null, null]
  const stageValues = [{}, {}, {}, {}]
  let latestActivity = null
  let currentStage = -1

  for (const act of activities) {
    if (act?.activityId === 'call-recording' || act?.values?.recording === true) continue
    const idx = getActivityIndex(act)

    if (idx >= 0) {
      const ts = activityTimestamp(act)
      const prev = stages[idx]
      if (!prev || ts > activityTimestamp(prev)) {
        stages[idx] = act
        stageValues[idx] = act.values || {}
      }

      if (!latestActivity || ts > activityTimestamp(latestActivity)) {
        latestActivity = act
        currentStage = idx
      }
    }
  }

  let isCompleted = false
  let outcome = null
  let completedAt = null
  let finalPrice = null
  let lostCategory = null

  if (latestActivity) {
    const v = latestActivity.values || {}
    const status = normalizeStatusText(v.status || v.outcome)
    if (status === 'won' || status === 'win' || status === 'closed won') {
      isCompleted = true
      outcome = 'Won'
      completedAt = latestActivity.savedAt || latestActivity.createdAt
      finalPrice = v.meetingPriceFinal || null
    } else if (status === 'lost' || status === 'close lost' || status === 'closed lost') {
      isCompleted = true
      outcome = 'Lost'
      completedAt = latestActivity.savedAt || latestActivity.createdAt
      lostCategory = v.lostCategory || null
    }
  }

  const stageStatuses = stages.map((s, i) => {
    if (!s) return 'not_started'
    return getStageStatus(i, stageValues[i])
  })

  return { stages, stageValues, stageStatuses, currentStage, latestActivity, isCompleted, outcome, completedAt, finalPrice, lostCategory }
}

function getStatusLabel(stageIdx, status) {
  if (status === 'not_started') return 'Not Started'
  if (stageIdx === 0) {
    if (status === 'connected') return 'Connected'
    if (status === 'not_connected' || status === 'non_connected') return 'Not Connected'
    if (status === 'callback') return 'CallBack'
  }
  if (stageIdx === 1) {
    if (status === 'meeting' || status === 'allowed_person') return 'Allowed Person for Meeting'
    if (status === 'follow_up') return 'Follow Up'
    if (status === 'not_interested') return 'Not Interested'
    if (status === 'lost') return 'Lost'
  }
  if (stageIdx === 2) {
    if (status === 'successful') return 'Successful'
    if (status === 'reschedule' || status === 'failed') return 'Reschedule'
  }
  if (stageIdx === 3) {
    if (status === 'won') return 'Won'
    if (status === 'lost') return 'Lost'
    if (status === 'negotiation') return 'Negotiation'
    if (status === 'hold') return 'Hold'
    if (status === 'pending_review' || status === 'pending') return 'Pending Review'
  }
  return 'Done'
}

function getStatusColor(status) {
  if (status === 'not_started') return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  if (status === 'connected' || status === 'meeting' || status === 'allowed_person' || status === 'successful' || status === 'won')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (status === 'not_connected' || status === 'non_connected' || status === 'not_interested' || status === 'reschedule' || status === 'failed' || status === 'lost')
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  if (status === 'follow_up' || status === 'callback' || status === 'hold' || status === 'negotiation' || status === 'pending_review' || status === 'pending')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

const isCompletedTask = (task) => {
  const status = String(task?.status || '').toUpperCase()
  return status === 'COMPLETED' || status === 'DONE' || status === 'CLOSED'
}

const timestampMs = (value, fallback = Number.MAX_SAFE_INTEGER) => {
  if (!value) return fallback
  const time = parseServerDateTime(value).getTime()
  return Number.isNaN(time) ? fallback : time
}

const sortTasksByUrgency = (rows = []) => [...rows].sort((a, b) => {
  const aDone = isCompletedTask(a)
  const bDone = isCompletedTask(b)
  if (aDone !== bDone) return aDone ? 1 : -1
  if (!aDone) {
    return timestampMs(a.dueDate || a.createdAt) - timestampMs(b.dueDate || b.createdAt)
  }
  return timestampMs(b.completedAt || b.updatedAt || b.createdAt, 0) - timestampMs(a.completedAt || a.updatedAt || a.createdAt, 0)
})

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = parseServerDateTime(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const latestTimestampValue = (...values) => {
  const valid = values
    .filter(Boolean)
    .map((value) => ({ value, time: timestampMs(value, 0) }))
    .filter((entry) => entry.time > 0)
    .sort((a, b) => b.time - a.time)
  return valid[0]?.value || null
}

const getLeadLastUpdateAt = (lead) => latestTimestampValue(
  lead?.updatedAt,
  lead?.latestActivity?.savedAt,
  lead?.latestActivity?.createdAt,
  lead?.latestActivity?.updatedAt,
  lead?.latestTask?.completedAt,
  lead?.latestTask?.updatedAt,
  lead?.latestTask?.createdAt,
  lead?.createdAt
)

const getLeadOutcomeKey = (lead) => {
  const candidates = [lead?.status, lead?.outcome].map(normalizeStatusText)
  if (candidates.some((status) => status === 'won' || status === 'win' || status === 'closed won')) return 'won'
  if (candidates.some((status) => status === 'lost' || status === 'close lost' || status === 'closed lost')) return 'lost'
  return null
}

const isActiveFollowupLead = (lead) => !getLeadOutcomeKey(lead)

const parseServerDateTime = (value) => {
  if (!value) return new Date(NaN)
  if (value instanceof Date) return value
  const raw = String(value).trim()
  if (!raw) return new Date(NaN)
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const looksLikeServerLocalDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)
  return new Date(looksLikeServerLocalDateTime && !hasExplicitZone ? `${raw}Z` : raw)
}

const DESCRIPTION_LABELS = {
  status: 'Status',
  connectionStatus: 'Status',
  callOutcome: 'Status',
  outcome: 'Status',
  remarkStatus: 'Status',
  remark: 'Remarks',
  remarks: 'Remarks',
  note: 'Remarks',
  remarkWon: 'Remarks',
  remarkLost: 'Remarks',
  lostCategory: 'Lost category',
  nextFollowUpDate: 'Next follow-up',
  followUpDate: 'Next follow-up',
  meetingPriceFinal: 'Final price',
  paymentReceived: 'Payment received',
}

const IMPORTANT_DUPLICATE_LABELS = new Set(['Lost category', 'Next follow-up', 'Final price', 'Payment received'])

const cleanTimelineDescription = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const parts = raw.split('|').map((part) => part.trim()).filter(Boolean)
  const cleaned = []
  const seenLabels = new Set()
  const seenValues = new Set()

  parts.forEach((part) => {
    const [rawKey, ...rest] = part.split(':')
    if (!rest.length) {
      const normalizedText = part.toLowerCase()
      if (!seenValues.has(normalizedText)) {
        seenValues.add(normalizedText)
        cleaned.push(part)
      }
      return
    }

    const key = rawKey.trim()
    const valueText = rest.join(':').trim()
    if (!valueText) return
    const label = DESCRIPTION_LABELS[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
    const normalizedValue = valueText.toLowerCase()
    if (seenLabels.has(label)) return
    if (seenValues.has(normalizedValue) && !IMPORTANT_DUPLICATE_LABELS.has(label)) return
    seenLabels.add(label)
    seenValues.add(normalizedValue)
    cleaned.push(`${label}: ${valueText}`)
  })

  return cleaned.join(' | ')
}

const taskStatusLabel = (task) => String(task?.status || 'PENDING').replace(/_/g, ' ')

const activityNote = (activity) => {
  if (activity?.summary) return cleanTimelineDescription(activity.summary)
  const values = activity?.values || {}
  return cleanTimelineDescription(Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ')) || 'Activity saved'
}

const buildLeadImportPayload = (lead) => pickFields(lead, [
  'name',
  'email',
  'phone',
  'company',
  'website',
  'designation',
  'service',
  'specialization',
  'source',
  'status',
  'score',
  'priority',
  'dealValue',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'aiScoreValue',
  'aiNextAction',
  'assignedToId',
  'tags',
  'notes',
  'facebookLeadId',
  'facebookFormId',
  'facebookAdId',
  'expectedCloseTimeline',
  'lastContactedAt',
  'convertedAt',
  'lostReason',
  'followUpDate',
  'revenueValue',
])

const buildActivityImportPayload = (activity) => {
  const activityIndex = Number(activity?.activityIndex)
  return {
    activityIndex: Number.isInteger(activityIndex) && activityIndex >= 0 ? activityIndex : 0,
    activityId: activity?.activityId || null,
    activityLabel: activity?.activityLabel || `Activity ${Number.isInteger(activityIndex) ? activityIndex + 1 : 1}`,
    activityTitle: activity?.activityTitle || '',
    assignedTo: activity?.assignedTo || 'Unassigned',
    values: activity?.values && typeof activity.values === 'object' ? activity.values : {},
    summary: activity?.summary || activityNote(activity),
  }
}

const buildTaskImportPayload = (task, leadId) => pickFields({ ...task, leadId: task?.leadId || leadId }, [
  'title',
  'description',
  'type',
  'status',
  'priority',
  'dueDate',
  'leadId',
  'dealId',
  'assignedToId',
])

function StageIcon({ currentStage }) {
  const stageIdx = currentStage <= 0 ? 0 : currentStage >= 3 ? 2 : Math.min(currentStage, 2)
  const def = ACTIVITY_DEFS[stageIdx]
  if (!def) return null
  const Icon = def.icon
  const colors = COLOR_MAP[def.color]
  return (
    <div className="group relative flex flex-col items-center">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colors.dot} text-white shadow-sm ring-2 ${colors.ring}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="pointer-events-none absolute -bottom-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {def.title}
      </div>
    </div>
  )
}

export default function TaskFollowUpPage() {
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [leadActivities, setLeadActivities] = useState({})
  const [leadStages, setLeadStages] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [activeTab, setActiveTab] = useState('welcome_call')
  const [followupDateFilter, setFollowupDateFilter] = useState('today')
  const [followupCustomDate, setFollowupCustomDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState(emptyDateRange)
  const [dateSortDirection, setDateSortDirection] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [activitiesLead, setActivitiesLead] = useState(null)
  const [historyLead, setHistoryLead] = useState(null)
  const [historyLoadingLeadId, setHistoryLoadingLeadId] = useState(null)
  const [fullHistoryLeadIds, setFullHistoryLeadIds] = useState(() => new Set())
  const [timelineEventsByLeadId, setTimelineEventsByLeadId] = useState({})
  const [timelineMetaByLeadId, setTimelineMetaByLeadId] = useState({})
  const [timelineLoadingLeadId, setTimelineLoadingLeadId] = useState(null)
  const [recordingUploadingLeadId, setRecordingUploadingLeadId] = useState(null)
  const [recordingPlayingActivityId, setRecordingPlayingActivityId] = useState(null)
  const [backupExporting, setBackupExporting] = useState(false)
  const [backupImporting, setBackupImporting] = useState(false)
  const historyRequestsRef = useRef(new Map())
  const timelineRequestsRef = useRef(new Map())
  const recordingInputRef = useRef(null)
  const backupImportInputRef = useRef(null)

  const loadAllActivities = useCallback(async (leadRows) => {
    const leadIds = Array.from(new Set((leadRows || []).map((lead) => lead?.id).filter(Boolean)))
    if (!leadIds.length) {
      return
    }
    setLoadingActivities(true)
    try {
      const results = leadIds.reduce((acc, leadId) => {
        acc[leadId] = []
        return acc
      }, {})
      const bulkBatchSize = 50
      const bulkBatches = []
      for (let i = 0; i < leadIds.length; i += bulkBatchSize) {
        bulkBatches.push(leadIds.slice(i, i + bulkBatchSize))
      }

      const responses = await Promise.allSettled(
        bulkBatches.map((batch) => leadsAPI.getActivitiesBulk(batch))
      )
      const failedLeadIds = []
      responses.forEach((res, index) => {
        const batch = bulkBatches[index]
        if (res.status === 'fulfilled') {
          const payload = res.value || {}
          batch.forEach((leadId) => {
            results[leadId] = unwrapList(payload[leadId])
          })
        } else {
          failedLeadIds.push(...batch)
        }
      })

      if (failedLeadIds.length) {
        for (let i = 0; i < failedLeadIds.length; i += 10) {
          const batch = failedLeadIds.slice(i, i + 10)
          const fallbackResponses = await Promise.allSettled(
            batch.map((leadId) => leadsAPI.getActivities(leadId))
          )
          fallbackResponses.forEach((res, j) => {
            const leadId = batch[j]
            results[leadId] = res.status === 'fulfilled' ? unwrapList(res.value) : []
          })
        }
      }

      setLeadActivities((prev) => {
        const next = { ...prev }
        Object.entries(results).forEach(([leadId, rows]) => {
          if (Array.isArray(prev[leadId]) && prev[leadId].length > rows.length) return
          next[leadId] = rows
        })
        return next
      })
    } catch (err) {
      const results = {}
      let failedCount = 0
      const batchSize = 10
      for (let i = 0; i < leadIds.length; i += batchSize) {
        const batch = leadIds.slice(i, i + batchSize)
        const responses = await Promise.allSettled(
          batch.map((leadId) => leadsAPI.getActivities(leadId))
        )
        responses.forEach((res, j) => {
          const leadId = batch[j]
          if (res.status === 'fulfilled') {
            results[leadId] = unwrapList(res.value)
          } else {
            failedCount += 1
            results[leadId] = []
          }
        })
      }
      setLeadActivities((prev) => {
        const next = { ...prev }
        Object.entries(results).forEach(([leadId, rows]) => {
          if (Array.isArray(prev[leadId]) && prev[leadId].length > rows.length) return
          next[leadId] = rows
        })
        return next
      })
      if (failedCount >= leadIds.length) {
        toast.error('Unable to load activity data')
      }
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLeadActivities({})
    setLeadStages({})
    setFullHistoryLeadIds(new Set())
    setTimelineEventsByLeadId({})
    setTimelineMetaByLeadId({})
    historyRequestsRef.current.clear()
    timelineRequestsRef.current.clear()
    try {
      const [leadResponse, pendingTaskResponse] = await Promise.all([
        leadsAPI.getAll({ page: 0, size: 500, sort: 'createdAt,desc' }),
        tasksAPI.getAll({ status: 'PENDING' }),
      ])
      const leadRows = unwrapList(leadResponse)
      const pendingTaskRows = unwrapList(pendingTaskResponse)
      const leadById = new Map(leadRows.map((lead) => [lead.id, lead]))
      const visiblePendingTaskRows = pendingTaskRows.filter((task) => task.leadId && leadById.has(task.leadId))
      // Fetch lightweight stages (fast) — just max activityIndex per lead
      const allLeadIds = leadRows.map((l) => l.id).filter(Boolean)
      try {
        const stagesData = await leadsAPI.getActivityStages(allLeadIds)
        if (stagesData && typeof stagesData === 'object') {
          setLeadStages(stagesData)
        }
      } catch {}

      setLeads(leadRows)
      setTasks(visiblePendingTaskRows)
      setLoading(false)
      loadAllActivities(leadRows)
    } catch (err) {
      toast.error(err?.message || 'Unable to load task follow-up data')
      setLoading(false)
    }
  }, [loadAllActivities])

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, dateSortDirection, dateRange])

  const ensureLeadActivities = useCallback(async (leadId) => {
    if (!leadId || fullHistoryLeadIds.has(leadId)) return
    const existingRequest = historyRequestsRef.current.get(leadId)
    if (existingRequest) return existingRequest

    setHistoryLoadingLeadId(leadId)
    const request = leadsAPI.getActivities(leadId)
      .then((acts) => {
        setLeadActivities((prev) => ({ ...prev, [leadId]: unwrapList(acts) }))
        setFullHistoryLeadIds((prev) => {
          const next = new Set(prev)
          next.add(leadId)
          return next
        })
      })
      .catch((err) => {
        toast.error(err?.message || 'Unable to load lead history')
      })
      .finally(() => {
        historyRequestsRef.current.delete(leadId)
        setHistoryLoadingLeadId((current) => (current === leadId ? null : current))
      })

    historyRequestsRef.current.set(leadId, request)
    return request
  }, [fullHistoryLeadIds])

  const loadLeadTimeline = useCallback(async (leadId, page = 0, options = {}) => {
    if (!leadId) return null
    const { append = page > 0, rebuildIfEmpty = page === 0 } = options
    const requestKey = `${leadId}:${page}`
    const existingRequest = timelineRequestsRef.current.get(requestKey)
    if (existingRequest) return existingRequest

    setTimelineLoadingLeadId(leadId)
    const request = leadsAPI.getTimeline(leadId, { page, size: 20 })
      .then(async (payload) => {
        let response = payload || {}
        if (rebuildIfEmpty && page === 0 && Number(response.total || 0) === 0) {
          try {
            await leadsAPI.rebuildTimeline(leadId)
            response = await leadsAPI.getTimeline(leadId, { page: 0, size: 20 })
          } catch {}
        }

        const rows = unwrapList(response)
        setTimelineEventsByLeadId((prev) => ({
          ...prev,
          [leadId]: append ? [...(prev[leadId] || []), ...rows] : rows,
        }))
        setTimelineMetaByLeadId((prev) => ({
          ...prev,
          [leadId]: {
            page: response.page ?? page,
            size: response.size ?? 20,
            total: response.total ?? rows.length,
            totalPages: response.totalPages ?? 1,
            last: response.last ?? true,
            loaded: true,
          },
        }))
        return response
      })
      .catch((err) => {
        toast.error(err?.message || 'Unable to load timeline')
        setTimelineMetaByLeadId((prev) => ({
          ...prev,
          [leadId]: { ...(prev[leadId] || {}), loaded: true, error: true },
        }))
        return null
      })
      .finally(() => {
        timelineRequestsRef.current.delete(requestKey)
        setTimelineLoadingLeadId((current) => (current === leadId ? null : current))
      })

    timelineRequestsRef.current.set(requestKey, request)
    return request
  }, [])

  const enrichedLeads = useMemo(() => {
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const tasksByLead = tasks.reduce((acc, task) => {
      if (!task.leadId) return acc
      if (!acc.has(task.leadId)) acc.set(task.leadId, [])
      acc.get(task.leadId).push(task)
      return acc
    }, new Map())

    const baseLeads = tasksByLead.size
      ? Array.from(tasksByLead.keys())
          .map((leadId) => leadById.get(leadId))
          .filter(Boolean)
          .map((lead) => ({ ...lead, leadExists: true }))
      : leads.map((lead) => ({ ...lead, leadExists: true }))

    return baseLeads.map((lead) => {
      const activities = leadActivities[lead.id] || []
      const parsed = parseLeadActivities(activities)
      // Use lightweight stage data as fallback when full activities haven't loaded yet
      if (activities.length === 0 && leadStages[lead.id] != null && leadStages[lead.id] >= 0) {
        parsed.currentStage = leadStages[lead.id]
      }
      const leadTasks = sortTasksByUrgency(tasksByLead.get(lead.id) || [])
      const pendingTasks = leadTasks.filter((task) => !isCompletedTask(task))
      const completedTasks = leadTasks.filter(isCompletedTask)
      const nextTask = pendingTasks[0]
      const latestTask = leadTasks[0]

      return {
        ...lead,
        ...parsed,
        activityCount: activities.length,
        tasks: leadTasks,
        pendingTaskCount: pendingTasks.length,
        completedTaskCount: completedTasks.length,
        nextTask,
        latestTask,
        taskDriven: leadTasks.length > 0,
      }
    })
  }, [leads, leadActivities, leadStages, tasks])

  const stageLeads = useMemo(() => {
    const isPending = (l) => tasks.length ? l.pendingTaskCount > 0 && !l.isCompleted : !l.isCompleted
    let pendingAll = enrichedLeads.filter((lead) => isPending(lead) && isActiveFollowupLead(lead))
    pendingAll = pendingAll.filter((lead) => isWithinDateRange(getLeadLastUpdateAt(lead), dateRange))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      pendingAll = pendingAll.filter(
        (l) =>
          anyFieldMatchesSearch(q, [l.name, l.phone, l.phoneNumber, l.mobileNumber, l.company, l.email, l.nextTask?.title])
      )
    }
    const sorter = (a, b) => {
      const direction = dateSortDirection === 'desc' ? -1 : 1
      return direction * (
        timestampMs(a.nextTask?.dueDate || a.followUpDate || a.createdAt)
        - timestampMs(b.nextTask?.dueDate || b.followUpDate || b.createdAt)
      )
    }
    const today = todayIST()
    const todayStr = dateOnlyStr(today)
    let targetDate = todayStr
    if (followupDateFilter === 'yesterday') targetDate = dateOnlyStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
    else if (followupDateFilter === 'tomorrow') targetDate = dateOnlyStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
    else if (followupDateFilter === 'custom' && followupCustomDate) targetDate = followupCustomDate

    let filteredFollowup = enrichedLeads
      .filter((l) => getLeadFollowUpDate(l) === targetDate)
      .filter((lead) => isWithinDateRange(getLeadLastUpdateAt(lead), dateRange))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filteredFollowup = filteredFollowup.filter(
        (l) => anyFieldMatchesSearch(q, [l.name, l.phone, l.phoneNumber, l.mobileNumber, l.company, l.email, l.nextTask?.title])
      )
    }
    filteredFollowup.sort(sorter)
    filteredFollowup = filteredFollowup.map((l) => ({ ...l, _followUpDate: getLeadFollowUpDate(l) }))

    return {
      welcome_call: pendingAll.filter((l) => l.currentStage <= 0).sort(sorter),
      followup_meeting: pendingAll.filter((l) => l.currentStage === 1).sort(sorter),
      meeting_outcome: pendingAll.filter((l) => l.currentStage === 2 || l.currentStage === 3).sort(sorter),
      todays_followup: filteredFollowup,
    }
  }, [dateSortDirection, enrichedLeads, searchQuery, tasks.length, followupDateFilter, followupCustomDate, dateRange])

  const stats = useMemo(() => {
    const isPending = (l) => tasks.length ? l.pendingTaskCount > 0 && !l.isCompleted : !l.isCompleted
    const pending = enrichedLeads.filter((lead) => isPending(lead) && isActiveFollowupLead(lead))
      .filter((lead) => isWithinDateRange(getLeadLastUpdateAt(lead), dateRange))
    const todayStr = dateOnlyStr(todayIST())
    const followupCount = enrichedLeads
      .filter((l) => getLeadFollowUpDate(l) === todayStr)
      .filter((lead) => isWithinDateRange(getLeadLastUpdateAt(lead), dateRange))
      .length
    return {
      welcomeCall: pending.filter((l) => l.currentStage <= 0).length,
      followupMeeting: pending.filter((l) => l.currentStage === 1).length,
      meetingOutcome: pending.filter((l) => l.currentStage === 2 || l.currentStage === 3).length,
      todaysFollowup: followupCount,
    }
  }, [dateRange, enrichedLeads, tasks.length])

  const completedOutcomeLeads = useMemo(() => {
    const tasksByLead = tasks.reduce((acc, task) => {
      if (!task.leadId) return acc
      if (!acc.has(task.leadId)) acc.set(task.leadId, [])
      acc.get(task.leadId).push(task)
      return acc
    }, new Map())

    return leads
      .map((lead) => {
        const activities = leadActivities[lead.id] || []
        const parsed = parseLeadActivities(activities)
        const leadTasks = sortTasksByUrgency(tasksByLead.get(lead.id) || [])
        const enriched = {
          ...lead,
          ...parsed,
          latestTask: leadTasks[0],
          tasks: leadTasks,
          taskDriven: leadTasks.length > 0,
        }
        const outcomeKey = getLeadOutcomeKey(enriched)
        return outcomeKey ? { ...enriched, outcomeKey } : null
      })
      .filter(Boolean)
      .sort((a, b) => timestampMs(getLeadLastUpdateAt(b), 0) - timestampMs(getLeadLastUpdateAt(a), 0))
  }, [leads, leadActivities, tasks])

  const wonOutcomeLeads = completedOutcomeLeads.filter((lead) => lead.outcomeKey === 'won')
  const lostOutcomeLeads = completedOutcomeLeads.filter((lead) => lead.outcomeKey === 'lost')

  const handleExportBackup = async () => {
    setBackupExporting(true)
    try {
      const blob = await leadsAPI.export({ format: 'xlsx' })
      downloadBlobFile(blob, `internite-leads-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('All leads exported to Excel.')
    } catch (err) {
      toast.error(err?.message || 'Unable to export leads')
    } finally {
      setBackupExporting(false)
    }
  }

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBackupImporting(true)
    try {
      if (!/\.json$/i.test(file.name || '')) {
        await leadsAPI.import(file)
        await refresh()
        toast.success('Leads imported from Excel.')
        return
      }

      const payload = await readJsonFile(file)
      const records = Array.isArray(payload?.leads) ? payload.leads : []
      if (payload?.schema !== 'internite.task-followup.backup' || !records.length) {
        throw new Error('This file is not a Task Follow-up JSON export.')
      }

      const results = { leads: 0, tasks: 0, activities: 0, skipped: 0, failed: 0 }
      for (const record of records) {
        const leadId = record?.lead?.id
        if (!leadId) {
          results.skipped += 1
          continue
        }

        try {
          const currentLead = await leadsAPI.getById(leadId)
          const leadPayload = buildLeadImportPayload({ ...currentLead, ...record.lead })
          await leadsAPI.update(leadId, leadPayload)
          results.leads += 1

          const existingTasks = unwrapList(await tasksAPI.getByLead(leadId).catch(() => []))
          const existingTaskIds = new Set(existingTasks.map((task) => task.id).filter(Boolean))
          for (const task of record.tasks || []) {
            try {
              const taskPayload = buildTaskImportPayload(task, leadId)
              if (!taskPayload.title) {
                results.skipped += 1
                continue
              }
              if (task.id && existingTaskIds.has(task.id)) {
                await tasksAPI.update(task.id, taskPayload)
              } else {
                await tasksAPI.create(taskPayload)
              }
              results.tasks += 1
            } catch {
              results.failed += 1
            }
          }

          const existingActivities = unwrapList(await leadsAPI.getActivities(leadId).catch(() => []))
          const existingActivityIds = new Set(existingActivities.map((activity) => activity.id).filter(Boolean))
          for (const activity of record.activities || []) {
            try {
              const activityPayload = buildActivityImportPayload(activity)
              if (activity.id && existingActivityIds.has(activity.id)) {
                await leadsAPI.updateActivity(leadId, activity.id, activityPayload)
              } else if (activity.activityId !== 'call-recording') {
                await leadsAPI.addActivity(leadId, activityPayload)
              } else {
                results.skipped += 1
                continue
              }
              results.activities += 1
            } catch {
              results.failed += 1
            }
          }

          await leadsAPI.rebuildTimeline(leadId).catch(() => {})
        } catch {
          results.failed += 1
        }
      }

      await refresh()
      const message = `Imported ${results.leads} lead${results.leads === 1 ? '' : 's'}, ${results.tasks} task${results.tasks === 1 ? '' : 's'}, ${results.activities} activit${results.activities === 1 ? 'y' : 'ies'}.`
      if (results.failed) {
        toast.error(`${message} ${results.failed} item${results.failed === 1 ? '' : 's'} failed.`)
      } else {
        toast.success(message)
      }
    } catch (err) {
      toast.error(err?.message || 'Unable to import task follow-up data')
    } finally {
      setBackupImporting(false)
    }
  }

  const handlePersistActivity = async ({ lead, activityIndex, activity, values }) => {
    const normalizedStatus = normalizeOutcome(values?.callOutcome || values?.connectionStatus || values?.status)
    const rawSummary = activityIndex === 0
      ? [
          normalizedStatus ? `Status: ${normalizedStatus}` : null,
          lead?.source ? `Source: ${lead.source}` : null,
          lead?.service ? `Service: ${lead.service}` : lead?.specialization ? `Service: ${lead.specialization}` : null,
          lead?.createdAt ? `Planned: ${lead.createdAt}` : null,
          `Actual: ${new Date().toISOString()}`,
          values?.nextFollowUpDate || values?.followUpDate ? `Next follow-up: ${values.nextFollowUpDate || values.followUpDate}` : null,
          values?.remark || values?.remarks || values?.note ? `Remarks: ${values.remark || values.remarks || values.note}` : null,
        ].filter(Boolean).join(' | ') || 'Lead activity recorded'
      : Object.entries(values || {})
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ') || 'No extra details'
    const summary = cleanTimelineDescription(rawSummary) || 'Lead activity recorded'

    const payload = {
      activityIndex,
      activityId: activity?.id || null,
      activityLabel: activity?.label || `Activity ${Number(activityIndex) + 1}`,
      activityTitle: activity?.title || '',
      assignedTo: values?.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Unassigned',
      values: values || {},
      summary,
    }
    const savedActivity = await leadsAPI.addActivity(lead.id, payload)
    if (savedActivity?.id) {
      const savedAt = savedActivity.savedAt || savedActivity.createdAt || savedActivity.updatedAt || new Date().toISOString()
      const savedStatus = normalizeStatusText(values?.status || values?.outcome)
      const statusPatch = savedStatus === 'lost' || savedStatus === 'close lost' || savedStatus === 'closed lost'
        ? { status: 'LOST', lostReason: values?.remark || values?.remarks || values?.note || lead?.lostReason || '' }
        : savedStatus === 'won' || savedStatus === 'win' || savedStatus === 'closed won'
          ? { status: 'WON' }
          : {}
      setLeadActivities((prev) => {
        const existing = prev[lead.id] || []
        const filtered = existing.filter((activity) => activity.id !== savedActivity.id)
        return { ...prev, [lead.id]: [savedActivity, ...filtered] }
      })
      setLeads((prev) => prev.map((row) => (
        row.id === lead.id
          ? { ...row, ...statusPatch, updatedAt: savedAt, lastContactedAt: savedAt }
          : row
      )))
      setActivitiesLead((current) => (
        current?.id === lead.id
          ? { ...current, ...statusPatch, updatedAt: savedAt, lastContactedAt: savedAt }
          : current
      ))
      setHistoryLead((current) => (
        current?.id === lead.id
          ? { ...current, ...statusPatch, updatedAt: savedAt, lastContactedAt: savedAt }
          : current
      ))
      if (timelineMetaByLeadId[lead.id]?.loaded) {
        loadLeadTimeline(lead.id, 0, { append: false, rebuildIfEmpty: false })
      }
    }
  }

  const closeActivitiesModal = async () => {
    const leadId = activitiesLead?.id
    setActivitiesLead(null)
    if (leadId && !fullHistoryLeadIds.has(leadId)) {
      try {
        const acts = await leadsAPI.getActivities(leadId)
        setLeadActivities((prev) => ({ ...prev, [leadId]: unwrapList(acts) }))
        setFullHistoryLeadIds((prev) => {
          const next = new Set(prev)
          next.add(leadId)
          return next
        })
      } catch {}
    }
  }

  const handleRecordingFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const leadId = historyLeadData?.id
    if (!file || !leadId) return
    if (!String(file.type || '').startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|webm|amr|flac)$/i.test(file.name)) {
      toast.error('Please choose an audio recording file.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Recording must be 50 MB or smaller.')
      return
    }

    setRecordingUploadingLeadId(leadId)
    try {
      const saved = await leadsAPI.uploadRecording(leadId, file)
      if (saved?.id) {
        setLeadActivities((prev) => ({ ...prev, [leadId]: [saved, ...(prev[leadId] || [])] }))
      }
      await loadLeadTimeline(leadId, 0, { append: false, rebuildIfEmpty: false })
      toast.success('Call recording uploaded.')
    } catch (err) {
      toast.error(err?.message || 'Unable to upload recording')
    } finally {
      setRecordingUploadingLeadId(null)
    }
  }

  const playRecording = async (activityId) => {
    if (!activityId) return
    setRecordingPlayingActivityId(activityId)
    try {
      const blob = await leadsAPI.downloadRecording(activityId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(err?.message || 'Unable to open recording')
    } finally {
      setRecordingPlayingActivityId(null)
    }
  }

  const displayLeads = stageLeads[activeTab] || []
  const totalPages = Math.max(1, Math.ceil(displayLeads.length / LEADS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = displayLeads.length ? (safeCurrentPage - 1) * LEADS_PER_PAGE + 1 : 0
  const pageEnd = Math.min(safeCurrentPage * LEADS_PER_PAGE, displayLeads.length)
  const paginatedLeads = useMemo(() => {
    const start = (safeCurrentPage - 1) * LEADS_PER_PAGE
    return displayLeads.slice(start, start + LEADS_PER_PAGE)
  }, [displayLeads, safeCurrentPage])
  const historyLeadData = historyLead
    ? enrichedLeads.find((lead) => lead.id === historyLead.id) || historyLead
    : null
  const historyActivities = historyLeadData ? (leadActivities[historyLeadData.id] || []) : []
  const historyTasks = historyLeadData?.tasks || []
  const timelineRows = historyLeadData ? (timelineEventsByLeadId[historyLeadData.id] || []) : []
  const timelineMeta = historyLeadData ? (timelineMetaByLeadId[historyLeadData.id] || {}) : {}
  const timelineIsLoading = Boolean(historyLeadData && timelineLoadingLeadId === historyLeadData.id)
  const historyStats = {
    totalTasks: historyTasks.length,
    doneTasks: historyTasks.filter(isCompletedTask).length,
    pendingTasks: historyTasks.filter((task) => !isCompletedTask(task)).length,
    activities: timelineRows.filter((event) => String(event.eventType || '').toUpperCase() === 'ACTIVITY').length || historyActivities.length,
  }
  const fallbackHistoryEvents = [
    ...historyTasks.map((task) => {
      const completed = isCompletedTask(task)
      const timestamp = completed
        ? task.completedAt || task.updatedAt || task.createdAt
        : task.dueDate || task.createdAt
      return {
        id: `task-${task.id}`,
        kind: 'task',
        title: task.title || 'Follow-up task',
        status: taskStatusLabel(task),
        description: task.description || '',
        owner: task.assignedToName || task.createdByName || historyLeadData?.assignedToName || 'Unassigned',
        timestamp,
        sortGroup: completed ? 1 : 0,
        sortTime: completed ? timestampMs(timestamp, 0) * -1 : timestampMs(timestamp),
        completed,
        priority: task.priority || 'MEDIUM',
      }
    }),
    ...historyActivities.map((activity, index) => ({
      id: `activity-${activity.id || index}`,
      kind: 'activity',
      title: activity.activityTitle || activity.activityLabel || 'Lead activity',
      status: activity.activityLabel || `Activity ${Number(activity.activityIndex ?? index) + 1}`,
      description: activityNote(activity),
      owner: activity.assignedTo || historyLeadData?.assignedToName || 'Unassigned',
      timestamp: activity.savedAt || activity.createdAt || activity.updatedAt,
      sortGroup: 2,
      sortTime: timestampMs(activity.savedAt || activity.createdAt || activity.updatedAt, 0) * -1,
      completed: true,
      priority: 'DONE',
    })),
  ].sort((a, b) => (a.sortGroup - b.sortGroup) || (a.sortTime - b.sortTime))
  const timelineHistoryEvents = timelineRows.map((event, index) => {
    const isTask = String(event.eventType || event.sourceType || '').toUpperCase() === 'TASK'
    const status = event.status || (isTask ? 'PENDING' : 'Activity')
    const completed = !isTask || status.toUpperCase() === 'COMPLETED'
    return {
      id: `timeline-${event.id || event.sourceId || index}`,
      kind: isTask ? 'task' : 'activity',
      title: event.title || (isTask ? 'Follow-up task' : 'Lead activity'),
      status,
      description: cleanTimelineDescription(event.description || ''),
      owner: event.owner || historyLeadData?.assignedToName || 'Unassigned',
      timestamp: event.eventAt,
      completed,
      priority: event.metadata?.priority || (isTask ? 'MEDIUM' : 'DONE'),
      recordingActivityId: event.metadata?.recording ? (event.metadata?.recordingActivityId || event.sourceId) : null,
      recordingName: event.metadata?.recordingOriginalName || '',
    }
  })
  const historyEvents = timelineHistoryEvents.length ? timelineHistoryEvents : fallbackHistoryEvents

  const openHistoryLead = (lead) => {
    setHistoryLead(lead)
    if (lead.leadExists !== false) {
      loadLeadTimeline(lead.id, 0)
    }
  }

  const renderCompletedOutcomeColumn = (title, rows, tone) => {
    const isWon = tone === 'won'
    const iconClass = isWon
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
    const badgeClass = isWon
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'

    return (
      <section className="rounded-2xl border border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/60">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800/70">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>
              {isWon ? <Trophy className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{rows.length} lead{rows.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <span className={`badge text-[10px] font-bold ${badgeClass}`}>{isWon ? 'Won' : 'Lost'}</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">
            No {isWon ? 'won' : 'lost'} leads yet.
          </div>
        ) : (
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800/70">
            {rows.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => openHistoryLead(lead)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{lead.name || 'Unnamed Lead'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{lead.company || lead.email || 'No company details'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    Last update: {formatDateTime(getLeadLastUpdateAt(lead))}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  {lead.assignedToName && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {lead.assignedToName}
                    </span>
                  )}
                  {lead.lostReason && !isWon && (
                    <span className="truncate">Reason: {lead.lostReason}</span>
                  )}
                  {lead.revenueValue && isWon && (
                    <span className="truncate">Revenue: {lead.revenueValue}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Task Follow-up"
          subtitle="Track every lead through activities and monitor follow-up progress."
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={backupImportInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/json,.json"
            className="hidden"
            onChange={handleImportBackup}
          />
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={backupExporting || backupImporting}
            className="btn-secondary"
          >
            {backupExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </button>
          <button
            type="button"
            onClick={() => backupImportInputRef.current?.click()}
            disabled={backupExporting || backupImporting}
            className="btn-secondary"
          >
            {backupImporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </button>
          <button type="button" onClick={refresh} disabled={loading || loadingActivities} className="btn-secondary">
            <RefreshCw className={`h-4 w-4 ${loading || loadingActivities ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="kpi-card cursor-pointer transition hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700" onClick={() => setActiveTab('welcome_call')}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <Phone className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Welcome Call</p>
          </div>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : stats.welcomeCall}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Leads awaiting first call</p>
        </div>
        <div className="kpi-card cursor-pointer transition hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700" onClick={() => setActiveTab('followup_meeting')}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Follow-up Meeting</p>
          </div>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : stats.followupMeeting}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Leads awaiting meeting</p>
        </div>
        <div className="kpi-card cursor-pointer transition hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-700" onClick={() => setActiveTab('meeting_outcome')}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Trophy className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Meeting Outcome</p>
          </div>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : stats.meetingOutcome}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Leads pending outcome</p>
        </div>
        <div className="kpi-card cursor-pointer transition hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700" onClick={() => setActiveTab('todays_followup')}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Today's Followup</p>
          </div>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : stats.todaysFollowup}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Follow-ups due today</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="flex border-b border-slate-200/70 dark:border-slate-800/70">
          {TABS.map((tab) => {
            const tabCount = (stageLeads[tab.key] || []).length
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 px-4 py-3.5 text-sm font-semibold transition-colors sm:flex-none sm:px-8 ${
                  activeTab === tab.key
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {loading ? '…' : tabCount}
                </span>
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800/50 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
              placeholder="Search by name, phone, company, or email..."
            />
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} compact className="shrink-0" />
          {activeTab === 'todays_followup' ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {[
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'today', label: 'Today' },
                { key: 'tomorrow', label: 'Tomorrow' },
                { key: 'custom', label: 'Custom' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFollowupDateFilter(opt.key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
                    followupDateFilter === opt.key
                      ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {followupDateFilter === 'custom' && (
                <input
                  type="date"
                  value={followupCustomDate}
                  onChange={(e) => setFollowupCustomDate(e.target.value)}
                  className="input h-8 w-40 text-xs"
                />
              )}
            </div>
          ) : (
            <div className="inline-flex h-10 shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDateSortDirection('asc')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  dateSortDirection === 'asc'
                    ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Asc
              </button>
              <button
                type="button"
                onClick={() => setDateSortDirection('desc')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  dateSortDirection === 'desc'
                    ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Desc
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : displayLeads.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {activeTab === 'welcome_call' && 'No leads at the welcome call stage.'}
            {activeTab === 'followup_meeting' && 'No leads awaiting follow-up meeting.'}
            {activeTab === 'meeting_outcome' && 'No leads pending meeting outcome.'}
            {activeTab === 'todays_followup' && `No follow-ups for ${followupDateFilter === 'custom' ? (followupCustomDate || 'selected date') : followupDateFilter}.`}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {(() => {
                const tabDef = TABS.find((t) => t.key === activeTab)
                const tabStageIdx = tabDef?.stageIdx ?? 0
                const tabActivityDef = ACTIVITY_DEFS[tabStageIdx]
                const tabColor = tabActivityDef ? COLOR_MAP[tabActivityDef.color] : COLOR_MAP.red

                const formatValueKey = (key) =>
                  key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/[_-]+/g, ' ')
                    .replace(/^\w/, (c) => c.toUpperCase())
                    .trim()

                const renderLeadCard = (lead, idx) => {
                  const stageIdx = activeTab === 'todays_followup' ? Math.min(lead.currentStage, 2) : (lead.currentStage === 3 && tabStageIdx === 2 ? 3 : tabStageIdx)
                  const stageStatus = lead.stageStatuses?.[stageIdx]
                  const stageVals = lead.stageValues?.[stageIdx] || {}
                  const valEntries = Object.entries(stageVals)
                    .filter(([, v]) => v != null && String(v).trim() !== '')
                    .slice(0, 5)

                  return (
                    <div
                      key={lead.id}
                      onClick={() => openHistoryLead(lead)}
                      className="flex cursor-pointer flex-col gap-4 px-4 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex-shrink-0">
                        <StageIcon currentStage={lead.currentStage} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {lead.name || 'Unnamed Lead'}
                          </h3>
                          {lead.company && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Building2 className="h-3 w-3" />
                              {lead.company}
                            </span>
                          )}
                          {stageStatus && stageStatus !== 'not_started' ? (
                            <span className={`badge text-[10px] font-bold ${getStatusColor(stageStatus)}`}>
                              {getStatusLabel(stageIdx, stageStatus)}
                            </span>
                          ) : (
                            <span className="badge bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {lead.taskDriven ? 'Task follow-up' : 'Not Started'}
                            </span>
                          )}
                          {lead.missingLead && (
                            <span className="badge bg-rose-100 text-[10px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                              Lead missing
                            </span>
                          )}
                          {lead.pendingTaskCount > 0 && (
                            <span className="badge bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                              {lead.pendingTaskCount} open task{lead.pendingTaskCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        {lead.nextTask?.title && (
                          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {lead.nextTask.title}
                          </p>
                        )}
                        {lead.missingLead && (
                          <p className="mt-1 text-[11px] text-rose-500 dark:text-rose-300">
                            Linked lead was deleted or isn’t accessible.
                          </p>
                        )}
                        {valEntries.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {valEntries.map(([k, v]) => (
                              <span key={k} className="inline-flex gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">
                                <span className="font-medium text-slate-500 dark:text-slate-400">{formatValueKey(k)}:</span>
                                <span className="text-slate-700 dark:text-slate-200">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {lead.assignedToName && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" /> {lead.assignedToName}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Updated {formatDateTime(getLeadLastUpdateAt(lead))}
                          </span>
                          {(lead._followUpDate || lead.nextTask?.dueDate || lead.followUpDate) && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> Follow-up {formatDate(lead._followUpDate || lead.nextTask?.dueDate || lead.followUpDate)}
                            </span>
                          )}
                          {lead.email && (
                            <CopyableContact
                              value={lead.email}
                              label="Email"
                              className="max-w-[180px]"
                            />
                          )}
                          {(lead.phone || lead.phoneNumber || lead.mobileNumber) && (
                            <CopyableContact
                              value={lead.phone || lead.phoneNumber || lead.mobileNumber}
                              label="Phone"
                              icon={Phone}
                              className="max-w-[180px]"
                            />
                          )}
                        </div>
                      </div>
                      {lead.leadExists !== false && (
                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActivitiesLead(lead)}
                            className="btn-primary h-9 px-3 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Open Activities
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {paginatedLeads.map((lead, idx) => renderLeadCard(lead, idx))}
                  </div>
                )
              })()}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer count */}
        {!loading && displayLeads.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800/50 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {pageStart}-{pageEnd} of {displayLeads.length} lead{displayLeads.length === 1 ? '' : 's'}
              {loadingActivities ? ' · loading activity progress…' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="btn-secondary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="btn-secondary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {renderCompletedOutcomeColumn('Won leads', wonOutcomeLeads, 'won')}
        {renderCompletedOutcomeColumn('Lost leads', lostOutcomeLeads, 'lost')}
      </div>

      {/* Lead History Drawer */}
      <AnimatePresence>
        {historyLeadData && (
          <ScreenModalPortal>
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label="Lead history"
            >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/40 bg-white/90 p-5 shadow-2xl backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/95"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
                    Lead History
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {historyLeadData.name || 'Unnamed Lead'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {[historyLeadData.company, historyLeadData.email, historyLeadData.phone || historyLeadData.phoneNumber || historyLeadData.mobileNumber].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryLead(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Tasks', historyStats.totalTasks, 'Total'],
                  ['Done', historyStats.doneTasks, 'Completed'],
                  ['Pending', historyStats.pendingTasks, 'Open'],
                  ['Activities', historyStats.activities, 'Saved'],
                ].map(([label, value, helper]) => (
                  <div key={label} className="rounded-2xl border border-white/50 bg-white/55 p-3 dark:border-slate-800/70 dark:bg-slate-900/60">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                    <p className="text-[10px] text-slate-400">{helper}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800/70 dark:bg-slate-900/50">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Timeline<InfoHint text="Tasks and saved lead activities, newest first." /></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={recordingInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.amr,.flac"
                      className="hidden"
                      onChange={handleRecordingFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => recordingInputRef.current?.click()}
                      disabled={recordingUploadingLeadId === historyLeadData.id}
                      className="btn-secondary"
                    >
                      {recordingUploadingLeadId === historyLeadData.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload recording
                    </button>
                    {timelineIsLoading && (
                      <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                    )}
                  </div>
                </div>

                {historyEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
                    No task or activity history found for this lead.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyEvents.map((event) => {
                      const isTask = event.kind === 'task'
                      return (
                        <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isTask
                              ? event.completed
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                              : 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300'
                          }`}>
                            {isTask ? <ClipboardList className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
                              <span className={`badge text-[10px] ${
                                event.completed
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                              }`}>
                                {event.status}
                              </span>
                            </div>
                            {event.description && (
                              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{event.description}</p>
                            )}
                            {event.recordingActivityId && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => playRecording(event.recordingActivityId)}
                                  disabled={recordingPlayingActivityId === event.recordingActivityId}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60 dark:border-brand-800/60 dark:bg-brand-950/30 dark:text-brand-300 dark:hover:bg-brand-900/40"
                                >
                                  {recordingPlayingActivityId === event.recordingActivityId ? <RefreshCw className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                                  {event.recordingName ? `Play ${event.recordingName}` : 'Play recording'}
                                </button>
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" /> {event.owner}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" /> {formatDateTime(event.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {timelineRows.length > 0 && !timelineMeta.last && (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          onClick={() => loadLeadTimeline(historyLeadData.id, Number(timelineMeta.page || 0) + 1, { append: true, rebuildIfEmpty: false })}
                          disabled={timelineIsLoading}
                          className="btn-secondary"
                        >
                          {timelineIsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                          Load older history
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            </motion.div>
          </ScreenModalPortal>
        )}
      </AnimatePresence>

      {/* Lead Activities Modal */}
      <AnimatePresence>
        {activitiesLead && (
          <LeadActivitiesModal
            lead={activitiesLead}
            onClose={closeActivitiesModal}
            onPersist={handlePersistActivity}
            initialData={[{}, {}, {}]}
            initialSaved={[false, false, false]}
            initialActiveTab={activeTab === 'todays_followup'
              ? Math.max(0, Math.min(Number(activitiesLead.currentStage) || 0, 2))
              : Math.max(0, TABS.find(t => t.key === activeTab)?.stageIdx ?? 0)
            }
          />
        )}
      </AnimatePresence>
    </div>
  )
}

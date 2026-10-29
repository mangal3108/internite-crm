import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, FunnelChart, Funnel, LabelList
} from 'recharts'
import {
  Activity, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Filter, FolderClock, Globe2, Layers3, LineChart as LineChartIcon, Repeat2, Target, TrendingDown, TrendingUp, Users, UserCheck, UserPlus
} from 'lucide-react'
import { dashboardAPI, tasksAPI } from '../../../services/api'
import { useAuthStore } from '../../../store/authStore'
import { parseNotificationCreatedAt } from '../../../store/notificationStore'
import PaginatedSelect from '../../ui/PaginatedSelect'
import DashboardIcon from '../DashboardIcon'
import InfoHint from '../../ui/InfoHint'

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
]

const SOURCE_COLORS = [
  '#7c3aed',
  '#ec4899',
  '#8fd3e8',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#9dc22a',
  '#f97316',
  '#6366f1',
]

const STAGE_COLORS = {
  NEW: '#6366f1',
  ASSIGNED: '#a855f7',
  CONTACTED: '#3b82f6',
  INTERESTED: '#8fd3e8',
  QUALIFIED: '#10b981',
  PROPOSAL_SENT: '#f59e0b',
  CONVERTED: '#22c55e',
  LOST: '#ef4444',
}

const FUNNEL_STAGE_ORDER = [
  'NEW',
  'ASSIGNED',
  'CONTACTED',
  'INTERESTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'CONVERTED',
  'LOST',
]

const KPI_CARDS = [
  { key: 'totalLeads', title: 'Total Leads', icon: Users, color: 'from-brand-500 to-brand-700', glow: 'rgba(127,108,228,0.28)', rgb: '127, 108, 228' },
  { key: 'newLeads', title: 'New Leads', icon: UserPlus, color: 'from-brand-400 to-brand-700', glow: 'rgba(169,155,240,0.3)', rgb: '169, 155, 240' },
  { key: 'assignedLeads', title: 'Assigned', icon: Repeat2, color: 'from-violet-500 to-indigo-600', glow: 'rgba(124,58,237,0.28)', rgb: '124, 58, 237' },
  { key: 'contactedLeads', title: 'Contacted', icon: Activity, color: 'from-brand-500 to-blue-600', glow: 'rgba(59,130,246,0.28)', rgb: '59, 130, 246' },
  { key: 'interestedLeads', title: 'Interested', icon: Globe2, color: 'from-teal-500 to-brand-600', glow: 'rgba(212,240,107,0.28)', rgb: '147, 176, 31' },
  { key: 'qualifiedLeads', title: 'Qualified', icon: Target, color: 'from-emerald-500 to-green-600', glow: 'rgba(16,185,129,0.3)', rgb: '16, 185, 129' },
  { key: 'proposalSentLeads', title: 'Proposal Sent', icon: LineChartIcon, color: 'from-orange-500 to-amber-600', glow: 'rgba(245,158,11,0.3)', rgb: '245, 158, 11' },
  { key: 'convertedLeads', title: 'Converted', icon: UserCheck, color: 'from-emerald-500 to-teal-600', glow: 'rgba(16,185,129,0.3)', rgb: '16, 185, 129' },
  { key: 'lostLeads', title: 'Lost', icon: TrendingDown, color: 'from-rose-500 to-red-600', glow: 'rgba(244,63,94,0.28)', rgb: '244, 63, 94' },
  { key: 'pendingFollowUps', title: 'Pending Follow-ups', icon: Clock3, color: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.3)', rgb: '245, 158, 11' },
  { key: 'conversionRate', title: 'Conv. Rate', icon: TrendingUp, color: 'from-lime-500 to-emerald-600', glow: 'rgba(34,197,94,0.28)', rgb: '34, 197, 94', percent: true },
  { key: 'revenueFromConvertedLeads', title: 'Revenue', icon: FolderClock, color: 'from-brand-500 to-blue-600', glow: 'rgba(169,155,240,0.3)', rgb: '169, 155, 240', currency: true },
]

const ACTIVITY_PAGE_SIZE = 8
const ACTIVITY_FETCH_LIMIT = 32
const EMPLOYEE_PAGE_SIZE = 6
const FOLLOW_UP_PAGE_SIZE = 5
const INDIA_TIME_ZONE = 'Asia/Kolkata'

const SPARKLINE_ACCESSORS = {
  totalLeads: (row) => Number(row.leadCount || 0),
  newLeads: (row) => Number(row.newCount || 0),
  assignedLeads: (row) => Number(row.assignedCount || 0),
  contactedLeads: (row) => Number(row.contactedCount || 0),
  interestedLeads: (row) => Number(row.interestedCount || 0),
  qualifiedLeads: (row) => Number(row.qualifiedCount || 0),
  proposalSentLeads: (row) => Number(row.proposalSentCount || 0),
  convertedLeads: (row) => Number(row.convertedCount || 0),
  lostLeads: (row) => Number(row.lostCount || 0),
  pendingFollowUps: (row) => Number(row.pendingFollowUpsCount || 0),
  conversionRate: (row) => {
    const total = Number(row.leadCount || 0)
    return total > 0 ? (Number(row.convertedCount || 0) * 100) / total : 0
  },
  revenueFromConvertedLeads: (row) => Number(row.revenueGenerated || 0),
}

const prettyNumber = (value) => {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Number.isInteger(n) ? `${n}` : n.toFixed(1)
}

const prettyCurrency = (value) => `₹${prettyNumber(Number(value || 0) / 100000)}L`

const prettyPercent = (value) => `${Number(value || 0).toFixed(1)}%`

const tintStyle = (rgb) => ({ '--dashboard-card-rgb': rgb })

const getTrendGranularity = (filter, startDate, endDate) => {
  if (filter === 'today' || filter === 'yesterday' || filter === 'thisWeek') return 'day'
  if (filter === 'thisMonth' || filter === 'lastMonth') return 'day'
  if (filter !== 'custom') return 'day'
  if (!startDate || !endDate) return 'day'
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'day'
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

const formatDateRangeLabel = (filter, startDate, endDate) => {
  const selected = DATE_FILTERS.find((opt) => opt.value === filter)?.label || 'This Month'
  if (filter !== 'custom') return selected
  if (!startDate && !endDate) return 'Custom Range'
  return `${startDate || 'Start'} → ${endDate || 'End'}`
}

const metricValue = (metric, { currency = false, percent = false } = {}) => {
  if (!metric) return currency ? '₹0.0L' : percent ? '0.0%' : '0'
  if (currency) return prettyCurrency(metric.value)
  if (percent) return prettyPercent(metric.value)
  return prettyNumber(metric.value)
}

function MetricCard({ item, metric, sparkline = [] }) {
  const Icon = item.icon
  const change = Number(metric?.changePercent || 0)
  const positive = change >= 0
  const hasSparkline = sparkline.some((point) => Number(point.value || 0) > 0)
  const stroke = positive ? '#10b981' : '#f43f5e'
  return (
    <div
      className="dashboard-color-card group kpi-card flex min-h-[84px] flex-col gap-1.5 overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5"
      style={tintStyle(item.rgb)}
    >
      <div className="flex items-start gap-2.5">
        <DashboardIcon icon={Icon} color={item.color} glow={item.glow} className="h-9 w-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.title}</p>
          <p className="mt-0.5 text-2xl font-bold leading-none text-slate-900 dark:text-slate-50">
            {metricValue(metric, { currency: item.currency, percent: item.percent })}
          </p>
        </div>
        <span className={`shrink-0 text-[11px] font-bold leading-none ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
          {positive ? '↗' : '↘'}{prettyPercent(Math.abs(change))}
        </span>
      </div>
      <div className="h-6 w-full">
        {hasSparkline ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={2}
                fill={stroke}
                fillOpacity={0.12}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center rounded-md bg-slate-100/50 px-1.5 text-[9px] font-medium text-slate-400 dark:bg-slate-800/40 dark:text-slate-500">
            No trend yet
          </div>
        )}
      </div>
    </div>
  )
}

function SectionShell({
  title,
  icon: Icon,
  subtitle,
  action,
  color = 'from-brand-500 to-brand-700',
  glow = 'rgba(127,108,228,0.28)',
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <DashboardIcon icon={Icon} color={color} glow={glow} />
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h3>
          <InfoHint text={subtitle} />
        </div>
      </div>
      {action}
    </div>
  )
}

function LoadingCard() {
  return <div className="h-[84px] w-full rounded-xl border border-white/40 bg-white/30 backdrop-blur-sm dark:border-slate-700/40 dark:bg-slate-800/30 animate-pulse" />
}

function ChartEmptyState({ label }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
      {label}
    </div>
  )
}

const formatActivityTime = (value) => {
  if (!value) return 'Just now'
  const date = parseNotificationCreatedAt(value, null)
  if (!date || Number.isNaN(date.getTime())) return 'Just now'
  return date.toLocaleString('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

const toDateKey = (value) => {
  if (!value) return ''
  const date = parseNotificationCreatedAt(value, null)
  if (!date || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

const shiftedDateKey = (offsetDays = 0, value = new Date()) => {
  const date = parseNotificationCreatedAt(value, new Date())
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return toDateKey(date)
}

const getIndianWeekKeys = () => {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: INDIA_TIME_ZONE, weekday: 'short' }).format(now)
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  const day = dayIndex >= 0 ? dayIndex : 0
  const diffToMonday = day === 0 ? -6 : 1 - day
  return new Set(Array.from({ length: 7 }, (_, index) => shiftedDateKey(diffToMonday + index, now)))
}

const isOpenFollowUpTask = (task) => {
  const status = String(task?.status || '').toUpperCase()
  if (status === 'COMPLETED' || status === 'DONE' || status === 'CLOSED') return false
  const text = [task?.type, task?.title, task?.description].filter(Boolean).join(' ').toLowerCase()
  return Boolean(task?.leadId) || text.includes('follow') || text.includes('callback')
}

export default function LeadConversionDashboard() {
  const { user } = useAuthStore()
  const isFullAccess = ['COMPANY_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)
  const dateFilterRef = useRef(null)
  const [filter, setFilter] = useState('thisMonth')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('all')
  const [sortBy, setSortBy] = useState('conversion')
  const [sortDir, setSortDir] = useState('desc')
  const [summary, setSummary] = useState(null)
  const [funnel, setFunnel] = useState([])
  const [employees, setEmployees] = useState([])
  const [sources, setSources] = useState([])
  const [activities, setActivities] = useState([])
  const [trend, setTrend] = useState([])
  const [followUpTasks, setFollowUpTasks] = useState([])
  const [followUpError, setFollowUpError] = useState('')
  // ponytail: per-section loading — each widget renders as its data arrives, no Promise.all blocking
  const [loadingChunks, setLoadingChunks] = useState({ summary: true, funnel: true, employees: true, sources: true, activities: true, trend: true, followUps: true })
  const loading = Object.values(loadingChunks).every(Boolean)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [expandedEmployee, setExpandedEmployee] = useState(null)
  const [activityPage, setActivityPage] = useState(0)
  const [employeePage, setEmployeePage] = useState(0)
  const [followUpPage, setFollowUpPage] = useState(0)

  const trendGranularity = useMemo(() => getTrendGranularity(filter, startDate, endDate), [filter, startDate, endDate])

  const requestParams = useMemo(() => {
    const base = {
      filter,
      status: status === 'all' ? undefined : status,
      employeeId: employeeId || undefined,
    }
    if (filter === 'custom') {
      base.startDate = startDate || undefined
      base.endDate = endDate || undefined
    }
    return base
  }, [filter, startDate, endDate, employeeId, status])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setDateMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const markChunk = (key, value) => {
      if (mounted && !controller.signal.aborted) setLoadingChunks((prev) => ({ ...prev, [key]: value }))
    }

    // ponytail: 60s poll instead of 15s, skip silent refetch if data arrived <30s ago
    let lastFetchedAt = 0
    const POLL_INTERVAL = 60 * 1000
    const SKIP_IF_FRESH = 30 * 1000

    const load = ({ silent = false } = {}) => {
      if (silent && Date.now() - lastFetchedAt < SKIP_IF_FRESH) return
      if (!silent) {
        setLoadingChunks({ summary: true, funnel: true, employees: true, sources: true, activities: true, trend: true, followUps: true })
        setError('')
      }
      lastFetchedAt = Date.now()
      const employeeParams = { ...requestParams, sortBy, sortDir }

      // Each chunk loads independently — first to arrive renders first
      dashboardAPI.getLeadConversionSummary(requestParams)
        .then((res) => { if (mounted) { setSummary(res); setLastUpdated(new Date().toISOString()) } })
        .catch((err) => { if (mounted) setError((prev) => prev || err?.message || 'Failed to load summary') })
        .finally(() => markChunk('summary', false))

      dashboardAPI.getLeadConversionFunnel(requestParams)
        .then((res) => { if (mounted) setFunnel(Array.isArray(res) ? res : []) })
        .catch(() => {})
        .finally(() => markChunk('funnel', false))

      dashboardAPI.getLeadConversionEmployees(employeeParams)
        .then((res) => { if (mounted) setEmployees(Array.isArray(res) ? res : []) })
        .catch(() => {})
        .finally(() => markChunk('employees', false))

      dashboardAPI.getLeadConversionSources(requestParams)
        .then((res) => { if (mounted) setSources(Array.isArray(res) ? res : []) })
        .catch(() => {})
        .finally(() => markChunk('sources', false))

      dashboardAPI.getLeadConversionActivities({ ...requestParams, limit: ACTIVITY_FETCH_LIMIT })
        .then((res) => { if (mounted) setActivities(Array.isArray(res) ? res : []) })
        .catch(() => {})
        .finally(() => markChunk('activities', false))

      dashboardAPI.getLeadConversionTrend({ ...requestParams, granularity: trendGranularity })
        .then((res) => { if (mounted) setTrend(Array.isArray(res) ? res : []) })
        .catch(() => {})
        .finally(() => markChunk('trend', false))

      tasksAPI.getDashboardFollowUps({ limit: 10 })
        .then((response) => { if (mounted) { setFollowUpTasks(unwrapList(response)); setFollowUpError('') } })
        .catch((err) => { if (mounted) setFollowUpError(err?.message || 'Unable to load follow-ups') })
        .finally(() => markChunk('followUps', false))
    }

    load()
    const id = window.setInterval(() => load({ silent: true }), POLL_INTERVAL)

    return () => {
      mounted = false
      controller.abort()
      window.clearInterval(id)
    }
  }, [requestParams, sortBy, sortDir, trendGranularity, refreshTick])

  useEffect(() => {
    setActivityPage(0)
    setEmployeePage(0)
    setExpandedEmployee(null)
  }, [filter, startDate, endDate, employeeId, status])

  const employeeOptions = useMemo(() => {
    if (!isFullAccess) return []
    return [
      { value: '', label: 'All Employees' },
      ...employees.map((row) => ({ value: row.employeeId, label: row.employeeName })),
    ]
  }, [employees, isFullAccess])

  const funnelData = useMemo(() => {
    const rowsByStage = new Map(funnel.map((row) => [row.key, row]))
    const ordered = FUNNEL_STAGE_ORDER.map((key) => rowsByStage.get(key)).filter(Boolean)
    const rows = ordered.length ? ordered : funnel
    const maxCount = Math.max(1, ...rows.map((row) => Number(row.count || 0)))
    const step = maxCount / Math.max(1, rows.length)
    return rows.map((row, index) => {
      const stageColor = STAGE_COLORS[row.key] || SOURCE_COLORS[index % SOURCE_COLORS.length]
      const realCount = Number(row.count || 0)
      const descendingMin = Math.max(1, Math.round(maxCount - step * index))
      return {
        ...row,
        displayCount: realCount > 0 ? Math.max(realCount, descendingMin) : 0,
        color: stageColor,
        fill: stageColor,
        dropOffLabel: prettyPercent(row.dropOffPercent),
        conversionLabel: prettyPercent(row.conversionPercent),
      }
    })
  }, [funnel])

  const funnelTotal = useMemo(() => (
    funnel.reduce((sum, row) => sum + Number(row.count || 0), 0)
  ), [funnel])

  const sourcePieData = useMemo(() => sources
    .filter((row) => Number(row.totalLeads || 0) > 0)
    .map((row, index) => ({
      name: row.sourceLabel,
      value: Number(row.totalLeads || 0),
      converted: Number(row.convertedLeads || 0),
      rate: Number(row.conversionRate || 0),
      color: SOURCE_COLORS[index % SOURCE_COLORS.length],
      bestPerforming: row.bestPerforming,
    })), [sources])

  const statusDonutData = useMemo(() => (summary?.statusBreakdown || []).map((row) => ({
    name: row.label,
    value: Number(row.count || 0),
    key: row.key,
    color: STAGE_COLORS[row.key] || '#8b5cf6',
  })), [summary])

  const bestSource = useMemo(() => sources.find((row) => row.bestPerforming) || null, [sources])

  const trendHasData = useMemo(() => trend.some((row) =>
    Number(row.leadCount || 0) > 0 || Number(row.convertedCount || 0) > 0 || Number(row.revenueGenerated || 0) > 0
  ), [trend])

  const kpiSparklines = useMemo(() => {
    const series = {}
    const rows = Array.isArray(trend) ? trend : []
    for (const item of KPI_CARDS) {
      const accessor = SPARKLINE_ACCESSORS[item.key] || (() => 0)
      series[item.key] = rows.map((row) => ({
        label: row.label || row.bucketKey,
        value: Number(accessor(row) || 0),
      }))
    }
    return series
  }, [trend])

  const activityTotalPages = Math.max(1, Math.ceil(activities.length / ACTIVITY_PAGE_SIZE))
  const boundedActivityPage = Math.min(activityPage, activityTotalPages - 1)
  const pagedActivities = activities.slice(
    boundedActivityPage * ACTIVITY_PAGE_SIZE,
    boundedActivityPage * ACTIVITY_PAGE_SIZE + ACTIVITY_PAGE_SIZE
  )

  const followUpSnapshot = useMemo(() => {
    const now = new Date()
    const todayKey = toDateKey(now)
    const yesterdayKey = shiftedDateKey(-1, now)
    const weekKeys = getIndianWeekKeys()

    const rows = followUpTasks
      .filter(isOpenFollowUpTask)
      .filter((task) => Boolean(task?.dueDate))
      .sort((a, b) => parseNotificationCreatedAt(a.dueDate || 0, new Date(0)) - parseNotificationCreatedAt(b.dueDate || 0, new Date(0)))

    const today = rows.filter((task) => toDateKey(task.dueDate) === todayKey)
    const yesterdayRows = rows.filter((task) => toDateKey(task.dueDate) === yesterdayKey)
    const thisWeek = rows.filter((task) => {
      const dueKey = toDateKey(task.dueDate)
      return dueKey && weekKeys.has(dueKey)
    })
    const listById = new Map()
    ;[...yesterdayRows, ...today, ...thisWeek].forEach((task) => {
      if (task?.id && !listById.has(task.id)) listById.set(task.id, task)
    })
    const list = Array.from(listById.values())
      .sort((a, b) => parseNotificationCreatedAt(a.dueDate || 0, new Date(0)) - parseNotificationCreatedAt(b.dueDate || 0, new Date(0)))

    return { today, yesterday: yesterdayRows, thisWeek, list }
  }, [followUpTasks])

  const followUpTotalPages = Math.max(1, Math.ceil(followUpSnapshot.list.length / FOLLOW_UP_PAGE_SIZE))
  const boundedFollowUpPage = Math.min(followUpPage, followUpTotalPages - 1)
  const pagedFollowUps = followUpSnapshot.list.slice(
    boundedFollowUpPage * FOLLOW_UP_PAGE_SIZE,
    boundedFollowUpPage * FOLLOW_UP_PAGE_SIZE + FOLLOW_UP_PAGE_SIZE
  )

  const employeeTotalPages = Math.max(1, Math.ceil(employees.length / EMPLOYEE_PAGE_SIZE))
  const boundedEmployeePage = Math.min(employeePage, employeeTotalPages - 1)
  const pagedEmployees = employees.slice(
    boundedEmployeePage * EMPLOYEE_PAGE_SIZE,
    boundedEmployeePage * EMPLOYEE_PAGE_SIZE + EMPLOYEE_PAGE_SIZE
  )

  const onSort = (key) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(key === 'pending' ? 'asc' : 'desc')
      return key
    })
  }

  return (
    <section className="space-y-2.5 sm:space-y-3">
      {/* ── Compact filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div ref={dateFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setDateMenuOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800/80"
          >
            <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
            <span>{DATE_FILTERS.find((option) => option.value === filter)?.label || 'This Month'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {dateMenuOpen && (
            <div className="absolute left-0 top-full z-30 mt-1.5 min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-950">
              {DATE_FILTERS.map((option) => {
                const active = option.value === filter
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFilter(option.value)
                      setDateMenuOpen(false)
                    }}
                    className={`flex w-full items-center px-3.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-accent-400 text-slate-950'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/70'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isFullAccess && (
          <PaginatedSelect
            value={employeeId}
            onChange={setEmployeeId}
            options={employeeOptions}
            placeholder="All Employees"
            searchPlaceholder="Search employees..."
            className="min-w-[160px]"
          />
        )}

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-700 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {filter === 'custom' && (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/60"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/60"
            />
          </>
        )}

        <button
          type="button"
          onClick={() => setRefreshTick((tick) => tick + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 backdrop-blur-sm transition-colors hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-300"
          title={lastUpdated ? `Last refreshed ${formatActivityTime(lastUpdated)}` : 'Refresh live KPI data'}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
          Live 15s
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          {error}
        </div>
      )}

      {/* ── KPI Cards — render skeleton per-card until summary+trend arrive ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {loadingChunks.summary
          ? Array.from({ length: 12 }).map((_, index) => <LoadingCard key={index} />)
          : KPI_CARDS.map((item) => (
            <MetricCard key={item.key} item={item} metric={summary?.[item.key]} sparkline={kpiSparklines[item.key]} />
          ))
        }
      </div>

      {/* ── Funnel + Trend ── */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="dashboard-color-card glass-card p-3 sm:p-4 xl:col-span-5" style={tintStyle('124, 58, 237')}>
          {loadingChunks.funnel ? (
            <div className="h-[320px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
            <SectionShell
                title="Lead Conversion Funnel"
                icon={Target}
                color="from-brand-500 to-violet-600"
                glow="rgba(124,58,237,0.28)"
                subtitle="Stage progression with drop-off."
                action={(
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {prettyNumber(funnelTotal)} total leads
                    </span>
                    {bestSource && (
                      <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">Best: {bestSource.sourceLabel}</span>
                    )}
                  </div>
                )}
              />
              {funnelData.length && funnelTotal > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <FunnelChart margin={{ right: 110, top: 4, bottom: 4 }}>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const stage = payload[0].payload
                        return (
                          <div className="glass-card px-4 py-3 text-sm shadow-xl">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{stage.label}</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">Count: <span className="font-semibold text-slate-800 dark:text-slate-200">{prettyNumber(stage.count)}</span></p>
                            <p className="text-slate-600 dark:text-slate-400">Drop-off: <span className="font-semibold text-slate-800 dark:text-slate-200">{stage.dropOffLabel}</span></p>
                            <p className="text-slate-600 dark:text-slate-400">Conversion: <span className="font-semibold text-slate-800 dark:text-slate-200">{stage.conversionLabel}</span></p>
                          </div>
                        )
                      }}
                    />
                    <Funnel dataKey="displayCount" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="#565654" stroke="none" content={({ x, y, width, height, index }) => {
                        const item = funnelData[index]
                        if (!item) return null
                        const labelX = x + width + 10
                        const centerY = y + height / 2 + 1
                        const count = Number(item.count || 0)
                        return (
                          <text x={labelX} y={centerY} dominantBaseline="central" fontSize={12}>
                            <tspan fill="#3d3d3c" fontWeight={600}>{item.label}</tspan>
                            <tspan fill="#a2a29e" fontWeight={400}>{` · ${count}`}</tspan>
                          </text>
                        )
                      }} />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState label="No funnel data available." />
              )}
            </>
          )}
        </div>

        <div className="dashboard-color-card glass-card p-3 sm:p-4 xl:col-span-7" style={tintStyle('169, 155, 240')}>
          {loadingChunks.trend ? (
            <div className="h-[280px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
              <SectionShell
                title="Trend Line"
                icon={LineChartIcon}
                color="from-brand-500 to-blue-600"
                glow="rgba(169,155,240,0.3)"
                subtitle="Leads, conversions, and revenue over time."
              />
              {trend.length && trendHasData ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="glass-card px-4 py-3 text-sm shadow-xl">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                            {payload.map((entry) => (
                              <p key={entry.dataKey} style={{ color: entry.color }}>
                                {entry.name}: <span className="font-semibold">{entry.dataKey === 'revenueGenerated' ? prettyCurrency(entry.value) : prettyNumber(entry.value)}</span>
                              </p>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="leadCount" name="Leads" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="convertedCount" name="Converted" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="revenueGenerated" name="Revenue" stroke="#f59e0b" fill="rgba(245,158,11,0.18)" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[240px] flex-col items-center justify-center text-center">
                  <LineChartIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No trend data yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ── #2: Lead Source Analytics ── */}
        <div className="dashboard-color-card glass-card p-3 sm:p-4" style={tintStyle('16, 185, 129')}>
          {loadingChunks.sources ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
              <SectionShell
                title="Lead Source Analytics"
                icon={Globe2}
                color="from-emerald-500 to-teal-600"
                glow="rgba(16,185,129,0.3)"
                subtitle="Conversion rates and revenue by source."
              />
              {sourcePieData.length > 1 ? (
                <div className="flex items-center gap-4">
                  <div className="w-[160px] shrink-0">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={sourcePieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={2} strokeWidth={0}>
                          {sourcePieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="glass-card px-3 py-2 text-xs shadow-xl">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{d.name}</p>
                                <p className="text-slate-500">{prettyNumber(d.value)} leads · {prettyPercent(d.rate)} conv.</p>
                              </div>
                            )
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {sourcePieData.map((row) => {
                      const total = sourcePieData.reduce((sum, r) => sum + r.value, 0)
                      const share = total > 0 ? (row.value / total) * 100 : 0
                      return (
                        <div key={row.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                          <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{row.name}</span>
                          <span className="tabular-nums text-slate-500">{prettyNumber(row.value)}</span>
                          <span className="w-[42px] text-right tabular-nums text-slate-400">{prettyPercent(share)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : sourcePieData.length === 1 ? (
                <div className="flex items-center gap-5 py-3">
                  <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-full" style={{ background: `${sourcePieData[0].color}14`, border: `3px solid ${sourcePieData[0].color}` }}>
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{prettyNumber(sourcePieData[0].value)}</p>
                      <p className="text-[10px] text-slate-400">leads</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sourcePieData[0].name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Only active source · {prettyPercent(sourcePieData[0].rate)} conversion</p>
                    {sourcePieData[0].converted > 0 && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{prettyNumber(sourcePieData[0].converted)} converted</p>
                    )}
                  </div>
                </div>
              ) : (
                <ChartEmptyState label="No source analytics available." />
              )}
            </>
          )}
        </div>

        {/* ── #3: Status Donut ── */}
        <div className="dashboard-color-card glass-card p-3 sm:p-4" style={tintStyle('124, 58, 237')}>
          {loadingChunks.summary ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
              <SectionShell
                title="Status Donut"
                icon={Repeat2}
                color="from-violet-500 to-purple-600"
                glow="rgba(124,58,237,0.3)"
                subtitle="Current pipeline balance by status."
              />
              {(() => {
                const activeStatuses = statusDonutData.filter((row) => row.value > 0)
                const totalStatusLeads = activeStatuses.reduce((sum, r) => sum + r.value, 0)
                if (!activeStatuses.length) return <ChartEmptyState label="No status data available." />
                return (
                  <div className="flex items-center gap-4">
                    <div className="w-[140px] shrink-0">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={activeStatuses} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                            {activeStatuses.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="glass-card px-3 py-2 text-xs shadow-xl">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">{d.name}</p>
                                  <p className="text-slate-500">{prettyNumber(d.value)} leads</p>
                                </div>
                              )
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {activeStatuses.map((row) => {
                        const share = totalStatusLeads > 0 ? (row.value / totalStatusLeads) * 100 : 0
                        return (
                          <div key={row.key} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                            <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">{row.name}</span>
                            <span className="tabular-nums text-slate-500">{prettyNumber(row.value)}</span>
                            <span className="w-[42px] text-right tabular-nums text-slate-400">{prettyPercent(share)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* ── #4: Activity Timeline — compact grid ── */}
      <div className="dashboard-color-card glass-card p-3 sm:p-4" style={tintStyle('127, 108, 228')}>
        {loadingChunks.activities ? (
          <div className="h-[160px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
        ) : (
          <>
            <SectionShell
              title="Lead Activity Timeline"
              icon={CalendarDays}
              color="from-brand-500 to-brand-600"
              glow="rgba(127,108,228,0.3)"
              subtitle="Latest lifecycle events."
              action={activities.length > ACTIVITY_PAGE_SIZE ? (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="hidden text-slate-400 sm:inline">
                    {boundedActivityPage + 1}/{activityTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivityPage((page) => Math.max(0, page - 1))}
                    disabled={boundedActivityPage === 0}
                    aria-label="Previous activities"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityPage((page) => Math.min(activityTotalPages - 1, page + 1))}
                    disabled={boundedActivityPage >= activityTotalPages - 1}
                    aria-label="Next activities"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            />
            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                <CalendarDays className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">No recent activities</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagedActivities.map((item) => {
                  const stageColor = STAGE_COLORS[item.newStatus] || '#7c3aed'
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      style={{
                        background: 'rgba(255,255,255,0.4)',
                        border: '1px solid rgba(255,255,255,0.35)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stageColor }} />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{item.leadName || 'Unnamed lead'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] mb-1">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.oldStatus || '—'}</span>
                        <span className="text-slate-400">→</span>
                        <span className="rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: `${stageColor}14`, color: stageColor }}>{item.newStatus || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{item.employeeName || 'Unassigned'}</span>
                        <span>{formatActivityTime(item.occurredAt)}</span>
                      </div>
                      {item.notes && <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">{item.notes}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* ── #5: Follow-up Snapshot ── */}
        <div className="dashboard-color-card glass-card p-3 sm:p-4" style={tintStyle('245, 158, 11')}>
          {loadingChunks.followUps ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
              <SectionShell
                title="Follow-up Snapshot"
                icon={Clock3}
                color="from-amber-500 to-orange-600"
                glow="rgba(245,158,11,0.3)"
                subtitle="Today, yesterday, and this week's open follow-ups."
                action={(
                  <div className="flex items-center gap-1.5">
                    {followUpSnapshot.list.length > FOLLOW_UP_PAGE_SIZE && (
                      <>
                        <span className="hidden text-[11px] text-slate-400 sm:inline">
                          {boundedFollowUpPage + 1}/{followUpTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFollowUpPage((page) => Math.max(0, page - 1))}
                          disabled={boundedFollowUpPage === 0}
                          aria-label="Previous follow-ups"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowUpPage((page) => Math.min(followUpTotalPages - 1, page + 1))}
                          disabled={boundedFollowUpPage >= followUpTotalPages - 1}
                          aria-label="Next follow-ups"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <Link to="/task-followup" className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">
                      View all
                    </Link>
                  </div>
                )}
              />
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {[
                  ['Today', followUpSnapshot.today.length, 'Due today', 'from-brand-500 to-brand-600'],
                  ['Yesterday', followUpSnapshot.yesterday.length, 'Missed yesterday', 'from-amber-500 to-orange-600'],
                  ['This Week', followUpSnapshot.thisWeek.length, 'Due this week', 'from-emerald-500 to-teal-600'],
                ].map(([label, value, helper, color]) => (
                  <div key={label} className="rounded-lg border border-white/45 bg-white/35 px-2.5 py-1.5 dark:border-slate-700/45 dark:bg-slate-900/35">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
                      <span className={`h-1.5 w-6 rounded-full bg-gradient-to-r ${color}`} />
                    </div>
                    <p className="mt-0.5 text-xl font-bold leading-none text-slate-900 dark:text-slate-50">{prettyNumber(value)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{helper}</p>
                  </div>
                ))}
              </div>

              {followUpError ? (
                <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                  Follow-up data unavailable: {followUpError}
                </div>
              ) : pagedFollowUps.length ? (
                <div className="mt-2 grid grid-cols-1 gap-2 2xl:grid-cols-2">
                  {pagedFollowUps.map((task) => (
                    <Link
                      key={task.id}
                      to="/task-followup"
                      className="rounded-xl border border-white/40 bg-white/30 px-3 py-2 transition-colors hover:bg-white/55 dark:border-slate-700/40 dark:bg-slate-900/30 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{task.title || 'Follow-up task'}</p>
                        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-bold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                          {task.priority || 'MEDIUM'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span className="truncate">{task.assignedToName || task.createdByName || 'Unassigned'}</span>
                        <span className="shrink-0">{formatActivityTime(task.dueDate)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No open follow-ups due today, yesterday, or this week.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── #6: Employee Performance — compact leaderboard ── */}
        <div className="dashboard-color-card glass-card p-3 sm:p-4" style={tintStyle('244, 63, 94')}>
          {loadingChunks.employees ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-white/30 dark:bg-slate-800/30" />
          ) : (
            <>
              <SectionShell
                title="Employee Performance"
                icon={Users}
                color="from-rose-500 to-pink-600"
                glow="rgba(244,63,94,0.26)"
                subtitle="Click a row to expand details."
                action={(
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {[['conversion', 'Conv.'], ['pending', 'Pending'], ['revenue', 'Revenue']].map(([key, label]) => (
                        <button key={key} type="button" onClick={() => onSort(key)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${sortBy === key ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >{label}</button>
                      ))}
                    </div>
                    {employees.length > EMPLOYEE_PAGE_SIZE && (
                      <div className="flex items-center gap-1">
                        <span className="hidden text-[11px] text-slate-400 sm:inline">
                          {boundedEmployeePage + 1}/{employeeTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEmployeePage((page) => Math.max(0, page - 1))
                            setExpandedEmployee(null)
                          }}
                          disabled={boundedEmployeePage === 0}
                          aria-label="Previous employees"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmployeePage((page) => Math.min(employeeTotalPages - 1, page + 1))
                            setExpandedEmployee(null)
                          }}
                          disabled={boundedEmployeePage >= employeeTotalPages - 1}
                          aria-label="Next employees"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 bg-white/45 text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/45 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              />

            {employees.length ? (
              <div className="space-y-1.5">
                {pagedEmployees.map((row, idx) => {
                  const isExpanded = expandedEmployee === row.employeeId
                  const maxAssigned = Math.max(1, ...pagedEmployees.map((e) => Number(e.assignedLeads || 0)))
                  const barWidth = Math.max(4, (Number(row.assignedLeads || 0) / maxAssigned) * 100)
                  return (
                    <div key={row.employeeId}>
                      <button
                        type="button"
                        onClick={() => setExpandedEmployee(isExpanded ? null : row.employeeId)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {boundedEmployeePage * EMPLOYEE_PAGE_SIZE + idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{row.employeeName}</p>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                          <span className="text-slate-600 dark:text-slate-400">{prettyNumber(row.assignedLeads)} assigned</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{prettyPercent(row.conversionRate)}</span>
                        </div>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mx-3 mb-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50/80 px-4 py-3 text-xs dark:bg-slate-800/40 sm:grid-cols-4">
                              {[
                                ['Contacted', row.contactedLeads, ''],
                                ['Converted', row.convertedLeads, 'text-emerald-600 dark:text-emerald-400'],
                                ['Lost', row.lostLeads, 'text-rose-600 dark:text-rose-400'],
                                ['Pending', row.pendingLeads, 'text-amber-600 dark:text-amber-400'],
                                ['Follow-ups', row.followUpsDone, ''],
                                ['Resp. Time', `${prettyNumber(row.averageResponseMinutes)} min`, ''],
                                ['Revenue', prettyCurrency(row.revenueGenerated), 'font-semibold'],
                                ['Conv. Rate', prettyPercent(row.conversionRate), 'font-semibold'],
                              ].map(([label, val, cls]) => (
                                <div key={label} className="flex items-center justify-between py-0.5">
                                  <span className="text-slate-500">{label}</span>
                                  <span className={`font-medium text-slate-700 dark:text-slate-300 ${cls}`}>{typeof val === 'number' ? prettyNumber(val) : val}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            ) : (
              <ChartEmptyState label="No employee data yet." />
            )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

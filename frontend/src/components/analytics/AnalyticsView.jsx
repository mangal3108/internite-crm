import InfoHint from '../ui/InfoHint'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  CheckCircle2, CircleHelp, Clock3, Database, Download, FileText, Filter,
  Gauge, Layers3, RefreshCw, ShieldCheck, Target, TrendingDown, TrendingUp,
  UserCheck, Users, XCircle,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import { dashboardAPI, analyticsAPI, leadsAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { PERMISSIONS, hasPermission } from '../../utils/permissions'
import { fetchAllPages } from '../../utils/pagination'

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom range' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL_SENT', label: 'Proposal sent' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
]

const SOURCE_FILTERS = [
  { value: '', label: 'All sources' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'GOOGLE_ADS', label: 'Google' },
  { value: 'REFERRAL', label: 'Referrals' },
  { value: 'OTHER', label: 'Manual entry / Other' },
]

const STAGE_COLORS = {
  NEW: '#6366f1',
  ASSIGNED: '#8b5cf6',
  CONTACTED: '#7f6ce4',
  INTERESTED: '#9dc22a',
  QUALIFIED: '#10b981',
  PROPOSAL_SENT: '#f59e0b',
  CONVERTED: '#22c55e',
  LOST: '#f43f5e',
}

const SOURCE_COLORS = ['#6366f1', '#7f6ce4', '#9dc22a', '#f59e0b', '#f43f5e', '#8b5cf6', '#8fd3e8', '#84cc16']

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN')
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`
const valueOf = (summary, key) => Number(summary?.[key]?.value || 0)
const metricChange = (summary, key) => Number(summary?.[key]?.changePercent || 0)

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const trendGranularity = (filter, startDate, endDate) => {
  if (filter !== 'custom') return filter === 'thisMonth' || filter === 'lastMonth' ? 'day' : 'day'
  if (!startDate || !endDate) return 'day'
  const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000))
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
}

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

const PDF_COLORS = {
  navy: [20, 33, 61],
  slate: [71, 85, 105],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  soft: [248, 250, 252],
  blue: [37, 99, 235],
  cyan: [20, 184, 166],
  emerald: [20, 184, 166],
  amber: [245, 158, 11],
  rose: [239, 68, 68],
  violet: [124, 58, 237],
  white: [255, 255, 255],
}

const pdfHexToRgb = (hex, fallback = PDF_COLORS.blue) => {
  const value = String(hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

const pdfText = (doc, text, x, y, { size = 9, color = PDF_COLORS.slate, style = 'normal', maxWidth } = {}) => {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const lines = maxWidth ? doc.splitTextToSize(String(text ?? ''), maxWidth) : String(text ?? '')
  doc.text(lines, x, y)
  return Array.isArray(lines) ? lines.length : 1
}

const pdfCard = (doc, x, y, width, height, fill = PDF_COLORS.white, border = PDF_COLORS.line) => {
  doc.setFillColor(...fill)
  doc.setDrawColor(...border)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, width, height, 3, 3, 'FD')
}

const pdfSectionTitle = (doc, title, subtitle, y) => {
  pdfText(doc, title, 14, y, { size: 14, color: PDF_COLORS.navy, style: 'bold' })
  if (subtitle) pdfText(doc, subtitle, 14, y + 6, { size: 8, color: PDF_COLORS.muted })
  return y + 14
}

const pdfTable = (doc, startY, head, body, options = {}) => {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: options.fontSize || 7.4,
      cellPadding: options.cellPadding || 2.4,
      textColor: PDF_COLORS.slate,
      lineColor: PDF_COLORS.line,
      lineWidth: 0.18,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: options.headColor || PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: options.headFontSize || 7.5,
      cellPadding: 2.8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: options.columnStyles || {},
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index % 2 === 1) {
        hookData.cell.styles.fillColor = [251, 253, 255]
      }
      if (options.didParseCell) options.didParseCell(hookData)
    },
    didDrawCell: options.didDrawCell,
    showHead: 'everyPage',
  })
  return doc.lastAutoTable?.finalY || startY
}

const pdfFooter = (doc, report, page, totalPages) => {
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...PDF_COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(14, height - 13, width - 14, height - 13)
  pdfText(doc, 'Internite CRM  |  Lead Activity & Engagement Report', 14, height - 7, { size: 7, color: PDF_COLORS.muted, style: 'bold' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...PDF_COLORS.muted)
  doc.text(`${report.summary.periodLabel || 'Selected period'}  |  Page ${page} of ${totalPages}`, width - 14, height - 7, { align: 'right' })
}

const pdfPageHeader = (doc, title, subtitle) => {
  const width = doc.internal.pageSize.getWidth()
  doc.setFillColor(...PDF_COLORS.navy)
  doc.rect(0, 0, width, 22, 'F')
  pdfText(doc, title, 14, 10, { size: 12, color: PDF_COLORS.white, style: 'bold' })
  pdfText(doc, subtitle, 14, 16, { size: 7.5, color: [203, 213, 225] })
}

const REPORT_TIME_ZONE = 'Asia/Kolkata'
const ACTIVITY_STAGE_KEYS = ['welcome', 'follow', 'meeting']

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const safeDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const zonedDateKey = (value, timeZone = REPORT_TIME_ZONE) => {
  const date = safeDate(value)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

const dateKeyOffset = (offset, timeZone = REPORT_TIME_ZONE) => {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  return zonedDateKey(date, timeZone)
}

const formatPdfDate = (value, timeZone = REPORT_TIME_ZONE) => {
  const date = safeDate(value)
  if (!date) return '—'
  return date.toLocaleDateString('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric' })
}

const resolveReportDateRange = (filter, startDate, endDate, timeZone = REPORT_TIME_ZONE) => {
  const todayKey = dateKeyOffset(0, timeZone)
  if (filter === 'today') return { start: todayKey, end: todayKey, label: 'Today' }
  if (filter === 'yesterday') {
    const yesterdayKey = dateKeyOffset(1, timeZone)
    return { start: yesterdayKey, end: yesterdayKey, label: 'Yesterday' }
  }
  if (filter === 'custom') {
    const start = startDate || endDate || todayKey
    const end = endDate || startDate || todayKey
    return start <= end ? { start, end, label: `${start} to ${end}` } : { start: end, end: start, label: `${end} to ${start}` }
  }

  const today = safeDate(`${todayKey}T12:00:00`)
  if (!today) return { start: todayKey, end: todayKey, label: 'Selected period' }
  if (filter === 'thisWeek') {
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay())
    return { start: start.toISOString().slice(0, 10), end: todayKey, label: 'This week' }
  }
  if (filter === 'lastMonth') {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12)
    const lastOfLastMonth = new Date(firstOfThisMonth)
    lastOfLastMonth.setDate(0)
    const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1, 12)
    return { start: firstOfLastMonth.toISOString().slice(0, 10), end: lastOfLastMonth.toISOString().slice(0, 10), label: 'Last month' }
  }
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12)
  return { start: firstOfMonth.toISOString().slice(0, 10), end: todayKey, label: 'This month' }
}

const sourceLabel = (lead) => {
  const source = String(lead?.source || 'OTHER')
  if (lead?.sourceLabel) return lead.sourceLabel
  if (source === 'GOOGLE_ADS') return 'Google'
  if (source === 'REFERRAL') return 'Referrals'
  if (source === 'OTHER') return 'Manual entry / Other'
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

const isActivitySavedOn = (activity, key, timeZone = REPORT_TIME_ZONE) => zonedDateKey(activity?.savedAt || activity?.createdAt, timeZone) === key
const isLeadCreatedOn = (lead, key, timeZone = REPORT_TIME_ZONE) => zonedDateKey(lead?.createdAt, timeZone) === key
const isFollowUpDueOn = (lead, key, timeZone = REPORT_TIME_ZONE) => zonedDateKey(lead?.followUpDate, timeZone) === key

const activityKind = (activity) => {
  const text = `${activity?.activityLabel || ''} ${activity?.activityTitle || ''} ${activity?.activityId || ''}`.toLowerCase()
  const index = Number(activity?.activityIndex)
  if (index === 0 || text.includes('welcome')) return 'welcome'
  if (index === 1 || text.includes('follow')) return 'follow'
  if (index === 2 || text.includes('meeting')) return 'meeting'
  return ACTIVITY_STAGE_KEYS[index] || 'activity'
}

const activityOutcome = (activity) => {
  const values = activity?.values || {}
  const text = `${activity?.summary || ''} ${Object.values(values).join(' ')}`.toLowerCase()
  if (text.includes('cancel')) return 'cancelled'
  if (text.includes('resched')) return 'rescheduled'
  if (text.includes('no show') || text.includes('no-show')) return 'noShow'
  if (text.includes('fail')) return 'failed'
  if (text.includes('unanswered') || text.includes('no answer')) return 'unanswered'
  if (activity?.savedAt || activity?.createdAt) return 'completed'
  return 'pending'
}

const scoreLead = (lead, activities, todayKey, yesterdayKey, timeZone = REPORT_TIME_ZONE) => {
  const status = String(lead?.status || '').toUpperCase()
  const baseInterest = status === 'WON' || status === 'QUALIFIED' ? 25 : status === 'CONTACTED' ? 18 : status === 'NEW' ? 8 : 12
  const welcome = activities.some((activity) => activityKind(activity) === 'welcome') ? 20 : 0
  const followUps = activities.filter((activity) => activityKind(activity) === 'follow').length
  const follow = followUps >= 2 ? 20 : followUps === 1 ? 14 : 0
  const meeting = activities.some((activity) => activityKind(activity) === 'meeting') ? 20 : 0
  const recent = activities.some((activity) => [todayKey, yesterdayKey].includes(zonedDateKey(activity?.savedAt || activity?.createdAt, timeZone))) || [todayKey, yesterdayKey].includes(zonedDateKey(lead?.lastContactedAt || lead?.updatedAt, timeZone)) ? 15 : 0
  return clamp(baseInterest + welcome + follow + meeting + recent, 0, 100)
}

const categoryForScore = (score) => score >= 80 ? 'Hot' : score >= 50 ? 'Warm' : 'Cold'

const buildLeadActivityReport = ({ leads, activityMap, sourceFilter, filter, startDate, endDate, timeZone = REPORT_TIME_ZONE }) => {
  const todayKey = dateKeyOffset(0, timeZone)
  const yesterdayKey = dateKeyOffset(1, timeZone)
  const previousKey = dateKeyOffset(2, timeZone)
  const dateRange = resolveReportDateRange(filter, startDate, endDate, timeZone)
  const sourceLeads = leads.filter((lead) => !sourceFilter || String(lead.source || '') === sourceFilter)
  const filteredLeads = sourceLeads.filter((lead) => {
    const key = zonedDateKey(lead?.createdAt, timeZone)
    return key && key >= dateRange.start && key <= dateRange.end
  })
  const activities = filteredLeads.flatMap((lead) => (activityMap[lead.id] || []).map((activity) => ({ ...activity, lead })))

  const yesterdayLeads = sourceLeads.filter((lead) => isLeadCreatedOn(lead, yesterdayKey, timeZone))
  const previousLeads = sourceLeads.filter((lead) => isLeadCreatedOn(lead, previousKey, timeZone))
  const sourceActivities = sourceLeads.flatMap((lead) => (activityMap[lead.id] || []).map((activity) => ({ ...activity, lead })))
  const yesterdayActivities = sourceActivities.filter((activity) => isActivitySavedOn(activity, yesterdayKey, timeZone))
  const previousActivities = sourceActivities.filter((activity) => isActivitySavedOn(activity, previousKey, timeZone))
  const pctChange = (current, previous) => previous > 0 ? ((current - previous) * 100) / previous : current > 0 ? 100 : 0

  const uniqueLeadCount = (rows, kind) => new Set(rows.filter((activity) => activityKind(activity) === kind).map((activity) => activity.leadId || activity.lead?.id).filter(Boolean)).size
  const contactedCount = filteredLeads.filter((lead) => ['CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].includes(String(lead.status || '')) || lead.lastContactedAt).length
  const welcomeCount = new Set(activities.filter((activity) => activityKind(activity) === 'welcome').map((activity) => activity.lead?.id).filter(Boolean)).size
  const followCount = new Set(activities.filter((activity) => activityKind(activity) === 'follow').map((activity) => activity.lead?.id).filter(Boolean)).size
  const meetingScheduled = filteredLeads.filter((lead) => (lead.tags || []).join(',').toLowerCase().includes('meeting') || (activityMap[lead.id] || []).some((activity) => activityKind(activity) === 'meeting')).length
  const meetingDone = new Set(activities.filter((activity) => activityKind(activity) === 'meeting' && activityOutcome(activity) === 'completed').map((activity) => activity.lead?.id).filter(Boolean)).size
  const funnelCounts = [filteredLeads.length, contactedCount, welcomeCount, followCount, meetingScheduled, meetingDone]
  const funnelLabels = ['Total Leads', 'Contacted', 'Welcome Call Completed', 'Follow-Up Completed', 'Meeting Scheduled', 'Meeting Completed']
  const funnel = funnelLabels.map((label, index) => {
    const count = funnelCounts[index]
    const previous = index === 0 ? count : funnelCounts[index - 1]
    return {
      label,
      count,
      progression: previous > 0 ? (count * 100) / previous : 0,
      dropoff: previous > 0 ? Math.max(0, ((previous - count) * 100) / previous) : 0,
      overall: funnelCounts[0] > 0 ? (count * 100) / funnelCounts[0] : 0,
    }
  })

  const scoredLeads = filteredLeads.map((lead) => {
    const leadActivities = activityMap[lead.id] || []
    const engagementScore = lead.aiScoreValue ?? scoreLead(lead, leadActivities, todayKey, yesterdayKey, timeZone)
    const category = categoryForScore(engagementScore)
    const lastActivity = leadActivities.slice().sort((a, b) => (safeDate(b.savedAt || b.createdAt)?.getTime() || 0) - (safeDate(a.savedAt || a.createdAt)?.getTime() || 0))[0]
    const lastContactDate = lead.lastContactedAt || lastActivity?.savedAt || lastActivity?.createdAt || lead.updatedAt
    const overdue = lead.followUpDate && zonedDateKey(lead.followUpDate, timeZone) < todayKey
    const nextAction = overdue ? 'Complete overdue follow-up' : category === 'Hot' ? 'Call and confirm next meeting' : category === 'Warm' ? 'Send timely follow-up' : 'Start welcome call sequence'
    return { ...lead, engagementScore, category, lastContactDate, nextAction, overdue }
  })

  const categoryCounts = ['Hot', 'Warm', 'Cold'].map((name) => ({ name, count: scoredLeads.filter((lead) => lead.category === name).length }))
  const avgScore = scoredLeads.length ? scoredLeads.reduce((sum, lead) => sum + lead.engagementScore, 0) / scoredLeads.length : 0
  const priorityLeads = scoredLeads.slice().sort((a, b) => {
    const overdueDelta = Number(Boolean(b.overdue)) - Number(Boolean(a.overdue))
    if (overdueDelta) return overdueDelta
    const scoreDelta = b.engagementScore - a.engagementScore
    if (scoreDelta) return scoreDelta
    return (safeDate(a.followUpDate)?.getTime() || Number.MAX_SAFE_INTEGER) - (safeDate(b.followUpDate)?.getTime() || Number.MAX_SAFE_INTEGER)
  }).slice(0, 10)

  const followActivities = activities.filter((activity) => activityKind(activity) === 'follow')
  const welcomeActivities = activities.filter((activity) => activityKind(activity) === 'welcome')
  const meetingActivities = activities.filter((activity) => activityKind(activity) === 'meeting')
  const scheduledFollowUps = filteredLeads.filter((lead) => lead.followUpDate).length
  const pendingFollowUps = filteredLeads.filter((lead) => lead.followUpDate && zonedDateKey(lead.followUpDate, timeZone) >= todayKey).length
  const overdueFollowUps = filteredLeads.filter((lead) => lead.followUpDate && zonedDateKey(lead.followUpDate, timeZone) < todayKey).length
  const upcomingToday = filteredLeads.filter((lead) => isFollowUpDueOn(lead, todayKey, timeZone)).length
  const completedFollowUps = followActivities.filter((activity) => activityOutcome(activity) === 'completed').length
  const completedWelcome = welcomeActivities.filter((activity) => activityOutcome(activity) === 'completed').length
  const completedMeetings = meetingActivities.filter((activity) => activityOutcome(activity) === 'completed').length

  const sourceRows = SOURCE_FILTERS.slice(1).map((source) => {
    const rows = scoredLeads.filter((lead) => String(lead.source || '') === source.value || (source.value === 'GOOGLE_ADS' && String(lead.source || '') === 'GOOGLE') || (source.value === 'OTHER' && !lead.source))
    const hot = rows.filter((lead) => lead.category === 'Hot').length
    const warm = rows.filter((lead) => lead.category === 'Warm').length
    const cold = rows.filter((lead) => lead.category === 'Cold').length
    return { source: source.label, total: rows.length, hot, warm, cold, percent: scoredLeads.length ? (rows.length * 100) / scoredLeads.length : 0 }
  }).filter((row) => row.total > 0)

  const insights = [
    categoryCounts[0].count ? `${categoryCounts[0].count} hot lead${categoryCounts[0].count === 1 ? '' : 's'} should receive a timely follow-up.` : 'No hot leads are visible in the selected source filter yet.',
    `${filteredLeads.filter((lead) => !(activityMap[lead.id] || []).some((activity) => activityKind(activity) === 'welcome')).length} lead${filteredLeads.length === 1 ? '' : 's'} still need a welcome call.`,
    overdueFollowUps ? `${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? '' : 's'} need attention.` : 'No overdue follow-ups in the selected data.',
    `${upcomingToday} follow-up${upcomingToday === 1 ? '' : 's'} are scheduled for today.`,
    `${filteredLeads.filter((lead) => !lead.lastContactedAt && !(activityMap[lead.id] || []).length).length} lead${filteredLeads.length === 1 ? '' : 's'} have no recent contact record.`,
  ]

  return {
    summary: {
      periodLabel: `Yesterday: ${yesterdayKey}`,
      rangeLabel: `${dateRange.label} (${dateRange.start} to ${dateRange.end})`,
      sourceLabel: SOURCE_FILTERS.find((item) => item.value === sourceFilter)?.label || 'All sources',
      timeZone,
    },
    kpis: [
      { label: "Yesterday's Total Leads", value: yesterdayLeads.length, change: pctChange(yesterdayLeads.length, previousLeads.length) },
      { label: "Yesterday's Follow-Ups", value: uniqueLeadCount(yesterdayActivities, 'follow'), change: pctChange(uniqueLeadCount(yesterdayActivities, 'follow'), uniqueLeadCount(previousActivities, 'follow')) },
      { label: "Yesterday's Welcome Calls", value: uniqueLeadCount(yesterdayActivities, 'welcome'), change: pctChange(uniqueLeadCount(yesterdayActivities, 'welcome'), uniqueLeadCount(previousActivities, 'welcome')) },
      { label: "Yesterday's Meetings", value: uniqueLeadCount(yesterdayActivities, 'meeting'), change: pctChange(uniqueLeadCount(yesterdayActivities, 'meeting'), uniqueLeadCount(previousActivities, 'meeting')) },
    ],
    funnel,
    scoredLeads,
    categoryCounts,
    avgScore,
    priorityLeads,
    followUp: {
      completed: completedFollowUps,
      scheduled: scheduledFollowUps,
      pending: pendingFollowUps,
      overdue: overdueFollowUps,
      today: upcomingToday,
      completion: scheduledFollowUps ? (completedFollowUps * 100) / Math.max(1, scheduledFollowUps + completedFollowUps) : 0,
    },
    welcome: {
      completed: completedWelcome,
      pending: Math.max(0, filteredLeads.length - welcomeCount),
      unanswered: welcomeActivities.filter((activity) => activityOutcome(activity) === 'unanswered').length,
      failed: welcomeActivities.filter((activity) => activityOutcome(activity) === 'failed').length,
      completion: filteredLeads.length ? (welcomeCount * 100) / filteredLeads.length : 0,
    },
    meeting: {
      completed: completedMeetings,
      scheduled: meetingScheduled,
      upcoming: meetingScheduled - meetingDone > 0 ? meetingScheduled - meetingDone : 0,
      rescheduled: meetingActivities.filter((activity) => activityOutcome(activity) === 'rescheduled').length,
      cancelled: meetingActivities.filter((activity) => activityOutcome(activity) === 'cancelled').length,
      noShow: meetingActivities.filter((activity) => activityOutcome(activity) === 'noShow').length,
      completion: meetingScheduled ? (meetingDone * 100) / meetingScheduled : 0,
    },
    sourceRows,
    insights,
  }
}

function ChangePill({ value }) {
  const change = Number(value || 0)
  const positive = change >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {formatPercent(Math.abs(change))}
    </span>
  )
}

function MetricCard({ label, value, detail, icon: Icon, change, tone = 'brand', valueClass = '' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300',
  }
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className={`mt-2 truncate text-2xl font-bold text-slate-900 dark:text-slate-50 ${valueClass}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-xl p-2 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
      {change !== undefined ? <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-700/50"><ChangePill value={change} /><span className="text-[11px] text-slate-400">vs previous period</span></div> : null}
    </div>
  )
}

function EmptyState({ children }) {
  return <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div>
}

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user)
  const [filter, setFilter] = useState('thisMonth')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [data, setData] = useState({ summary: null, funnel: [], sources: [], trend: [], activities: [] })

  const canExport = hasPermission(user, PERMISSIONS.REPORTS_EXPORT) || hasPermission(user, PERMISSIONS.ANALYTICS_EXPORT)
  const requestParams = useMemo(() => ({
    filter,
    ...(filter === 'custom' && startDate ? { startDate } : {}),
    ...(filter === 'custom' && endDate ? { endDate } : {}),
    ...(status ? { status } : {}),
  }), [endDate, filter, startDate, status])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    const params = { ...requestParams }
    const calls = [
      dashboardAPI.getLeadConversionSummary(params),
      dashboardAPI.getLeadConversionFunnel(params),
      dashboardAPI.getLeadConversionSources(params),
      dashboardAPI.getLeadConversionTrend({ ...params, granularity: trendGranularity(filter, startDate, endDate) }),
      dashboardAPI.getLeadConversionActivities({ ...params, limit: 40 }),
    ]

    Promise.allSettled(calls).then((results) => {
      if (!mounted) return
      const [summary, funnel, sources, trend, activities] = results
      const rejected = results.find((result) => result.status === 'rejected')
      if (rejected) setError(rejected.reason?.message || 'Some analytics sections could not be loaded.')
      setData({
        summary: summary.status === 'fulfilled' ? summary.value : null,
        funnel: funnel.status === 'fulfilled' && Array.isArray(funnel.value) ? funnel.value : [],
        sources: sources.status === 'fulfilled' && Array.isArray(sources.value) ? sources.value : [],
        trend: trend.status === 'fulfilled' && Array.isArray(trend.value) ? trend.value : [],
        activities: activities.status === 'fulfilled' && Array.isArray(activities.value) ? activities.value : [],
      })
      setLastUpdated(new Date().toISOString())
    }).finally(() => {
      if (mounted) setLoading(false)
    })

    return () => { mounted = false }
  }, [filter, refreshTick, requestParams, startDate, endDate])

  const report = useMemo(() => {
    const summary = data.summary || {}
    const total = valueOf(summary, 'totalLeads')
    const converted = valueOf(summary, 'convertedLeads')
    const lost = valueOf(summary, 'lostLeads')
    const active = Math.max(0, total - converted - lost)
    const assigned = valueOf(summary, 'assignedLeads')
    const contacted = valueOf(summary, 'contactedLeads')
    const pending = valueOf(summary, 'pendingFollowUps')
    const funnel = (data.funnel.length ? data.funnel : (summary.statusBreakdown || [])).map((row, index) => ({
      ...row,
      key: row.key || row.stage || `stage-${index}`,
      label: row.label || row.stage || 'Unknown stage',
      count: Number(row.count || 0),
      color: STAGE_COLORS[row.key] || STAGE_COLORS[row.stage] || SOURCE_COLORS[index % SOURCE_COLORS.length],
    }))
    const activeRows = funnel.filter((row) => !['CONVERTED', 'LOST', 'WON'].includes(row.key))
    const largestQueue = activeRows.reduce((best, row) => row.count > (best?.count || 0) ? row : best, null)
    const sourceRows = data.sources.filter((row) => Number(row.totalLeads || 0) > 0)
    const weakestSource = sourceRows.filter((row) => row.totalLeads >= 3).sort((a, b) => a.conversionRate - b.conversionRate)[0]
    const bestSource = sourceRows.find((row) => row.bestPerforming) || sourceRows.slice().sort((a, b) => b.conversionRate - a.conversionRate)[0]
    const actions = [
      pending > 0
        ? { tone: 'amber', icon: Clock3, title: `Close ${formatNumber(pending)} pending follow-up${pending === 1 ? '' : 's'}`, body: 'A scheduled follow-up is the clearest near-term recovery action. Set a due time and next step.' }
        : { tone: 'emerald', icon: CheckCircle2, title: 'Follow-up queue is clear', body: 'Keep the same discipline and make sure every new lead receives a next action.' },
      largestQueue?.count
        ? { tone: 'violet', icon: Layers3, title: `Review the ${largestQueue.label} queue`, body: `${formatNumber(largestQueue.count)} leads are currently here. Check ageing, activity quality, and the next step for each one.` }
        : { tone: 'brand', icon: Target, title: 'Define a next-stage focus', body: 'Once leads arrive, use a clear qualification rule so the team knows which step to work next.' },
      weakestSource
        ? { tone: 'rose', icon: TrendingDown, title: `Audit ${weakestSource.sourceLabel}`, body: `${formatNumber(weakestSource.totalLeads)} leads have a ${formatPercent(weakestSource.conversionRate)} current completion rate. Review source quality, audience, and hand-off timing.` }
        : { tone: 'brand', icon: Database, title: 'Capture source and campaign consistently', body: 'Reliable source attribution is needed before deciding which channels deserve more attention.' },
      { tone: 'sky', icon: ShieldCheck, title: 'Add historical transition tracking', body: 'This report shows current status, not a proven cohort conversion rate. Record every stage change and first response timestamp for stronger decisions.' },
    ]
    return { summary, total, converted, lost, active, assigned, contacted, pending, funnel, largestQueue, sourceRows, weakestSource, bestSource, actions, activities: data.activities }
  }, [data])

  const statusMix = [
    { name: 'Active', value: report.active, color: '#7f6ce4' },
    { name: 'Converted', value: report.converted, color: '#22c55e' },
    { name: 'Lost', value: report.lost, color: '#f43f5e' },
  ].filter((item) => item.value > 0)

  const exportPdf = async () => {
    if (!canExport) return toast.error('You do not have permission to export reports.')
    setExporting('pdf')
    try {
      const { rows: leads } = await fetchAllPages((pageParams) => leadsAPI.getAll({
        ...pageParams,
        ...(status ? { status } : {}),
        ...(sourceFilter ? { source: sourceFilter } : {}),
      }), 200)
      const activityMap = {}
      const ids = leads.map((lead) => lead.id).filter(Boolean)
      for (let index = 0; index < ids.length; index += 50) {
        const chunk = ids.slice(index, index + 50)
        const rows = await leadsAPI.getActivitiesBulk(chunk)
        Object.assign(activityMap, rows || {})
      }

      const pdfReport = buildLeadActivityReport({
        leads,
        activityMap,
        sourceFilter,
        filter,
        startDate,
        endDate,
        timeZone: REPORT_TIME_ZONE,
      })

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const drawStat = (x, y, width, height, label, value, detail, color = PDF_COLORS.blue) => {
        pdfCard(doc, x, y, width, height, PDF_COLORS.white)
        doc.setFillColor(...color)
        doc.roundedRect(x, y, 2.5, height, 1.2, 1.2, 'F')
        pdfText(doc, label, x + 7, y + 8, { size: 6.8, color: PDF_COLORS.muted, style: 'bold', maxWidth: width - 10 })
        pdfText(doc, value, x + 7, y + 20, { size: 17, color: PDF_COLORS.navy, style: 'bold' })
        pdfText(doc, detail, x + 7, y + 28, { size: 6.5, color: PDF_COLORS.muted, maxWidth: width - 10 })
      }
      const addHeaderPage = (title, subtitle) => {
        doc.addPage()
        pdfPageHeader(doc, title, subtitle)
        return 31
      }

      doc.setFillColor(...PDF_COLORS.soft)
      doc.rect(0, 0, pageWidth, 297, 'F')
      doc.setFillColor(...PDF_COLORS.navy)
      doc.rect(0, 0, pageWidth, 47, 'F')
      doc.setFillColor(...PDF_COLORS.blue)
      doc.roundedRect(14, 12, 39, 8, 4, 4, 'F')
      pdfText(doc, 'Internite CRM', 19, 18, { size: 7.5, color: PDF_COLORS.white, style: 'bold' })
      pdfText(doc, 'Lead Management & Daily Activity Analytics Report', 14, 32, { size: 17, color: PDF_COLORS.white, style: 'bold', maxWidth: 148 })
      pdfText(doc, `${pdfReport.summary.periodLabel}  |  Reporting range: ${pdfReport.summary.rangeLabel}  |  ${pdfReport.summary.sourceLabel}  |  ${pdfReport.summary.timeZone}`, 14, 41, { size: 7.2, color: [203, 213, 225], maxWidth: 180 })

      const kpiColors = [PDF_COLORS.blue, PDF_COLORS.cyan, PDF_COLORS.amber, PDF_COLORS.rose]
      pdfReport.kpis.forEach((kpi, index) => {
        const x = 14 + index * 45.5
        const trend = `${kpi.change >= 0 ? '+' : ''}${formatPercent(kpi.change)} vs previous day`
        drawStat(x, 58, 41, 32, kpi.label, formatNumber(kpi.value), trend, kpiColors[index])
      })

      let y = 101
      y = pdfSectionTitle(doc, 'Lead Management Funnel', 'Unique leads counted once per engagement stage.', y)
      pdfReport.funnel.forEach((stage, index) => {
        const width = 174 - index * 18
        const x = 18 + index * 9
        doc.setFillColor(...(index % 2 ? PDF_COLORS.cyan : PDF_COLORS.blue))
        doc.roundedRect(x, y, width, 11, 3, 3, 'F')
        pdfText(doc, `${stage.label}: ${formatNumber(stage.count)}`, x + 5, y + 7, { size: 7.2, color: PDF_COLORS.white, style: 'bold' })
        pdfText(doc, `${formatPercent(stage.progression)} progression | ${formatPercent(stage.dropoff)} drop-off | ${formatPercent(stage.overall)} overall`, x + width - 72, y + 7, { size: 6.3, color: PDF_COLORS.white, maxWidth: 66 })
        y += 14
      })

      y += 4
      y = pdfSectionTitle(doc, 'Lead Scoring & Classification', `Average engagement score: ${formatPercent(pdfReport.avgScore).replace('%', '')}/100`, y)
      const totalScored = Math.max(1, pdfReport.scoredLeads.length)
      pdfReport.categoryCounts.forEach((row, index) => {
        const x = 14 + index * 60
        const color = row.name === 'Hot' ? PDF_COLORS.rose : row.name === 'Warm' ? PDF_COLORS.amber : PDF_COLORS.blue
        drawStat(x, y, 54, 25, `${row.name} Leads`, formatNumber(row.count), `${formatPercent((row.count * 100) / totalScored)} of classified leads`, color)
      })
      y += 35
      pdfTable(doc, y, [['Lead', 'Source', 'Score', 'Category', 'Last Contact']], pdfReport.scoredLeads.slice().sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 5).map((lead) => [
        lead.name || 'Unnamed lead',
        sourceLabel(lead),
        `${lead.engagementScore}/100`,
        lead.category,
        formatPdfDate(lead.lastContactDate, REPORT_TIME_ZONE),
      ]), { headColor: PDF_COLORS.navy, fontSize: 7, columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 22, halign: 'right' }, 3: { cellWidth: 25 }, 4: { cellWidth: 35 } } })

      y = addHeaderPage('Activity Analytics', 'Follow-ups, welcome calls, meetings, and source mix')
      const panels = [
        ['Follow-Up Analytics', pdfReport.followUp, [['Completed', 'completed'], ['Scheduled', 'scheduled'], ['Pending', 'pending'], ['Overdue', 'overdue'], ['Today', 'today'], ['Completion', 'completion']]],
        ['Welcome Call Analytics', pdfReport.welcome, [['Completed', 'completed'], ['Pending', 'pending'], ['Unanswered', 'unanswered'], ['Failed', 'failed'], ['Completion', 'completion']]],
        ['Meeting Analytics', pdfReport.meeting, [['Completed', 'completed'], ['Scheduled', 'scheduled'], ['Upcoming', 'upcoming'], ['Rescheduled', 'rescheduled'], ['Cancelled', 'cancelled'], ['No-show', 'noShow'], ['Completion', 'completion']]],
      ]
      panels.forEach(([title, values, rows], index) => {
        const x = index === 1 ? 109 : 14
        const panelY = index === 2 ? 118 : y
        const panelWidth = index === 2 ? 181 : 86
        pdfCard(doc, x, panelY, panelWidth, index === 2 ? 59 : 73, PDF_COLORS.white)
        pdfText(doc, title, x + 5, panelY + 8, { size: 9, color: PDF_COLORS.navy, style: 'bold' })
        rows.forEach(([label, key], rowIndex) => {
          const value = key === 'completion' ? formatPercent(values[key]) : formatNumber(values[key])
          const rowX = x + 5 + (index === 2 && rowIndex > 3 ? 90 : 0)
          const rowY = panelY + 19 + (index === 2 ? (rowIndex % 4) * 8 : rowIndex * 8)
          pdfText(doc, label, rowX, rowY, { size: 7, color: PDF_COLORS.muted })
          doc.text(value, rowX + 56, rowY, { align: 'right' })
        })
      })

      y = 187
      y = pdfSectionTitle(doc, 'Lead Source Distribution', 'Volume share with engagement classification by source.', y)
      pdfTable(doc, y, [['Source', 'Total Leads', 'Share', 'Hot', 'Warm', 'Cold']], pdfReport.sourceRows.map((row) => [
        row.source,
        formatNumber(row.total),
        formatPercent(row.percent),
        formatNumber(row.hot),
        formatNumber(row.warm),
        formatNumber(row.cold),
      ]), { headColor: PDF_COLORS.cyan, fontSize: 7, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } })

      y = addHeaderPage('Lead Intelligence', 'Priority leads, activity attention, and smart insights')
      y = pdfSectionTitle(doc, 'Top 10 Priority Leads', 'Prioritized by engagement, inactivity, and upcoming or overdue follow-ups.', y)
      y = pdfTable(doc, y, [['Lead Name', 'Source', 'Score', 'Category', 'Last Contact', 'Next Follow-Up', 'Status', 'Recommended Next Action']], pdfReport.priorityLeads.map((lead) => [
        lead.name || 'Unnamed lead',
        sourceLabel(lead),
        `${lead.engagementScore}/100`,
        lead.category,
        formatPdfDate(lead.lastContactDate, REPORT_TIME_ZONE),
        formatPdfDate(lead.followUpDate, REPORT_TIME_ZONE),
        lead.status || 'NEW',
        lead.nextAction,
      ]), { headColor: PDF_COLORS.navy, fontSize: 6.2, cellPadding: 1.7, columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 25 }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 18 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 }, 6: { cellWidth: 19 }, 7: { cellWidth: 39 } } })

      y += 8
      y = pdfSectionTitle(doc, 'Smart Lead Insights', 'Generated only from CRM lead and activity records available to this report.', y)
      pdfReport.insights.forEach((insight, index) => {
        const boxY = y + index * 16
        pdfCard(doc, 14, boxY, pageWidth - 28, 12, index % 2 ? [251, 253, 255] : PDF_COLORS.white)
        doc.setFillColor(...(index % 2 ? PDF_COLORS.cyan : PDF_COLORS.blue))
        doc.circle(20, boxY + 6, 2, 'F')
        pdfText(doc, insight, 26, boxY + 7.5, { size: 7.3, color: PDF_COLORS.slate, maxWidth: pageWidth - 43 })
      })

      const totalPages = doc.getNumberOfPages()
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page)
        pdfFooter(doc, pdfReport, page, totalPages)
      }
      doc.save(`nexacrm-lead-activity-engagement-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success(`Lead activity PDF downloaded (${totalPages} pages).`)
    } catch (err) {
      toast.error(err?.message || 'Failed to generate lead activity PDF')
    } finally {
      setExporting('')
    }
  }

  const exportExcel = async () => {
    if (!canExport) return toast.error('You do not have permission to export reports.')
    setExporting('xlsx')
    try {
      const blob = await analyticsAPI.exportReport({ format: 'xlsx', scope: 'lead-funnel', ...requestParams })
      saveBlob(blob, `nexacrm-lead-performance-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Lead performance Excel report downloaded.')
    } catch (err) {
      toast.error(err?.message || 'Failed to download Excel report')
    } finally {
      setExporting('')
    }
  }

  if (loading && !data.summary) {
    return (
      <div className="space-y-4">
        <div className="glass-card h-36 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="glass-card h-32 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" />)}</div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="glass-card h-80 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" /><div className="glass-card h-80 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" /></div>
      </div>
    )
  }

  const winRate = report.total ? (report.converted * 100) / report.total : 0
  const contactedRate = report.total ? (report.contacted * 100) / report.total : 0
  return (
    <div className="space-y-5 pb-6">
      <div className="glass-card overflow-visible p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300"><BarChart3 className="h-4 w-4" /> Lead activity & engagement report</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Lead Management & Daily Activity Analytics Report</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Yesterday’s leads, follow-ups, calls and priority actions.</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {report.summary.periodLabel || 'Selected period'}</span><span>Updated {lastUpdated ? formatDateTime(lastUpdated) : '—'}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRefreshTick((tick) => tick + 1)} className="btn-secondary gap-1.5 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            <button type="button" onClick={exportPdf} disabled={!canExport || exporting === 'pdf'} className="btn-secondary gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-4 w-4" /> {exporting === 'pdf' ? 'Preparing...' : 'PDF'}</button>
            <button type="button" onClick={exportExcel} disabled={!canExport || exporting === 'xlsx'} className="btn-primary gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" /> {exporting === 'xlsx' ? 'Preparing...' : 'Excel'}</button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4 dark:border-slate-700/50">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/50"><CalendarDays className="h-4 w-4 text-brand-500" /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200">{DATE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/50"><Filter className="h-4 w-4 text-slate-400" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200">{STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/50"><Database className="h-4 w-4 text-slate-400" /><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200">{SOURCE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          {filter === 'custom' ? <><input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/50" /><input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/50" /></> : null}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-400"><Gauge className="h-3.5 w-3.5" /> Counts are based on leads created in this period</span>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">{error} Refresh to retry the missing sections.</div> : null}
      {!canExport ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">Exporting needs report-export permission.</div> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Leads created" value={formatNumber(report.total)} detail={report.summary.periodLabel || 'Selected period'} icon={Users} change={metricChange(report.summary, 'totalLeads')} tone="brand" />
        <MetricCard label="Active pipeline" value={formatNumber(report.active)} detail="Not converted or lost" icon={Layers3} change={metricChange(report.summary, 'totalLeads')} tone="violet" />
        <MetricCard label="Completion rate" value={formatPercent(winRate)} detail={`${formatNumber(report.converted)} leads completed`} icon={TrendingUp} change={metricChange(report.summary, 'conversionRate')} tone="emerald" />
        <MetricCard label="Contacted rate" value={formatPercent(contactedRate)} detail={`${formatNumber(report.contacted)} leads contacted`} icon={UserCheck} change={metricChange(report.summary, 'contactedLeads')} tone="amber" />
        <MetricCard label="Pending follow-ups" value={formatNumber(report.pending)} detail="Open follow-up dates" icon={Clock3} change={metricChange(report.summary, 'pendingFollowUps')} tone="rose" />
      </div>

      <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400"><InfoHint text="Each lead is counted once by its current status. Completion rate is based on leads created in the selected period and their current outcome. Use the PDF export for the premium three-page lead activity and engagement report." /> How to read this report</div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="glass-card p-4 sm:p-5 xl:col-span-7">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Current pipeline shape<InfoHint text="Where the selected-period leads sit right now." /></h2></div><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{formatNumber(report.total)} leads</span></div>
          <div className="mt-5 space-y-3">
            {report.funnel.length ? report.funnel.map((row) => { const share = report.total ? (row.count * 100) / report.total : 0; return <div key={row.key}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 font-medium text-slate-700 dark:text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />{row.label}</span><span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{formatNumber(row.count)} <span className="ml-1 text-xs">({formatPercent(share)})</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, share)}%`, backgroundColor: row.color }} /></div></div> }) : <EmptyState>No lead stage data for this period.</EmptyState>}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400"><InfoHint text="The bars show portfolio share, not a sequential conversion funnel. Current stage counts can move up or down independently." /> How to read this</div>
        </section>

        <section className="glass-card p-4 sm:p-5 xl:col-span-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Outcome picture<InfoHint text="Current outcome mix for leads created in the period." /></h2></div><Target className="h-5 w-5 text-emerald-500" /></div>
          {statusMix.length ? <div className="mt-4 grid grid-cols-1 items-center gap-3 sm:grid-cols-[180px_1fr]"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>{statusMix.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [formatNumber(value), 'Leads']} /></PieChart></ResponsiveContainer><div className="space-y-3">{statusMix.map((item) => <div key={item.name} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(item.value)} <span className="ml-1 text-xs font-normal text-slate-400">({formatPercent(report.total ? item.value * 100 / report.total : 0)})</span></span></div>)}</div></div> : <EmptyState>No outcomes to chart for this period.</EmptyState>}
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20"><p className="text-xs text-emerald-700 dark:text-emerald-300">Converted</p><p className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">{formatNumber(report.converted)}</p></div><div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/20"><p className="text-xs text-rose-700 dark:text-rose-300">Lost</p><p className="mt-1 text-xl font-bold text-rose-800 dark:text-rose-200">{formatNumber(report.lost)}</p></div></div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="glass-card p-4 sm:p-5 xl:col-span-7"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Volume and outcomes over time<InfoHint text="Created lead volume compared with recorded converted and lost outcomes." /></h2></div><TrendingUp className="h-5 w-5 text-brand-500" /></div>{data.trend.length ? <div className="mt-4"><ResponsiveContainer width="100%" height={260}><AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="leadVolumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7f6ce4" stopOpacity={0.28} /><stop offset="95%" stopColor="#7f6ce4" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" /><XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value, name) => [formatNumber(value), name === 'leadCount' ? 'Created' : name === 'convertedCount' ? 'Converted' : 'Lost']} /><Area type="monotone" dataKey="leadCount" name="leadCount" stroke="#7f6ce4" fill="url(#leadVolumeFill)" strokeWidth={2} /><Area type="monotone" dataKey="convertedCount" name="convertedCount" stroke="#22c55e" fill="none" strokeWidth={2} /><Area type="monotone" dataKey="lostCount" name="lostCount" stroke="#f43f5e" fill="none" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <div className="mt-4"><EmptyState>No trend data for this period.</EmptyState></div>}</section>
        <section className="glass-card p-4 sm:p-5 xl:col-span-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Where to improve<InfoHint text="Priorities generated from the visible operational signals." /></h2></div><AlertTriangle className="h-5 w-5 text-amber-500" /></div><div className="mt-4 space-y-3">{report.actions.map((action) => { const Icon = action.icon; const tone = { amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/25 dark:text-amber-300', violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/25 dark:text-violet-300', rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/25 dark:text-rose-300', sky: 'bg-brand-50 text-brand-600 dark:bg-brand-950/25 dark:text-brand-300', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/25 dark:text-emerald-300', brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/25 dark:text-brand-300' }[action.tone]; return <div key={action.title} className="flex gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60"><div className={`mt-0.5 rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{action.title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{action.body}</p></div></div> })}</div><Link to="/leads" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">Open leads to act on these signals <ArrowUpRight className="h-4 w-4" /></Link></section>
      </div>

      <section className="glass-card overflow-hidden"><div className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/50 sm:px-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Source performance<InfoHint text="Compare lead volume, current outcomes, and engagement quality by source." /></h2></div><BarChart3 className="h-5 w-5 text-brand-500" /></div></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700"><thead className="bg-slate-50/70 dark:bg-slate-900/50"><tr>{['Source', 'Leads', 'Converted', 'Lost', 'Current completion rate', 'Read'].map((header) => <th key={header} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{report.sourceRows.length ? report.sourceRows.map((row, index) => <tr key={row.sourceKey || row.sourceLabel} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40"><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-200"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />{row.sourceLabel}{row.bestPerforming ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Best rate</span> : null}</td><td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatNumber(row.totalLeads)}</td><td className="px-4 py-3 tabular-nums text-emerald-600">{formatNumber(row.convertedLeads)}</td><td className="px-4 py-3 tabular-nums text-rose-500">{formatNumber(row.lostLeads)}</td><td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatPercent(row.conversionRate)}</td><td className="max-w-xs px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{row.bestPerforming ? 'Protect quality and test more volume.' : row.totalLeads >= 3 && row.conversionRate === 0 ? 'Audit targeting and hand-off.' : 'Keep measuring before changing source mix.'}</td></tr>) : <tr><td colSpan="6" className="px-4 py-8"><EmptyState>No source data for this period.</EmptyState></td></tr>}</tbody></table></div></section>

      <div className="grid grid-cols-1 gap-4">
        <section className="glass-card overflow-hidden"><div className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/50"><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Recorded lead activity<InfoHint text="Recent lifecycle signals available for the selected period." /></h2></div><div className="max-h-[360px] overflow-y-auto">{data.activities.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{data.activities.slice(0, 12).map((activity) => <div key={activity.id} className="flex gap-3 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{activity.leadName || 'Unnamed lead'} <span className="font-normal text-slate-400">· {activity.activityType || 'Activity'}</span></p><time className="text-[11px] text-slate-400">{formatDateTime(activity.occurredAt)}</time></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{activity.oldStatus && activity.newStatus ? `${activity.oldStatus} → ${activity.newStatus}` : activity.notes || 'Lifecycle activity recorded'}</p></div></div>)}</div> : <div className="p-4"><EmptyState>No activity signals yet.</EmptyState></div>}</div></section>
      </div>

      <section className="glass-card p-4 sm:p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Data confidence and next measurement</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p className="text-slate-600 dark:text-slate-300"><strong className="text-slate-800 dark:text-slate-100">Reliable now:</strong> total, current status, source, converted, lost, and follow-up counts.</p></div><div className="flex gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p className="text-slate-600 dark:text-slate-300"><strong className="text-slate-800 dark:text-slate-100">Use carefully:</strong> current completion rate depends on the selected creation period and can change as leads mature.</p></div><div className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /><p className="text-slate-600 dark:text-slate-300"><strong className="text-slate-800 dark:text-slate-100">Missing for precision:</strong> complete stage transitions, response-time samples, and reason-coded losses.</p></div></div></div></div></section>
    </div>
  )
}

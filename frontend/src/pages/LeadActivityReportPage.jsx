import InfoHint from '../components/ui/InfoHint'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, CalendarDays, CheckCircle2, Clock3, Database,
  Download, FileText, Filter, Flame, Gauge, Loader2, PhoneCall, RefreshCw,
  Target, Users,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import { leadsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { PERMISSIONS, hasPermission } from '../utils/permissions'

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

const REPORT_TIME_ZONE = 'Asia/Kolkata'
const DAY_MS = 86400000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const PDF_COLORS = {
  navy: [20, 33, 61],
  slate: [71, 85, 105],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  soft: [248, 250, 252],
  blue: [37, 99, 235],
  teal: [20, 184, 166],
  amber: [245, 158, 11],
  rose: [239, 68, 68],
  white: [255, 255, 255],
}

const CONVERSION_FUNNEL_COLORS = [
  'bg-indigo-500',
  'bg-purple-500',
  'bg-blue-500',
  'bg-brand-500',
  'bg-emerald-500',
  'bg-slate-400',
  'bg-green-500',
  'bg-red-500',
]
const PDF_FUNNEL_COLORS = [
  [99, 102, 241],
  [168, 85, 247],
  [59, 130, 246],
  [6, 182, 212],
  [16, 185, 129],
  [148, 163, 184],
  [34, 197, 94],
  [239, 68, 68],
]

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN')
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`
const toDateKey = (date) => {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const yesterdayKey = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateKey(date)
}
const toDate = (value) => {
  if (!value) return null
  const date = DATE_ONLY.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
const daysBetween = (date) => {
  if (!date) return 999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / DAY_MS)
}

const sourceLabel = (lead) => {
  if (lead?.sourceLabel) return lead.sourceLabel
  const source = String(lead?.source || lead?.leadSource || 'OTHER').replace(/_/g, ' ').toLowerCase()
  return source.replace(/\b\w/g, (char) => char.toUpperCase())
}

const leadName = (lead) => lead?.name || lead?.fullName || lead?.customerName || lead?.contactName || lead?.companyName || 'Unnamed lead'
const activityType = (activity) => String(activity?.type || activity?.activityType || activity?.category || activity?.title || '').toLowerCase()
const activityStatus = (activity) => String(activity?.status || activity?.outcome || activity?.result || activity?.values?.status || activity?.values?.outcome || activity?.values?.callOutcome || activity?.values?.meetingStatus || activity?.values?.connectionStatus || '').toLowerCase()
const activityAt = (activity) => toDate(activity?.scheduledAt || activity?.dueDate || activity?.followUpDate || activity?.activityDate || activity?.occurredAt || activity?.createdAt)
const completedAt = (activity) => toDate(activity?.completedAt || activity?.doneAt || activity?.occurredAt)
const containsAny = (value, words) => words.some((word) => value.includes(word))
const isDone = (activity) => {
  const status = activityStatus(activity)
  return Boolean(activity?.completed || activity?.isCompleted || containsAny(status, ['complete', 'done', 'success', 'answered', 'attended', 'connected', 'allowed person for meeting']))
}

const inRange = (date, range) => {
  if (!date) return false
  return date >= range.start && date <= range.end
}

const completedActivityAt = (activity) => completedAt(activity) || (isDone(activity) ? activityAt(activity) : null)

const leadCreatedAt = (lead) => toDate(lead?.createdAt || lead?.createdDate || lead?.date)

const buildRange = (dateKey = yesterdayKey()) => {
  const selected = toDate(dateKey) || toDate(yesterdayKey()) || new Date()
  const start = new Date(selected)
  const end = new Date(selected)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

const rangeLabel = (range) => {
  const options = { day: '2-digit', month: 'short', year: 'numeric' }
  return `${range.start.toLocaleDateString('en-IN', options)} - ${range.end.toLocaleDateString('en-IN', options)}`
}

const pdfText = (doc, text, x, y, { size = 9, color = PDF_COLORS.slate, style = 'normal', maxWidth } = {}) => {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
  const lines = maxWidth ? doc.splitTextToSize(String(text ?? ''), maxWidth) : String(text ?? '')
  doc.text(lines, x, y)
}

const pdfCard = (doc, x, y, width, height, accent = PDF_COLORS.blue) => {
  doc.setFillColor(...PDF_COLORS.white)
  doc.setDrawColor(...PDF_COLORS.line)
  doc.roundedRect(x, y, width, height, 3, 3, 'FD')
  doc.setFillColor(...accent)
  doc.roundedRect(x, y, 3, height, 1.4, 1.4, 'F')
}

const pdfSectionTitle = (doc, title, subtitle, y) => {
  pdfText(doc, title, 14, y, { size: 12, color: PDF_COLORS.navy, style: 'bold' })
  if (subtitle) pdfText(doc, subtitle, 14, y + 5.5, { size: 7.2, color: PDF_COLORS.muted, maxWidth: 178 })
  return y + (subtitle ? 12 : 8)
}

const pdfFunnelSegment = (doc, centerX, y, topWidth, bottomWidth, height, color) => {
  const startX = centerX - (topWidth / 2)
  doc.setFillColor(...color)
  doc.setDrawColor(...PDF_COLORS.white)
  doc.setLineWidth(0.7)
  doc.lines([
    [topWidth, 0],
    [(bottomWidth - topWidth) / 2, height],
    [-bottomWidth, 0],
  ], startX, y, [1, 1], 'FD', true)
}

const classifyActivity = (activity) => {
  const type = activityType(activity)
  const values = activity?.values || {}
  const status = String(values.status || values.connectionStatus || values.callOutcome || values.outcome || values.meetingStatus || activity?.status || '').toLowerCase()
  const notes = String(activity?.notes || activity?.description || activity?.summary || '').toLowerCase()
  const label = String(activity?.activityLabel || activity?.activityTitle || activity?.activityId || '').toLowerCase()
  const value = `${type} ${label} ${status} ${notes}`
  const index = Number(activity?.activityIndex)
  if (index === 0) return 'welcome'
  if (index === 1) return 'followUp'
  if (index === 2 || index === 3) return 'meeting'
  if (containsAny(value, ['welcome'])) return 'welcome'
  if (containsAny(value, ['allowed person', 'meeting', 'site visit', 'visit', 'demo'])) return 'meeting'
  if (containsAny(value, ['follow', 'call back', 'callback'])) return 'followUp'
  return 'other'
}

const normalizeStatusText = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const activityTimestamp = (activity, fallback = 0) => {
  const time = new Date(activity?.savedAt || activity?.createdAt || activity?.updatedAt || 0).getTime()
  return Number.isNaN(time) ? fallback : time
}
const stageStatus = (stageIndex, values = {}) => {
  const status = normalizeStatusText(values.status || values.connectionStatus || values.callOutcome || values.outcome || values.meetingStatus || '')
  if (stageIndex === 0) {
    if (status === 'connected') return 'connected'
    if (['not connected', 'non connected', 'no answer'].includes(status)) return 'not_connected'
    if (['callback', 'call back', 'callback requested'].includes(status)) return 'callback'
    return 'done'
  }
  if (stageIndex === 1) {
    if (['meeting', 'allowed person for meeting', 'allowed person'].includes(status)) return 'allowed_person'
    if (['follow up', 'followup'].includes(status)) return 'follow_up'
    if (status === 'not interested') return 'not_interested'
    if (['lost', 'close lost', 'closed lost'].includes(status)) return 'lost'
    return 'done'
  }
  if (stageIndex === 2 || stageIndex === 3) {
    if (['successful', 'success', 'won', 'win', 'closed won'].includes(status)) return 'successful'
    if (['reschedule', 'rescheduled', 'failed', 'failure'].includes(status)) return 'reschedule'
    if (['lost', 'close lost', 'closed lost'].includes(status)) return 'lost'
    if (['negotiation', 'hold', 'follow up', 'followup', 'pending', 'pending review'].includes(status)) return 'pending'
    return 'done'
  }
  return 'not_started'
}
const stageLabel = (stageIndex, status) => {
  if (stageIndex < 0) return 'Not Started'
  if (stageIndex <= 0) return status === 'not_connected' ? 'Welcome Call - Not Connected' : status === 'callback' ? 'Welcome Call - Callback' : 'Welcome Call'
  if (stageIndex === 1) return status === 'allowed_person' ? 'Meeting Scheduled' : status === 'follow_up' ? 'Follow Up' : 'Follow-Up Meeting'
  if (stageIndex === 2) return 'Meeting'
  if (stageIndex >= 3) return status === 'successful' ? 'Won / Successful' : status === 'lost' ? 'Lost' : 'Meeting Outcome'
  return 'Not Started'
}
const bucketLabel = (bucket) => ({
  welcome: 'Welcome Call',
  followUp: 'Follow-Up',
  meeting: 'Meeting',
}[bucket] || 'Lead')
const activityStage = (activity) => {
  const numeric = Number(activity?.activityIndex)
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) return numeric
  const kind = classifyActivity(activity)
  if (kind === 'welcome') return 0
  if (kind === 'followUp') return 1
  if (kind === 'meeting') return 2
  return -1
}
const hasLeadAssignee = (lead) => Boolean(
  lead?.assignedTo || lead?.assignedToId || lead?.assignedToName ||
  lead?.ownerId || lead?.ownerName || lead?.salesOwnerId || lead?.salesOwnerName
)
const parseLeadStage = (lead, activities = []) => {
  const latestByStage = [null, null, null, null]
  activities.forEach((activity) => {
    const index = activityStage(activity)
    if (index < 0) return
    if (!latestByStage[index] || activityTimestamp(activity) > activityTimestamp(latestByStage[index])) latestByStage[index] = activity
  })
  const currentStage = latestByStage.reduce((latest, activity, index) => activity ? index : latest, -1)
  const latestActivity = currentStage >= 0 ? latestByStage[currentStage] : null
  const latestValues = latestActivity?.values || {}
  const status = currentStage >= 0 ? stageStatus(currentStage, latestValues) : 'not_started'
  const leadStatus = String(lead?.status || '').toUpperCase()
  const hasFollowUpDate = Boolean(lead?.followUpDate || activities.some((activity) => activity?.values?.nextFollowUpDate || activity?.values?.followUpDate))
  const hasMeeting = activities.some((activity) => classifyActivity(activity) === 'meeting')
  const bucket = hasMeeting || currentStage >= 2 || ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].includes(leadStatus)
    ? 'meeting'
    : currentStage === 1 || status === 'follow_up' || hasFollowUpDate || ['CONTACTED', 'INTERESTED'].includes(leadStatus)
      ? 'followUp'
      : 'welcome'
  return {
    bucket,
    currentStage,
    status,
    label: stageLabel(currentStage, status),
  }
}

const conversionStageForLead = (lead) => {
  const status = String(lead?.status || '').toUpperCase()
  if (!status || status === 'NEW') return hasLeadAssignee(lead) ? 'ASSIGNED' : 'NEW'
  if (status === 'CONTACTED') return 'CONTACTED'
  if (status === 'QUALIFIED') return 'QUALIFIED'
  if (status === 'PROPOSAL' || status === 'PROPOSAL_SENT') return 'PROPOSAL_SENT'
  if (status === 'NEGOTIATION' || status === 'INTERESTED') return 'INTERESTED'
  if (status === 'WON' || status === 'CONVERTED') return 'CONVERTED'
  if (status === 'LOST' || status === 'CLOSED_LOST' || status === 'NOT_INTERESTED') return 'LOST'
  if (lead?.bucket === 'meeting') return 'QUALIFIED'
  if (lead?.bucket === 'followUp') return 'CONTACTED'
  return hasLeadAssignee(lead) ? 'ASSIGNED' : 'NEW'
}

const scoreLead = (lead, activities) => {
  const status = String(lead?.status || '').toUpperCase()
  let score = 15
  if (['CONTACTED', 'INTERESTED', 'QUALIFIED', 'PROPOSAL_SENT'].includes(status)) score += 18
  if (['CONVERTED', 'WON'].includes(status)) score += 25
  if (activities.some((activity) => classifyActivity(activity) === 'welcome' && isDone(activity))) score += 16
  if (activities.some((activity) => classifyActivity(activity) === 'followUp' && isDone(activity))) score += 14
  if (activities.some((activity) => classifyActivity(activity) === 'meeting')) score += 18
  if (activities.some((activity) => {
    const date = activityAt(activity)
    return date && daysBetween(date) >= -7 && daysBetween(date) <= 7
  })) score += 10
  if (daysBetween(toDate(lead?.createdAt)) <= 3) score += 7
  const engagementScore = Math.min(100, score)
  return {
    engagementScore,
    category: engagementScore >= 70 ? 'Hot' : engagementScore >= 45 ? 'Warm' : 'Cold',
  }
}

const emptyActivityStats = () => ({
  total: 0,
  completed: 0,
  scheduled: 0,
  pending: 0,
  overdue: 0,
  today: 0,
  completion: 0,
})

const timelineAt = (event) => toDate(event?.eventAt || event?.timestamp || event?.createdAt || event?.savedAt || event?.updatedAt)
const timelineTitle = (event) => event?.title || event?.activityTitle || event?.activityLabel || event?.eventType || 'Lead activity'
const timelineDescription = (event) => event?.description || event?.summary || event?.notes || ''
const scheduledFollowUpAt = (source = {}) => {
  const values = source?.values || source?.metadata || {}
  const text = timelineDescription(source)
  const date = values.nextFollowUpDate || values.followUpDate || text.match(/(?:nextFollowUpDate|followUpDate):\s*(\d{4}-\d{2}-\d{2})/i)?.[1]
  const time = values.nextFollowUpTime || values.followUpTime || text.match(/(?:nextFollowUpTime|followUpTime):\s*([0-2]?\d:[0-5]\d)/i)?.[1]
  if (!date) return null
  return toDate(`${date}T${String(time || '00:00').padStart(5, '0')}`)
}
const timelineDisplayTime = (row) => row.scheduledAt || row.at
const normalizeTimelineRows = (lead, activities = [], events = []) => {
  const timelineRows = Array.isArray(events) && events.length
    ? events.map((event, index) => ({
      id: event.id || event.sourceId || `event-${lead.id}-${index}`,
      lead,
      title: timelineTitle(event),
      description: timelineDescription(event),
      status: event.status || event.sourceType || 'Timeline',
      scheduledAt: scheduledFollowUpAt(event),
      at: timelineAt(event),
    }))
    : activities.map((activity, index) => ({
      id: activity.id || `activity-${lead.id}-${index}`,
      lead,
      title: activity.activityTitle || activity.activityLabel || stageLabel(activityStage(activity), stageStatus(activityStage(activity), activity.values || {})),
      description: activity.summary || timelineDescription(activity),
      status: stageStatus(activityStage(activity), activity.values || {}),
      scheduledAt: scheduledFollowUpAt(activity),
      at: timelineAt(activity),
    }))
  return timelineRows
    .filter((row) => row.at)
    .sort((a, b) => b.at - a.at)
}

const buildReport = ({ leads, activityMap, timelineMap, sourceFilter, reportDate }) => {
  const range = buildRange(reportDate)

  const visibleLeads = leads
    .filter((lead) => !sourceFilter || String(lead?.source || lead?.leadSource || '').toUpperCase() === sourceFilter)
    .filter((lead) => {
      const created = leadCreatedAt(lead)
      return !created || created <= range.end
    })

  const newLeadRows = visibleLeads.filter((lead) => {
    const created = leadCreatedAt(lead)
    return created && inRange(created, range)
  })

  const leadRows = visibleLeads.map((lead) => {
    const activities = Array.isArray(activityMap[lead.id]) ? activityMap[lead.id] : []
    const scored = scoreLead(lead, activities)
    const stage = parseLeadStage(lead, activities)
    const dates = activities.map(activityAt).filter(Boolean).sort((a, b) => b - a)
    const timelines = normalizeTimelineRows(lead, activities, timelineMap?.[lead.id] || [])
      .filter((row) => inRange(row.at, range))
    return { ...lead, ...scored, ...stage, activities, timelines, lastContactDate: dates[0] || toDate(lead?.updatedAt || lead?.createdAt) }
  })

  const allActivities = leadRows.flatMap((lead) => lead.activities.map((activity) => ({ ...activity, lead })))
  const completedActivities = allActivities.filter((activity) => {
    const date = completedActivityAt(activity)
    return isDone(activity) && date && inRange(date, range) && ['welcome', 'followUp', 'meeting'].includes(classifyActivity(activity))
  })
  const completedByLead = completedActivities.reduce((acc, activity) => {
    const leadId = activity.lead?.id
    if (!leadId) return acc
    acc[leadId] ||= []
    acc[leadId].push(activity)
    return acc
  }, {})
  leadRows.forEach((lead) => {
    lead.completedYesterdayActivities = completedByLead[lead.id] || []
  })

  const activityStats = {
    followUp: emptyActivityStats(),
    welcome: emptyActivityStats(),
    meeting: emptyActivityStats(),
  }
  completedActivities.forEach((activity) => {
    const kind = classifyActivity(activity)
    if (!activityStats[kind]) return
    const stat = activityStats[kind]
    const completed = completedActivityAt(activity)
    stat.total += 1
    if (completed) stat.scheduled += 1
    stat.completed += 1
  })
  Object.values(activityStats).forEach((stat) => {
    stat.completion = stat.total ? (stat.completed * 100) / stat.total : 0
  })

  const stageCounts = completedActivities.reduce((acc, activity) => {
    const kind = classifyActivity(activity)
    if (acc[kind] !== undefined) acc[kind] += 1
    return acc
  }, { welcome: 0, followUp: 0, meeting: 0 })

  const statusCount = (statuses) => leadRows.filter((lead) => statuses.includes(String(lead.status || '').toUpperCase())).length
  const welcomeCompleted = activityStats.welcome.completed
  const followCompleted = activityStats.followUp.completed
  const meetingScheduled = activityStats.meeting.completed
  const meetingCompleted = activityStats.meeting.completed

  const funnel = [
    { label: 'Total Leads', count: leadRows.length },
    { label: 'Welcome Call', count: Math.max(stageCounts.welcome + stageCounts.followUp + stageCounts.meeting, welcomeCompleted) },
    { label: 'Follow-Up', count: followCompleted },
    { label: 'Meeting Scheduled', count: meetingScheduled },
    { label: 'Meeting Completed', count: meetingCompleted },
  ].map((stage, index, stages) => {
    const previous = index ? stages[index - 1].count : stage.count
    return {
      ...stage,
      progression: previous ? (stage.count * 100) / previous : 0,
      overall: leadRows.length ? (stage.count * 100) / leadRows.length : 0,
    }
  })

  const conversionCounts = leadRows.reduce((acc, lead) => {
    const stage = conversionStageForLead(lead)
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {})
  const conversionFunnel = [
    { label: 'New Leads', count: leadRows.length },
    { label: 'Assigned Leads', count: conversionCounts.ASSIGNED || 0 },
    { label: 'Contacted', count: conversionCounts.CONTACTED || 0 },
    { label: 'Interested', count: conversionCounts.INTERESTED || 0 },
    { label: 'Qualified', count: conversionCounts.QUALIFIED || 0 },
    { label: 'Proposal Sent', count: conversionCounts.PROPOSAL_SENT || 0 },
    { label: 'Converted', count: conversionCounts.CONVERTED || 0 },
    { label: 'Lost', count: conversionCounts.LOST || 0 },
  ].map((stage, index, stages) => {
    const maxCount = Math.max(...stages.map((item) => item.count), leadRows.length, 1)
    const previous = index ? stages[index - 1].count : stage.count
    return {
      ...stage,
      overall: (stage.count * 100) / maxCount,
      progression: previous ? (stage.count * 100) / previous : 0,
    }
  })

  const sourceRows = Object.values(leadRows.reduce((acc, lead) => {
    const label = sourceLabel(lead)
    acc[label] ||= { source: label, leads: 0, hot: 0, warm: 0, cold: 0 }
    acc[label].leads += 1
    acc[label][lead.category.toLowerCase()] += 1
    return acc
  }, {})).sort((a, b) => b.leads - a.leads)

  const categoryCounts = ['Hot', 'Warm', 'Cold'].map((name) => ({
    name,
    count: leadRows.filter((lead) => lead.category === name).length,
  }))

  const priorityLeads = leadRows
    .slice()
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 10)

  const upcoming = allActivities
    .filter((activity) => {
      const scheduled = activityAt(activity)
      const distance = daysBetween(scheduled)
      return !isDone(activity) && scheduled && distance >= 0 && distance <= 7
    })
    .sort((a, b) => activityAt(a) - activityAt(b))
    .slice(0, 8)

  const overdue = allActivities
    .filter((activity) => {
      const scheduled = activityAt(activity)
      return !isDone(activity) && scheduled && daysBetween(scheduled) < 0
    })
    .sort((a, b) => activityAt(a) - activityAt(b))
    .slice(0, 8)

  const avgScore = leadRows.length ? leadRows.reduce((sum, lead) => sum + lead.engagementScore, 0) / leadRows.length : 0
  const totalActivities = activityStats.followUp.total + activityStats.welcome.total + activityStats.meeting.total
  const completedActivityCount = activityStats.followUp.completed + activityStats.welcome.completed + activityStats.meeting.completed
  const activityCompletion = totalActivities ? (completedActivityCount * 100) / totalActivities : 0
  const visibleCompleted = {
    welcome: Math.min(activityStats.welcome.completed, stageCounts.welcome),
    followUp: Math.min(activityStats.followUp.completed, stageCounts.followUp),
    meeting: Math.min(activityStats.meeting.completed, stageCounts.meeting),
  }
  const insights = [
    categoryCounts[0].count ? `${categoryCounts[0].count} hot lead${categoryCounts[0].count === 1 ? '' : 's'} should be handled first.` : 'No hot leads are visible in this report filter.',
    activityStats.followUp.overdue ? `${activityStats.followUp.overdue} follow-up${activityStats.followUp.overdue === 1 ? '' : 's'} are overdue.` : 'Follow-up overdue queue is clear for the selected data.',
    activityStats.welcome.pending ? `${activityStats.welcome.pending} welcome call${activityStats.welcome.pending === 1 ? '' : 's'} still need completion.` : 'Welcome calls are not showing a pending backlog.',
    sourceRows[0] ? `${sourceRows[0].source} is currently the largest source with ${sourceRows[0].leads} lead${sourceRows[0].leads === 1 ? '' : 's'}.` : 'Lead source mix will appear after data is available.',
  ]

  return {
    range,
    rangeLabel: rangeLabel(range),
    sourceLabel: SOURCE_FILTERS.find((item) => item.value === sourceFilter)?.label || 'All sources',
    leadRows,
    kpis: [
      { label: 'Total Leads', value: newLeadRows.length, detail: 'Created on selected date' },
      { label: 'Welcome Calls', value: activityStats.welcome.completed, detail: `${activityStats.welcome.completed} completed` },
      { label: 'Follow-Ups', value: activityStats.followUp.completed, detail: `${activityStats.followUp.completed} completed` },
      { label: 'Meetings', value: activityStats.meeting.completed, detail: `${activityStats.meeting.completed} completed` },
    ],
    activityTotals: {
      total: totalActivities,
      completed: completedActivityCount,
      completion: activityCompletion,
    },
    funnel,
    conversionFunnel,
    completedActivities,
    visibleCompleted,
    leadTimelines: leadRows.flatMap((lead) => lead.timelines).sort((a, b) => b.at - a.at),
    stageCounts,
    categoryCounts,
    avgScore,
    sourceRows,
    priorityLeads,
    upcoming,
    overdue,
    insights,
    ...activityStats,
    totalLeads: newLeadRows.length,
    converted: statusCount(['CONVERTED', 'WON']),
  }
}

const downloadPdf = (report) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...PDF_COLORS.soft)
  doc.rect(0, 0, pageWidth, 297, 'F')
  doc.setFillColor(...PDF_COLORS.navy)
  doc.rect(0, 0, pageWidth, 48, 'F')
  doc.setFillColor(...PDF_COLORS.blue)
  doc.roundedRect(14, 12, 30, 7, 3.5, 3.5, 'F')
  pdfText(doc, 'Internite CRM', 18, 17.2, { size: 7, color: PDF_COLORS.white, style: 'bold' })
  pdfText(doc, 'Lead Management & Daily Activity Analytics Report', 14, 31, { size: 17, color: PDF_COLORS.white, style: 'bold', maxWidth: 175 })
  pdfText(doc, `${report.rangeLabel} | ${report.sourceLabel} | ${REPORT_TIME_ZONE}`, 14, 41, { size: 7.5, color: [203, 213, 225] })

  const kpiAccents = [PDF_COLORS.blue, PDF_COLORS.teal, PDF_COLORS.amber, PDF_COLORS.rose]
  report.kpis.forEach((kpi, index) => {
    const x = 14 + index * 46
    pdfCard(doc, x, 58, 42, 30, kpiAccents[index])
    pdfText(doc, kpi.label, x + 6, 67, { size: 6.5, color: PDF_COLORS.muted, style: 'bold', maxWidth: 32 })
    pdfText(doc, typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value, x + 6, 78, { size: 15, color: PDF_COLORS.navy, style: 'bold' })
    pdfText(doc, kpi.detail, x + 6, 84.5, { size: 6.2, color: PDF_COLORS.muted, maxWidth: 31 })
  })

  let y = pdfSectionTitle(doc, 'Lead Conversion Funnel', 'All leads through the selected date.', 103)
  const funnelStartY = y
  report.conversionFunnel.forEach((item, index) => {
    const width = Math.max(20, 88 * Math.min(100, item.overall) / 100)
    const next = report.conversionFunnel[index + 1]
    const nextWidth = next ? Math.max(20, 88 * Math.min(100, next.overall) / 100) : Math.max(16, width * 0.72)
    pdfFunnelSegment(doc, 59, funnelStartY + (index * 7.5), width, nextWidth, 7.5, PDF_FUNNEL_COLORS[index % PDF_FUNNEL_COLORS.length])
    pdfText(doc, item.label, 116, funnelStartY + 4.8 + (index * 7.5), { size: 8, color: PDF_COLORS.navy, style: 'bold' })
    pdfText(doc, `· ${formatNumber(item.count)}`, 158, funnelStartY + 4.8 + (index * 7.5), { size: 8, color: PDF_COLORS.muted, maxWidth: 25 })
  })
  y = funnelStartY + 68

  y += 6
  y = pdfSectionTitle(doc, 'Priority Lead Scoring', `Average score: ${formatNumber(report.avgScore)}/100 | Hot ${report.categoryCounts[0]?.count || 0}, Warm ${report.categoryCounts[1]?.count || 0}, Cold ${report.categoryCounts[2]?.count || 0}`, y)
  autoTable(doc, {
    startY: y,
    head: [['Lead', 'Source', 'Score', 'Class', 'Last Contact']],
    body: report.priorityLeads.map((lead) => [
      leadName(lead),
      sourceLabel(lead),
      `${lead.engagementScore}/100`,
      lead.category,
      lead.lastContactDate ? lead.lastContactDate.toLocaleDateString('en-IN') : '-',
    ]),
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: PDF_COLORS.teal },
  })

  doc.addPage()
  doc.setFillColor(...PDF_COLORS.soft)
  doc.rect(0, 0, pageWidth, 297, 'F')
  pdfText(doc, 'Lead Timelines', 14, 18, { size: 14, color: PDF_COLORS.navy, style: 'bold' })
  pdfText(doc, 'Timeline events for every lead loaded in the selected date report.', 14, 25, { size: 7.5, color: PDF_COLORS.muted })
  autoTable(doc, {
    startY: 34,
    head: [['Lead', 'Stage', 'Timeline', 'Status', 'Date', 'Details']],
    body: report.leadTimelines.length ? report.leadTimelines.map((row) => [
      leadName(row.lead),
      bucketLabel(row.lead.bucket),
      row.title,
      row.status || '-',
      timelineDisplayTime(row) ? timelineDisplayTime(row).toLocaleString('en-IN') : '-',
      row.description || '-',
    ]) : [['No timeline events found', '-', '-', '-', '-', '-']],
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 24 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
      5: { cellWidth: 45 },
    },
    headStyles: { fillColor: PDF_COLORS.navy },
  })
  doc.save(`lead-activity-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

const loadReportLeads = async (sourceFilter, reportDate) => {
  const range = buildRange(reportDate)
  const rows = []
  const pageSize = 100
  const maxPages = 1000

  for (let page = 0; page < maxPages; page += 1) {
    const response = await leadsAPI.getAll({
      page,
      size: pageSize,
      sort: 'createdAt,desc',
      ...(sourceFilter ? { source: sourceFilter } : {}),
    })
    const content = Array.isArray(response?.content) ? response.content : []
    const reportRows = content.filter((lead) => {
      const created = leadCreatedAt(lead)
      return !created || created <= range.end
    })
    rows.push(...reportRows)
    if (content.length < pageSize || response?.last) break
  }

  return rows
}

const loadLeadTimelineEvents = async (leadId) => {
  const events = []
  const size = 50
  const maxPages = 10
  for (let page = 0; page < maxPages; page += 1) {
    const response = await leadsAPI.getTimeline(leadId, { page, size })
    const content = Array.isArray(response?.content) ? response.content : []
    events.push(...content)
    if (content.length < size || response?.last) break
  }
  return events
}

function StatCard({ label, value, detail, icon: Icon, tone = 'blue' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300',
  }[tone]
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{typeof value === 'number' ? formatNumber(value) : value}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-xl p-2 ${toneClass}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/50 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {Icon ? <Icon className="h-5 w-5 text-brand-500" /> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div>
}

function ActivityTable({ rows }) {
  if (!rows.length) return <EmptyState>No activities found for this section.</EmptyState>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="bg-slate-50/70 dark:bg-slate-900/50">
          <tr>{['Lead', 'Activity', 'Date', 'Status'].map((header) => <th key={header} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((activity, index) => (
            <tr key={`${activity.lead?.id || index}-${activity.id || index}`}>
              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{leadName(activity.lead)}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{activity.activityType || activity.type || activity.title || 'Activity'}</td>
              <td className="px-3 py-2 text-slate-500">{(completedActivityAt(activity) || activityAt(activity))?.toLocaleDateString('en-IN') || '-'}</td>
              <td className="px-3 py-2 text-slate-500">{isDone(activity) ? 'Completed' : daysBetween(activityAt(activity)) < 0 ? 'Overdue' : 'Upcoming'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LeadActivityReportPage() {
  const user = useAuthStore((state) => state.user)
  const [reportDate, setReportDate] = useState(yesterdayKey)
  const [sourceFilter, setSourceFilter] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [leads, setLeads] = useState([])
  const [activityMap, setActivityMap] = useState({})
  const [timelineMap, setTimelineMap] = useState({})

  const canExport = hasPermission(user, PERMISSIONS.REPORTS_EXPORT) || hasPermission(user, PERMISSIONS.ANALYTICS_EXPORT)

  useEffect(() => {
    let mounted = true
    const loadReport = async () => {
      setLoading(true)
      setError('')
      setActivityMap({})
      setTimelineMap({})
      try {
        const rows = await loadReportLeads(sourceFilter, reportDate)
        if (mounted) {
          setLeads(rows)
          setLoading(false)
        }
        const ids = rows.map((lead) => lead.id).filter(Boolean)
        const nextActivityMap = {}
        for (let index = 0; index < ids.length; index += 50) {
          const chunk = ids.slice(index, index + 50)
          const batch = await leadsAPI.getActivitiesBulk(chunk)
          Object.assign(nextActivityMap, batch || {})
        }
        if (mounted) {
          setActivityMap(nextActivityMap)
        }
        const nextTimelineMap = {}
        for (let index = 0; index < ids.length; index += 10) {
          const chunk = ids.slice(index, index + 10)
          const results = await Promise.all(chunk.map(async (leadId) => {
            try {
              return [leadId, await loadLeadTimelineEvents(leadId)]
            } catch {
              return [leadId, []]
            }
          }))
          results.forEach(([leadId, events]) => {
            nextTimelineMap[leadId] = events
          })
        }
        if (mounted) {
          setTimelineMap(nextTimelineMap)
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Report data could not be loaded.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadReport()
    return () => { mounted = false }
  }, [refreshTick, sourceFilter, reportDate])

  const report = useMemo(() => buildReport({ leads, activityMap, timelineMap, sourceFilter, reportDate }), [activityMap, leads, sourceFilter, reportDate, timelineMap])

  const handlePdf = async () => {
    if (!canExport) return toast.error('You do not have permission to export reports.')
    setExporting(true)
    try {
      downloadPdf(report)
      toast.success('Report PDF downloaded.')
    } finally {
      setExporting(false)
    }
  }

  const categoryTotal = Math.max(1, report.categoryCounts.reduce((sum, item) => sum + item.count, 0))
  const activityRows = report.completedActivities

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="glass-card h-36 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="glass-card h-32 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" />)}</div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="glass-card h-80 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" /><div className="glass-card h-80 animate-pulse bg-slate-100/70 dark:bg-slate-800/40" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Separate report page</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Lead Activity Report<InfoHint text="The selected date's new leads, completed work, historical conversion funnel, priority leads, and timelines are shown here." /></h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRefreshTick((tick) => tick + 1)} className="btn-secondary gap-1.5 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button>
            <button type="button" onClick={handlePdf} disabled={!canExport || exporting} className="btn-primary gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-200">
            <CalendarDays className="h-4 w-4 text-brand-500" />
            <input aria-label="Report date" type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value || yesterdayKey())} className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/50">
            <Filter className="h-4 w-4 text-slate-400" />
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200">
              {SOURCE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{report.rangeLabel}</span>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={report.kpis[0].label} value={report.kpis[0].value} detail={report.kpis[0].detail} icon={Users} tone="blue" />
        <StatCard label={report.kpis[1].label} value={report.kpis[1].value} detail={report.kpis[1].detail} icon={PhoneCall} tone="teal" />
        <StatCard label={report.kpis[2].label} value={report.kpis[2].value} detail={report.kpis[2].detail} icon={Clock3} tone="amber" />
        <StatCard label={report.kpis[3].label} value={report.kpis[3].value} detail={report.kpis[3].detail} icon={CalendarDays} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Lead Conversion Funnel" subtitle="Stage progression with drop-off." icon={BarChart3}>
          <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.9fr)_minmax(220px,1fr)] lg:items-center">
            <div className="flex flex-col items-center justify-center">
              {report.conversionFunnel.map((stage, index) => (
                <div
                  key={stage.label}
                  className={`h-10 border border-white/80 shadow-sm ${CONVERSION_FUNNEL_COLORS[index % CONVERSION_FUNNEL_COLORS.length]}`}
                  style={{
                    width: `${Math.max(18, Math.min(100, stage.overall))}%`,
                    clipPath: index === 0
                      ? 'polygon(50% 0, 100% 100%, 0 100%)'
                      : index === report.conversionFunnel.length - 1
                        ? 'polygon(0 0, 100% 0, 50% 100%)'
                        : 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)',
                  }}
                />
              ))}
            </div>
            <div className="space-y-2">
              {report.conversionFunnel.map((stage, index) => (
                <div key={stage.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/80 px-3 py-2 dark:bg-slate-900/40">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CONVERSION_FUNNEL_COLORS[index % CONVERSION_FUNNEL_COLORS.length]}`} />
                    <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{stage.label}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatNumber(stage.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Lead Scoring & Classification" subtitle={`Average engagement score: ${formatNumber(report.avgScore)}/100`} icon={Gauge}>
          <div className="grid gap-3 sm:grid-cols-3">
            {report.categoryCounts.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{item.name}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">{formatNumber(item.count)}</p>
                <p className="text-xs text-slate-500">{formatPercent((item.count * 100) / categoryTotal)} of leads</p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50"><tr>{['Priority Lead', 'Source', 'Score', 'Class'].map((header) => <th key={header} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.priorityLeads.slice(0, 5).map((lead) => (
                  <tr key={lead.id || leadName(lead)}>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{leadName(lead)}</td>
                    <td className="px-3 py-2 text-slate-500">{sourceLabel(lead)}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{lead.engagementScore}/100</td>
                    <td className="px-3 py-2"><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{lead.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section title="Follow-Up Analytics" icon={Clock3}>
          <StatCard label="Follow-ups" value={report.stageCounts.followUp} detail={`${report.followUp.completed} completed`} icon={Clock3} tone="amber" />
        </Section>
        <Section title="Welcome Call Analytics" icon={PhoneCall}>
          <StatCard label="Welcome calls" value={report.stageCounts.welcome} detail={`${report.welcome.completed} completed`} icon={PhoneCall} tone="teal" />
        </Section>
        <Section title="Meeting Analytics" icon={CalendarDays}>
          <StatCard label="Meetings" value={report.stageCounts.meeting} detail={`${report.meeting.completed} completed`} icon={CalendarDays} tone="rose" />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Lead Source Distribution" subtitle="Source count with hot, warm, and cold classification." icon={Database}>
          {report.sourceRows.length ? (
            <div className="space-y-3">
              {report.sourceRows.map((row) => (
                <div key={row.source} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{row.source}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatNumber(row.leads)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Hot {row.hot} · Warm {row.warm} · Cold {row.cold}</p>
                </div>
              ))}
            </div>
          ) : <EmptyState>No source data for this filter.</EmptyState>}
        </Section>

        <Section title="Top 10 Priority Leads" subtitle="Sorted by engagement score and recent activity." icon={Flame}>
          {report.priorityLeads.length ? (
            <div className="space-y-2">
              {report.priorityLeads.map((lead, index) => (
                <div key={lead.id || `${leadName(lead)}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{index + 1}. {leadName(lead)}</p>
                    <p className="text-xs text-slate-500">{sourceLabel(lead)} · {lead.category}</p>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">{lead.engagementScore}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState>No priority leads found.</EmptyState>}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Yesterday's Completed Activities" subtitle="Completed welcome calls, follow-ups, and meetings across all leads." icon={CheckCircle2}>
          <ActivityTable rows={activityRows} />
        </Section>
        <Section title="Smart Lead Insights" subtitle="Short operational reads from the current data." icon={Target}>
          <div className="space-y-3">
            {report.insights.map((insight) => (
              <div key={insight} className="flex gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">{insight}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Lead Timelines" subtitle="The leads with timeline events yesterday, linked to their completed work." icon={Clock3}>
        {report.leadTimelines.length ? (
          <div className="space-y-3">
            {report.leadRows.filter((lead) => lead.timelines.length).map((lead, leadIndex) => (
              <div key={lead.id || `${leadName(lead)}-${leadIndex}`} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{leadName(lead)}</p>
                    <p className="text-xs text-slate-500">{sourceLabel(lead)} · {bucketLabel(lead.bucket)}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      Completed yesterday: {Array.from(new Set(lead.completedYesterdayActivities.map((activity) => bucketLabel(classifyActivity(activity))))).join(', ') || 'Timeline event recorded'}
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{formatNumber(lead.timelines.length)} events</span>
                </div>
                {lead.timelines.length ? (
                  <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {lead.timelines.map((row, rowIndex) => (
                      <div key={row.id || `${lead.id || leadIndex}-${rowIndex}`} className="grid gap-2 py-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)_120px]">
                        <div>
                          <p className="text-xs font-medium text-slate-500">{timelineDisplayTime(row) ? timelineDisplayTime(row).toLocaleString('en-IN') : '-'}</p>
                          {row.scheduledAt ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Scheduled</p> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{row.title}</p>
                          {row.description ? <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{row.description}</p> : null}
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{row.status || 'Activity'}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No timeline events found for this lead.</p>}
              </div>
            ))}
          </div>
        ) : <EmptyState>No leads found for this report date.</EmptyState>}
      </Section>
    </div>
  )
}

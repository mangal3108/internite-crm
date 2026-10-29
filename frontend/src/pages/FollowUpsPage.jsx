import InfoHint from '../components/ui/InfoHint'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  CalendarCheck2,
  Clock3,
  RefreshCw,
  Plus,
  UserRound,
  ArrowRight,
  FileText,
  BadgeCheck,
  PhoneCall,
  Mail,
  MessageSquare,
  CircleDot,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import TaskEditorModal from '../components/tasks/TaskEditorModal'
import PaginatedSelect from '../components/ui/PaginatedSelect'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { leadsAPI, tasksAPI } from '../services/api'
import { emptyDateRange, isWithinDateRange } from '../utils/dateRangeFilter'

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

const formatWhen = (value) => {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const iconForText = (text) => {
  const lower = String(text || '').toLowerCase()
  if (lower.includes('call')) return PhoneCall
  if (lower.includes('mail') || lower.includes('email')) return Mail
  if (lower.includes('message') || lower.includes('whatsapp') || lower.includes('chat')) return MessageSquare
  return FileText
}

export default function FollowUpsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [leads, setLeads] = useState([])
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState(searchParams.get('leadId') || '')
  const [dateRange, setDateRange] = useState(emptyDateRange)

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  )
  const leadOptions = useMemo(() => [
    { value: '', label: 'Choose a lead' },
    ...leads.map((lead) => ({
      value: lead.id,
      label: lead.name || 'Untitled lead',
      meta: lead.company || lead.email || '',
    })),
  ], [leads])

  const loadLeads = async () => {
    const leadResponse = await leadsAPI.getAll({ page: 0, size: 200, sort: 'createdAt,desc' })
    setLeads(unwrapList(leadResponse))
    return unwrapList(leadResponse)
  }

  const loadTimeline = async (leadId) => {
    if (!leadId) {
      setActivities([])
      setTasks([])
      return
    }
    const [activityResponse, taskResponse] = await Promise.all([
      leadsAPI.getActivities(leadId),
      tasksAPI.getByLead(leadId),
    ])
    setActivities(unwrapList(activityResponse))
    setTasks(unwrapList(taskResponse))
  }

  const loadData = async (leadId = selectedLeadId) => {
    setLoading(true)
    try {
      const leadRows = await loadLeads()
      const nextLeadId = leadId || searchParams.get('leadId') || leadRows[0]?.id || ''
      setSelectedLeadId(nextLeadId)
      if (nextLeadId) {
        await loadTimeline(nextLeadId)
        setSearchParams(nextLeadId ? { leadId: nextLeadId } : {})
      }
    } catch (error) {
      toast.error(error?.message || 'Unable to load follow-ups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(searchParams.get('leadId') || '')
  }, [])

  useEffect(() => {
    if (!selectedLeadId) return
    loadTimeline(selectedLeadId).catch((error) => toast.error(error?.message || 'Unable to load timeline'))
  }, [selectedLeadId])

  const timeline = useMemo(() => {
    const events = []

    if (selectedLead) {
      events.push({
        id: `lead-created-${selectedLead.id}`,
        type: 'lead-created',
        title: 'Lead created',
        description: `${selectedLead.name} entered the pipeline.`,
        timestamp: selectedLead.createdAt,
      })
      if (selectedLead.followUpDate) {
        events.push({
          id: `follow-up-${selectedLead.id}`,
          type: 'follow-up',
          title: 'Follow-up due',
          description: `Next follow-up is scheduled for ${formatWhen(selectedLead.followUpDate)}.`,
          timestamp: selectedLead.followUpDate,
        })
      }
      if (selectedLead.lastContactedAt) {
        events.push({
          id: `last-contact-${selectedLead.id}`,
          type: 'contact',
          title: 'Last contacted',
          description: `Last contact logged at ${formatWhen(selectedLead.lastContactedAt)}.`,
          timestamp: selectedLead.lastContactedAt,
        })
      }
    }

    activities.forEach((activity, index) => {
      const title = activity.activityTitle || activity.activityLabel || 'Lead activity'
      const summary = activity.summary || 'Activity recorded'
      const Icon = iconForText(title)
      events.push({
        id: activity.id || `activity-${index}`,
        type: 'activity',
        title,
        description: summary,
        timestamp: activity.savedAt || activity.createdAt,
        icon: Icon,
      })
    })

    tasks.forEach((task, index) => {
      events.push({
        id: task.id || `task-${index}`,
        type: 'task',
        title: task.status === 'COMPLETED' ? 'Task completed' : 'Follow-up task',
        description: `${task.title}${task.completedAt ? ` · completed ${formatWhen(task.completedAt)}` : ''}`,
        timestamp: task.completedAt || task.dueDate || task.createdAt,
      })
    })

    return events
      .filter((event) => isWithinDateRange(event.timestamp, dateRange))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  }, [activities, dateRange, selectedLead, tasks])

  const openTaskEditor = () => {
    if (!selectedLeadId) {
      toast.error('Pick a lead first')
      return
    }
    setEditorOpen(true)
  }

  const createFollowUp = async (values) => {
    try {
      await tasksAPI.create({
        ...values,
        leadId: selectedLeadId,
        type: values.type || 'Follow-up',
        status: values.status || 'PENDING',
        priority: values.priority || 'MEDIUM',
      })
      toast.success('Follow-up task created')
      setEditorOpen(false)
      await loadTimeline(selectedLeadId)
    } catch (error) {
      toast.error(error?.message || 'Unable to create follow-up')
    }
  }

  const dateFilteredTasks = tasks.filter((task) => isWithinDateRange(task.dueDate || task.createdAt || task.updatedAt, dateRange))
  const dateFilteredActivities = activities.filter((activity) => isWithinDateRange(activity.savedAt || activity.createdAt || activity.updatedAt, dateRange))
  const overdueTasks = dateFilteredTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && String(task.status || '').toUpperCase() !== 'COMPLETED')
  const openTasks = dateFilteredTasks.filter((task) => String(task.status || '').toUpperCase() !== 'COMPLETED')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Follow-up Timeline"
          subtitle="See every task, call note, and lead activity in one chronological view."
          icon={<Clock3 className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => loadData(selectedLeadId)} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button type="button" onClick={openTaskEditor} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add follow-up
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Select lead</label>
            <PaginatedSelect
              value={selectedLeadId}
              onChange={(nextLeadId) => {
                setSelectedLeadId(nextLeadId)
                setSearchParams(nextLeadId ? { leadId: nextLeadId } : {})
              }}
              options={leadOptions}
              placeholder="Choose a lead"
              searchPlaceholder="Search leads..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Date</label>
            <DateRangeFilter value={dateRange} onChange={setDateRange} compact />
          </div>

          {selectedLead ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Owner</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedLead.assignedToName || 'Unassigned'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{String(selectedLead.status || 'NEW').replace('_', ' ')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Due Follow-up</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatWhen(selectedLead.followUpDate)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-800">
              Select a lead to see its history.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Open tasks</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{openTasks.length}</h3>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Overdue</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{overdueTasks.length}</h3>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Activities</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{dateFilteredActivities.length}</h3>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="glass-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Timeline<InfoHint text="Most recent updates appear first" /></p>
            </div>
            {selectedLeadId && selectedLead && (
              <Link to={`/leads?search=${encodeURIComponent(selectedLead.name || '')}`} className="btn-ghost h-9 px-3 text-xs">
                Open lead
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
              No activity yet for the selected lead.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((event) => {
                const Icon = event.icon || CircleDot
                const isTask = event.type === 'task'
                return (
                  <div key={event.id} className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
                    <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isTask ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300'}`}>
                      {isTask ? <CalendarCheck2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</h3>
                        {event.type === 'follow-up' && (
                          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Follow-up</span>
                        )}
                        {event.type === 'contact' && (
                          <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">Contact</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.description}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {formatWhen(event.timestamp)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Lead Summary<InfoHint text="Relevant follow-up context" /></p>
              </div>
              <UserRound className="h-5 w-5 text-brand-500" />
            </div>
            {selectedLead ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lead</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedLead.name}</p>
                  <p className="text-slate-500 dark:text-slate-400">{selectedLead.company || 'No company'} · {selectedLead.email}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last Contact</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatWhen(selectedLead.lastContactedAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lead Owner</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedLead.assignedToName || 'Unassigned'}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
                No lead selected.
              </div>
            )}
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">Quick Action<InfoHint text="Open a fresh follow-up task" /></p>
              </div>
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <button type="button" onClick={openTaskEditor} className="btn-primary mt-4 w-full">
              <Plus className="h-4 w-4" />
              Create follow-up
            </button>
          </div>
        </div>
      </div>

      <TaskEditorModal
        open={editorOpen}
        mode="create"
        leads={leads}
        employees={[]}
        defaultLeadId={selectedLeadId}
        onClose={() => setEditorOpen(false)}
        onSave={createFollowUp}
      />
    </div>
  )
}

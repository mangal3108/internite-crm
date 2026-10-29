import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Plus,
  RefreshCw,
  Search,
  User,
  CalendarRange,
  CheckCircle2,
  Pencil,
  Trash2,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import TaskCalendar from '../components/tasks/TaskCalendar'
import DueTodayWidget from '../components/tasks/DueTodayWidget'
import OverdueTasksWidget from '../components/tasks/OverdueTasksWidget'
import TaskEditorModal from '../components/tasks/TaskEditorModal'
import PaginatedSelect from '../components/ui/PaginatedSelect'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { leadsAPI, tasksAPI, teamAPI } from '../services/api'
import { emptyDateRange, isWithinDateRange } from '../utils/dateRangeFilter'

const EMPTY_FILTERS = {
  status: '',
  assignedTo: '',
  due: '',
  search: '',
  leadId: '',
}

const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const TASK_QUEUE_PAGE_SIZE = 6

const formatDateTime = (value) => {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No due date'
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDateKey = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateRange, setDateRange] = useState(emptyDateRange)
  const [selectedDate, setSelectedDate] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState('create')
  const [activeTask, setActiveTask] = useState(null)
  const [taskPage, setTaskPage] = useState(0)

  const dateFilteredTasks = useMemo(
    () => tasks.filter((task) => isWithinDateRange(task.dueDate || task.createdAt || task.updatedAt, dateRange)),
    [dateRange, tasks]
  )

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return []
    return dateFilteredTasks.filter((task) => formatDateKey(task?.dueDate) === selectedDate)
  }, [dateFilteredTasks, selectedDate])

  const stats = useMemo(() => {
    const today = new Date()
    const dueToday = dateFilteredTasks.filter((task) => {
      const date = new Date(task?.dueDate)
      return task?.dueDate && date.toDateString() === today.toDateString()
    }).length
    const overdue = dateFilteredTasks.filter((task) => {
      const date = new Date(task?.dueDate)
      return task?.dueDate && date < new Date() && String(task?.status ?? '').toUpperCase() !== 'COMPLETED'
    }).length
    const completed = dateFilteredTasks.filter((task) => String(task?.status ?? '').toUpperCase() === 'COMPLETED').length
    const assignees = new Set(dateFilteredTasks.map((task) => task?.assignedToId).filter(Boolean)).size
    return { dueToday, overdue, completed, assignees }
  }, [dateFilteredTasks])

  const loadData = async () => {
    setLoading(true)
    try {
      const [taskResponse, employeeResponse, leadResponse] = await Promise.all([
        tasksAPI.getAll({
          status: filters.status || undefined,
          assignedTo: filters.assignedTo || undefined,
          due: filters.due || undefined,
          search: filters.search || undefined,
          leadId: filters.leadId || undefined,
        }),
        teamAPI.getAll(),
        leadsAPI.getAll({ page: 0, size: 200, sort: 'createdAt,desc' }),
      ])

      setTasks(unwrapList(taskResponse))
      setEmployees(unwrapList(employeeResponse))
      setLeads(unwrapList(leadResponse))
    } catch (error) {
      toast.error(error?.message || 'Unable to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters.status, filters.assignedTo, filters.due, filters.search, filters.leadId])

  useEffect(() => {
    setTaskPage(0)
  }, [filters.status, filters.assignedTo, filters.due, filters.search, filters.leadId, dateRange])

  const openCreate = (prefill = {}) => {
    setActiveTask(prefill?.id ? prefill : null)
    setEditorMode(prefill?.id ? 'edit' : 'create')
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setActiveTask(null)
  }

  const saveTask = async (values) => {
    setSaving(true)
    try {
      const payload = {
        title: values.title,
        description: values.description || null,
        type: values.type || null,
        status: values.status || 'PENDING',
        priority: values.priority || 'MEDIUM',
        dueDate: values.dueDate || null,
        leadId: values.leadId || null,
        dealId: values.dealId || null,
        assignedToId: values.assignedToId || null,
      }

      if (editorMode === 'edit' && activeTask?.id) {
        await tasksAPI.update(activeTask.id, payload)
        toast.success('Task updated')
      } else {
        await tasksAPI.create(payload)
        toast.success('Task created')
      }
      closeEditor()
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to save task')
    } finally {
      setSaving(false)
    }
  }

  const markComplete = async (task) => {
    try {
      await tasksAPI.complete(task.id)
      toast.success(`Completed "${task.title}"`)
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to complete task')
    }
  }

  const removeTask = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    try {
      await tasksAPI.delete(task.id)
      toast.success('Task deleted')
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to delete task')
    }
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setDateRange(emptyDateRange())
  }

  const employeeOptions = useMemo(() => [
    { value: '', label: 'All employees' },
    ...employees.map((employee) => ({
      value: employee.id,
      label: employee.name,
      meta: employee.role || '',
    })),
  ], [employees])

  const leadOptions = useMemo(() => [
    { value: '', label: 'All leads' },
    ...leads.map((lead) => ({
      value: lead.id,
      label: lead.name || 'Untitled lead',
      meta: lead.company || lead.email || '',
    })),
  ], [leads])

  const taskTotalPages = Math.max(1, Math.ceil(dateFilteredTasks.length / TASK_QUEUE_PAGE_SIZE))
  const safeTaskPage = Math.min(taskPage, taskTotalPages - 1)
  const pagedTasks = dateFilteredTasks.slice(
    safeTaskPage * TASK_QUEUE_PAGE_SIZE,
    safeTaskPage * TASK_QUEUE_PAGE_SIZE + TASK_QUEUE_PAGE_SIZE
  )
  const taskStart = dateFilteredTasks.length ? safeTaskPage * TASK_QUEUE_PAGE_SIZE + 1 : 0
  const taskEnd = Math.min(dateFilteredTasks.length, (safeTaskPage + 1) * TASK_QUEUE_PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Tasks"
          subtitle="Track assignments, due dates, and task execution from one place."
          icon={<CalendarRange className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadData} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button type="button" onClick={() => openCreate()} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DueTodayWidget tasks={dateFilteredTasks} onOpenTask={openCreate} />
        <OverdueTasksWidget tasks={dateFilteredTasks} onOpenTask={openCreate} />
        <div className="kpi-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Completed</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.completed}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Closed tasks this cycle</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Active Assignees</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.assignees}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Employees with work assigned</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filters</span>
          </div>
          <button type="button" onClick={clearFilters} className="btn-ghost h-9 px-3 text-xs">
            Clear filters
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                className="input pl-9"
                placeholder="Search task title, description, type..."
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Status</label>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="input"
            >
              <option value="">All statuses</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>{status.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Due</label>
            <select
              value={filters.due}
              onChange={(event) => setFilters((current) => ({ ...current, due: event.target.value }))}
              className="input"
            >
              <option value="">All dates</option>
              <option value="today">Due today</option>
              <option value="tomorrow">Due tomorrow</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Assignee</label>
            <PaginatedSelect
              value={filters.assignedTo}
              onChange={(nextValue) => setFilters((current) => ({ ...current, assignedTo: nextValue }))}
              options={employeeOptions}
              placeholder="All employees"
              searchPlaceholder="Search employees..."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Lead</label>
            <PaginatedSelect
              value={filters.leadId}
              onChange={(nextValue) => setFilters((current) => ({ ...current, leadId: nextValue }))}
              options={leadOptions}
              placeholder="All leads"
              searchPlaceholder="Search leads..."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Date</label>
            <DateRangeFilter value={dateRange} onChange={setDateRange} compact />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/70">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Task Queue</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{dateFilteredTasks.length} task{dateFilteredTasks.length === 1 ? '' : 's'} matched</p>
              </div>
              <Link to="/task-followup" className="btn-secondary h-9 px-3 text-xs">
                Follow-up timeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-3 p-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : dateFilteredTasks.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No tasks match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedTasks.map((task) => {
                  const lead = leads.find((item) => item.id === task.leadId)
                  const assignee = employees.find((item) => item.id === task.assignedToId)
                  const status = String(task.status || 'PENDING').replace('_', ' ')
                  const isCompleted = String(task.status || '').toUpperCase() === 'COMPLETED'
                  return (
                    <div key={task.id} className="p-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
                            <span className={`badge ${isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'}`}>
                              {status}
                            </span>
                            <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {task.priority || 'MEDIUM'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                            {task.description || 'No description added'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                              <User className="h-3.5 w-3.5" />
                              {assignee?.name || 'Unassigned'}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                              <CalendarRange className="h-3.5 w-3.5" />
                              {formatDateTime(task.dueDate)}
                            </span>
                            {lead ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                <span className="truncate">{lead.name}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {task.leadId && (
                            <Link to="/task-followup" className="btn-secondary h-9 px-3 text-xs">
                              <ArrowRight className="h-4 w-4" />
                              Timeline
                            </Link>
                          )}
                          {!isCompleted && (
                            <button type="button" onClick={() => markComplete(task)} className="btn-secondary h-9 px-3 text-xs">
                              <CheckCircle2 className="h-4 w-4" />
                              Complete
                            </button>
                          )}
                          <button type="button" onClick={() => {
                            setActiveTask(task)
                            setEditorMode('edit')
                            setEditorOpen(true)
                          }} className="btn-ghost h-9 px-3 text-xs">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button type="button" onClick={() => removeTask(task)} className="btn-ghost h-9 px-3 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!loading && dateFilteredTasks.length > TASK_QUEUE_PAGE_SIZE && (
              <div className="flex flex-col gap-2 border-t border-slate-200/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>Showing {taskStart}-{taskEnd} of {dateFilteredTasks.length} tasks</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskPage(Math.max(0, safeTaskPage - 1))}
                    disabled={safeTaskPage === 0}
                    className="btn-secondary h-8 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  <span className="min-w-12 text-center">{safeTaskPage + 1} / {taskTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setTaskPage(Math.min(taskTotalPages - 1, safeTaskPage + 1))}
                    disabled={safeTaskPage >= taskTotalPages - 1}
                    className="btn-secondary h-8 px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <TaskCalendar tasks={dateFilteredTasks} selectedDate={selectedDate} onDateSelect={setSelectedDate} />

          <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDate ? `Tasks on ${new Date(selectedDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}` : 'Selected day'}
                </p>
              </div>
              {selectedDate && (
                <button type="button" onClick={() => setSelectedDate(null)} className="btn-ghost h-8 px-3 text-xs">
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-2">
              {selectedDateTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
                  No tasks due on the selected date.
                </div>
              ) : (
                selectedDateTasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openCreate(task)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-800/70 dark:bg-slate-950/40 dark:hover:bg-slate-900/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{task.priority || 'MEDIUM'} · {formatDateTime(task.dueDate)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        <TaskEditorModal
          open={editorOpen}
          mode={editorMode}
          task={activeTask}
          leads={leads}
          employees={employees}
          onClose={closeEditor}
          onSave={saveTask}
        />
      </AnimatePresence>
      {saving ? <div className="sr-only">Saving</div> : null}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, RefreshCw, Trash2, ExternalLink, Filter, Mail, User, Kanban, Receipt, AlertCircle, Circle } from 'lucide-react'
import SarathiMark from '../components/ui/SarathiMark'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import DateRangeFilter from '../components/ui/DateRangeFilter'
import { useNotificationStore, formatIndianTime } from '../store/notificationStore'
import { emptyDateRange, isWithinDateRange } from '../utils/dateRangeFilter'

const iconMap = {
  lead: { icon: User, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-950/40' },
  deal: { icon: Kanban, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  task: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  invoice: { icon: Receipt, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-950/40' },
  ai: { icon: SarathiMark, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-950/40' },
  communication: { icon: Mail, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-950/40' },
  system: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'lead', label: 'Leads' },
  { key: 'deal', label: 'Deals' },
  { key: 'task', label: 'Tasks' },
  { key: 'invoice', label: 'Invoices' },
]

export default function NotificationCenterPage() {
  const navigate = useNavigate()
  const { notifications, unreadCount, fetchNotifications, markAllRead, markRead, deleteNotification, loading } = useNotificationStore()
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState(emptyDateRange)

  useEffect(() => {
    fetchNotifications().catch((error) => toast.error(error?.message || 'Unable to load notifications'))
  }, [fetchNotifications])

  const filtered = useMemo(() => {
    let rows = notifications
    if (filter === 'unread') rows = rows.filter((notification) => !notification.read)
    else if (filter === 'read') rows = rows.filter((notification) => notification.read)
    else if (filter !== 'all') rows = rows.filter((notification) => notification.type === filter)
    return rows.filter((notification) => isWithinDateRange(notification.createdAt, dateRange))
  }, [dateRange, filter, notifications])

  const counts = useMemo(() => ({
    total: notifications.length,
    unread: unreadCount,
    read: notifications.length - unreadCount,
  }), [notifications.length, unreadCount])

  const openNotification = async (notification) => {
    await markRead(notification.id)
    if (notification.actionUrl) {
      navigate(notification.actionUrl)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Notification Center"
          subtitle="Monitor system events, real-time alerts, and unread activity across the CRM."
          icon={<Bell className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fetchNotifications()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button type="button" onClick={markAllRead} className="btn-primary">
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{counts.total}</h3>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Unread</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{counts.unread}</h3>
        </div>
        <div className="kpi-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Read</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{counts.read}</h3>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filter</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-accent-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} compact />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>No notifications found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((notification) => {
              const config = iconMap[notification.type] ?? iconMap.system
              const Icon = config.icon
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                    notification.read ? 'border-slate-200/70 dark:border-slate-800/70' : 'border-brand-200/70 bg-brand-50/30 dark:border-brand-900/40 dark:bg-brand-950/20'
                  }`}
                >
                  <button type="button" onClick={() => openNotification(notification)} className="flex flex-1 items-start gap-3 text-left">
                    <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm font-semibold ${notification.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{notification.message}</p>
                        </div>
                        {!notification.read && <Circle className="mt-1 h-3.5 w-3.5 fill-brand-500 text-brand-500" />}
                      </div>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {formatIndianTime(notification.createdAt)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <button type="button" onClick={() => markRead(notification.id)} className="btn-ghost h-9 px-2 text-xs">
                        <CheckCheck className="h-4 w-4" />
                        Read
                      </button>
                    )}
                    <button type="button" onClick={() => deleteNotification(notification.id)} className="btn-ghost h-9 px-2 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {notification.actionUrl && (
                      <button type="button" onClick={() => navigate(notification.actionUrl)} className="btn-ghost h-9 px-2 text-xs">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

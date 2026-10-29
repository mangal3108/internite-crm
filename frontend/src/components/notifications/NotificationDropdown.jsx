import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, ExternalLink, Mail, Trash2, User, Kanban, Receipt, AlertCircle } from 'lucide-react'
import SarathiMark from '../ui/SarathiMark'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore, formatIndianTime } from '../../store/notificationStore'

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
  { key: 'task', label: 'Tasks' },
  { key: 'lead', label: 'Leads' },
  { key: 'deal', label: 'Deals' },
]

export default function NotificationDropdown({ onClose }) {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAllRead, markRead, deleteNotification } = useNotificationStore()
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications
    if (filter === 'unread') return notifications.filter((n) => !n.read)
    return notifications.filter((n) => n.type === filter)
  }, [filter, notifications])

  const openNotification = async (notification) => {
    await markRead(notification.id)
    if (notification.actionUrl) {
      navigate(notification.actionUrl)
      onClose?.()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="fixed right-2 top-[4.25rem] z-[9999] w-[min(92vw,28rem)] overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl dark:border-slate-800/50 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/60">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="btn-secondary h-9 px-3 text-xs">
              <CheckCheck className="h-4 w-4" />
              Mark all
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/60">
        {FILTERS.map((item) => {
          const isActive = filter === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-400 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="max-h-[28rem] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>No notifications yet</p>
          </div>
        ) : (
          filtered.map((notification) => {
            const config = iconMap[notification.type] ?? iconMap.system
            const Icon = config.icon
            return (
              <div
                key={notification.id}
                className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60 ${
                  notification.read ? '' : 'bg-brand-50/40 dark:bg-brand-950/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="flex flex-1 items-start gap-3 text-left"
                >
                  <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="relative mt-1 flex-shrink-0">
                          <span className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-brand-400 animate-ping opacity-75" />
                          <span className="relative h-2.5 w-2.5 rounded-full bg-brand-500 block" />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {formatIndianTime(notification.createdAt)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotification(notification.id)}
                  className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-slate-800"
                  aria-label="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200/70 px-4 py-3 dark:border-slate-800/60">
        <button type="button" onClick={onClose} className="btn-ghost h-9 px-3 text-xs">
          Close
        </button>
        <button type="button" onClick={() => navigate('/notifications')} className="btn-secondary h-9 px-3 text-xs">
          Open center
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

import { Bell } from 'lucide-react'

export default function NotificationBell({ unreadCount = 0, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative btn-ghost h-10 w-10 rounded-full p-0 ${active ? 'bg-slate-950 text-accent-400 hover:bg-slate-900 dark:bg-accent-400 dark:text-slate-950' : 'bg-white dark:bg-white/5'}`}
      aria-label="Notifications"
      aria-expanded={active}
    >
      <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'animate-[wiggle_0.5s_ease-in-out]' : ''}`} />
      {unreadCount > 0 && (
        <>
          {/* Pulsing ring behind badge */}
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-rose-500/30 animate-ping" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-lg ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </>
      )}
    </button>
  )
}

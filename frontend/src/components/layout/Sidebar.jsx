import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard, Users, Kanban, UserCircle, MessageSquare, MessageCircle, Zap, BarChart3, Shield, Settings, X, ListTodo, ShieldCheck, Activity, Building2, BadgeDollarSign, Lock, FileText, Menu, PhoneCall
} from 'lucide-react'
import SarathiMark from '../ui/SarathiMark'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { PERMISSIONS, hasPermission } from '../../utils/permissions'
import { prefetchPage } from '../../App'
import Tooltip from '../ui/Tooltip'
import BrandLogo from '../brand/BrandLogo'

const NAV_ITEMS = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  { label: 'Leads',          icon: Users,           path: '/leads', permission: PERMISSIONS.LEADS_READ },
  { label: 'Pipeline',       icon: Kanban,          path: '/pipeline', permission: PERMISSIONS.LEADS_READ },
  { label: 'Tasks',          icon: ListTodo,        path: '/task-followup', permission: PERMISSIONS.TASKS_READ },
  { label: 'Customers',      icon: UserCircle,      path: '/customers', permission: PERMISSIONS.CUSTOMERS_READ },
  { label: 'Phone Dialer',   icon: PhoneCall,       path: '/dialer', permission: PERMISSIONS.COMMUNICATIONS_READ },
  { label: 'WhatsApp',       icon: MessageCircle,   path: '/whatsapp', permission: PERMISSIONS.COMMUNICATIONS_READ },
  { label: 'Messages',       icon: MessageSquare,   path: '/communication', permission: PERMISSIONS.COMMUNICATIONS_READ },
  { label: 'Sarathi',        icon: SarathiMark,        path: '/ai-engine', permission: PERMISSIONS.AI_USE },
  { label: 'Automation',     icon: Zap,             path: '/automation', permission: PERMISSIONS.AUTOMATION_READ },
  { label: 'Analytics',      icon: BarChart3,       path: '/analytics', permission: PERMISSIONS.REPORTS_READ },
  { label: 'Lead Report',    icon: FileText,        path: '/lead-activity-report', permission: PERMISSIONS.REPORTS_READ },
  { label: 'Team',           icon: Shield,          path: '/team', permission: PERMISSIONS.TEAM_READ },
  { label: 'Settings',       icon: Settings,        path: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
]

// Platform Admin sidebar tabs — shown instead of company nav items
const PLATFORM_ADMIN_TABS = [
  { label: 'Overview',       icon: Activity,        tabKey: 'overview' },
  { label: 'Companies',      icon: Building2,       tabKey: 'companies' },
  { label: 'Users',          icon: Users,           tabKey: 'users' },
  { label: 'Subscriptions',  icon: BadgeDollarSign, tabKey: 'subscriptions' },
  { label: 'Security',       icon: Lock,            tabKey: 'security' },
  { label: 'Feature Flags',  icon: Zap,             tabKey: 'features' },
  { label: 'Audit Logs',     icon: FileText,        tabKey: 'audit' },
]

const AVATAR_STYLE_CLASS = {
  brand: 'from-brand-500 to-accent-500',
  ocean: 'from-cyan-500 to-blue-500',
  sunset: 'from-orange-500 to-rose-500',
  forest: 'from-emerald-500 to-teal-500',
  steel: 'from-slate-500 to-slate-700',
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const avatarStyle = AVATAR_STYLE_CLASS[user?.avatarStyle] ?? AVATAR_STYLE_CLASS.brand
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN'
  const rawTab = searchParams.get('tab') || 'overview'
  const activeTab = PLATFORM_ADMIN_TABS.some(t => t.tabKey === rawTab) ? rawTab : 'overview'
  const expanded = !collapsed

  // Badge counts for sidebar nav items
  const navBadges = {
    '/communication': unreadCount,
  }

  // Platform Admin only sees Platform Admin tabs — no company nav items at all
  const visibleNavItems = isPlatformAdmin
    ? []
    : NAV_ITEMS.filter((item) => !item.platformAdminOnly && hasPermission(user, item.permission))

  useEffect(() => {
    setAvatarBroken(false)
  }, [user?.avatarUrl])

  const SidebarContent = ({ isMobile = false }) => {
    const showLabel = isMobile || expanded
    const navItemModeClass = showLabel ? 'edu-nav-item--expanded' : 'edu-nav-item--collapsed'
    const iconWrapClass = showLabel ? 'edu-nav-icon edu-nav-icon--expanded' : 'edu-nav-icon edu-nav-icon--collapsed'
    const iconClass = showLabel ? 'h-[18px] w-[18px]' : 'h-5 w-5'

    return (
      <div className="flex flex-col h-full">
        {!isMobile && (
          <div className={`flex h-[68px] flex-shrink-0 items-center px-2.5 ${showLabel ? 'justify-between gap-2 pl-4' : 'justify-center'}`}>
            {showLabel ? (
              <BrandLogo variant="wordmark" size="sm" tone="dark" className="flex-1" />
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-accent-400 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <BrandLogo variant="icon" size="md" className="h-full w-full p-2" />
              </button>
            )}
            {showLabel && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className={`edu-sidebar-scroll flex-1 flex flex-col px-2 pt-1 pb-1 gap-1 overflow-y-auto ${showLabel ? '' : 'items-center'}`}>
          {isPlatformAdmin && (
            <>
              {showLabel && (
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Platform Admin</span>
                </div>
              )}
              {PLATFORM_ADMIN_TABS.map(({ label, icon: Icon, tabKey }) => {
                const isActive = location.pathname === '/admin/saas' && activeTab === tabKey
                return (
                  <Link
                    key={tabKey}
                    to={`/admin/saas?tab=${tabKey}`}
                    onClick={() => setMobileOpen(false)}
                    className={`edu-nav-item ${isActive ? 'active' : ''} ${navItemModeClass}`}
                  >
                    <span className={iconWrapClass}>
                      <Icon className={iconClass} />
                    </span>
                    {showLabel && <span className="text-[13px] font-medium truncate">{label}</span>}
                    {!showLabel && <span className="edu-nav-label--collapsed">{label}</span>}
                  </Link>
                )
              })}
              <div className="my-1.5 border-t border-white/10" />
            </>
          )}
          {visibleNavItems.map(({ label, icon: Icon, path }) => {
            const badgeCount = navBadges[path] || 0
            const navLink = (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => prefetchPage(path)}
                className={({ isActive }) =>
                  `edu-nav-item ${isActive ? 'active' : ''} ${navItemModeClass} relative`
                }
              >
                <div className={iconWrapClass}>
                  <Icon className={iconClass} />
                  {badgeCount > 0 && !showLabel && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#f26b6b] text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-black">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                {showLabel && <span className="text-[13px] font-medium truncate">{label}</span>}
                {!showLabel && <span className="edu-nav-label--collapsed">{label}</span>}
                {badgeCount > 0 && showLabel && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#f26b6b] text-white text-[9px] font-bold flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </NavLink>
            )
            // Tooltip only when collapsed (icon-only)
            return showLabel ? navLink : (
              <Tooltip key={path} title={label} placement="right" delay={200} block>
                {navLink}
              </Tooltip>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-2.5 pb-3">
          <div className={`flex items-center ${showLabel ? 'gap-3 rounded-full bg-white/5 p-1.5 pr-3' : 'justify-center'}`}>
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarStyle} flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white/10`}>
                {user?.avatarUrl && !avatarBroken ? (
                  <img
                    src={user.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  user?.name?.charAt(0) ?? 'U'
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-accent-400 border-2 border-black" />
            </div>
            {showLabel && (
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
                {user?.tenantName && (
                  <p className="text-[10px] text-accent-400 truncate leading-tight">{user.tenantName}</p>
                )}
                <p className="text-[10px] text-slate-400 truncate">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar — collapsible */}
      <aside
        className="hidden md:flex flex-col edu-sidebar flex-shrink-0 relative z-30 my-2 ml-2 rounded-[28px] transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 72 : 212, height: 'calc(100vh - 16px)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay — always expanded with labels */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          />
          <aside className="fixed left-2 top-2 bottom-2 w-60 edu-sidebar rounded-[28px] overflow-hidden z-50 md:hidden">
            <div className="flex h-16 items-center px-4 pr-12">
              <BrandLogo variant="wordmark" size="md" tone="dark" className="w-full" />
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <SidebarContent isMobile />
          </aside>
        </>
      )}
    </>
  )
}

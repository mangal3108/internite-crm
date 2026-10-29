import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Home, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const ROUTE_LABELS = {
  '/dashboard':      'Dashboard',
  '/leads':          'Leads',
  '/pipeline':       'Pipeline',
  '/task-followup':  'Tasks',
  '/customers':      'Customers',
  '/communication':  'Messages',
  '/ai-engine':      'Sarathi',
  '/automation':     'Automation',
  '/analytics':      'Analytics',
  '/lead-activity-report': 'Lead Activity Report',
  '/team':           'Team',
  '/settings':       'Settings',
  '/admin/saas':     'Platform Admin',
}

const SETTINGS_TAB_LABELS = {
  general:       'General',
  profile:       'Profile',
  notifications: 'Notifications',
  alerts:        'Alerts',
  tickets:       'Tickets',
  security:      'Security',
  appearance:    'Appearance',
  integrations:  'Integrations',
  subscription:  'Subscription',
  billing:       'Billing',
}

const SAAS_TAB_LABELS = {
  overview:      'Overview',
  companies:     'Companies',
  users:         'Users',
  subscriptions: 'Subscriptions',
  security:      'Security',
  features:      'Feature Flags',
  audit:         'Audit Logs',
}

export default function Breadcrumb() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const path = location.pathname

  // Build breadcrumb segments
  const crumbs = []

  // Home
  crumbs.push({
    label: null,
    icon: true,
    to: user?.role === 'PLATFORM_ADMIN' ? '/admin/saas' : '/dashboard',
  })

  // Role segment
  const roleName = user?.role === 'PLATFORM_ADMIN'
    ? 'Platform Admin'
    : user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
      ? (user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin')
      : user?.role
        ? user.role.charAt(0) + user.role.slice(1).toLowerCase().replace(/_/g, ' ')
        : null

  if (roleName) {
    crumbs.push({ label: roleName })
  }

  // Page segment
  const pageLabel = ROUTE_LABELS[path]
  if (pageLabel) {
    crumbs.push({ label: pageLabel, to: path, active: true })
  }

  // Sub-tab for settings
  if (path === '/settings') {
    const tab = searchParams.get('tab')
    const tabLabel = tab && SETTINGS_TAB_LABELS[tab]
    if (tabLabel && tab !== 'general') {
      // Make Settings clickable, sub-tab is active
      const settingsCrumb = crumbs[crumbs.length - 1]
      settingsCrumb.active = false
      settingsCrumb.to = '/settings'
      crumbs.push({ label: tabLabel, active: true })
    }
  }

  // Sub-tab for SaaS admin
  if (path === '/admin/saas') {
    const tab = searchParams.get('tab')
    const tabLabel = tab && SAAS_TAB_LABELS[tab]
    if (tabLabel && tab !== 'overview') {
      const adminCrumb = crumbs[crumbs.length - 1]
      adminCrumb.active = false
      adminCrumb.to = '/admin/saas'
      crumbs.push({ label: tabLabel, active: true })
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const isActive = crumb.active

        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
            )}
            {crumb.icon ? (
              <Link
                to={crumb.to}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-brand-50 dark:hover:bg-brand-950/30 text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                aria-label="Home"
              >
                <Home className="w-3.5 h-3.5" />
              </Link>
            ) : isActive || isLast ? (
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {crumb.label}
              </span>
            ) : crumb.to ? (
              <Link
                to={crumb.to}
                className="text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors font-medium"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-medium">
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

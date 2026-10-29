import { useState, useEffect, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Settings, Bell, Shield, Palette, Link, CreditCard, Save, ShieldCheck, ShieldOff, X, Smartphone, AlertTriangle, Globe, Info, Clock, Activity, LifeBuoy, User, Link2, RefreshCw
} from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import ScreenModalPortal from '../ui/ScreenModalPortal'
import InfoHint from '../ui/InfoHint'

const LazyAlerts       = lazy(() => import('../../pages/NotificationCenterPage'))
const LazyTickets      = lazy(() => import('../../pages/TicketsPage'))
const LazySubscription = lazy(() => import('../../pages/SubscriptionPage'))
const LazyProfile      = lazy(() => import('../../pages/ProfilePage'))
const LazyIntegrations = lazy(() => import('../../pages/IntegrationsPage'))

const TABS = [
  { key: 'general',       label: 'General',       icon: Settings },
  { key: 'profile',       label: 'Profile',       icon: User },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'alerts',        label: 'Alerts',        icon: Bell },
  { key: 'tickets',       label: 'Tickets',       icon: LifeBuoy },
  { key: 'security',      label: 'Security',      icon: Shield },
  { key: 'appearance',    label: 'Appearance',    icon: Palette },
  { key: 'integrations',  label: 'Integrations',  icon: Link2 },
  { key: 'subscription',  label: 'Subscription',  icon: CreditCard },
  { key: 'billing',       label: 'Billing',       icon: CreditCard },
]
const VALID_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

const INTEGRATIONS = [
  { name: 'Facebook / Instagram', status: 'connected', icon: '📘', color: 'bg-blue-50 dark:bg-blue-950/20' },
  { name: 'LinkedIn',             status: 'connected', icon: '💼', color: 'bg-brand-50 dark:bg-brand-950/20' },
  { name: 'WhatsApp Business',    status: 'connected', icon: '💬', color: 'bg-emerald-50 dark:bg-emerald-950/20' },
  { name: 'Gmail / Google',       status: 'connected', icon: '📧', color: 'bg-red-50 dark:bg-red-950/20' },
  { name: 'Google Calendar',      status: 'pending',   icon: '📅', color: 'bg-orange-50 dark:bg-orange-950/20' },
  { name: 'Mistral AI',            status: 'connected', icon: '🤖', color: 'bg-slate-50 dark:bg-slate-800/50' },
  { name: 'AWS S3',               status: 'connected', icon: '☁️', color: 'bg-amber-50 dark:bg-amber-950/20' },
  { name: 'Tally XML',            status: 'pending',   icon: '📊', color: 'bg-brand-50 dark:bg-brand-950/20' },
]

const SETTINGS_STORAGE_KEY = 'internite-settings'
const DEFAULT_GENERAL_SETTINGS = [
  { key: 'companyName', label: 'Company Name', value: 'Internite Corporation' },
  { key: 'timezone', label: 'Timezone', value: 'Asia/Kolkata (IST)' },
  { key: 'currency', label: 'Currency', value: 'INR (₹)' },
  { key: 'language', label: 'Language', value: 'English' },
  { key: 'dateFormat', label: 'Date Format', value: 'DD/MM/YYYY' },
  { key: 'fiscalYear', label: 'Fiscal Year', value: 'April – March' },
]
const DEFAULT_NOTIFICATION_PREFS = [
  { label: 'New Lead', channels: ['Email', 'In-App', 'WhatsApp'] },
  { label: 'Deal Update', channels: ['Email', 'In-App'] },
  { label: 'Follow-up Reminder', channels: ['Email', 'In-App', 'Push'] },
  { label: 'Invoice Overdue', channels: ['Email', 'WhatsApp'] },
  { label: 'Sarathi Signals', channels: ['In-App'] },
]

function readStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function mergeIntegrationState(base, saved) {
  if (!Array.isArray(saved)) return base
  const byName = new Map(saved.map((item) => [item?.name, item]))
  return base.map((intg) => {
    const next = byName.get(intg.name)
    return next ? { ...intg, status: next.status ?? intg.status } : intg
  })
}

/* ── 2FA Setup Modal ─────────────────────────────────────────────── */
function TwoFactorModal({ onClose, onConfirm }) {
  return (
    <ScreenModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Two-factor authentication">
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        exit={{ opacity:0, scale:0.95 }} transition={{ duration:0.2 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <span className="font-bold text-slate-800 dark:text-slate-100">Two-Factor Authentication</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              MFA is managed by your identity provider.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Close</button>
            <button onClick={onConfirm} className="btn-primary flex-1 justify-center">Acknowledge</button>
          </div>
        </div>
      </motion.div>
      </div>
    </ScreenModalPortal>
  )
}

/* ── Disable 2FA Confirm ─────────────────────────────────────────── */
/* ── Session Timeout Panel ───────────────────────────────────────── */
const TIMEOUT_OPTIONS = [
  { label: '5 minutes',  value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour',     value: 60 },
  { label: '2 hours',    value: 120 },
  { label: 'Never',      value: 0 },
]

function SessionTimeoutPanel() {
  const [selected, setSelected] = useState(30)
  const [saved, setSaved]       = useState(30)

  const save = () => {
    setSaved(selected)
    toast.success(`Session timeout set to ${selected === 0 ? 'never' : selected + ' min'}.`)
  }

  return (
    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
      exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }} className="mt-4 space-y-3 overflow-hidden">

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <InfoHint text="This workspace stores the selection locally for now. Connect a policy service later if you need enforced session expiry." /> Saved on this device
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TIMEOUT_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setSelected(opt.value)}
            className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all
              ${selected === opt.value
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
            <Clock className="w-3 h-3 inline mr-1 opacity-70" />
            {opt.label}
          </button>
        ))}
      </div>

      {selected === 0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/40">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Sessions will never expire. Not recommended for shared devices.
          </p>
        </motion.div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-400">
          Currently active: <span className="font-semibold text-slate-600 dark:text-slate-300">
            {saved === 0 ? 'Never' : `${saved} min`}
          </span>
        </span>
        <button onClick={save} disabled={selected === saved}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-400 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold transition-colors">
          <Save className="w-3 h-3" /> Apply
        </button>
      </div>
    </motion.div>
  )
}

function AuditLogsPanel() {
  return (
    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
      exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }} className="mt-4 space-y-3 overflow-hidden">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <InfoHint text="Audit logging is represented as a saved workspace preference in this build. Hook it to your backend audit service before treating it as enforced policy." /> Saved as a preference
      </p>
    </motion.div>
  )
}

/* ── IP Whitelist Panel ───────────────────────────────────────────── */
function IPWhitelistPanel() {
  return (
    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
      exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }} className="mt-3 space-y-4 overflow-hidden">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <InfoHint text="IP allowlisting is shown as a workspace preference in this build. Connect it to server-side enforcement before relying on it for security control." /> Saved as a preference
      </p>
    </motion.div>
  )
}

/* ── Manage Plan Modal ───────────────────────────────────────────── */
const PLANS = [
  { name: 'Starter',    price: '₹799',  period: '/month', users: 1,  features: ['Up to 500 leads','Basic pipeline','Email support'] },
  { name: 'Growth',     price: '₹1,499',period: '/month', users: 3,  features: ['Up to 5,000 leads','Sarathi assistant (basic)','WhatsApp integration','Priority support'] },
  { name: 'Enterprise', price: '₹2,499',period: '/month', users: 5,  features: ['Unlimited leads & deals','Sarathi assistant (Mistral)','All integrations','Dedicated support','Custom reports','White-labeling'], current: true },
  { name: 'Custom',     price: 'Contact',period: '',      users: 999, features: ['Unlimited everything','Custom SLA','On-premise option','API access','Custom training'] },
]

function ManagePlanModal({ onClose, currentPlan = 'Enterprise', onSelectPlan }) {
  const [selected, setSelected] = useState(currentPlan)

  const handleUpgrade = () => {
    onSelectPlan?.(selected)
    toast.success(selected === 'Custom' ? 'Sales will follow up with a custom plan proposal.' : `${selected} plan saved for this workspace preview.`)
    onClose()
  }

  return (
    <ScreenModalPortal>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Manage plan"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        className="glass-card w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Manage Plan</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <button key={plan.name} onClick={() => setSelected(plan.name)}
              className={`text-left rounded-xl border-2 p-4 transition-all
                ${selected === plan.name
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">{plan.name}</p>
                {plan.current && <span className="text-[10px] bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400 font-semibold px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400">{plan.price}<span className="text-xs font-medium text-slate-400">{plan.period}</span></p>
              <p className="text-xs text-slate-500 mb-2">{plan.users < 999 ? `${plan.users} users included` : 'Unlimited users'}</p>
              <ul className="space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-3 h-3 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleUpgrade} className="btn-primary flex-1 text-sm">
            {selected === 'Custom' ? 'Contact Sales' : selected === 'Enterprise' ? 'Keep Current Plan' : `Switch to ${selected}`}
          </button>
        </div>
      </motion.div>
      </motion.div>
    </ScreenModalPortal>
  )
}

/* ── Theme Picker Config ─────────────────────────────────────────── */
const THEME_OPTIONS = [
  {
    id: 'light',
    name: 'Light',
    emoji: '☀️',
    desc: 'Soft grey canvas, lime accents',
    preview: {
      bg: '#e9e9e7',
      card: '#ffffff',
      cardShadow: '0 6px 16px -8px rgba(11,11,12,0.2)',
      cardBorder: 'none',
      cardRadius: '14px',
      accent: '#d4f06b',
      btnRadius: '9999px',
      text: '#0b0b0c',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    emoji: '🌙',
    desc: 'Ink night mode, lime accents',
    preview: {
      bg: '#050506',
      card: '#141416',
      cardShadow: '0 8px 20px rgba(0,0,0,0.5)',
      cardBorder: '1px solid rgba(255,255,255,0.06)',
      cardRadius: '14px',
      accent: '#d4f06b',
      btnRadius: '9999px',
      text: '#f6f6f4',
    },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    emoji: '💼',
    desc: 'Premium SaaS default',
    preview: {
      bg: '#e9e9e7',
      card: '#ffffff',
      cardShadow: '0 6px 16px -8px rgba(11,11,12,0.2)',
      cardBorder: 'none',
      cardRadius: '14px',
      accent: '#a99bf0',
      btnRadius: '9999px',
      text: '#0b0b0c',
    },
  },
]

/* ── Main Settings Page ──────────────────────────────────────────── */
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab]               = useState(() => {
    const tabFromUrl = searchParams.get('tab')
    return VALID_TAB_KEYS.has(tabFromUrl) ? tabFromUrl : 'general'
  })
  const { theme, setTheme }         = useThemeStore()
  const storedSettings = readStoredSettings()
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(() => storedSettings.sessionTimeout ?? true)
  const [auditLogs, setAuditLogs] = useState(() => storedSettings.auditLogs ?? true)
  const [ipWhitelist, setIpWhitelist] = useState(() => storedSettings.ipWhitelist ?? false)
  const [integrations, setIntegrations] = useState(() => mergeIntegrationState(INTEGRATIONS, storedSettings.integrations))
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [generalSettings, setGeneralSettings] = useState(() => {
    const saved = storedSettings.generalSettings
    if (!Array.isArray(saved)) return DEFAULT_GENERAL_SETTINGS
    const savedMap = new Map(saved.map((item) => [item.key, item]))
    return DEFAULT_GENERAL_SETTINGS.map((item) => ({ ...item, value: savedMap.get(item.key)?.value ?? item.value }))
  })
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    const saved = storedSettings.notificationPrefs
    if (!Array.isArray(saved)) return DEFAULT_NOTIFICATION_PREFS
    const savedMap = new Map(saved.map((item) => [item.label, item]))
    return DEFAULT_NOTIFICATION_PREFS.map((item) => ({
      ...item,
      channels: Array.isArray(savedMap.get(item.label)?.channels) ? savedMap.get(item.label).channels : item.channels,
    }))
  })
  const [activePlan, setActivePlan] = useState(() => storedSettings.activePlan ?? 'Enterprise')
  const twoFAEnabled = false

  const saveWorkspaceSettings = (nextState = {}) => {
    const snapshot = {
      generalSettings,
      notificationPrefs,
      sessionTimeout,
      auditLogs,
      ipWhitelist,
      integrations,
      activePlan,
      ...nextState,
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Ignore local persistence errors and still keep the UI responsive.
    }
    return snapshot
  }

  const handle2FAToggle = () => setShowSetupModal(true)
  const save = () => {
    saveWorkspaceSettings()
    toast.success('Settings saved locally')
  }

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (VALID_TAB_KEYS.has(tabFromUrl) && tabFromUrl !== tab) {
      setTab(tabFromUrl)
    }
  }, [searchParams, tab])

  const handleTabChange = (nextTab) => {
    setTab(nextTab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', nextTab)
      return next
    }, { replace: true })
  }

  const toggleIntegration = (name) => {
    setIntegrations((prev) =>
      prev.map((intg) => {
        if (intg.name !== name) return intg
        const next = intg.status === 'connected' ? 'pending' : 'connected'
        toast.success(`${name} ${next === 'connected' ? 'connected' : 'set to pending'}`)
        return { ...intg, status: next }
      })
    )
  }

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          generalSettings,
          notificationPrefs,
          sessionTimeout,
          auditLogs,
          ipWhitelist,
          integrations,
          activePlan,
        })
      )
    } catch {
      // Ignore local persistence errors and keep the UI responsive.
    }
  }, [generalSettings, notificationPrefs, sessionTimeout, auditLogs, ipWhitelist, integrations, activePlan])

  useEffect(() => {
    const themeOptions = new Set(['light', 'dark', 'corporate'])
    if (!themeOptions.has(theme)) setTheme('corporate')
  }, [theme, setTheme])

  const activeTheme = THEME_OPTIONS.find((option) => option.id === theme) ?? THEME_OPTIONS[2]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="w-full lg:w-48 lg:flex-shrink-0">
          <nav className="flex lg:block gap-1 overflow-x-auto custom-scrollbar">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => handleTabChange(key)} className={`nav-item whitespace-nowrap lg:w-full ${tab === key ? 'active' : ''}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 glass-card p-4 sm:p-6">

          {tab === 'general' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">General Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {generalSettings.map(({ key, label, value }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">{label}</label>
                    <input
                      value={value}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setGeneralSettings((prev) => prev.map((item) => (item.key === key ? { ...item, value: nextValue } : item)))
                      }}
                      className="input"
                    />
                  </div>
                ))}
              </div>
              <button onClick={save} className="btn-primary gap-2"><Save className="w-4 h-4" /> Save Changes</button>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Notification Preferences</h2>
              {notificationPrefs.map(({ label, channels }) => (
                <div key={label} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {['Email','In-App','Push','WhatsApp'].map(ch => (
                      <label key={ch} className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={channels.includes(ch)}
                          onChange={() => {
                            setNotificationPrefs((prev) => prev.map((item) => {
                              if (item.label !== label) return item
                              const nextChannels = item.channels.includes(ch)
                                ? item.channels.filter((channel) => channel !== ch)
                                : [...item.channels, ch]
                              return { ...item, channels: nextChannels }
                            }))
                          }}
                          className="rounded"
                        /> {ch}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={save} className="btn-primary gap-2"><Save className="w-4 h-4" /> Save</button>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Appearance</h2>

              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Theme</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 text-left
                        ${theme === t.id
                          ? 'ring-2 ring-brand-500 ring-offset-2 shadow-lg shadow-brand-500/20'
                          : 'ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-brand-300 dark:hover:ring-brand-700 hover:shadow-md'}`}
                    >
                      {/* Mini visual preview */}
                      <div
                        className="h-[72px] w-full p-2 relative flex flex-col gap-1.5"
                        style={{ background: t.preview.bg }}
                      >
                        {/* Simulated card */}
                        <div
                          className="flex-1 flex flex-col justify-center gap-1 px-2 py-1"
                          style={{
                            background: t.preview.card,
                            boxShadow: t.preview.cardShadow,
                            border: t.preview.cardBorder || 'none',
                            borderRadius: t.preview.cardRadius,
                          }}
                        >
                          <div
                            className="h-1.5 rounded-full w-3/5"
                            style={{ background: t.preview.accent, opacity: 0.75 }}
                          />
                          <div
                            className="h-1 rounded-full w-4/5"
                            style={{ background: t.preview.text, opacity: 0.14 }}
                          />
                          <div
                            className="h-1 rounded-full w-2/5"
                            style={{ background: t.preview.text, opacity: 0.09 }}
                          />
                        </div>
                        {/* Simulated button */}
                        <div
                          className="h-3.5 w-11 self-end"
                          style={{ background: t.preview.accent, borderRadius: t.preview.btnRadius, opacity: 0.88 }}
                        />
                        {/* Active check badge */}
                        {theme === t.id && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Label row */}
                      <div className="px-2.5 py-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{t.emoji}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t.name}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active theme summary */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50/60 dark:bg-slate-800/30 flex items-center gap-3">
                <span className="text-2xl leading-none">{activeTheme.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {activeTheme.name} Theme
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeTheme.desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'integrations' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <LazyIntegrations />
            </Suspense>
          )}

          {tab === 'security' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Security</h2>

              <div className={`rounded-2xl border-2 p-5 transition-all
                ${twoFAEnabled ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                               : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${twoFAEnabled ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {twoFAEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Two-Factor Authentication (2FA)</p>
                        <InfoHint text="Add an extra layer of security using an authenticator app." />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${twoFAEnabled ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                         : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${twoFAEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {twoFAEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      {twoFAEnabled && (
                        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="mt-3 flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Authenticator app active</span>
                          <span className="text-xs text-slate-400">· last verified today</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <button onClick={handle2FAToggle}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                      ${twoFAEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <motion.div animate={{ x: twoFAEnabled ? 24 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" />
                  </button>
                </div>
                {!twoFAEnabled && (
                  <motion.button initial={{ opacity:0 }} animate={{ opacity:1 }} onClick={() => setShowSetupModal(true)}
                    className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5" /> Set up 2FA now →
                  </motion.button>
                )}
              </div>

              {/* Session Timeout Card */}
              <div className={`rounded-2xl border-2 p-5 transition-all
                ${sessionTimeout ? 'border-brand-400 dark:border-brand-600 bg-brand-50/50 dark:bg-brand-950/10'
                                 : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${sessionTimeout ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Session Timeout</p>
                        <InfoHint text="Automatically sign out inactive users after a set period." />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${sessionTimeout ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400'
                                           : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sessionTimeout ? 'bg-brand-500' : 'bg-slate-400'}`} />
                          {sessionTimeout ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setSessionTimeout(p => !p); toast(sessionTimeout ? 'Session timeout disabled.' : 'Session timeout enabled.') }}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                      ${sessionTimeout ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <motion.div animate={{ x: sessionTimeout ? 24 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" />
                  </button>
                </div>
                <AnimatePresence>
                  {sessionTimeout && <SessionTimeoutPanel />}
                </AnimatePresence>
              </div>

              {/* Audit Logs Card */}
              <div className={`rounded-2xl border-2 p-5 transition-all
                ${auditLogs ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/10'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${auditLogs ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Audit Logs</p>
                        <InfoHint text="Track all user actions — logins, changes, deletions — with timestamps and IPs." />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${auditLogs ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${auditLogs ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          {auditLogs ? 'Recording' : 'Paused'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setAuditLogs(p => !p); toast(auditLogs ? 'Audit logging paused.' : 'Audit logging enabled.', { icon: auditLogs ? '⏸️' : '▶️' }) }}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                      ${auditLogs ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <motion.div animate={{ x: auditLogs ? 24 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" />
                  </button>
                </div>
                <AnimatePresence>
                  {auditLogs && <AuditLogsPanel />}
                </AnimatePresence>
              </div>

              <div className={`rounded-2xl border-2 p-5 transition-all
                ${ipWhitelist ? 'border-brand-400 dark:border-brand-600 bg-brand-50/50 dark:bg-brand-950/10'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${ipWhitelist ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">IP Whitelist</p>
                        <InfoHint text="Restrict access to specific IP addresses or CIDR ranges." />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${ipWhitelist ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ipWhitelist ? 'bg-brand-500' : 'bg-slate-400'}`} />
                          {ipWhitelist ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { const n = !ipWhitelist; setIpWhitelist(n); n ? toast('IP Whitelist enabled.', { icon:'🌐' }) : toast('IP Whitelist disabled.') }}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                      ${ipWhitelist ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <motion.div animate={{ x: ipWhitelist ? 24 : 2 }} transition={{ type:'spring', stiffness:500, damping:30 }}
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" />
                  </button>
                </div>
                <AnimatePresence>
                  {ipWhitelist && <IPWhitelistPanel />}
                </AnimatePresence>
              </div>
            </div>
          )}

          {tab === 'alerts' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <LazyAlerts />
            </Suspense>
          )}

          {tab === 'tickets' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <LazyTickets />
            </Suspense>
          )}

          {tab === 'subscription' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <LazySubscription />
            </Suspense>
          )}

          {tab === 'profile' && (
            <Suspense fallback={<div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>}>
              <LazyProfile />
            </Suspense>
          )}

          {tab === 'billing' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Billing & Plan</h2>
              <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Current Plan</p>
                <p className="text-3xl font-bold mt-1">{activePlan}</p>
                <p className="text-sm opacity-80 mt-1">₹2,499/month · Billed annually · 5 users included</p>
                <button onClick={() => setShowPlanModal(true)} className="mt-4 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Manage Plan</button>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Plan Features</p>
                {['Unlimited leads & deals','Sarathi assistant (Mistral)','All integrations','Priority support','Custom reports','White-labeling'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-2 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <AnimatePresence>
        {showSetupModal && (
          <TwoFactorModal
            onClose={() => setShowSetupModal(false)}
            onConfirm={() => { toast.info('MFA is managed by your identity provider.'); setShowSetupModal(false) }}
          />
        )}
        {showPlanModal && (
          <ManagePlanModal
            currentPlan={activePlan}
            onSelectPlan={(plan) => {
              setActivePlan(plan)
              saveWorkspaceSettings({ activePlan: plan })
            }}
            onClose={() => setShowPlanModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

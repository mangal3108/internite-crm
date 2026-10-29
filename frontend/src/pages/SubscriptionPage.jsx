import { useEffect, useState, useCallback } from 'react'
import {
  CreditCard,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Target,
  BadgeDollarSign,
  HardDrive,
  FileText,
  Clock,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import { subscriptionAPI } from '../services/api'

// ── Helpers ─────────────────────────────────────────────────────
const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount) => {
  if (amount == null) return '—'
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  TRIALING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  PAST_DUE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  TRIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
}

const INVOICE_STATUS_COLORS = {
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  OVERDUE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
}

// ── Skeleton ────────────────────────────────────────────────────
const Skeleton = ({ count = 3, h = 'h-24' }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <div key={i} className={`${h} animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60`} />
    ))}
  </div>
)

// ── Section Card ────────────────────────────────────────────────
const SectionCard = ({ title, subtitle, icon: Icon, iconColor = 'text-brand-500', children }) => (
  <div className="glass-card p-4">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
    </div>
    {children}
  </div>
)

// ── Usage Meter ─────────────────────────────────────────────────
function UsageMeter({ label, current, max, icon: Icon, color = 'brand' }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isHigh = pct >= 80
  const barColor = isHigh
    ? 'from-amber-400 to-rose-500'
    : `from-${color}-400 to-${color}-500`

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-4 w-4 ${isHigh ? 'text-amber-500' : `text-${color}-500`}`} />}
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
        </div>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          {current}{max ? ` / ${max}` : ''}
        </span>
      </div>
      {max > 0 && (
        <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-2 rounded-full bg-gradient-to-r ${isHigh ? 'from-amber-400 to-rose-500' : 'from-brand-400 to-brand-700'} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════════════
export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await subscriptionAPI.getCurrent()
      setSubscription(data || null)
    } catch (err) {
      toast.error(err?.message || 'Unable to load subscription data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const sub = subscription || {}
  const plan = sub.plan || {}
  const usage = sub.usage || {}
  const features = sub.features || plan.features || []
  const invoices = sub.invoices || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Subscription & Billing"
          subtitle="View your current plan, usage, and billing history."
          icon={<CreditCard className="h-5 w-5" />}
        />
        <button type="button" onClick={loadData} disabled={loading} className="btn-secondary self-start">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {loading ? (
        <Skeleton count={4} h="h-32" />
      ) : !subscription ? (
        <div className="glass-card py-16 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No subscription information available.</p>
        </div>
      ) : (
        <>
          {/* Current Plan Card */}
          <div className="glass-card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {plan.name || sub.planName || 'Current Plan'}
                  </h2>
                  <span className={`badge text-xs ${STATUS_COLORS[sub.status] || STATUS_COLORS.ACTIVE}`}>
                    {sub.status === 'ACTIVE' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {sub.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-1">
                  <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                    {formatCurrency(plan.price || sub.price)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    / {sub.billingCycle || plan.billingCycle || 'month'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Current period: {formatDate(sub.currentPeriodStart)} — {formatDate(sub.currentPeriodEnd)}</span>
                  </div>
                  {sub.nextBillingDate && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Next billing: {formatDate(sub.nextBillingDate)}</span>
                    </div>
                  )}
                  {sub.trialEndsAt && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Zap className="h-4 w-4" />
                      <span>Trial ends: {formatDate(sub.trialEndsAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Usage meters */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <UsageMeter
                label="Users"
                current={usage.users ?? usage.currentUsers ?? 0}
                max={usage.maxUsers ?? plan.maxUsers ?? 0}
                icon={Users}
              />
              <UsageMeter
                label="Leads"
                current={usage.leads ?? usage.currentLeads ?? 0}
                max={usage.maxLeads ?? plan.maxLeads ?? 0}
                icon={Target}
              />
              <UsageMeter
                label="Deals"
                current={usage.deals ?? usage.currentDeals ?? 0}
                max={usage.maxDeals ?? plan.maxDeals ?? 0}
                icon={BadgeDollarSign}
              />
              <UsageMeter
                label="Storage"
                current={usage.storage ?? usage.currentStorage ?? 0}
                max={usage.maxStorage ?? plan.maxStorage ?? 0}
                icon={HardDrive}
              />
            </div>
          </div>

          {/* Features list */}
          {Array.isArray(features) && features.length > 0 && (
            <SectionCard title="Plan Features" subtitle="Capabilities included in your plan" icon={Zap} iconColor="text-violet-500">
              <div className="grid gap-2 sm:grid-cols-2">
                {features.map((feature, i) => {
                  const isEnabled = typeof feature === 'object' ? feature.enabled !== false : true
                  const label = typeof feature === 'object' ? (feature.name || feature.label) : feature
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
                      {isEnabled ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" />
                      )}
                      <span className={`text-sm ${isEnabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Invoice History */}
          <SectionCard title="Invoice History" subtitle={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`} icon={FileText} iconColor="text-slate-500">
            {invoices.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No invoices yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                      <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice</th>
                      <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                      <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id || i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {inv.invoiceNumber || inv.number || `INV-${String(i + 1).padStart(4, '0')}`}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`badge text-xs ${INVOICE_STATUS_COLORS[inv.status] || INVOICE_STATUS_COLORS.PENDING}`}>
                            {inv.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(inv.date || inv.createdAt)}
                        </td>
                        <td className="py-3 text-xs text-slate-500 dark:text-slate-400">
                          {inv.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}

import InfoHint from '../components/ui/InfoHint'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BadgeDollarSign, Building2, CheckCircle2, CircleOff, RefreshCw, Shield, BarChart3, FileText, Pencil, Plus, Trash2, Users, Lock, Activity, Eye, UserX, UserCheck, Crown, Search, ChevronDown, ToggleLeft, ToggleRight, ShieldCheck, ShieldAlert, KeyRound, Globe, Server, Database, Layers, Zap, Settings, X, Phone, Mail, MapPin, Clock, DollarSign, StickyNote, Briefcase, Link as LinkIcon, User as UserIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import { platformAdminAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import CopyableContact from '../components/ui/CopyableContact'
import { anyFieldMatchesSearch } from '../utils/search'

// ── Helpers ─────────────────────────────────────────────────────
const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

const stringifyJson = (value) => {
  try { return JSON.stringify(value ?? {}, null, 2) } catch { return '{}' }
}

const parseJson = (value) => {
  if (!value || !value.trim()) return {}
  try { return JSON.parse(value) } catch { return {} }
}

const EMPTY_FORM = {
  id: '', name: '', slug: '', industry: '', website: '', logoUrl: '',
  contactName: '', contactEmail: '', contactPhone: '', country: '',
  plan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: '', maxUsers: 5,
  subscriptionStartedAt: '', subscriptionEndsAt: '',
  timezone: '', currency: 'INR',
  featureFlagsJson: '{}', usageLimitsJson: '{}',
  adminName: '', adminEmail: '', adminPassword: '',
  isActive: true, notes: '',
}


const ROLE_LABELS = {
  PLATFORM_ADMIN: 'Platform Admin',
  COMPANY_ADMIN: 'Company Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES_EXEC: 'Sales Exec',
  NORMAL_USER: 'Normal User',
}

const ROLE_COLORS = {
  PLATFORM_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400',
  COMPANY_ADMIN: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  ADMIN: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  MANAGER: 'bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400',
  SALES_EXEC: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  NORMAL_USER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

// ── Skeleton ────────────────────────────────────────────────────
const Skeleton = ({ count = 4, h = 'h-24' }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <div key={i} className={`${h} animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60`} />
    ))}
  </div>
)

// ── KPI Card ────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, color = 'text-brand-500', sub }) => (
  <div className="kpi-card">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      {Icon && <Icon className={`h-4 w-4 ${color}`} />}
    </div>
    <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3>
    {sub && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
)

// ── Section Card ────────────────────────────────────────────────
const SectionCard = ({ title, subtitle, icon: Icon, iconColor = 'text-brand-500', children, actions }) => (
  <div className="glass-card p-4">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
      </div>
    </div>
    {children}
  </div>
)

// ── Form Section ───────────────────────────────────────────────
const FormSection = ({ title, icon: Icon, iconColor = 'text-brand-500', children, accent }) => (
  <div className={`rounded-xl border p-4 ${accent || 'border-slate-200/70 bg-white/50 dark:border-slate-800/60 dark:bg-slate-950/30'}`}>
    <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {Icon && <Icon className={`h-3.5 w-3.5 ${iconColor}`} />} {title}
    </p>
    {children}
  </div>
)

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Real Estate', 'Education',
  'Retail', 'Manufacturing', 'Consulting', 'Marketing', 'Legal',
  'Hospitality', 'Logistics', 'Media', 'Telecom', 'Other',
]

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'Singapore', 'UAE', 'Japan', 'France', 'Other',
]

const TIMEZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
]

const CURRENCIES = [
  { code: 'INR', label: '₹ INR' }, { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' }, { code: 'GBP', label: '£ GBP' },
  { code: 'AUD', label: 'A$ AUD' }, { code: 'SGD', label: 'S$ SGD' },
  { code: 'AED', label: 'د.إ AED' }, { code: 'JPY', label: '¥ JPY' },
]

// ═════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═════════════════════════════════════════════════════════════════
function OverviewTab({ overview, billing, loading }) {
  if (loading) return <Skeleton count={6} h="h-20" />

  const o = overview || {}
  const b = billing || {}

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Companies" value={o.totalCompanies ?? 0} icon={Building2} color="text-brand-500" sub={`${o.activeCompanies ?? 0} active`} />
        <KpiCard label="Total Users" value={o.totalUsers ?? 0} icon={Users} color="text-brand-500" sub={`${o.activeUsers ?? 0} active`} />
        <KpiCard label="Total Leads" value={o.totalLeads ?? 0} icon={Layers} color="text-emerald-500" />
        <KpiCard label="Total Deals" value={o.totalDeals ?? 0} icon={BadgeDollarSign} color="text-amber-500" />
      </div>

      {/* Second row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Invoices" value={o.totalInvoices ?? 0} icon={FileText} color="text-rose-500" />
        <KpiCard label="Workflows" value={o.totalWorkflows ?? 0} icon={Zap} color="text-violet-500" />
        <KpiCard label="Integrations" value={o.totalIntegrations ?? 0} icon={Globe} color="text-teal-500" />
        <KpiCard label="2FA Enabled" value={o.twoFaUsers ?? 0} icon={ShieldCheck} color="text-green-500" sub={`of ${o.totalUsers ?? 0} users`} />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Users by Role" icon={Crown} iconColor="text-amber-500">
          <div className="space-y-2">
            {Object.entries(o.roleBreakdown || {}).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'}`}>{ROLE_LABELS[role] || role}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Companies by Plan" icon={BadgeDollarSign} iconColor="text-emerald-500">
          <div className="space-y-2">
            {Object.entries(o.planBreakdown || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300 text-xs">{plan}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Billing summary */}
      <SectionCard title="Billing Summary" subtitle="Subscription health across all companies" icon={BadgeDollarSign} iconColor="text-emerald-500">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 text-center dark:border-slate-800/70 dark:bg-slate-950/40">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{b.totalTenants ?? 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-center dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{b.activeTenants ?? 0}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">Active</p>
          </div>
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{b.trialTenants ?? 0}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">On Trial</p>
          </div>
          <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-3 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{b.expiringSoon ?? 0}</p>
            <p className="text-xs text-rose-600 dark:text-rose-500">Expiring Soon</p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  COMPANIES TAB
// ═════════════════════════════════════════════════════════════════
function CompaniesTab({ tenants, loading, onSelectTenant, selectedTenant, form, updateForm, submitTenant, saving, toggleTenant, onNewTenant, currentTenantId }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const handleSelectTenant = (tenant) => { onSelectTenant(tenant); setShowForm(true) }
  const handleNewTenant = () => { onNewTenant(); setShowForm(true) }
  const handleCloseForm = () => { setShowForm(false) }
  const handleSubmit = async (e) => { await submitTenant(e); setShowForm(false) }
  const filtered = tenants.filter((t) =>
    anyFieldMatchesSearch(search, [t.name, t.slug, t.contactName, t.contactEmail, t.contactPhone])
  )

  return (
    <div className={`grid gap-6 ${showForm ? 'xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]' : ''}`}>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search by company, phone, contact, or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        <SectionCard title="Companies" subtitle={`${filtered.length} compan${filtered.length === 1 ? 'y' : 'ies'}`} icon={Building2} iconColor="text-brand-500"
          actions={<button type="button" onClick={handleNewTenant} className="btn-primary h-8 px-3 text-xs"><Plus className="h-3.5 w-3.5" />New</button>}
        >
          {loading ? <Skeleton /> : (
            <div className="space-y-3 max-h-[36rem] overflow-y-auto custom-scrollbar">
              {filtered.map((tenant) => {
                const isSelected = selectedTenant?.id === tenant.id
                return (
                  <div key={tenant.id}
                    className={`rounded-2xl border p-4 transition cursor-pointer ${
                      isSelected
                        ? 'border-brand-300 bg-brand-50/40 dark:border-brand-900/50 dark:bg-brand-950/20'
                        : 'border-slate-200/70 bg-white/70 hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-950/40 dark:hover:border-slate-700'
                    }`}
                    onClick={() => handleSelectTenant(tenant)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</h3>
                          {currentTenantId && String(tenant.tenantId) === String(currentTenantId) && (
                            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 text-xs">
                              <Building2 className="mr-1 h-3 w-3" />Current
                            </span>
                          )}
                          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs">{tenant.plan}</span>
                          {tenant.isActive ? (
                            <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3" />Active
                            </span>
                          ) : (
                            <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs">
                              <CircleOff className="mr-1 h-3 w-3" />Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {tenant.slug} · {tenant.billingStatus || 'TRIAL'} · Trial ends {formatDate(tenant.trialEndsAt)}
                        </p>
                        <div className="mt-2 grid gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                          <span>Users: {tenant.userCount ?? 0}/{tenant.maxUsers ?? 0}</span>
                          <span>Leads: {tenant.leadCount ?? 0}</span>
                          <span>Deals: {tenant.dealCount ?? 0}</span>
                          <span>Invoices: {tenant.invoiceCount ?? 0}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleSelectTenant(tenant)} className="btn-ghost h-8 px-2.5 text-xs">
                          <Pencil className="h-3.5 w-3.5" />Edit
                        </button>
                        {tenant.isActive ? (
                          <button type="button" onClick={() => toggleTenant(tenant, false)} className="btn-ghost h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                            <CircleOff className="h-3.5 w-3.5" />Deactivate
                          </button>
                        ) : (
                          <button type="button" onClick={() => toggleTenant(tenant, true)} className="btn-secondary h-8 px-2.5 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />Activate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No companies found</p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Edit / Create form */}
      {showForm && <SectionCard title={form.id ? 'Edit Company' : 'Create Company'} subtitle="Fill in company details, contact, subscription and admin" icon={Building2} iconColor="text-brand-500"
        actions={<button type="button" onClick={handleCloseForm} className="btn-ghost h-8 px-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><X className="h-4 w-4" /></button>}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar pr-1">

          {/* ── 1. Company Details ──────────────────────────────── */}
          <FormSection title="Company Details" icon={Building2} iconColor="text-brand-500">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Company Name <span className="text-rose-500">*</span></label>
                <input name="name" value={form.name} onChange={updateForm} className="input" placeholder="Acme Corp" required />
              </div>
              <div>
                <label className="label">Slug / ID <span className="text-rose-500">*</span></label>
                <input name="slug" value={form.slug} onChange={updateForm} className="input" placeholder="acme-corp" />
              </div>
              <div>
                <label className="label">Industry</label>
                <select name="industry" value={form.industry} onChange={updateForm} className="input">
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Website</label>
                <input name="website" value={form.website} onChange={updateForm} className="input" placeholder="https://acme.com" type="url" />
              </div>
              <div>
                <label className="label">Logo URL</label>
                <input name="logoUrl" value={form.logoUrl} onChange={updateForm} className="input" placeholder="https://..." />
              </div>
            </div>
          </FormSection>

          {/* ── 2. Primary Contact ──────────────────────────────── */}
          <FormSection title="Primary Contact" icon={UserIcon} iconColor="text-brand-500">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Contact Name <span className="text-rose-500">*</span></label>
                <input name="contactName" value={form.contactName} onChange={updateForm} className="input" placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Email <span className="text-rose-500">*</span></label>
                <input name="contactEmail" type="email" value={form.contactEmail} onChange={updateForm} className="input" placeholder="john@acme.com" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input name="contactPhone" value={form.contactPhone} onChange={updateForm} className="input" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label">Country</label>
                <select name="country" value={form.country} onChange={updateForm} className="input">
                  <option value="">Select country...</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </FormSection>

          {/* ── 3. Subscription ─────────────────────────────────── */}
          <FormSection title="Subscription" icon={BadgeDollarSign} iconColor="text-emerald-500">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Plan <span className="text-rose-500">*</span></label>
                <select name="plan" value={form.plan} onChange={updateForm} className="input">
                  {['TRIAL', 'STARTER', 'BUSINESS', 'ENTERPRISE'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Billing Cycle</label>
                <select name="billingStatus" value={form.billingStatus} onChange={updateForm} className="input">
                  {['TRIAL', 'MONTHLY', 'QUARTERLY', 'ANNUAL'].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Trial Ends</label>
                <input name="trialEndsAt" type="datetime-local" value={form.trialEndsAt} onChange={updateForm} className="input" />
              </div>
              <div>
                <label className="label">User / Seat Limit</label>
                <input name="maxUsers" type="number" min="1" value={form.maxUsers} onChange={updateForm} className="input" />
              </div>
              <div>
                <label className="label">Subscription Starts</label>
                <input name="subscriptionStartedAt" type="datetime-local" value={form.subscriptionStartedAt} onChange={updateForm} className="input" />
              </div>
              <div>
                <label className="label">Subscription Ends</label>
                <input name="subscriptionEndsAt" type="datetime-local" value={form.subscriptionEndsAt} onChange={updateForm} className="input" />
              </div>
            </div>
          </FormSection>

          {/* ── 4. Configuration ────────────────────────────────── */}
          <FormSection title="Configuration" icon={Settings} iconColor="text-violet-500">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Time Zone</label>
                <select name="timezone" value={form.timezone} onChange={updateForm} className="input">
                  <option value="">Select timezone...</option>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Currency</label>
                <select name="currency" value={form.currency} onChange={updateForm} className="input">
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Feature Flags</label>
                <textarea name="featureFlagsJson" rows={4} value={form.featureFlagsJson} onChange={updateForm} className="input font-mono text-xs" placeholder='{"ai_engine": true}' />
              </div>
              <div>
                <label className="label">Usage Limits</label>
                <textarea name="usageLimitsJson" rows={4} value={form.usageLimitsJson} onChange={updateForm} className="input font-mono text-xs" placeholder='{"maxLeads": 1000}' />
              </div>
            </div>
          </FormSection>

          {/* ── 5. Initial Admin — only on create ───────────────── */}
          {!form.id && (
            <FormSection title="Initial Admin" icon={Crown} iconColor="text-amber-500"
              accent="border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Admin Name <span className="text-rose-500">*</span></label>
                  <input name="adminName" value={form.adminName} onChange={updateForm} className="input" placeholder="John Doe" />
                </div>
                <div>
                  <label className="label inline-flex items-center gap-1.5">Admin Email <span className="text-rose-500">*</span><InfoHint text="This user will be the first Company Admin and can log in at the company login page." /></label>
                  <input name="adminEmail" type="email" value={form.adminEmail} onChange={updateForm} className="input" placeholder="admin@company.com" required />
                </div>
                <div>
                  <label className="label">Password <span className="text-rose-500">*</span></label>
                  <input name="adminPassword" type="text" value={form.adminPassword} onChange={updateForm} className="input" placeholder="Min 6 characters" required minLength={6} />
                </div>
              </div>
            </FormSection>
          )}

          {/* ── 6. Status ───────────────────────────────────────── */}
          <FormSection title="Status" icon={Activity} iconColor="text-rose-500">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={updateForm} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Active company
              </label>
              <div>
                <label className="label">Internal Notes</label>
                <textarea name="notes" rows={2} value={form.notes} onChange={updateForm} className="input text-xs" placeholder="Internal notes about this company..." />
              </div>
            </div>
          </FormSection>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200/70 bg-white/80 pt-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 sm:flex-row">
            <button type="button" onClick={handleCloseForm} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : form.id ? 'Save & Update Company' : 'Save & Create Company'}
            </button>
          </div>
        </form>
      </SectionCard>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  USERS TAB
// ═════════════════════════════════════════════════════════════════
function UsersTab({ loading, refreshData }) {
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'COMPANY_ADMIN', tenantId: '' })

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const [userData, tenantData] = await Promise.all([
        platformAdminAPI.getAllUsers(),
        platformAdminAPI.getTenants(),
      ])
      setUsers(Array.isArray(userData) ? userData : [])
      setTenants(Array.isArray(tenantData) ? tenantData : [])
    } catch (err) {
      toast.error(err?.message || 'Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return anyFieldMatchesSearch(q, [u.name, u.email, u.phone, u.tenantName])
    }
    return true
  })

  const handleRoleChange = async (userId, newRole) => {
    try {
      await platformAdminAPI.changeUserRole(userId, newRole)
      toast.success('Role updated')
      await loadUsers()
      refreshData()
    } catch (err) {
      toast.error(err?.message || 'Failed to update role')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      if (user.isActive) {
        await platformAdminAPI.deactivateUser(user.id)
        toast.success('User deactivated')
      } else {
        await platformAdminAPI.activateUser(user.id)
        toast.success('User activated')
      }
      await loadUsers()
      refreshData()
    } catch (err) {
      toast.error(err?.message || 'Failed to update user')
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUser.email || !newUser.password || !newUser.tenantId) {
      toast.error('Email, password, and company are required')
      return
    }
    setCreating(true)
    try {
      await platformAdminAPI.createUser({
        ...newUser,
        tenantId: Number(newUser.tenantId),
      })
      toast.success('User created successfully')
      setShowCreateForm(false)
      setNewUser({ name: '', email: '', password: '', role: 'COMPANY_ADMIN', tenantId: '' })
      await loadUsers()
      refreshData()
    } catch (err) {
      toast.error(err?.message || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const activeCount = users.filter((u) => u.isActive).length
  const inactiveCount = users.length - activeCount

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Users" value={users.length} icon={Users} color="text-brand-500" />
        <KpiCard label="Active" value={activeCount} icon={UserCheck} color="text-emerald-500" />
        <KpiCard label="Inactive" value={inactiveCount} icon={UserX} color="text-rose-500" />
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <SectionCard title="Create New User" icon={Plus} iconColor="text-emerald-500">
          <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Company <span className="text-rose-500">*</span></label>
              <select value={newUser.tenantId} onChange={(e) => setNewUser({ ...newUser, tenantId: e.target.value })}
                className="input" required>
                <option value="">Select company...</option>
                {tenants.filter(t => t.isActive).map(t => (
                  <option key={t.tenantId} value={t.tenantId}>{t.name} (ID: {t.tenantId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="input">
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'PLATFORM_ADMIN').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Full Name</label>
              <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="John Doe" className="input" />
            </div>
            <div>
              <label className="label">Email <span className="text-rose-500">*</span></label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="user@company.com" className="input" required />
            </div>
            <div>
              <label className="label">Password <span className="text-rose-500">*</span></label>
              <input type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Min 6 characters" className="input" required minLength={6} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={creating} className="btn-primary flex-1">
                {creating ? 'Creating...' : <><Plus className="h-4 w-4" /> Create User</>}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name, phone, company, or email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input w-auto min-w-[160px]">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" onClick={() => setShowCreateForm(!showCreateForm)}
          className={`btn-primary ${showCreateForm ? 'bg-rose-600 hover:bg-rose-700' : ''}`}>
          {showCreateForm ? <><X className="h-4 w-4" /> Close</> : <><Plus className="h-4 w-4" /> New User</>}
        </button>
        <button type="button" onClick={loadUsers} className="btn-secondary"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Users table */}
      <SectionCard title="All Platform Users" subtitle={`${filtered.length} user${filtered.length === 1 ? '' : 's'} shown`} icon={Users} iconColor="text-brand-500">
        {loadingUsers ? <Skeleton count={6} h="h-14" /> : (
          <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Company</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">2FA</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                        <CopyableContact
                          value={u.email}
                          label="Email"
                          className="max-w-[220px] text-xs text-slate-500 dark:text-slate-400"
                        />
                        {u.phone && (
                          <CopyableContact
                            value={u.phone}
                            label="Phone"
                            className="max-w-[220px] text-xs text-slate-400"
                          />
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-400">{u.tenantName}</td>
                      <td className="py-3 pr-4">
                        {u.role === 'PLATFORM_ADMIN' ? (
                          <span className={`badge text-xs ${ROLE_COLORS.PLATFORM_ADMIN}`}>{ROLE_LABELS.PLATFORM_ADMIN}</span>
                        ) : (
                          <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="input h-7 py-0 text-xs w-auto min-w-[130px]">
                            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'PLATFORM_ADMIN').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {u.isActive ? (
                          <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs">Active</span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {u.twoFaEnabled ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </td>
                      <td className="py-3">
                        {u.role === 'PLATFORM_ADMIN' ? (
                          <span className="text-[10px] text-slate-400">Protected</span>
                        ) : (
                          <button type="button" onClick={() => handleToggleActive(u)}
                            className={`btn-ghost h-7 px-2 text-xs ${u.isActive ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}>
                            {u.isActive ? <><UserX className="h-3.5 w-3.5" />Deactivate</> : <><UserCheck className="h-3.5 w-3.5" />Activate</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No users match your filters</p>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  SUBSCRIPTIONS TAB
// ═════════════════════════════════════════════════════════════════
function SubscriptionsTab({ plans, billing, tenants, loading }) {
  if (loading) return <Skeleton count={4} h="h-32" />

  const b = billing || {}
  const planCounts = {}
  tenants.forEach((t) => { const p = (t.plan || 'TRIAL').toUpperCase(); planCounts[p] = (planCounts[p] || 0) + 1 })

  return (
    <div className="space-y-6">
      {/* Billing KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Companies" value={b.totalTenants ?? 0} icon={Building2} color="text-brand-500" />
        <KpiCard label="Active Subscriptions" value={b.activeTenants ?? 0} icon={CheckCircle2} color="text-emerald-500" />
        <KpiCard label="On Trial" value={b.trialTenants ?? 0} icon={Activity} color="text-amber-500" />
        <KpiCard label="Expiring Soon" value={b.expiringSoon ?? 0} icon={ShieldAlert} color="text-rose-500" sub="Within 7 days" />
      </div>

      {/* Plans */}
      <SectionCard title="Subscription Plans" subtitle="Pricing and limit presets" icon={BadgeDollarSign} iconColor="text-emerald-500">
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-slate-800/70 dark:bg-slate-950/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                  <p className="mt-1 text-lg font-bold text-brand-600 dark:text-brand-400">₹{(plan.priceInRupees || 0).toLocaleString()}<span className="text-xs font-normal text-slate-500"> /month</span></p>
                </div>
                <div className="text-right">
                  <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">{plan.maxUsers} users</span>
                  <p className="mt-1 text-xs text-slate-500">{planCounts[plan.name] || 0} companies</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{plan.features}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Trial {plan.trialDays} days</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Companies by subscription status */}
      <SectionCard title="Company Subscriptions" subtitle="Status of all company subscriptions" icon={Layers} iconColor="text-violet-500">
        <div className="max-h-[24rem] overflow-y-auto custom-scrollbar space-y-2">
          {tenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-950/40">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.billingStatus || 'TRIAL'} · Ends {formatDate(t.subscriptionEndsAt || t.trialEndsAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs">{t.plan}</span>
                {t.isActive ? (
                  <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs">Active</span>
                ) : (
                  <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs">Inactive</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  SECURITY TAB
// ═════════════════════════════════════════════════════════════════
function SecurityTab({ loading }) {
  const [security, setSecurity] = useState(null)
  const [loadingSec, setLoadingSec] = useState(true)

  useEffect(() => {
    (async () => {
      setLoadingSec(true)
      try {
        const data = await platformAdminAPI.getSecurity()
        setSecurity(data || null)
      } catch (err) {
        toast.error(err?.message || 'Failed to load security data')
      } finally {
        setLoadingSec(false)
      }
    })()
  }, [])

  if (loadingSec) return <Skeleton count={5} h="h-16" />
  const s = security || {}

  return (
    <div className="space-y-6">
      {/* Security KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Users" value={s.totalUsers ?? 0} icon={Users} color="text-brand-500" />
        <KpiCard label="Active Users" value={s.activeUsers ?? 0} icon={UserCheck} color="text-emerald-500" />
        <KpiCard label="2FA Enabled" value={s.twoFaEnabled ?? 0} icon={ShieldCheck} color="text-green-500" sub={`${s.twoFaPercent ?? 0}% adoption`} />
        <KpiCard label="Platform Admins" value={s.platformAdmins ?? 0} icon={Crown} color="text-purple-500" />
      </div>

      {/* 2FA progress bar */}
      <SectionCard title="Two-Factor Authentication Adoption" icon={KeyRound} iconColor="text-green-500">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{s.twoFaEnabled ?? 0} of {s.totalUsers ?? 0} users have 2FA enabled</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{s.twoFaPercent ?? 0}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all" style={{ width: `${Math.min(s.twoFaPercent ?? 0, 100)}%` }} />
          </div>
        </div>
      </SectionCard>

      {/* Security policies */}
      <SectionCard title="Security Policies" subtitle="Active platform security controls" icon={Shield} iconColor="text-brand-500">
        <div className="space-y-2">
          {(s.policies || []).map((policy, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-950/40">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{policy.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{policy.description}</p>
              </div>
              <span className={`badge text-xs ${
                policy.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}>
                {policy.status === 'ACTIVE' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Activity className="mr-1 h-3 w-3" />}
                {policy.status}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Admin accounts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Access Control Summary" icon={Lock} iconColor="text-violet-500">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
              <span className="text-sm text-slate-600 dark:text-slate-400">Platform Admins</span>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">{s.platformAdmins ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
              <span className="text-sm text-slate-600 dark:text-slate-400">Company Admins</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{s.companyAdmins ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
              <span className="text-sm text-slate-600 dark:text-slate-400">Active Users</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{s.activeUsers ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/40">
              <span className="text-sm text-slate-600 dark:text-slate-400">Inactive Users</span>
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{s.inactiveUsers ?? 0}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Data Isolation" icon={Database} iconColor="text-teal-500">
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Multi-Tenant Isolation Active</p>
                <InfoHint text="Each company’s data is isolated by tenant ID. Users can only access data belonging to their own company." />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Soft Delete Enabled</p>
                <InfoHint text="Records are soft-deleted (marked as deleted) for data recovery and audit compliance." />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  FEATURE FLAGS TAB
// ═════════════════════════════════════════════════════════════════
function FeatureFlagsTab({ featureFlags, loading }) {
  if (loading) return <Skeleton count={5} h="h-16" />
  return (
    <SectionCard title="Platform Feature Flags" subtitle="Capabilities available across all companies" icon={Zap} iconColor="text-violet-500">
      <div className="grid gap-3 sm:grid-cols-2">
        {featureFlags.map((flag) => (
          <div key={flag.key} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{flag.label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{flag.description}</p>
              </div>
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />Enabled
              </span>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">{flag.key}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ═════════════════════════════════════════════════════════════════
//  AUDIT LOGS TAB
// ═════════════════════════════════════════════════════════════════
function AuditLogsTab({ auditLogs, loading }) {
  const [search, setSearch] = useState('')
  const filtered = auditLogs.filter((log) => {
    if (!search) return true
    const q = search.toLowerCase()
    return log.userName?.toLowerCase().includes(q) || log.userEmail?.toLowerCase().includes(q)
      || log.action?.toLowerCase().includes(q) || log.entityName?.toLowerCase().includes(q)
  })

  if (loading) return <Skeleton count={6} h="h-14" />

  const ACTION_LABELS = {
    TENANT_CREATED: 'Created company',
    TENANT_UPDATED: 'Updated company',
    TENANT_ACTIVATED: 'Activated company',
    TENANT_DEACTIVATED: 'Deactivated company',
    USER_ROLE_CHANGED: 'Changed user role',
    USER_ACTIVATED: 'Activated user',
    USER_DEACTIVATED: 'Deactivated user',
  }

  const ACTION_COLORS = {
    TENANT_CREATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    TENANT_UPDATED: 'bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400',
    TENANT_ACTIVATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    TENANT_DEACTIVATED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
    USER_ROLE_CHANGED: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    USER_ACTIVATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    USER_DEACTIVATED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search audit logs..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
      </div>

      <SectionCard title="Global Audit Trail" subtitle={`${filtered.length} recent events`} icon={FileText} iconColor="text-slate-500">
        <div className="max-h-[36rem] overflow-y-auto custom-scrollbar space-y-2">
          {filtered.map((log, i) => (
            <div key={log.id || i} className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge text-xs ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    {log.entityName && <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{log.entityName}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    by {log.performedBy || log.userName || 'System'} ({log.performedByEmail || log.userEmail || ''})
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 whitespace-nowrap">{formatDate(log.createdAt)}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No audit events found</p>}
        </div>
      </SectionCard>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════════════
export default function SaaSAdminPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const VALID_TABS = ['overview', 'companies', 'users', 'subscriptions', 'security', 'features', 'audit']
  const rawTab = searchParams.get('tab') || 'overview'
  const tab = VALID_TABS.includes(rawTab) ? rawTab : 'overview'
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [featureFlags, setFeatureFlags] = useState([])
  const [billing, setBilling] = useState(null)
  const [overview, setOverview] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tenantRows, planRows, flagRows, billingSummary, overviewData, auditRows] = await Promise.all([
        platformAdminAPI.getTenants(),
        platformAdminAPI.getPlans(),
        platformAdminAPI.getFeatureFlags(),
        platformAdminAPI.getBilling(),
        platformAdminAPI.getOverview(),
        platformAdminAPI.getAuditLogs(),
      ])
      setTenants(Array.isArray(tenantRows) ? tenantRows : [])
      setPlans(Array.isArray(planRows) ? planRows : [])
      setFeatureFlags(Array.isArray(flagRows) ? flagRows : [])
      setBilling(billingSummary || null)
      setOverview(overviewData || null)
      setAuditLogs(Array.isArray(auditRows) ? auditRows : [])
    } catch (error) {
      toast.error(error?.message || 'Unable to load platform data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const selectTenant = (tenant) => {
    setSelectedTenant(tenant)
    setForm({
      id: tenant?.id || '', name: tenant?.name || '', slug: tenant?.slug || '',
      industry: tenant?.industry || '', website: tenant?.website || '', logoUrl: tenant?.logoUrl || '',
      contactName: tenant?.contactName || '', contactEmail: tenant?.contactEmail || '',
      contactPhone: tenant?.contactPhone || '', country: tenant?.country || '',
      plan: tenant?.plan || 'TRIAL', billingStatus: tenant?.billingStatus || 'TRIAL',
      trialEndsAt: tenant?.trialEndsAt ? String(tenant.trialEndsAt).slice(0, 16) : '',
      maxUsers: tenant?.maxUsers ?? 5,
      subscriptionStartedAt: tenant?.subscriptionStartedAt ? String(tenant.subscriptionStartedAt).slice(0, 16) : '',
      subscriptionEndsAt: tenant?.subscriptionEndsAt ? String(tenant.subscriptionEndsAt).slice(0, 16) : '',
      timezone: tenant?.timezone || '', currency: tenant?.currency || 'INR',
      featureFlagsJson: stringifyJson(tenant?.featureFlags), usageLimitsJson: stringifyJson(tenant?.usageLimits),
      adminName: '', adminEmail: '', adminPassword: '',
      isActive: Boolean(tenant?.isActive), notes: tenant?.notes || '',
    })
    if (tenant) navigate('/admin/saas?tab=companies', { replace: true })
  }

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target
    setForm((c) => ({ ...c, [name]: type === 'checkbox' ? checked : value }))
  }

  const submitTenant = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name, slug: form.slug, plan: form.plan,
        industry: form.industry || null, website: form.website || null,
        logoUrl: form.logoUrl || null,
        contactName: form.contactName || null, contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null, country: form.country || null,
        billingStatus: form.billingStatus, isActive: form.isActive,
        maxUsers: Number(form.maxUsers) || 5,
        trialEndsAt: form.trialEndsAt || null,
        subscriptionStartedAt: form.subscriptionStartedAt || null,
        subscriptionEndsAt: form.subscriptionEndsAt || null,
        timezone: form.timezone || null, currency: form.currency || null,
        notes: form.notes || null,
        featureFlags: parseJson(form.featureFlagsJson),
        usageLimits: parseJson(form.usageLimitsJson),
      }
      if (form.id) {
        await platformAdminAPI.updateTenant(form.id, payload)
        toast.success('Company updated')
      } else {
        // Include admin credentials when creating a new company
        if (form.adminEmail) {
          payload.adminEmail = form.adminEmail
          payload.adminPassword = form.adminPassword
          payload.adminName = form.adminName || form.adminEmail.split('@')[0]
        }
        await platformAdminAPI.createTenant(payload)
        toast.success(form.adminEmail ? 'Company & admin user created' : 'Company created')
      }
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to save company')
    } finally {
      setSaving(false)
    }
  }

  const toggleTenant = async (tenant, active) => {
    if (!active) {
      const confirmed = window.confirm(
        `Are you sure you want to deactivate "${tenant.name}"? All users in this company will lose access.`
      )
      if (!confirmed) return
    }
    try {
      if (active) await platformAdminAPI.activateTenant(tenant.id)
      else await platformAdminAPI.deactivateTenant(tenant.id)
      toast.success(active ? 'Company activated' : 'Company deactivated')
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to update company')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="Platform Admin"
          subtitle="Manage companies, users, subscriptions, security, and platform operations."
          icon={<Shield className="h-5 w-5" />}
        />
        <button type="button" onClick={loadData} className="btn-secondary self-start">
          <RefreshCw className="h-4 w-4" />Refresh
        </button>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab overview={overview} billing={billing} loading={loading} />}
      {tab === 'companies' && (
        <CompaniesTab
          tenants={tenants} loading={loading} onSelectTenant={selectTenant}
          selectedTenant={selectedTenant} form={form} updateForm={updateForm}
          submitTenant={submitTenant} saving={saving} toggleTenant={toggleTenant}
          onNewTenant={() => selectTenant(null)}
          currentTenantId={user?.tenantId}
        />
      )}
      {tab === 'users' && <UsersTab loading={loading} refreshData={loadData} />}
      {tab === 'subscriptions' && <SubscriptionsTab plans={plans} billing={billing} tenants={tenants} loading={loading} />}
      {tab === 'security' && <SecurityTab loading={loading} />}
      {tab === 'features' && <FeatureFlagsTab featureFlags={featureFlags} loading={loading} />}
      {tab === 'audit' && <AuditLogsTab auditLogs={auditLogs} loading={loading} />}
    </div>
  )
}

import InfoHint from './ui/InfoHint'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarCheck, Download, Loader2, PhoneCall, RefreshCw, Search, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { hasPermission, PERMISSIONS } from '../utils/permissions'
import { buildDailyReportPdf, DEFAULT_ACTIVITY_FILTER, activityFilterLabel, filterTimeline, label, metrics, reportTime, stageColor } from './dailyReportPdf'

const colors = { HOT: 'bg-rose-500', WARM: 'bg-amber-500', COLD: 'bg-blue-500', UNCLASSIFIED: 'bg-slate-400' }
const icons = [Users, PhoneCall, CalendarCheck, BarChart3]
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900'
const pageSize = 20

export default function DailyLeadDashboard() {
  const user = useAuthStore(state => state.user)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState(DEFAULT_ACTIVITY_FILTER)
  const [page, setPage] = useState(0)
  const [stage, setStage] = useState('')
  const [stagePage, setStagePage] = useState(0)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await api.get('/reports/daily-lead-activity'); setReport(data); setPage(0) }
    catch (e) { setError(e.response?.data?.message || 'Unable to load the daily report. Please retry.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const rows = useMemo(() => filterTimeline(report?.timeline || [], search, type), [report, search, type])
  const types = useMemo(() => [...new Set((report?.timeline || []).map(row => row.type))].sort(), [report])
  const stageLeads = useMemo(() => (report?.leads || []).filter(lead => lead.stage === stage), [report, stage])
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const download = async () => {
    setExporting(true)
    try {
      // Re-authorize export and refresh both views with exactly the same server snapshot.
      const data = await api.get('/reports/daily-lead-activity/export')
      setReport(data); setPage(0)
      buildDailyReportPdf(data, { search, type }).save(`CRM_Daily_Lead_Activity_${data.date}.pdf`)
      toast.success('Complete report downloaded')
    } catch (e) { toast.error(e.response?.data?.message || 'Could not export the report. Please retry.') }
    finally { setExporting(false) }
  }
  return <section className="space-y-5 text-slate-900 dark:text-slate-100" aria-label="Daily lead activity analytics">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Daily intelligence</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Yesterday’s lead activity</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{report ? `${report.date} · ${report.timezone} · All accessible leads` : 'Your complete daily activity overview'}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={load} disabled={loading || exporting}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh Report</button>
        {hasPermission(user, PERMISSIONS.REPORTS_EXPORT) && <button className="btn-primary" disabled={!report || loading || exporting || !!error} onClick={download}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download Yesterday’s Report (PDF)</button>}
      </div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    {loading && !report && <div role="status" className={`${panel} flex items-center gap-3`}><Loader2 className="h-5 w-5 animate-spin" />Loading activity from your CRM…</div>}
    {report && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([key, title], index) => { const Icon = icons[index]; return <article key={key} className={`${panel} transition-shadow hover:shadow-md`}>
          <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Yesterday</span><Icon className="h-5 w-5 text-indigo-500" /></div>
          <p className="my-3 text-4xl font-semibold tracking-tight">{report.kpis[key].toLocaleString('en-IN')}</p>
          <h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{index === 0 ? 'Created during the reporting day' : 'Completed on new and existing leads'}</p>
        </article> })}
      </div>
      <section className={panel}>
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">Current lead pipeline</h2><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Current snapshot</span></div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{reportTime(report.pipelineSnapshotAt, report.timezone)} · Each lead appears once. Counts show distribution, not conversion rates.</p>
        <div className="mt-6 grid gap-7 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-1.5" aria-label="Lead pipeline funnel">
            {report.pipeline.map((item, index) => <button key={item.name} aria-pressed={stage === item.name} aria-label={`${label(item.name)}: ${item.count} leads, ${item.percentage.toFixed(1)} percent. View leads`} onClick={() => { setStage(item.name); setStagePage(0) }} className="relative mx-auto flex h-14 items-center justify-center gap-3 text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-400" style={{ width: `${100 - index * 7}%`, background: `linear-gradient(115deg, ${stageColor(item.name)}, ${stageColor(item.name)}dd)`, clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)' }}>
              <span className="text-xs font-semibold sm:text-sm">{label(item.name)}</span><span className="text-xl font-bold sm:text-2xl">{item.count}</span>
              <span className="hidden rounded-full bg-white/20 px-2 py-1 text-xs sm:inline">{item.percentage.toFixed(1)}%</span>
            </button>)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Across your pipeline</p>
            <p className="mt-2 text-4xl font-bold tracking-tight">{report.pipeline.reduce((total, item) => total + item.count, 0).toLocaleString('en-IN')} <span className="text-base font-normal text-slate-500">leads</span></p>
            <div className="mt-5 space-y-3">{report.pipeline.map(item => <button key={item.name} onClick={() => { setStage(item.name); setStagePage(0) }} aria-pressed={stage === item.name} className="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageColor(item.name) }} /><span className="flex-1">{label(item.name)}</span><strong>{item.count}</strong><span className="w-14 text-right text-xs text-slate-500 dark:text-slate-400">{item.percentage.toFixed(1)}%</span>
            </button>)}</div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400"><InfoHint text="Funnel shape shows stage order. Counts and percentages show the current distribution; widths do not represent conversion." /> How to read this</div>
          </div>
        </div>
        {stage && <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
          <div className="flex justify-between"><h3 className="font-medium">{label(stage)} · {stageLeads.length} leads</h3><button aria-label="Close stage leads" onClick={() => setStage('')}><X className="h-4 w-4" /></button></div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{stageLeads.slice(stagePage * 20, (stagePage + 1) * 20).map(lead => <li key={lead.id} className="break-words text-sm">{lead.name || 'Unnamed lead'}<span className="block text-xs text-slate-500 dark:text-slate-400">{lead.id}</span></li>)}</ul>
          {!stageLeads.length && <p className="mt-3 text-sm text-slate-500">No leads in this stage.</p>}
          {stageLeads.length > 20 && <div className="mt-3 flex gap-3"><button disabled={!stagePage} onClick={() => setStagePage(p => p - 1)}>Previous</button><button disabled={(stagePage + 1) * 20 >= stageLeads.length} onClick={() => setStagePage(p => p + 1)}>Next</button></div>}
        </div>}
      </section>
      <section className={panel}><h2 className="text-lg font-semibold">Yesterday’s new lead scoring</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current CRM classifications for the {report.kpis.received} leads created on {report.date}.</p>
        <div className="my-5 flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">{report.scoring.map(item => <div key={item.name} title={`${label(item.name)}: ${item.count}`} className={colors[item.name]} style={{ width: `${item.percentage}%` }} />)}</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{report.scoring.map(item => <div key={item.name}><p className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${colors[item.name]}`} />{label(item.name)}</p><p className="mt-2 text-2xl font-semibold">{item.count}<span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{item.percentage.toFixed(1)}%</span></p></div>)}</div>
      </section>
      <section className={panel}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Lead history & activity</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rows.length} matching records · Lead names and activity details · Newest first · PDF includes every matching page</p></div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Search by lead name or ID" className="w-full rounded-lg border border-slate-200 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-slate-700" placeholder="Lead name or ID" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></label>
          <select aria-label="Activity type" className="rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={type} onChange={e => { setType(e.target.value); setPage(0) }}><option value={DEFAULT_ACTIVITY_FILTER}>{activityFilterLabel(DEFAULT_ACTIVITY_FILTER)}</option><option value="">All activity types</option>{types.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></div></div>
        <ol className="mt-5 space-y-3">{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => <li key={row.id} className="relative rounded-xl border border-slate-200 border-l-4 bg-gradient-to-r from-indigo-50/60 to-white p-4 sm:p-5 dark:border-slate-700 dark:from-indigo-950/30 dark:to-slate-900" style={{ borderLeftColor: stageColor(row.updatedStage || 'NEW') }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{(row.leadName || '?').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span><div className="min-w-0"><h3 className="break-words text-base font-bold">{row.leadName || 'Unnamed lead'}</h3><p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">Lead ID: {row.leadId}</p></div></div>
            <time className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">{reportTime(row.at, report.timezone)}</time>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{label(row.type)}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(row.status) || 'Recorded'}</span></div>
          {(row.previousStage || row.updatedStage) && <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-300">{label(row.previousStage)} → {label(row.updatedStage)}</p>}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{row.message || 'No message recorded.'}</p>
          {row.nextFollowUp && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Next follow-up: {row.nextFollowUp}</p>}
        </li>)}</ol>
        {!rows.length && <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No matching activity recorded for this day.</p>}
        <div className="mt-5 flex items-center justify-between gap-3 text-sm"><span>Page {currentPage + 1} of {pages}</span><div className="flex gap-2"><button className="btn-secondary" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="btn-secondary" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      </section>
      <div className="space-y-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{report.notes.map(note => <p key={note}>{note}</p>)}</div>
    </>}
  </section>
}

import InfoHint from '../ui/InfoHint'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUp, ArrowUpRight, Flame, Thermometer, Snowflake, Activity, PenLine,
  Compass, Radar, MessagesSquare, RefreshCw, Copy, CheckCircle2, AlertCircle
} from 'lucide-react'
import SarathiMark, { ASSISTANT_NAME, ASSISTANT_TAGLINE } from '../ui/SarathiMark'
import { aiAPI, customersAPI, leadsAPI, dealsAPI } from '../../services/api'
import toast from 'react-hot-toast'

const SCORE_STYLE = {
  hot: { icon: Flame, cls: 'text-red-600 bg-red-50 dark:bg-red-900/20', bar: 'bg-red-500' },
  warm: { icon: Thermometer, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500' },
  cold: { icon: Snowflake, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500' },
}

const TABS = [
  { id: 'chat', label: `Ask ${ASSISTANT_NAME}`, hint: 'Talk through your pipeline', icon: MessagesSquare },
  { id: 'score', label: 'Lead Pulse', hint: 'Who is ready to buy', icon: Activity },
  { id: 'email', label: 'Drafts', hint: 'Emails written for each customer', icon: PenLine },
  { id: 'predict', label: 'Deal Compass', hint: 'Win odds and risks per deal', icon: Compass },
  { id: 'insights', label: 'Signals', hint: 'Patterns hiding in your CRM', icon: Radar },
]

function ChatTurn({ message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  if (isUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed text-white dark:bg-slate-100 dark:text-slate-950">
          {message.content}
        </div>
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group max-w-[88%]">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <SarathiMark className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" strokeWidth={2} />
        {ASSISTANT_NAME}
        {!message.loading && (
          <button onClick={copy} aria-label="Copy reply" className="ml-1 rounded p-0.5 text-slate-400 opacity-100 transition-opacity hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-slate-200">
            {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
      <div className="border-l-2 border-accent-400 pl-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {message.loading
          ? <span className="inline-flex items-center gap-2 py-0.5 text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />Reading your pipeline…</span>
          : <div className="whitespace-pre-wrap">{message.content}</div>}
      </div>
    </motion.div>
  )
}

function AskSarathi() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const QUICK = [
    'Which leads should I prioritize today?',
    'Write a follow-up email for my hottest lead',
    "What's blocking my pipeline?",
    'Give me 3 tips to close more deals this week',
  ]

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages((p) => [...p, { role: 'user', content: msg }, { role: 'assistant', loading: true, content: '' }])
    setLoading(true)
    try {
      const history = messages.filter((m) => !m.loading).map((m) => ({ role: m.role, content: m.content }))
      const res = await aiAPI.chat([...history, { role: 'user', content: msg }])
      const reply = res?.response || 'No response.'
      setMessages((p) => [...p.slice(0, -1), { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages((p) => [...p.slice(0, -1), { role: 'assistant', content: `Error: ${e.message}` }])
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[min(620px,calc(100vh-240px))] min-h-[380px] flex-col">
      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Good to see you</p>
            <h3 className="mt-2 text-xl font-semibold leading-snug text-slate-900 dark:text-slate-100">Where should we take the pipeline today?</h3>
            <p className="mt-1.5 text-sm text-slate-500">{ASSISTANT_NAME} reads your leads, deals and activity before answering.</p>
            <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {QUICK.map((q, i) => (
                <button key={q} onClick={() => send(q)} className="group flex w-full items-center gap-4 py-3 text-left text-sm text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                  <span className="w-5 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1">{q}</span>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <ChatTurn key={i} message={m} />)}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 pb-4 sm:px-6">
        <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-slate-400 dark:bg-slate-800/60 dark:ring-slate-700">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Ask ${ASSISTANT_NAME} about a lead, a deal, or your week…`}
            rows={2}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-400 text-slate-950 transition-opacity disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
      </div>
    </div>
  )
}

function LeadScoring() {
  const [scores, setScores] = useState([])
  const [allLeads, setAllLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loading, setLoading] = useState(false)
  const [scorePage, setScorePage] = useState(0)
  const [scoreProgress, setScoreProgress] = useState({ done: 0, total: 0 })
  const pageSize = 4
  const totalPages = Math.ceil(scores.length / pageSize)
  const visibleScores = scores.slice(scorePage * pageSize, (scorePage + 1) * pageSize)

  useEffect(() => {
    let cancelled = false
    const loadLeads = async () => {
      setLoadingLeads(true)
      try {
        const all = []
        let page = 0
        let total = 1
        while (page < total) {
          const response = await leadsAPI.getAll({ page, size: 50 })
          const rows = Array.isArray(response?.content) ? response.content : []
          all.push(...rows)
          total = Number(response?.totalPages || 1)
          page += 1
        }
        if (!cancelled) setAllLeads(all)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load leads')
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadLeads()
    return () => { cancelled = true }
  }, [])

  const run = async () => {
    if (!allLeads.length) {
      toast.error('No leads found to score')
      return
    }
    setLoading(true)
    setScores([])
    setScorePage(0)
    setScoreProgress({ done: 0, total: allLeads.length })
    try {
      const results = new Array(allLeads.length)
      const failed = []
      let cursor = 0
      let done = 0
      const concurrency = Math.min(3, allLeads.length)

      const scoreOne = async (lead, index) => {
        try {
          const response = await aiAPI.scoreLead(String(lead.id), { timeout: 20000 })
          const scoreLabel = String(response?.score || 'WARM').toLowerCase()
          results[index] = {
            id: lead.id,
            name: lead.name || lead.company || 'Lead',
            aiScore: scoreLabel === 'hot' || scoreLabel === 'warm' || scoreLabel === 'cold' ? scoreLabel : 'warm',
            confidence: Number(response?.scoreValue ?? lead.aiScoreValue ?? 50),
            reason: response?.reasoning || 'Analysis completed.',
            nextAction: response?.nextAction || 'Follow up with this lead.',
          }
        } catch (error) {
          failed.push({ lead, error })
        } finally {
          done += 1
          setScoreProgress({ done, total: allLeads.length })
          setScores(results.filter(Boolean))
        }
      }

      const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < allLeads.length) {
          const index = cursor
          cursor += 1
          await scoreOne(allLeads[index], index)
        }
      })

      await Promise.all(workers)

      if (failed.length && results.some(Boolean)) {
        toast(`${results.filter(Boolean).length} leads scored. ${failed.length} could not be scored right now.`)
      } else if (failed.length) {
        toast.error(failed[0]?.error?.message || 'Failed to score leads')
      } else {
        toast.success('Lead Pulse updated.')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
      setScoreProgress({ done: 0, total: 0 })
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">Lead Pulse<InfoHint text="Rates every lead hot, warm or cold with a suggested next step" /></h3>
        </div>
        <button onClick={run} disabled={loading || loadingLeads || !allLeads.length} className="btn-primary text-xs gap-2 disabled:opacity-60">
          <Activity className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Taking the pulse...' : scores.length ? 'Check again' : 'Check all leads'}
        </button>
      </div>
      {!scores.length && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"><Activity className="w-8 h-8 text-slate-400" /></div><p className="text-slate-500 text-sm">{loadingLeads ? 'Loading leads...' : allLeads.length ? 'Click "Check all leads" to see who is ready to buy' : 'No leads available to score'}</p></div>}
      {loading && !scores.length && <div className="flex flex-col items-center justify-center py-16"><RefreshCw className="w-8 h-8 text-brand-500 animate-spin mb-3" /><p className="text-sm text-slate-500">Analyzing leads{scoreProgress.total ? ` ${scoreProgress.done}/${scoreProgress.total}` : '...'}</p></div>}
      {loading && scores.length > 0 && <div className="text-xs text-slate-500">Scoring leads {scoreProgress.done}/{scoreProgress.total}</div>}
      {scores.length > 0 && (
        <div className="space-y-3">
          {visibleScores.map((s, i) => {
            const st = SCORE_STYLE[s.aiScore] || SCORE_STYLE.warm
            const Icon = st.icon
            return (
              <motion.div key={s.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card p-4 flex items-start gap-4">
                <div className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold flex-shrink-0 ${st.cls}`}>
                  <Icon className="w-3.5 h-3.5" /> {(s.aiScore || '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                    <span className="text-xs font-bold text-slate-500">{s.confidence}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1.5 mb-2">
                    <div className={`h-1.5 rounded-full ${st.bar}`} style={{ width: `${s.confidence}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{s.reason}</p>
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1">Next: {s.nextAction}</p>
                </div>
              </motion.div>
            )
          })}
          {totalPages > 1 && (
            <div className="glass-card p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setScorePage((prev) => Math.max(prev - 1, 0))}
                  disabled={loading || scorePage === 0}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <p className="text-xs text-slate-500">
                  Page {scorePage + 1} of {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => setScorePage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={loading || scorePage >= totalPages - 1}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LeadSelect({ value, onChange, options, loading }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Lead</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || options.length === 0}
        className="input text-sm w-full disabled:opacity-60"
      >
        <option value="">{loading ? 'Loading customers...' : 'Select a customer'}</option>
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>{o.name} - {o.company}</option>
        ))}
      </select>
    </div>
  )
}

function EmailWriter() {
  const [lead, setLead] = useState('')
  const [type, setType] = useState('follow-up')
  const [tone, setTone] = useState('professional')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [customerLeads, setCustomerLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const leadOptions = customerLeads
  const selectedLead = leadOptions.find((l) => String(l.id) === String(lead)) || null

  useEffect(() => {
    let cancelled = false
    const loadCustomers = async () => {
      setLoadingLeads(true)
      try {
        const response = await customersAPI.getOptions({ size: 50 })
        const rows = Array.isArray(response) ? response : []
        const all = rows.map((c) => ({
          id: c.id,
          name: c.name || c.company || 'Customer',
          company: c.company || c.name || 'Company',
          status: String(c.status || 'active').toLowerCase(),
          source: c.source || 'CRM',
          value: Number(c.value || 0),
        }))
        if (cancelled) return
        setCustomerLeads(all)
        setLead(all.length > 0 ? String(all[0].id) : '')
      } catch {
        if (!cancelled) {
          setCustomerLeads([])
          setLead('')
          toast.error('Failed to load customers for Drafts')
        }
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadCustomers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!lead && leadOptions.length > 0) {
      setLead(String(leadOptions[0].id))
    }
  }, [lead, leadOptions])

  const generate = async () => {
    if (!selectedLead) {
      toast.error('Select a customer first')
      return
    }
    setLoading(true)
    setResult('')
    try {
      const response = await aiAPI.generateEmail({
        leadName: selectedLead?.name,
        company: selectedLead?.company,
        emailType: type,
        tone,
        keyPoints: `Customer status: ${selectedLead?.status}; Source: ${selectedLead?.source}; Estimated value: ₹${selectedLead?.value?.toLocaleString()}`
      })
      setResult(response?.email || '')
      toast.success('Email generated.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(result)
    toast.success('Copied.')
  }

  return (
    <div className="p-6 space-y-5">
      <div><h3 className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">Drafts<InfoHint text="Writes a personalised email for any customer" /></h3></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LeadSelect value={lead} onChange={setLead} options={leadOptions} loading={loadingLeads} />
        <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Type</label><select value={type} onChange={(e) => setType(e.target.value)} className="input text-sm w-full">{['follow-up', 'introduction', 'proposal', 're-engagement', 'meeting request', 'thank you', 'closing'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tone</label><select value={tone} onChange={(e) => setTone(e.target.value)} className="input text-sm w-full">{['professional', 'friendly', 'urgent', 'formal', 'casual'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
      </div>
      <button onClick={generate} disabled={loading || loadingLeads || !selectedLead} className="btn-primary text-xs gap-2 disabled:opacity-60"><PenLine className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />{loading ? 'Drafting...' : 'Draft email'}</button>
      {result && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative"><pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 font-sans leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">{result}</pre><button onClick={copy} className="absolute top-3 right-3 btn-secondary text-xs gap-1.5 py-1"><Copy className="w-3 h-3" /> Copy</button></motion.div>}
    </div>
  )
}

function DealPredictor() {
  const [deal, setDeal] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deals, setDeals] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const dealOptions = deals
  const selectedDeal = dealOptions.find((d) => String(d.id) === String(deal)) || null

  useEffect(() => {
    let cancelled = false
    const loadDeals = async () => {
      setLoadingLeads(true)
      try {
        const response = await dealsAPI.getOptions({ size: 50 })
        const rows = Array.isArray(response) ? response : []
        const all = rows.map((d) => ({
          id: d.id,
          title: d.title || 'Deal',
          company: d.company || 'Company',
          value: Number(d.value || 0),
        }))
        if (cancelled) return
        setDeals(all)
        setDeal(all.length > 0 ? String(all[0].id) : '')
      } catch {
        if (!cancelled) {
          setDeals([])
          setDeal('')
          toast.error('Failed to load deals for Deal Compass')
        }
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadDeals()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!deal && dealOptions.length > 0) {
      setDeal(String(dealOptions[0].id))
    }
  }, [deal, dealOptions])

  const predict = async () => {
    if (!selectedDeal) {
      toast.error('Select a deal first')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await aiAPI.predictDeal(String(selectedDeal?.id || '0'))
      setResult(response)
      toast.success('Prediction ready.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div><h3 className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">Deal Compass<InfoHint text="Shows the odds of winning a deal and what could derail it" /></h3></div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Select Deal</label>
          <select
            value={deal}
            onChange={(e) => setDeal(e.target.value)}
            disabled={loadingLeads || dealOptions.length === 0}
            className="input text-sm w-full disabled:opacity-60"
          >
            <option value="">{loadingLeads ? 'Loading deals...' : 'Select a deal'}</option>
            {dealOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.title} - {o.company} (₹{o.value?.toLocaleString()})</option>
            ))}
          </select>
        </div>
        <button onClick={predict} disabled={loading || loadingLeads || !selectedDeal} className="btn-primary text-xs gap-2 disabled:opacity-60 flex-shrink-0"><Compass className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Reading the deal...' : 'Get bearing'}</button>
      </div>
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass-card p-5 text-center">
            <p className="text-xs text-slate-500 mb-1">Win Probability</p>
            <div className="text-5xl font-black mb-2" style={{ color: result.winProbability >= 70 ? '#10b981' : result.winProbability >= 40 ? '#f59e0b' : '#ef4444' }}>{result.winProbability}%</div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
              <motion.div className="h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${result.winProbability}%` }} transition={{ duration: 1, ease: 'easeOut' }} style={{ background: result.winProbability >= 70 ? '#10b981' : result.winProbability >= 40 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-card p-4"><p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Key Factors</p>{result.keyFactors?.map((s, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 mt-1">- {s}</p>)}</div>
            <div className="glass-card p-4"><p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Risks</p>{result.riskFactors?.map((r, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 mt-1">- {r}</p>)}</div>
          </div>
          <div className="glass-card p-4"><p className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">Recommendation</p><p className="text-sm text-slate-700 dark:text-slate-300">{result.recommendation}</p></div>
        </motion.div>
      )}
    </div>
  )
}

function AIInsights() {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const STYLE = {
    opportunity: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    prediction: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    insight: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
  }

  const generate = async () => {
    setLoading(true)
    setInsights([])
    try {
      const response = await aiAPI.getInsights()
      setInsights(Array.isArray(response) ? response : [])
      toast.success('Signals ready.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h3 className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">Signals<InfoHint text="Patterns and warnings spotted across your CRM data" /></h3></div>
        <button onClick={generate} disabled={loading} className="btn-primary text-xs gap-2 disabled:opacity-60"><Radar className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />{loading ? 'Scanning...' : insights.length ? 'Scan again' : 'Scan for signals'}</button>
      </div>
      {!insights.length && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"><Radar className="w-8 h-8 text-slate-400" /></div><p className="text-slate-500 text-sm">Run a scan to surface patterns in your data</p></div>}
      {loading && <div className="flex flex-col items-center justify-center py-16"><Radar className="w-8 h-8 text-slate-400 animate-pulse mb-3" /><p className="text-sm text-slate-500">Scanning your CRM...</p></div>}
      {insights.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {insights.map((a) => (
            <div key={a.id} className={`p-4 rounded-xl border ${STYLE[a.type] || STYLE.insight}`}>
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-xs mt-0.5 opacity-80">{a.body}</p>
              <p className="text-xs font-semibold mt-2">Action: {a.action}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function AIEnginePage() {
  const [activeTab, setActiveTab] = useState('chat')
  const current = TABS.find((t) => t.id === activeTab) || TABS[0]
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ink text-accent-400 dark:bg-slate-100 dark:text-slate-950">
            <SarathiMark className="h-7 w-7" strokeWidth={1.7} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{ASSISTANT_NAME}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{ASSISTANT_TAGLINE}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Ready
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={`${ASSISTANT_NAME} tools`} className="custom-scrollbar max-w-full overflow-x-auto lg:overflow-visible">
          <ul className="flex gap-1 lg:flex-col">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-start gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition-colors lg:whitespace-normal ${active ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:hover:bg-slate-900/50 dark:hover:text-slate-200'}`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${active ? 'text-slate-900 dark:text-accent-400' : ''}`} />
                    <span>
                      <span className="block text-sm font-semibold">{tab.label}</span>
                      <span className="hidden text-xs font-normal text-slate-400 lg:block">{tab.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section aria-label={current.label} className="sarathi-plain overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {activeTab === 'chat' && <AskSarathi />}
              {activeTab === 'score' && <LeadScoring />}
              {activeTab === 'email' && <EmailWriter />}
              {activeTab === 'predict' && <DealPredictor />}
              {activeTab === 'insights' && <AIInsights />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}

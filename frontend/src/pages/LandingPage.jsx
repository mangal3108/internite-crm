import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowUp, BadgeCheck, BarChart3, Bell, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, Flame, Globe, Kanban, Loader2, LogIn, Mail, MapPin, Menu, MessageCircle, Mic, MoreHorizontal, Phone, Play, Rocket, Search, Send, Share2, ShieldCheck, Star, Target, TrendingUp, Users, Video, X, Zap, Radar
} from 'lucide-react'
import SarathiMark from '../components/ui/SarathiMark'

/* ══════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════ */

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Testimonials', href: '#testimonial' },
  { label: 'Contact', href: '#contact' },
]

const quickLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Testimonials', href: '#testimonial' },
  { label: 'Contact', href: '#contact' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]

const socialLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/internite-corporation', Icon: BadgeCheck },
  { label: 'Instagram', href: 'https://www.instagram.com/internitecorporation/', Icon: Camera },
  { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61559180788863', Icon: Share2 },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: Video },
]

const featureChips = [
  { icon: Users, label: 'Lead Management' },
  { icon: SarathiMark, label: 'Sarathi' },
  { icon: Kanban, label: 'Pipeline Board' },
  { icon: MessageCircle, label: 'Communication Hub' },
  { icon: Zap, label: 'Smart Automation' },
  { icon: BarChart3, label: 'Real-time Analytics' },
  { icon: Phone, label: 'AI Calling' },
  { icon: ShieldCheck, label: 'Enterprise Security' },
]

const features = [
  { icon: Users, label: 'Lead Management', desc: 'Capture, score, and route leads automatically with AI-powered insights.' },
  { icon: SarathiMark, label: 'Sarathi', desc: 'Smart recommendations, auto-summaries, and next-best-action prompts.' },
  { icon: Kanban, label: 'Pipeline Board', desc: 'Drag-and-drop Kanban board to visualise every deal stage at a glance.' },
  { icon: MessageCircle, label: 'Communication Hub', desc: 'Unified inbox for email, WhatsApp, and call logs in one timeline.' },
  { icon: Zap, label: 'Automation', desc: 'No-code workflows that trigger tasks, emails, and follow-ups on autopilot.' },
  { icon: BarChart3, label: 'Analytics', desc: 'Real-time dashboards and conversion funnels to track what matters.' },
]

const testimonials = [
  ['ApexPrime', 'Internite CRM allowed us to reduce duplicated effort and improve forecasting accuracy by 40%.', 'Thomas John', 'CEO', 5],
  ['Global Eleva', 'Our teams got a single source of truth for every customer conversation across channels.', 'Sara Agrawal', 'VP Sales', 5],
  ['Minox', 'We implemented workflows faster and gave managers better visibility into the pipeline.', 'Oyin Robertson', 'CTO', 4],
  ['iNfoty', 'Automation helped us update high-priority accounts without manual effort or delays.', 'Ank Patel', 'Director', 5],
  ['TechVault', 'The AI engine surfaced opportunities we were missing — revenue grew 28% in Q1.', 'Maya Chen', 'Head of Growth', 5],
  ['Orbion', 'We switched from 3 tools to just Internite CRM. Everything is finally in one place.', 'Ravi Kumar', 'COO', 4],
]

const faqs = [
  ['How do I migrate to Internite CRM?', 'Our team helps import contacts, companies, deals, notes, and activities with guided onboarding — usually under 48 hours.'],
  ['Can teams customize pipelines?', 'Yes. You can create pipelines, fields, automations, and dashboards around your unique sales process.'],
  ['Does Internite CRM include AI assistance?', 'Yes. AI agents can summarize records, recommend next actions, and surface high-value opportunities automatically.'],
  ['What integrations are available?', 'We connect with email providers, WhatsApp, calendars, and popular tools through our API and native integrations.'],
  ['Is there a free trial?', 'Yes! Our Starter plan is free forever for up to 3 users. No credit card required.'],
]

const stats = [
  [27, '%', 'Increased productivity'],
  [50, '%', 'Faster implementation'],
  [71, '%', 'Saved on licensing fees'],
  [10, 'K+', 'Active users'],
]

const howItWorks = [
  { step: 1, title: 'Connect your data', desc: 'Import contacts, companies, and deals from any source in minutes.', icon: Globe },
  { step: 2, title: 'Sarathi reads the road', desc: 'Sarathi scores leads, spots patterns, and points to the next opportunity.', icon: Radar },
  { step: 3, title: 'Automate & scale', desc: 'Set up workflows, sequences, and automations — no code required.', icon: Rocket },
  { step: 4, title: 'Watch revenue grow', desc: 'Track every metric in real-time dashboards and close deals faster.', icon: TrendingUp },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    desc: 'Perfect for small teams getting started.',
    features: ['Up to 3 users', '500 contacts', 'Basic pipeline', 'Email integration', 'Community support'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '₹2,499',
    period: '/user/mo',
    desc: 'For growing teams that need more power.',
    features: ['Unlimited users', '50K contacts', 'Sarathi assistant', 'Automation workflows', 'Priority support', 'Custom fields', 'API access'],
    cta: 'Start Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For large organizations with complex needs.',
    features: ['Everything in Pro', 'Unlimited contacts', 'Dedicated CSM', 'SSO & SAML', 'Custom integrations', 'SLA guarantee', 'On-premise option'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

const avatarColors = ['from-amber-300 to-orange-400', 'from-sky-300 to-blue-500', 'from-rose-300 to-pink-500']

/* ══════════════════════════════════════════════════════════
   SMALL BUILDING BLOCKS
   ══════════════════════════════════════════════════════════ */

function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  )
}

function CountUp({ end, suffix = '', duration = 2000 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let frame
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(Math.round(end * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isInView, end, duration])

  return <span ref={ref}>{value}{suffix}</span>
}

function SectionLabel({ children }) {
  return (
    <p className="mb-4 text-center text-[13px] font-medium text-slate-500">{children}</p>
  )
}

function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"
          className="fixed bottom-5 left-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-lg transition hover:-translate-y-0.5 sm:bottom-7 sm:left-7">
          <ArrowUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════════════
   PHONE MOCKUPS
   ══════════════════════════════════════════════════════════ */

function PhoneFrame({ children, className = '' }) {
  return (
    <div className={`rounded-[2.6rem] bg-gradient-to-b from-slate-300 via-slate-100 to-slate-300 p-[3px] shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="rounded-[2.45rem] bg-slate-950 p-[7px]">
        <div className="relative h-full overflow-hidden rounded-[2.05rem] bg-white">
          <div className="absolute left-1/2 top-2.5 z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-slate-950" />
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-slate-900">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-[1.5px]">
                {[4, 6, 8, 10].map((h) => <span key={h} className="w-[2.5px] rounded-sm bg-slate-900" style={{ height: h }} />)}
              </span>
              <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-slate-900 p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-slate-900" /></span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function CenterPhoneScreen() {
  return (
    <div className="h-full">
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-sky-100 via-amber-50 to-white" />
      <div className="relative px-5 pt-8 text-center">
        <p className="text-[17px] text-slate-800">Ready to Close</p>
        <p className="text-[26px] font-semibold leading-tight text-slate-900">Today's Deals!</p>
      </div>
      <div className="relative mx-4 mt-5 flex items-center gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-400 shadow-sm">
          <Search size={14} /> Find leads, deals, tasks...
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><Mic size={14} /></span>
      </div>
      <p className="relative mx-5 mt-5 text-[13px] font-semibold text-slate-900">Sarathi Signals Today</p>
      <div className="relative mx-4 mt-3 grid grid-cols-3 gap-2">
        {[
          { icon: Flame, label: 'Hot Leads', value: '24', tone: 'from-orange-400 to-rose-500' },
          { icon: CalendarDays, label: 'Follow-ups', value: '12', tone: 'from-sky-400 to-blue-600' },
          { icon: TrendingUp, label: 'Forecast', value: '₹4.2L', tone: 'from-emerald-400 to-teal-500' },
        ].map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white p-2 text-center shadow-sm">
            <span className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}><Icon size={20} /></span>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-900">{value}</p>
            <p className="text-[9px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="relative mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-blue-500 text-[11px] font-bold text-white">AS</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-900">Ankit Sharma</p>
          <p className="text-[9px] text-slate-400">Proposal sent · 2h ago</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">Score 92</span>
      </div>
    </div>
  )
}

function LeftPhoneScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-sky-50 to-white px-4 pt-6">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft size={14} /></span>
        <p className="text-[13px] font-semibold text-slate-900">Pipeline</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"><MoreHorizontal size={14} /></span>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-800 shadow-sm"><Target size={12} className="text-sky-500" /> Qualified</span>
        <span className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-800 shadow-sm"><Kanban size={12} className="text-amber-500" /> Proposal</span>
      </div>
      <div className="mt-4 space-y-2">
        {[
          ['Riya Mehta', '₹85,000', 'bg-sky-400'],
          ['Vikram Rao', '₹1.2L', 'bg-amber-400'],
          ['Neha Kapoor', '₹64,000', 'bg-emerald-400'],
          ['Arjun Singh', '₹2.1L', 'bg-violet-400'],
        ].map(([name, amount, dot]) => (
          <div key={name} className="flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm">
            <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-800"><span className={`h-2 w-2 rounded-full ${dot}`} />{name}</span>
            <span className="text-[10px] font-bold text-slate-900">{amount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RightPhoneScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-sky-50 to-white px-4 pt-6">
      <div className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[10px] text-slate-400 shadow-sm">
        <Search size={12} /> Search leads...
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-lg bg-amber-300 px-2 py-1 text-[9px] font-bold text-slate-900">Hot</span>
        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-semibold text-slate-700 shadow-sm">New</span>
        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-semibold text-slate-700 shadow-sm">Follow-up</span>
      </div>
      <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
        <p className="text-[10px] font-semibold text-slate-900">Conversions</p>
        <div className="mt-3 flex h-20 items-end gap-1.5">
          {[38, 55, 42, 70, 58, 86, 74].map((h, i) => (
            <span key={i} className={`flex-1 rounded-t-md ${i === 5 ? 'bg-[#5AAFFF]' : 'bg-sky-100'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-500"><Bell size={12} /></span>
        <p className="text-[9px] font-semibold text-slate-700">3 leads need a call today</p>
      </div>
    </div>
  )
}

function HeroDevices() {
  return (
    <div className="relative mx-auto mt-16 h-[420px] max-w-5xl overflow-hidden sm:h-[520px]">
      {/* Soft sky arc */}
      <div className="absolute left-1/2 top-0 h-[1100px] w-[1100px] -translate-x-1/2 overflow-hidden rounded-full bg-gradient-to-b from-sky-200/70 via-sky-50 to-white">
        <img src="/hero-clouds.png" alt="" aria-hidden="true" className="absolute inset-x-0 top-0 h-[520px] w-full object-cover opacity-60 mix-blend-screen" />
      </div>

      {/* Positioning lives on the wrapper; framer-motion owns the inner transform */}
      <div className="absolute left-1/2 top-[150px] hidden w-[230px] -translate-x-[135%] sm:block">
        <motion.div initial={{ opacity: 0, y: 80, rotate: -8 }} animate={{ opacity: 1, y: 0, rotate: -6 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
          <PhoneFrame className="h-[470px]"><LeftPhoneScreen /></PhoneFrame>
        </motion.div>
      </div>

      <div className="absolute left-1/2 top-[150px] hidden w-[230px] translate-x-[35%] sm:block">
        <motion.div initial={{ opacity: 0, y: 80, rotate: 8 }} animate={{ opacity: 1, y: 0, rotate: 6 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}>
          <PhoneFrame className="h-[470px]"><RightPhoneScreen /></PhoneFrame>
        </motion.div>
      </div>

      <div className="absolute left-1/2 top-[70px] z-10 w-[280px] -translate-x-1/2">
        <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}>
          <PhoneFrame className="h-[570px]"><CenterPhoneScreen /></PhoneFrame>
        </motion.div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-white via-white/90 to-transparent" />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TESTIMONIALS
   ══════════════════════════════════════════════════════════ */

function TestimonialWall({ items }) {
  const half = Math.ceil(items.length / 2)
  const rows = [items.slice(0, half), items.slice(half)]

  return (
    <div className="landing-fade-x space-y-4 overflow-hidden">
      {rows.map((row, r) => (
        <div key={r} className={`flex w-max gap-4 ${r === 0 ? 'landing-scroll-left' : 'landing-scroll-right'}`}>
          {[...row, ...row, ...row].map(([brand, quote, person, role, rating], i) => (
            <article key={i} className="w-[320px] shrink-0 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
              <div className="mb-3 flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, s) => (
                  <Star key={s} size={13} className={s < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                ))}
              </div>
              <p className="text-sm leading-6 text-slate-600">"{quote}"</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{person[0]}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{person}</p>
                  <p className="text-[11px] text-slate-500">{role} · {brand}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CHATBOT
   ══════════════════════════════════════════════════════════ */

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I am Internite Corporation's AI assistant. Ask me about automation, marketing, recruitment, or how our team can help." },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages); setInput(''); setIsSending(true)

    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-10) }) })
      const data = await response.json()
      if (!response.ok || !data.message) throw new Error(data.error || 'The assistant could not respond.')
      setMessages((cur) => [...cur, { role: 'assistant', content: data.message }])
    } catch {
      setMessages((cur) => [...cur, { role: 'assistant', content: 'Sorry, I could not respond right now. Please try again later.' }])
    } finally { setIsSending(false) }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-4 sm:bottom-7 sm:right-7">
      <AnimatePresence>
        {isOpen && (
          <motion.section initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.25 }}
            aria-label="Sarathi chat" className="w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:w-[390px]">
            <div className="flex items-center justify-between gap-4 bg-slate-950 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#5AAFFF]"><SarathiMark size={21} /></span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white">Sarathi</h2>
                  <p className="text-xs text-white/60">Your Internite CRM guide</p>
                </div>
              </div>
              <button type="button" aria-label="Close chat" onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><X size={18} /></button>
            </div>
            <div className="flex max-h-[360px] min-h-[300px] flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${msg.role === 'user'
                    ? 'rounded-br-md bg-slate-950 text-white' : 'rounded-bl-md border border-slate-100 bg-slate-50 text-slate-700'}`}>{msg.content}</p>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" /> Thinking</span>
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
              <label className="sr-only" htmlFor="chat-msg">Message</label>
              <textarea id="chat-msg" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }}
                placeholder="Type your message..." rows={1}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
              <button type="submit" disabled={isSending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <motion.button type="button" onClick={() => setIsOpen((c) => !c)} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
        className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-slate-950 px-4 text-sm font-medium text-white shadow-[0_14px_34px_rgba(15,23,42,0.25)] transition">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#5AAFFF] transition group-hover:bg-white/20">
          <SarathiMark size={18} strokeWidth={2.1} /></span>
        <span className="hidden pr-1 sm:inline">Ask Sarathi</span>
      </motion.button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MOBILE NAV
   ══════════════════════════════════════════════════════════ */

function MobileNav({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.nav initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 250 }}
            className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 bg-white p-6 shadow-xl">
            <button onClick={onClose} aria-label="Close menu" className="mb-4 self-end text-slate-500 hover:text-slate-900"><X size={20} /></button>
            {navItems.map(({ label, href }) => (
              <a key={label} href={href} onClick={onClose}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950">{label}</a>
            ))}
            <div className="mt-6 space-y-2.5">
              <Link to="/login" onClick={onClose} className="block rounded-full border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-900 transition hover:bg-slate-50">Login</Link>
              <Link to="/register" onClick={onClose} className="block rounded-full bg-slate-950 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-800">Get Started Free</Link>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════ */

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
})

export default function LandingPage() {
  const [mobileNav, setMobileNav] = useState(false)

  return (
    <main className="landing-root bg-white text-slate-950 antialiased">

      {/* ═══ HERO ═══ */}
      <section id="home" className="relative overflow-hidden px-4 pt-5 sm:px-8">
        <div aria-hidden="true" className="landing-dot-grid absolute inset-x-0 top-0 h-[640px]" />

        {/* Navbar */}
        <motion.header initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
          className="sticky top-4 z-30 mx-auto flex max-w-[760px] items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <Link to="/" className="flex shrink-0 items-center pl-1.5" aria-label="Internite CRM home">
            <img src="/brand/internite-wordmark-light.svg" alt="Internite CRM" className="h-[18px] w-auto" />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 text-[13px] text-slate-600 lg:flex">
            {navItems.map(({ label, href }) => (
              <a key={label} href={href} className="transition hover:text-slate-950">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link to="/login" aria-label="Login" title="Login"
              className="hidden h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800 transition hover:bg-slate-200 sm:flex">
              <LogIn size={16} />
            </Link>
            <Link to="/register" aria-label="Get started" title="Get started"
              className="hidden h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800 transition hover:bg-slate-200 sm:flex">
              <Play size={14} className="fill-slate-800" />
            </Link>
            <button aria-label="Open menu" onClick={() => setMobileNav(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-900 transition hover:bg-slate-200 lg:hidden">
              <Menu size={16} />
            </button>
          </div>
        </motion.header>

        <MobileNav open={mobileNav} onClose={() => setMobileNav(false)} />

        {/* Hero copy */}
        <div className="relative mx-auto max-w-3xl pt-14 text-center sm:pt-16">
          <motion.div {...fadeUp(0.1)} className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1 shadow-sm">
            <span className="flex -space-x-1.5">
              {avatarColors.map((c, i) => (
                <span key={i} className={`h-5 w-5 rounded-full bg-gradient-to-br ${c} ring-2 ring-white`} />
              ))}
            </span>
            <span className="text-[12px] text-slate-700">Join 300K+ Businesses</span>
            <Link to="/register" className="inline-flex items-center gap-1 rounded-full bg-[#5AAFFF] px-2.5 py-0.5 text-[11px] font-medium text-white transition hover:bg-sky-500">
              Get Access <ArrowRight size={11} />
            </Link>
          </motion.div>

          <motion.h1 {...fadeUp(0.2)} className="text-[40px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[56px] lg:text-[64px]">
            The Future of Sales
            <br />
            Intelligence &amp; Automation
          </motion.h1>

          <motion.p {...fadeUp(0.35)} className="mx-auto mt-5 max-w-[520px] text-[15px] leading-6 text-slate-500">
            Manage leads, customers, and sales activity from first touch to closed deal — powered by intelligent AI automation.
          </motion.p>

          <motion.div {...fadeUp(0.5)} className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register"
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6)] transition hover:bg-slate-800">
              Get Started Free
            </Link>
            <a href="#how-it-works"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300">
              <Play size={13} className="fill-slate-900" /> Watch Demo
            </a>
          </motion.div>
        </div>

        <HeroDevices />

        {/* Feature chips */}
        <div className="relative -mt-6 pb-6">
          <SectionLabel>Our Top Notch Features</SectionLabel>
          <div className="landing-fade-x overflow-hidden">
            <div className="landing-ticker-track flex w-max gap-3 py-2">
              {[...featureChips, ...featureChips].map(({ icon: Icon, label }, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-800 shadow-sm">
                  <Icon size={14} className="text-slate-700" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATEMENT ═══ */}
      <section className="relative px-5 py-24 sm:py-28">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-sky-50 to-transparent" />
        <ScrollReveal className="relative mx-auto max-w-[760px] text-center">
          <h2 className="text-[30px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[42px]">
            Run a smarter sales team with a CRM that keeps your{' '}
            <span className="text-slate-400">leads, deals, and follow-ups simple to manage.</span>
          </h2>
        </ScrollReveal>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="px-5 pb-24 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <SectionLabel>Core Features</SectionLabel>
          <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">Supercharge your sales with AI</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-6 text-slate-500">
            Harness the power of multi-agent AI to automate your CRM, surface the best opportunities, and move every deal forward.
          </p>
        </ScrollReveal>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, label, desc }, i) => (
            <ScrollReveal key={label} delay={i * 0.06}>
              <article className="group h-full rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.18)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.25)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-[#3a9bf5] ring-1 ring-sky-100 transition group-hover:bg-slate-950 group-hover:text-[#5AAFFF]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-base font-medium text-slate-950">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="bg-slate-50/70 px-5 py-24 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">
            Up and running in <span className="text-slate-400">4 simple steps</span>
          </h2>
        </ScrollReveal>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map(({ step, title, desc, icon: Icon }, i) => (
            <ScrollReveal key={step} delay={i * 0.1}>
              <article className="h-full rounded-3xl border border-slate-200/80 bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-[#5AAFFF]"><Icon size={20} /></span>
                  <span className="text-sm font-medium text-slate-300">0{step}</span>
                </div>
                <h3 className="mt-5 text-base font-medium text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══ AUTOMATION FLOW ═══ */}
      <section className="px-5 py-24 sm:px-8">
        <ScrollReveal>
          <div className="mx-auto grid max-w-5xl items-center gap-10 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.3)] sm:p-12 md:grid-cols-2">
            <div>
              <p className="text-[13px] font-medium text-slate-500">Workflow Automation</p>
              <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-[40px]">
                Scale your sales <span className="text-slate-400">on autopilot</span>
              </h2>
              <p className="mt-4 text-[15px] leading-6 text-slate-500">
                Advanced workflows, cadences, and no-code functions to help you sell faster and scale efficiently.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Transparency', 'Territory Creation', '360° Customer View', 'Team Sync', 'Shared Pipeline'].map((item) => (
                  <span key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">{item}</span>
                ))}
              </div>
              <a href="#pricing" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-slate-950 hover:text-[#3a9bf5]">
                Explore workflow automation <ArrowRight size={15} />
              </a>
            </div>
            <div className="rounded-3xl bg-gradient-to-b from-sky-100 via-sky-50 to-white p-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                {['Lead captured', 'AI scores lead', 'Owner assigned', 'Follow-up queued', 'Deal closed'].map((step, i) => (
                  <motion.div key={step} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1 }}
                    className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i === 4 ? 'bg-[#5AAFFF] text-white' : 'bg-slate-950 text-white'}`}>
                      {i === 4 ? <Check size={14} /> : i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{step}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <ScrollReveal className="text-center">
            <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">
              Grow with <span className="text-[#3a9bf5]">Internite CRM</span>
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(([value, suffix, label], i) => (
              <ScrollReveal key={label} delay={i * 0.08}>
                <article className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-sky-50/60 p-6 text-center">
                  <strong className="block text-4xl font-medium tracking-[-0.03em] text-slate-950 sm:text-5xl">
                    <CountUp end={value} suffix={suffix} />
                  </strong>
                  <p className="mt-2 text-sm text-slate-500">{label}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="testimonial" className="overflow-hidden bg-slate-50/70 py-24">
        <ScrollReveal className="mx-auto max-w-3xl px-5 text-center">
          <SectionLabel>Testimonials</SectionLabel>
          <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">
            Loved by teams <span className="text-slate-400">everywhere</span>
          </h2>
          <p className="mt-3 text-[15px] text-slate-500">See what our customers are saying about Internite CRM</p>
        </ScrollReveal>
        <div className="mt-12">
          <TestimonialWall items={testimonials} />
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="px-5 py-24 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">Plans for every team size</h2>
          <p className="mt-4 text-[15px] leading-6 text-slate-500">Start free. Upgrade when you're ready. No credit card required.</p>
        </ScrollReveal>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-3">
          {pricingPlans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 0.1}>
              <article className={`relative flex h-full flex-col rounded-[2rem] p-7 ${plan.highlight
                ? 'bg-slate-950 text-white shadow-[0_30px_60px_-30px_rgba(15,23,42,0.6)]'
                : 'border border-slate-200/80 bg-white'}`}>
                {plan.highlight && (
                  <span className="absolute right-6 top-6 rounded-full bg-[#5AAFFF] px-3 py-1 text-[11px] font-medium text-white">Most Popular</span>
                )}
                <h3 className={`text-base font-medium ${plan.highlight ? 'text-white' : 'text-slate-950'}`}>{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-medium tracking-[-0.03em]">{plan.price}</span>
                  {plan.period && <span className={`text-sm ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{plan.period}</span>}
                </div>
                <p className={`mt-2 text-sm ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{plan.desc}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-2.5 text-sm ${plan.highlight ? 'text-slate-200' : 'text-slate-700'}`}>
                      <Check size={15} className="shrink-0 text-[#5AAFFF]" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`mt-8 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition ${plan.highlight
                    ? 'bg-white text-slate-950 hover:bg-slate-100'
                    : 'bg-slate-950 text-white hover:bg-slate-800'}`}>
                  {plan.cta} <ArrowRight size={14} />
                </Link>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <ScrollReveal className="mb-10 text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-3xl font-medium tracking-[-0.02em] sm:text-[40px]">Frequently asked questions</h2>
          </ScrollReveal>
          <div className="space-y-3">
            {faqs.map(([question, answer], i) => (
              <ScrollReveal key={question} delay={i * 0.05}>
                <details className="group rounded-2xl border border-slate-200/80 bg-white px-5 py-4 transition open:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.3)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-slate-950">
                    {question}
                    <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{answer}</p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="px-5 pb-24 sm:px-8">
        <ScrollReveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-b from-sky-100 via-sky-50 to-white px-6 py-16 text-center ring-1 ring-sky-100 sm:py-20">
            <img src="/hero-clouds.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen" />
            <div className="relative">
              <h2 className="text-4xl font-medium tracking-[-0.03em] sm:text-[52px]">Take us for a spin!</h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] text-slate-500">
                Join 300K+ businesses already using Internite CRM to close more deals and grow faster.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register" className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800">
                  Get Started Free <ArrowRight size={14} />
                </Link>
                <a href="#contact" className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 transition hover:border-slate-300">
                  <Phone size={14} /> Talk to Sales
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-950 px-5 pb-20 pt-14 text-slate-300 sm:px-8 sm:pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.35fr_0.7fr_0.95fr] lg:gap-12">
          <div id="contact" className="max-w-xl">
            <Link to="/" aria-label="Internite CRM home" className="inline-flex">
              <img src="/brand/internite-wordmark-dark.svg" alt="Internite CRM" className="h-6 w-auto" />
            </Link>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400">
              Software development, internship programs and study abroad consulting from Internite Corporation, Indore.
            </p>
            <div className="mt-6 space-y-3">
              <a href="mailto:team.internite@gmail.com" className="group flex items-center gap-3 text-sm font-medium text-slate-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#5AAFFF] transition group-hover:bg-white/10">
                  <Mail size={18} /></span>team.internite@gmail.com</a>
              <div className="flex items-start gap-3 text-sm leading-6 text-slate-400">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#5AAFFF]">
                  <MapPin size={18} /></span>
                <span>Indore, Madhya Pradesh, India</span>
              </div>
            </div>
          </div>

          <nav aria-label="Footer quick links">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Quick Links</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              {quickLinks.map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith('/') ? (
                    <Link to={href} className="transition hover:text-white">{label}</Link>
                  ) : (
                    <a href={href} className="transition hover:text-white">{label}</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">Follow Us</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              Connect with us on our social media platforms for the latest updates in AI and automation.
            </p>
            <div className="mt-5 grid max-w-sm grid-cols-1 gap-2.5 sm:grid-cols-2">
              {socialLinks.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white">
                  <Icon size={17} /> {label}</a>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>&copy; 2026 <a href="https://www.internite.online" target="_blank" rel="noreferrer" className="font-medium transition hover:text-white">Internite Corporation</a> All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="transition hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </footer>

      <Chatbot />
      <BackToTop />

      <style>{`
        .landing-root { font-family: 'Inter', 'Roboto', system-ui, sans-serif; }

        .landing-dot-grid {
          background-image: radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px);
          background-size: 14px 14px;
          -webkit-mask-image: radial-gradient(ellipse at 50% 30%, #000 30%, transparent 70%);
                  mask-image: radial-gradient(ellipse at 50% 30%, #000 30%, transparent 70%);
        }

        .landing-fade-x {
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
                  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
        }

        @keyframes landingTickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .landing-ticker-track { animation: landingTickerScroll 32s linear infinite; }
        .landing-ticker-track:hover { animation-play-state: paused; }

        @keyframes landingScrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
        @keyframes landingScrollRight { 0% { transform: translateX(-33.33%); } 100% { transform: translateX(0); } }
        .landing-scroll-left { animation: landingScrollLeft 45s linear infinite; }
        .landing-scroll-right { animation: landingScrollRight 45s linear infinite; }
        .landing-scroll-left:hover, .landing-scroll-right:hover { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .landing-ticker-track, .landing-scroll-left, .landing-scroll-right { animation: none !important; }
        }
      `}</style>
    </main>
  )
}

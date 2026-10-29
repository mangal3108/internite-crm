import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldAlert, ArrowLeft, Mail, Users, Zap, CheckCircle2 } from 'lucide-react'
import SarathiMark from '../components/ui/SarathiMark'

/* ── Floating particles (matches login page) ── */
function RegisterParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      size: 3 + (i % 3) * 2,
      left: `${(i * 7.69) % 100}%`,
      top: `${(i * 8.33 + 5) % 100}%`,
      delay: `${(i * 1.1) % 5}s`,
      duration: `${10 + (i % 4) * 3}s`,
    })), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span key={p.id} className="absolute rounded-full register-particle"
          style={{ width: p.size, height: p.size, left: p.left, top: p.top,
            background: p.id % 2 === 0 ? 'rgba(127,108,228,0.25)' : 'rgba(212,240,107,0.25)',
            animationDelay: p.delay, animationDuration: p.duration }} />
      ))}
    </div>
  )
}

const highlights = [
  { icon: SarathiMark, text: 'Sarathi lead scoring & pipeline guidance' },
  { icon: Zap, text: 'No-code automation workflows' },
  { icon: Users, text: 'Team collaboration & shared pipelines' },
  { icon: Mail, text: 'Unified communication hub' },
]

export default function RegisterPage() {
  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-brand-50 px-4 py-0 text-slate-900 font-sans antialiased sm:px-6">
      {/* Aurora background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="reactbits-aurora absolute inset-0 opacity-50" />
        <div className="reactbits-aurora__band reactbits-aurora__band--one absolute inset-0 opacity-40" />
        <RegisterParticles />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_54px_rgba(127,108,228,0.12)] md:max-h-[min(520px,90vh)] md:grid-cols-[1.05fr_0.95fr]"
      >
        {/* Left — branding & highlights */}
        <div className="relative hidden flex-col justify-center overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-6 text-white sm:p-8 md:flex">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.77, 0, 0.175, 1] }}
            className="absolute inset-0 z-10 origin-right bg-brand-600"
          />

          {/* Decorative circles */}
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute right-8 bottom-8 h-32 w-32 rounded-full bg-white/5" aria-hidden="true" />

          <div className="relative z-20">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
              <Link to="/" className="inline-flex items-center gap-2 mb-5">
                <img src="/brand/internite-wordmark-dark.svg" alt="Internite CRM" className="h-7 w-auto object-contain" />
              </Link>
            </motion.div>

            <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xl font-bold leading-tight sm:text-2xl">
              The smarter way to manage your sales pipeline
            </motion.h2>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-5 space-y-3">
              {highlights.map(({ icon: Icon, text }, i) => (
                <motion.div key={text} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                  className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                    <Icon size={14} />
                  </span>
                  <span className="text-sm font-medium text-white/90">{text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
              className="mt-5 text-xs text-white/60">
              Trusted by 300K+ businesses worldwide
            </motion.p>
          </div>
        </div>

        {/* Right — request access */}
        <div className="flex flex-col justify-center px-7 py-6 sm:px-10 lg:px-12">
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600">
              <ShieldAlert className="w-3.5 h-3.5" />
              Invitation Only
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Request Access
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-2 text-sm leading-6 text-slate-500">
            This workspace is invite-based, so registration is handled by your admin team.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600 mb-3">What to do next</p>
            <div className="space-y-2.5">
              {[
                'Ask your workspace admin to invite your email address.',
                'Use the login screen once your account is provisioned.',
                'Contact support if your invite hasn\'t arrived.',
              ].map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />
                  <span className="text-sm leading-5 text-slate-600">{step}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/login"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-400 px-6 text-sm font-bold text-slate-950 shadow-[0_14px_28px_rgba(127,108,228,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-500">
              <ArrowLeft size={15} />
              Back to sign in
            </Link>
            <a href="mailto:team.internite@gmail.com"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-600">
              <Mail size={15} />
              Contact support
            </a>
          </motion.div>
        </div>
      </motion.section>

      <style>{`
        @keyframes registerFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
          25%      { transform: translate(10px, -15px) scale(1.2); opacity: 0.35; }
          50%      { transform: translate(-6px, -25px) scale(0.9); opacity: 0.2; }
          75%      { transform: translate(12px, -10px) scale(1.1); opacity: 0.3; }
        }
        .register-particle { animation: registerFloat 12s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .register-particle { animation: none !important; } }
      `}</style>
    </main>
  )
}

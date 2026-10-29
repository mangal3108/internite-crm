import { useState, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

/* ── Floating particles (Spline-inspired) ── */
function LoginParticles() {
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
        <span
          key={p.id}
          className="absolute rounded-full login-particle"
          style={{
            width: p.size, height: p.size,
            left: p.left, top: p.top,
            background: p.id % 2 === 0 ? 'rgba(127,108,228,0.25)' : 'rgba(212,240,107,0.25)',
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  )
}

/* ── Magnetic effect on button ── */
function MagneticSubmit({ children, ...props }) {
  const ref = useRef(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleMouse = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setOffset({ x: (e.clientX - cx) * 0.15, y: (e.clientY - cy) * 0.15 })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 250, damping: 18, mass: 0.4 }}
    >
      <button {...props}>{children}</button>
    </motion.div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, setPersistenceMode } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.login({ email, password })
      const user = data?.user ?? null
      const accessToken = data?.accessToken ?? data?.token ?? null
      const refreshToken = data?.refreshToken ?? null

      if (!user || !accessToken) {
        throw new Error('Login succeeded but the session payload was incomplete.')
      }

      if (user.role === 'PLATFORM_ADMIN') {
        throw new Error('Platform Admins must use the Platform Admin login page.')
      }

      setPersistenceMode(rememberMe ? 'local' : 'session')
      login(user, accessToken, refreshToken)
      toast.success(`Welcome back, ${user?.name ?? 'User'}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.message || 'Login failed. Check backend connection and credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-brand-50 px-4 py-0 text-slate-900 font-sans antialiased sm:px-6">
      {/* Animated aurora background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="reactbits-aurora absolute inset-0 opacity-50" />
        <div className="reactbits-aurora__band reactbits-aurora__band--one absolute inset-0 opacity-40" />
        <LoginParticles />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_54px_rgba(127,108,228,0.12)] md:max-h-[min(520px,90vh)] md:grid-cols-[1.05fr_0.95fr]"
      >
        {/* Left — illustration top + glassmorphism card bottom */}
        <div className="relative hidden overflow-hidden bg-white md:flex md:h-full flex-col">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.77, 0, 0.175, 1] }}
            className="absolute inset-0 z-30 origin-right bg-white"
          />

          {/* Illustration — takes top 58% */}
          <div className="relative flex-[1_1_58%] flex items-center justify-center overflow-hidden">
            <motion.img
              src="/login-crm-illustration.png"
              alt="CRM support and communication illustration"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full w-full object-contain object-center p-4"
            />
          </div>

          {/* Glassmorphism card — bottom */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="relative z-20 mx-4 mb-4 shrink-0 rounded-2xl border border-brand-100/60 p-4"
            style={{ background: 'rgba(240,249,255,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(127,108,228,0.08), inset 0 1px 0 rgba(255,255,255,0.8)' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <img src="/brand/internite-wordmark-light.svg" alt="Internite CRM" className="h-4 w-auto object-contain" />
            </div>
            <p className="text-sm font-bold text-slate-800 leading-snug">
              Your sales, support &amp; success — all in one place
            </p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              AI-powered CRM that helps modern teams close deals faster and delight customers.
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-brand-500">Trusted by 300K+ businesses worldwide</p>
          </motion.div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col justify-center px-7 py-6 sm:px-10 lg:px-12">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link
              to="/"
              className="mb-5 inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-900 transition hover:text-brand-600"
              aria-label="Go to Internite CRM home"
            >
              <img src="/brand/internite-wordmark-light.svg" alt="Internite CRM" className="h-6 w-auto object-contain" />
            </Link>
          </motion.div>

          <div className="w-full max-w-sm">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              Welcome back
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-2 text-sm leading-6 text-slate-500"
            >
              Enter your details to access your CRM workspace.
            </motion.p>

            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-5 space-y-3.5"
            >
              {/* Email */}
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</span>
                <motion.span
                  animate={focusedField === 'email' ? {
                    borderColor: 'rgba(127,108,228,0.5)',
                    boxShadow: '0 0 0 4px rgba(127,108,228,0.08), 0 0 20px rgba(127,108,228,0.06)',
                  } : {
                    borderColor: 'rgba(226,232,240,1)',
                    boxShadow: '0 0 0 0 transparent',
                  }}
                  className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-slate-500 transition"
                >
                  <Mail size={17} className={focusedField === 'email' ? 'text-brand-500' : ''} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </motion.span>
              </label>

              {/* Password */}
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Password</span>
                <motion.span
                  animate={focusedField === 'password' ? {
                    borderColor: 'rgba(127,108,228,0.5)',
                    boxShadow: '0 0 0 4px rgba(127,108,228,0.08), 0 0 20px rgba(127,108,228,0.06)',
                  } : {
                    borderColor: 'rgba(226,232,240,1)',
                    boxShadow: '0 0 0 0 transparent',
                  }}
                  className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-slate-500 transition"
                >
                  <Lock size={17} className={focusedField === 'password' ? 'text-brand-500' : ''} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </motion.span>
              </label>

              {/* Remember me + forgot */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-brand-500 focus:ring-brand-500/30"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => toast('Password resets are handled by your admin or identity provider.')}
                  className="text-brand-500 hover:text-brand-600 font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit with magnetic effect */}
              <MagneticSubmit
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-accent-400 text-sm font-bold text-slate-950 shadow-[0_14px_28px_rgba(127,108,228,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:opacity-70 disabled:hover:translate-y-0"
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="login"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      Login <ArrowRight size={15} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </MagneticSubmit>
            </motion.form>

            {/* Footer links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 space-y-1 text-center text-xs text-slate-500"
            >
              <p>
                Need access?{' '}
                <Link to="/register" className="text-brand-500 hover:text-brand-600 font-semibold">Request an invite</Link>
              </p>
              <p>
                Platform Admin?{' '}
                <Link to="/platform/login" className="text-brand-500 hover:text-brand-600 font-semibold">Sign in here</Link>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Login page particles animation */}
      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
          25%      { transform: translate(10px, -15px) scale(1.2); opacity: 0.35; }
          50%      { transform: translate(-6px, -25px) scale(0.9); opacity: 0.2; }
          75%      { transform: translate(12px, -10px) scale(1.1); opacity: 0.3; }
        }
        .login-particle {
          animation: loginFloat 12s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-particle { animation: none !important; }
        }
      `}</style>
    </main>
  )
}

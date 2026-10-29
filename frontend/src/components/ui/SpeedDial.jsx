/**
 * MUI-inspired SpeedDial / FAB component
 * Floating action button with expandable quick-action menu
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'

export default function SpeedDial({ actions = [], icon, position = 'bottom-right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const positionClass = {
    'bottom-right': 'fixed bottom-20 right-5 z-50',
    'bottom-left': 'fixed bottom-20 left-5 z-50',
    'bottom-center': 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
  }

  return (
    <div ref={ref} className={`nexa-speed-dial ${positionClass[position] || positionClass['bottom-right']}`}>
      {/* Action items */}
      <AnimatePresence>
        {open && (
          <div className="flex flex-col-reverse items-center gap-3 mb-3">
            {actions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.3, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.3, y: 20 }}
                transition={{ duration: 0.15, delay: i * 0.04 }}
                className="nexa-speed-dial__item flex items-center gap-2"
              >
                {/* Label */}
                <span className="nexa-speed-dial__label px-2.5 py-1 rounded-lg bg-slate-800 dark:bg-slate-200 text-[11px] font-medium text-white dark:text-slate-900 shadow-lg whitespace-nowrap">
                  {action.label}
                </span>
                {/* Mini FAB */}
                <button
                  type="button"
                  onClick={() => { setOpen(false); action.onClick?.() }}
                  className={`nexa-speed-dial__mini w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95
                    ${action.color || 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  title={action.label}
                  aria-label={action.label}
                >
                  {action.icon}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ duration: 0.2 }}
        className="nexa-speed-dial__main w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-slate-950 transition-all hover:shadow-2xl active:scale-95"
        style={{
          background: '#d4f06b', color: '#0b0b0c',
          boxShadow: open
            ? '0 8px 30px rgba(147,176,31,0.45), 0 4px 12px rgba(0,0,0,0.1)'
            : '0 6px 20px rgba(147,176,31,0.35), 0 3px 8px rgba(0,0,0,0.08)',
        }}
        aria-label={open ? 'Close actions' : 'Quick actions'}
        aria-expanded={open}
      >
        {icon || <Plus className="w-6 h-6" />}
      </motion.button>
    </div>
  )
}

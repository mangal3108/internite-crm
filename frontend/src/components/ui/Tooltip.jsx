/**
 * MUI-inspired Tooltip component
 * Hover info for icons, buttons, and labels.
 * Renders in a portal with fixed positioning so it is never clipped by
 * scrolling panels or modals, and flips to the opposite side near viewport edges.
 */
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

const GAP = 8
const EDGE = 8

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

const initial = {
  top: { opacity: 0, y: 4, scale: 0.97 },
  bottom: { opacity: 0, y: -4, scale: 0.97 },
  left: { opacity: 0, x: 4, scale: 0.97 },
  right: { opacity: 0, x: -4, scale: 0.97 },
}

function computePosition(anchor, tip, preferred) {
  const fits = {
    top: anchor.top - tip.height - GAP >= EDGE,
    bottom: anchor.bottom + tip.height + GAP <= window.innerHeight - EDGE,
    left: anchor.left - tip.width - GAP >= EDGE,
    right: anchor.right + tip.width + GAP <= window.innerWidth - EDGE,
  }
  const side = fits[preferred] || !fits[OPPOSITE[preferred]] ? preferred : OPPOSITE[preferred]

  let top
  let left
  if (side === 'top' || side === 'bottom') {
    top = side === 'top' ? anchor.top - tip.height - GAP : anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - tip.width / 2
  } else {
    top = anchor.top + anchor.height / 2 - tip.height / 2
    left = side === 'left' ? anchor.left - tip.width - GAP : anchor.right + GAP
  }

  left = Math.min(Math.max(left, EDGE), window.innerWidth - tip.width - EDGE)
  top = Math.min(Math.max(top, EDGE), window.innerHeight - tip.height - EDGE)
  return { top, left, side }
}

export default function Tooltip({ children, title, placement = 'top', arrow = true, delay = 300, className = '', block = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const timerRef = useRef(null)
  const anchorRef = useRef(null)
  const tipRef = useRef(null)

  const handleEnter = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(true), delay)
  }
  const handleLeave = () => {
    clearTimeout(timerRef.current)
    setOpen(false)
    setPos(null)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return undefined
    const update = () => {
      if (!anchorRef.current || !tipRef.current) return
      setPos(computePosition(anchorRef.current.getBoundingClientRect(), tipRef.current.getBoundingClientRect(), placement))
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, placement, title])

  if (!title) return children

  const side = pos?.side || placement
  const arrowStyle = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-950 dark:border-t-slate-100 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-950 dark:border-b-slate-100 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-950 dark:border-l-slate-100 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-950 dark:border-r-slate-100 border-y-transparent border-l-transparent',
  }[side]

  return (
    <span
      ref={anchorRef}
      className={`relative ${block ? 'flex' : 'inline-flex'} ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.span
              ref={tipRef}
              role="tooltip"
              initial={initial[side]}
              animate={{ opacity: pos ? 1 : 0, y: 0, x: 0, scale: 1 }}
              exit={initial[side]}
              transition={{ duration: 0.12 }}
              className="pointer-events-none fixed z-[10000]"
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            >
              <span className="block w-max max-w-[260px] rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-medium leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-950">
                {title}
              </span>
              {arrow && <span className={`absolute border-4 ${arrowStyle}`} />}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  )
}

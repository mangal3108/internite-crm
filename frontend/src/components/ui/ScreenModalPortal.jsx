import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

let activeScrollLocks = 0
let previousBodyOverflow = ''

export default function ScreenModalPortal({ children, lockScroll = true }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (lockScroll) {
      if (activeScrollLocks === 0) {
        previousBodyOverflow = document.body.style.overflow
      }
      activeScrollLocks += 1
      document.body.style.overflow = 'hidden'
    }

    return () => {
      if (!lockScroll) return
      activeScrollLocks = Math.max(0, activeScrollLocks - 1)
      if (activeScrollLocks === 0) {
        document.body.style.overflow = previousBodyOverflow
      }
    }
  }, [lockScroll])

  if (!mounted) return null

  return createPortal(children, document.body)
}

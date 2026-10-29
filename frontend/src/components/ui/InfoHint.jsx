/**
 * Small ⓘ icon that reveals helper copy on hover/focus.
 * Use it instead of a visible subtitle line to keep cards and modals uncluttered.
 */
import { Info } from 'lucide-react'
import Tooltip from './Tooltip'

export default function InfoHint({ text, placement = 'top', className = '' }) {
  if (!text) return null
  return (
    <Tooltip title={text} placement={placement} delay={120}>
      <span
        tabIndex={0}
        aria-label={text}
        className={`inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-slate-200 ${className}`}
      >
        <Info className="h-3.5 w-3.5" />
      </span>
    </Tooltip>
  )
}

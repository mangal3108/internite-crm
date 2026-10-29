import { Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CopyableContact({
  value,
  label = 'value',
  icon: Icon,
  className = '',
  textClassName = '',
}) {
  if (!value || value === '—') {
    return <span className={className}>{value || '—'}</span>
  }

  const copyValue = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(String(value))
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  return (
    <span className={`group/copy inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      <span className={`min-w-0 truncate ${textClassName}`}>{value}</span>
      <button
        type="button"
        onClick={copyValue}
        className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 group-hover/copy:opacity-100"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  )
}

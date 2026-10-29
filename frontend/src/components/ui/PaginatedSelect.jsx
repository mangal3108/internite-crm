import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'

const DEFAULT_PAGE_SIZE = 8

export default function PaginatedSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  emptyLabel = 'No options found',
  pageSize = DEFAULT_PAGE_SIZE,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const rootRef = useRef(null)

  const normalizedOptions = useMemo(() => (
    options
      .filter(Boolean)
      .map((option) => ({
        value: String(option.value ?? ''),
        label: String(option.label ?? option.value ?? ''),
        meta: option.meta ? String(option.meta) : '',
      }))
  ), [options])

  const selected = normalizedOptions.find((option) => option.value === String(value ?? ''))

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return normalizedOptions
    return normalizedOptions.filter((option) =>
      `${option.label} ${option.meta}`.toLowerCase().includes(needle)
    )
  }, [normalizedOptions, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const boundedPage = Math.min(page, totalPages - 1)
  const visibleOptions = filtered.slice(
    boundedPage * pageSize,
    boundedPage * pageSize + pageSize
  )

  useEffect(() => {
    setPage(0)
  }, [query, options])

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const choose = (nextValue) => {
    onChange?.(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={`relative ${open ? 'z-50' : ''} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="input flex min-h-[2.05rem] items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`truncate ${selected ? '' : 'text-slate-500 dark:text-slate-400'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/12 dark:border-slate-700 dark:bg-slate-950">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input h-8 pl-8 text-xs"
                placeholder={searchPlaceholder}
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[18rem] overflow-hidden py-1">
            {visibleOptions.length ? (
              visibleOptions.map((option) => {
                const active = option.value === String(value ?? '')
                return (
                  <button
                    key={`${option.value}-${option.label}`}
                    type="button"
                    onClick={() => choose(option.value)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/70'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.meta ? <span className="block truncate text-[10px] text-slate-400">{option.meta}</span> : null}
                    </span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-5 text-center text-xs text-slate-400">{emptyLabel}</div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              {filtered.length ? `${boundedPage * pageSize + 1}-${Math.min(filtered.length, (boundedPage + 1) * pageSize)} of ${filtered.length}` : '0 results'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={boundedPage <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-slate-800"
                aria-label="Previous options page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-8 text-center">{boundedPage + 1}/{totalPages}</span>
              <button
                type="button"
                disabled={boundedPage >= totalPages - 1}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-slate-800"
                aria-label="Next options page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

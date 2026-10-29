/**
 * MUI-inspired Rating component
 * Star rating display and interactive input
 */
import { useState } from 'react'
import { Star } from 'lucide-react'

export default function Rating({
  value = 0,
  max = 5,
  precision = 1,
  size = 'md',
  readOnly = false,
  onChange,
  showLabel = false,
  className = '',
}) {
  const [hover, setHover] = useState(-1)

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  }

  const displayValue = hover >= 0 ? hover : value

  const handleClick = (starValue) => {
    if (readOnly) return
    onChange?.(starValue)
  }

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const filled = displayValue >= starValue
        const halfFilled = precision === 0.5 && displayValue >= starValue - 0.5 && displayValue < starValue

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => !readOnly && setHover(starValue)}
            onMouseLeave={() => !readOnly && setHover(-1)}
            className={`p-0 transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
          >
            <Star
              className={`${sizes[size]} transition-colors ${
                filled
                  ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                  : halfFilled
                    ? 'text-amber-400 fill-amber-400/50'
                    : 'text-slate-300 dark:text-slate-600'
              }`}
            />
          </button>
        )
      })}
      {showLabel && (
        <span className="ml-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400">
          {value.toFixed(precision === 0.5 ? 1 : 0)}
        </span>
      )}
    </div>
  )
}

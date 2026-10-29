/**
 * MUI-inspired AvatarGroup component
 * Overlapping avatar stack with overflow count
 */

const GRADIENTS = [
  'from-brand-400 to-brand-700',
  'from-brand-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-orange-400 to-rose-500',
  'from-violet-400 to-purple-500',
  'from-amber-400 to-orange-500',
]

function Avatar({ name, src, size = 'md', gradient, showStatus, status = 'online' }) {
  const sizes = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-base',
  }
  const statusSizes = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-[1.5px]',
    lg: 'w-3 h-3 border-2',
    xl: 'w-3.5 h-3.5 border-2',
  }
  const statusColors = {
    online: 'bg-emerald-400',
    offline: 'bg-slate-300 dark:bg-slate-600',
    busy: 'bg-rose-400',
    away: 'bg-amber-400',
  }

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizes[size]} rounded-full bg-gradient-to-br ${gradient || GRADIENTS[0]} flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-slate-900 overflow-hidden`}
      >
        {src ? (
          <img src={src} alt={name || ''} className="w-full h-full object-cover" />
        ) : (
          (name || '?').charAt(0).toUpperCase()
        )}
      </div>
      {showStatus && (
        <span className={`absolute -bottom-0.5 -right-0.5 ${statusSizes[size]} rounded-full ${statusColors[status]} border-white dark:border-slate-900 shadow-sm`} />
      )}
    </div>
  )
}

export default function AvatarGroup({
  users = [],
  max = 4,
  size = 'md',
  showStatus = false,
  className = '',
}) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  const spacings = {
    xs: '-space-x-2',
    sm: '-space-x-2.5',
    md: '-space-x-3',
    lg: '-space-x-3.5',
    xl: '-space-x-4',
  }

  const overflowSizes = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-7 h-7 text-[9px]',
    md: 'w-8 h-8 text-[10px]',
    lg: 'w-10 h-10 text-xs',
    xl: 'w-12 h-12 text-sm',
  }

  return (
    <div className={`flex items-center ${spacings[size]} ${className}`}>
      {visible.map((user, i) => (
        <Avatar
          key={user.id || i}
          name={user.name}
          src={user.avatarUrl || user.src}
          size={size}
          gradient={GRADIENTS[i % GRADIENTS.length]}
          showStatus={showStatus}
          status={user.status === 'active' || user.status === 'online' ? 'online' : 'offline'}
        />
      ))}
      {overflow > 0 && (
        <div
          className={`${overflowSizes[size]} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

export { Avatar }

export default function DashboardIcon({
  icon: Icon,
  color = 'from-brand-500 to-brand-700',
  glow = 'rgba(127,108,228,0.28)',
  className = '',
  iconClassName = 'h-4 w-4',
}) {
  return (
    <div
      className={`dashboard-card-icon bg-gradient-to-br ${color} ${className}`}
      style={{ '--dashboard-icon-glow': glow }}
    >
      <Icon className={`relative z-10 text-white ${iconClassName}`} />
    </div>
  )
}

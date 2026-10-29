// Sarathi — the CRM's assistant ("charioteer" in Sanskrit: the one who steers).
// The mark is a chariot wheel with a single forward-pointing spoke, drawn to sit
// alongside lucide icons (24px grid, currentColor stroke, accepts className/size).
export const ASSISTANT_NAME = 'Sarathi'
export const ASSISTANT_TAGLINE = 'Steers you to the next right move, using your own CRM data'

export default function SarathiMark({ className = 'w-5 h-5', size, strokeWidth = 1.8, ...rest }) {
  const dims = size ? { width: size, height: size } : {}
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...dims}
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 3v6.8M12 14.2V21M3 12h6.8M14.2 12H21" opacity="0.45" />
      <path d="M13.6 10.4 18.4 5.6" />
      <path d="M15.2 5.4h3.4v3.4" />
    </svg>
  )
}

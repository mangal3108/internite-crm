export default function GradientText({ children, className = '' }) {
  return (
    <span className={`reactbits-gradient-text ${className}`}>
      {children}
    </span>
  )
}

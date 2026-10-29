import GradientText from '../reactbits/GradientText'

export default function PageHeading({ title, subtitle, icon = null }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2.5">
        {icon ? (
          <div className="w-9 h-9 rounded-full bg-accent-400 flex items-center justify-center text-slate-950">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-xl font-medium tracking-tight leading-tight">
            <GradientText>{title}</GradientText>
          </h1>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}

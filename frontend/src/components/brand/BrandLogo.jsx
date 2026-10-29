const LOGO_ICON_SRC = '/brand/internite-icon.svg'
const LOGO_WORDMARK_DARK_SRC = '/brand/internite-wordmark-dark.svg'
const LOGO_WORDMARK_LIGHT_SRC = '/brand/internite-wordmark-light.svg'
const BRAND_NAME = 'Internite CRM'

const WORDMARK_HEIGHT = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-8',
}

const ICON_SIZE = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
}

export default function BrandLogo({
  variant = 'wordmark',
  size = 'md',
  tone = 'auto',
  className = '',
  imageClassName = '',
}) {
  if (variant === 'icon') {
    return (
      <img
        src={LOGO_ICON_SRC}
        alt={BRAND_NAME}
        className={`${ICON_SIZE[size] ?? ICON_SIZE.md} object-contain ${className}`}
      />
    )
  }

  const baseImageClass = `${WORDMARK_HEIGHT[size] ?? WORDMARK_HEIGHT.md} w-auto max-w-full object-contain object-left ${imageClassName}`

  if (tone === 'light') {
    return (
      <div className={`flex min-w-0 items-center ${className}`}>
        <img
          src={LOGO_WORDMARK_LIGHT_SRC}
          alt={BRAND_NAME}
          className={baseImageClass}
        />
      </div>
    )
  }

  if (tone === 'dark') {
    return (
      <div className={`flex min-w-0 items-center ${className}`}>
        <img
          src={LOGO_WORDMARK_DARK_SRC}
          alt={BRAND_NAME}
          className={baseImageClass}
        />
      </div>
    )
  }

  return (
    <div className={`flex min-w-0 items-center ${className}`}>
      <img
        src={LOGO_WORDMARK_LIGHT_SRC}
        alt={BRAND_NAME}
        className={`${baseImageClass} dark:hidden`}
      />
      <img
        src={LOGO_WORDMARK_DARK_SRC}
        alt={BRAND_NAME}
        className={`${baseImageClass} hidden dark:block`}
      />
    </div>
  )
}

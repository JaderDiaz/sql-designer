/** Props del icono de la aplicación. */
export interface AppIconProps {
  /** Lado en píxeles; la Bienvenida lo dibuja a 96. */
  size?: number
  /** Texto accesible; sin él, el icono queda oculto para el lector. */
  label?: string
}

/**
 * Icono de SQL Designer, tal como lo dibuja el lienzo de diseño: cuadrado
 * redondeado con degradado y una «D» recortada sobre filas de datos.
 *
 * Va en línea para que no haya ningún archivo que pedir al arrancar.
 */
export function AppIcon({ size = 96, label }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.22)) drop-shadow(0 1px 2px rgba(0,0,0,0.12))',
      }}
    >
      <defs>
        <linearGradient id="sqld-app-icon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3c" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <clipPath id="sqld-app-icon-d">
          <path d="M14 9.5 H26 A22.5 22.5 0 0 1 26 54.5 H14 A4 4 0 0 1 10 50.5 V13.5 A4 4 0 0 1 14 9.5 Z" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#sqld-app-icon)" />
      <rect
        x="0.5"
        y="0.5"
        width="95"
        height="95"
        rx="21.5"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
      />
      <g transform="translate(18.75 16)">
        <g clipPath="url(#sqld-app-icon-d)">
          <rect x="10" y="9.5" width="42" height="7" fill="#7d7bff" />
          <rect x="10" y="19" width="7" height="7" fill="#ffffff" />
          <rect x="19.5" y="19" width="32" height="7" fill="#ffffff" />
          <rect x="10" y="28.5" width="7" height="7" fill="#ffffff" />
          <rect x="19.5" y="28.5" width="32" height="7" fill="#ffffff" />
          <rect x="10" y="38" width="7" height="7" fill="#ffffff" />
          <rect x="19.5" y="38" width="32" height="7" fill="#ffffff" />
          <rect x="10" y="47.5" width="7" height="7" fill="#ffffff" />
          <rect x="19.5" y="47.5" width="32" height="7" fill="#ffffff" />
        </g>
      </g>
    </svg>
  )
}

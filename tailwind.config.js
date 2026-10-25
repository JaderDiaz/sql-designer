/**
 * Tailwind no define valores propios: cada escala apunta a un token de
 * `src/styles/tokens.css` (los del sistema Aura), para que claro y oscuro
 * salgan del mismo nombre de clase (principio V de la constitución).
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        window: 'var(--bg-window)',
        sidebar: 'var(--bg-sidebar)',
        raised: 'var(--bg-raised)',
        control: 'var(--bg-control)',
        field: 'var(--bg-field)',
        inset: 'var(--bg-inset)',
        'fill-hover': 'var(--fill-hover)',
        'fill-pressed': 'var(--fill-pressed)',
        'fill-selected': 'var(--fill-selected)',
        scrim: 'var(--scrim)',
        separator: 'var(--separator)',
        'border-subtle': 'var(--border-subtle)',
        'border-control': 'var(--border-control)',
        label: 'var(--label)',
        'label-secondary': 'var(--label-secondary)',
        'label-tertiary': 'var(--label-tertiary)',
        link: 'var(--link)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-pressed': 'var(--accent-pressed)',
        'accent-soft': 'var(--accent-soft)',
        'on-accent': 'var(--on-accent)',
        'focus-ring': 'var(--focus-ring)',
        blue: 'var(--blue)',
        indigo: 'var(--indigo)',
        orange: 'var(--orange)',
        red: 'var(--red)',
        'danger-solid': 'var(--danger-solid)',
        'danger-text': 'var(--danger-text)',
        'danger-soft': 'var(--danger-soft)',
        'on-danger': 'var(--on-danger)',
        'warning-text': 'var(--warning-text)',
        'warning-soft': 'var(--warning-soft)',
        'traffic-close': 'var(--traffic-close)',
        'traffic-minimize': 'var(--traffic-minimize)',
        'traffic-zoom': 'var(--traffic-zoom)',
        'traffic-inactive': 'var(--traffic-inactive)',
      },
      boxShadow: {
        control: 'var(--shadow-control)',
        accent: 'var(--shadow-accent)',
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        popover: 'var(--shadow-popover)',
        window: 'var(--shadow-window)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--easing-standard)',
        out: 'var(--easing-out)',
        spring: 'var(--easing-spring)',
        'spring-soft': 'var(--easing-spring-soft)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

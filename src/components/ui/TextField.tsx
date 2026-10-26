import { useId, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/** Props del campo de texto; lo que no se declara son atributos nativos. */
export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** Etiqueta visible encima del campo. */
  label?: string
  value: string
  onValueChange: (value: string) => void
  /** Segunda línea que explica el campo. */
  hint?: string
  /** Mensaje de error; sustituye a la pista y pinta el campo en rojo. */
  error?: string | null
  className?: string
}

/**
 * Campo de texto del sistema Aura.
 *
 * El error se anuncia con `role="alert"` y se enlaza al campo con
 * `aria-describedby`, de modo que el lector de pantalla lo lee al aparecer y
 * al volver al campo (principio V).
 */
export function TextField({
  label,
  value,
  onValueChange,
  hint,
  error,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error ?? hint

  return (
    <div className={cn('au-field', error ? 'is-error' : null, className)}>
      {label ? (
        <label className="au-field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <span className="au-input-wrap">
        <input
          {...rest}
          id={id}
          className="au-input"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </span>
      {message ? (
        <span id={messageId} className="au-field-hint" role={error ? 'alert' : undefined}>
          {message}
        </span>
      ) : null}
    </div>
  )
}

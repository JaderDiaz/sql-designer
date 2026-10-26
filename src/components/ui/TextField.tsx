import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Props del campo de texto; lo que no se declara son atributos nativos. */
export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  /** Etiqueta visible encima del campo. */
  label?: string
  value: string
  onValueChange: (value: string) => void
  /** Segunda línea que explica el campo. */
  hint?: string
  /** Mensaje de error; sustituye a la pista y pinta el campo en rojo. */
  error?: string | null
  /** Contenido fijo a la derecha del campo, como la extensión de un archivo. */
  trailing?: ReactNode
  /** Contenido a la derecha del mensaje, como la acción que lo resuelve. */
  messageTrailing?: ReactNode
  /** Clases del propio campo, por ejemplo para su tipografía. */
  inputClassName?: string
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
  trailing,
  messageTrailing,
  inputClassName,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error ?? hint

  const field = (
    <span className={cn('au-input-wrap', trailing ? 'min-w-0 flex-1' : null)}>
      <input
        {...rest}
        id={id}
        className={cn('au-input', inputClassName)}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </span>
  )

  const text = message ? (
    <span id={messageId} className="au-field-hint" role={error ? 'alert' : undefined}>
      {message}
    </span>
  ) : null

  return (
    <div className={cn('au-field', error ? 'is-error' : null, className)}>
      {label ? (
        <label className="au-field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {trailing ? (
        <span className="flex min-w-0 items-center gap-1.5">
          {field}
          {trailing}
        </span>
      ) : (
        field
      )}
      {messageTrailing ? (
        <span className="au-field-foot">
          {text}
          {messageTrailing}
        </span>
      ) : (
        text
      )}
    </div>
  )
}

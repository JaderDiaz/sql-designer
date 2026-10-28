import { useId, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/** Props del área de texto; lo que no se declara son atributos nativos. */
export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  /** Etiqueta visible encima del campo. */
  label?: string
  value: string
  onValueChange: (value: string) => void
  /** Segunda línea que explica el campo. */
  hint?: string
  /** Mensaje de error; sustituye a la pista y pinta el campo en rojo. */
  error?: string | null
  /** Tope de caracteres; con él se muestra la cuenta. */
  maxLength?: number
  /** Filas visibles; el área no cambia de alto al escribir. */
  rows?: number
  className?: string
}

/**
 * Área de texto de varias líneas del sistema Aura, con cuenta de caracteres.
 *
 * Es la hermana de `TextField` para los textos largos: la descripción de una
 * tabla, que tiene tope de 280 caracteres y donde ver cuánto queda importa
 * (FR-043). La cuenta se anuncia con `aria-live="polite"` para que el lector
 * de pantalla la diga sin interrumpir lo que se escribe, y el error con
 * `role="alert"`, igual que en `TextField` (principio V).
 */
export function TextArea({
  label,
  value,
  onValueChange,
  hint,
  error,
  maxLength,
  rows = 3,
  className,
  ...rest
}: TextAreaProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error ?? hint
  const showsCount = maxLength !== undefined

  return (
    <div className={cn('au-field', error ? 'is-error' : null, className)}>
      {label ? (
        <label className="au-field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <span className="au-input-wrap">
        <textarea
          {...rest}
          id={id}
          rows={rows}
          maxLength={maxLength}
          className="au-input au-textarea"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </span>
      {message || showsCount ? (
        <span className="au-field-foot">
          {message ? (
            <span id={messageId} className="au-field-hint" role={error ? 'alert' : undefined}>
              {message}
            </span>
          ) : (
            <span />
          )}
          {showsCount ? (
            <span className="au-field-count" aria-live="polite">
              {value.length}/{maxLength}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

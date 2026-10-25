import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Compone clases de Tailwind resolviendo las que se contradicen.
 *
 * @param values Clases condicionales, como las acepta clsx.
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values))
}

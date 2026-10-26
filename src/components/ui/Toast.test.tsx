import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NOTICE_MS, Toast, noticeIcon } from '@/components/ui/Toast'

describe('aviso flotante (RS-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('se va solo y no tapa la pantalla mientras dura', () => {
    const onDismiss = vi.fn()
    render(<Toast title="Guardado" onDismiss={onDismiss} />)

    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(NOTICE_MS)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('un aviso nuevo reinicia el reloj', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(
      <Toast title="Deshecho: renombrar el modelo" onDismiss={onDismiss} />,
    )

    act(() => {
      vi.advanceTimersByTime(NOTICE_MS - 200)
    })
    rerender(<Toast title="Rehecho: renombrar el modelo" onDismiss={onDismiss} />)
    act(() => {
      vi.advanceTimersByTime(NOTICE_MS - 200)
    })

    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('el icono sale de lo que dice el aviso', () => {
    expect(noticeIcon('Deshecho: renombrar el modelo')).toBe('history')
    expect(noticeIcon('Rehecho: renombrar el modelo')).toBe('history')
    expect(noticeIcon('No se pudo guardar: sin permiso')).toBe('info')
    expect(noticeIcon('Guardado')).toBe('circle-check')
  })
})

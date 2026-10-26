import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DARK_QUERY, useTheme } from '@/hooks/useTheme'
import { setMediaQuery } from '@/test/setup'
import { resetStore } from '@/test/helpers'
import { useAppStore } from '@/store'

describe('useTheme', () => {
  beforeEach(() => {
    resetStore()
  })

  it('con «sistema» sigue al tema del sistema operativo', () => {
    setMediaQuery(DARK_QUERY, true)

    const { result } = renderHook(() => useTheme())

    expect(result.current).toBe('dark')
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  it('con «sistema» reacciona cuando el sistema cambia', () => {
    setMediaQuery(DARK_QUERY, false)
    const { result } = renderHook(() => useTheme())
    expect(result.current).toBe('light')

    act(() => setMediaQuery(DARK_QUERY, true))

    expect(result.current).toBe('dark')
  })

  it('con «claro» u «oscuro» ignora al sistema', () => {
    resetStore({ preferences: { theme: 'light' } })
    setMediaQuery(DARK_QUERY, true)

    const { result } = renderHook(() => useTheme())

    expect(result.current).toBe('light')

    act(() => {
      useAppStore.setState({
        preferences: { ...useAppStore.getState().preferences, theme: 'dark' },
        effectiveTheme: 'dark',
      })
    })

    expect(result.current).toBe('dark')
  })
})

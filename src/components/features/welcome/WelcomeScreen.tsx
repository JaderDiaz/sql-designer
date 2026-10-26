import { motion } from 'framer-motion'
import { useEffect } from 'react'

import { RecentsList, recentsCountLabel } from '@/components/features/welcome/RecentsList'
import { ShowWelcomeToggle } from '@/components/features/welcome/ShowWelcomeToggle'
import { WelcomeActions } from '@/components/features/welcome/WelcomeActions'
import { AppIcon } from '@/components/ui/AppIcon'
import { Button } from '@/components/ui/Button'
import { riseIn, screenIn, slideInLeft } from '@/lib/motion'
import { useAppStore } from '@/store'

/**
 * Pantalla de Bienvenida, que es la ventana entera (820 × 500 en el lienzo):
 * barra lateral con la identidad y las acciones, y panel de recientes a la
 * derecha (FR-001 a FR-005, FR-020).
 *
 * Entra escalonada: primero la barra lateral, luego la identidad, las filas
 * de acción y el panel derecho, para que la ventana no aparezca de golpe.
 *
 * Las zonas vacías de la barra lateral y de la cabecera arrastran la ventana.
 *
 * La lista de recientes se lee al montar y se revalida después del primer
 * fotograma, para que la ventana aparezca con la lista ya pintada y lo que
 * haya cambiado en el disco se corrija sin bloquearla (FR-042).
 */
export function WelcomeScreen() {
  const identity = useAppStore((state) => state.identity)
  const platform = useAppStore((state) => state.platform)
  const loadError = useAppStore((state) => state.loadError)
  const openPreferences = useAppStore((state) => state.openPreferences)
  const requestIntent = useAppStore((state) => state.requestIntent)
  const recents = useAppStore((state) => state.recents)
  const recentSelection = useAppStore((state) => state.recentSelection)
  const refreshRecents = useAppStore((state) => state.refreshRecents)
  const revalidateStale = useAppStore((state) => state.revalidateStale)
  const openRecent = useAppStore((state) => state.openRecent)

  useEffect(() => {
    let frame = 0
    void refreshRecents().then(() => {
      frame = requestAnimationFrame(() => void revalidateStale())
    })
    return () => cancelAnimationFrame(frame)
  }, [refreshRecents, revalidateStale])

  return (
    <motion.section
      key="welcome"
      aria-label="Bienvenido a SQL Designer"
      variants={screenIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex h-full min-h-0 w-full bg-window"
    >
      <motion.aside
        data-tauri-drag-region
        variants={slideInLeft}
        className="relative m-2 flex w-[300px] flex-none flex-col rounded-md bg-sidebar px-4 pb-5 shadow-[0_0_0_0.5px_var(--separator)]"
      >
        <motion.div
          data-tauri-drag-region
          variants={riseIn}
          className="flex flex-col items-center pt-16"
        >
          <AppIcon size={96} label="Icono de SQL Designer" />
          <h1 className="mt-5 text-[26px] font-semibold leading-8 tracking-[-0.01em] text-label">
            {identity?.name ?? 'SQL Designer'}
          </h1>
          <p className="mt-1 flex items-baseline gap-1 text-[12px] leading-4 text-label-secondary [font-variant-numeric:tabular-nums]">
            <span className="font-medium">Versión {identity?.version ?? '1.0.0'}</span>
            <span className="text-[10px] leading-[13px]">({identity?.buildDate ?? ''})</span>
          </p>
        </motion.div>

        <WelcomeActions
          platform={platform}
          onNewModel={() => requestIntent('new-model')}
          onOpenModel={() => requestIntent('open-model')}
          onOpenPreferences={openPreferences}
        />
      </motion.aside>

      <motion.div data-tauri-drag-region variants={riseIn} className="flex min-w-0 flex-1 flex-col">
        <div
          data-tauri-drag-region
          className="flex h-[44px] items-center justify-between pl-[22px] pr-5 pt-2"
        >
          <h2 className="text-[11px] font-semibold leading-[14px] tracking-[0.01em] text-label-secondary">
            Recientes
          </h2>
          <span className="text-[11px] leading-[14px] text-label-secondary [font-variant-numeric:tabular-nums]">
            {recentsCountLabel(recents.length)}
          </span>
        </div>

        {loadError ? (
          <p
            role="alert"
            className="mx-3 rounded-md bg-warning-soft px-2.5 py-2 text-[12px] leading-4 text-warning-text"
          >
            {loadError}
          </p>
        ) : null}

        <RecentsList />

        <div className="mx-3 flex h-[52px] flex-none items-center justify-between gap-3 border-t-[0.5px] border-separator px-2.5">
          <ShowWelcomeToggle />
          <Button
            variant="primary"
            disabled={recentSelection === null}
            onClick={() => {
              if (recentSelection !== null) void openRecent(recentSelection)
            }}
          >
            Abrir
          </Button>
        </div>
      </motion.div>
    </motion.section>
  )
}

import type { ReactNode } from 'react'
import { domAnimation, LazyMotion } from 'motion/react'
import { ToastProvider } from './components/ui/Toaster'
import { I18nProvider } from './i18n'
import { LoadoutProvider } from './lib/loadout'
import { MotionPrefProvider } from './lib/motionPref'
import { RegistryProvider } from './lib/registry'
import { ThemeProvider } from './lib/theme'

/**
 * Provider order: language → theme → motion (MotionConfig reducedMotion) → LazyMotion
 * (domAnimation, strict: use `m.*`, never `motion.*`) → catalog data → loadout → toasts.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <MotionPrefProvider>
          <LazyMotion features={domAnimation} strict>
            <RegistryProvider>
              <LoadoutProvider>
                <ToastProvider>{children}</ToastProvider>
              </LoadoutProvider>
            </RegistryProvider>
          </LazyMotion>
        </MotionPrefProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}

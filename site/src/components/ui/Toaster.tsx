// Site toasts: small, mono, bottom-right, like the client's own toasts (a wink, not a gimmick).
// Announced politely to screen readers. useToast().show('Copied').
import { AnimatePresence, m } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { exit, spring } from '../../lib/motion'
import './ui.css'

type Toast = { id: number; text: string }
type ToastApi = { show: (text: string, ms?: number) => void }

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const show = useCallback((text: string, ms = 2200) => {
    const id = ++seq.current
    setToasts((list) => [...list.slice(-2), { id, text }])
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ms)
  }, [])

  const api = useMemo(() => ({ show }), [show])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="site-toasts" role="status" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              className="site-toast"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: spring.snappy }}
              exit={{ opacity: 0, transition: exit }}
            >
              {t.text}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast() needs <ToastProvider>')
  return ctx
}

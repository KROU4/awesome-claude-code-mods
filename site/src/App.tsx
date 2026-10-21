// App shell: header, the one page (hero → catalog → how it works → submit), footer,
// the loadout bar and the detail sheet for #/mod/<name>. Routing: lib/router.ts.
import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import LoadoutBar from './components/loadout/LoadoutBar'
import { useT } from './i18n'
import { useMotionPref } from './lib/motionPref'
import { back, useRoute } from './lib/router'
import Catalog from './sections/Catalog'
import Hero from './sections/Hero'
import HowItWorks from './sections/HowItWorks'

const Submit = lazy(() => import('./sections/Submit'))
const DetailSheet = lazy(() => import('./components/detail/DetailSheet'))

/** Section ids the routes scroll to. */
const SECTION_FOR_ROUTE: Partial<Record<string, string>> = {
  catalog: 'catalog',
  how: 'how',
  submit: 'submit',
}

export default function App() {
  const { t } = useT()
  const route = useRoute()
  const { still } = useMotionPref()
  const stillRef = useRef(still)
  // Runs before the scroll effect below (effects run in order), so it reads the current value.
  useEffect(() => {
    stillRef.current = still
  }, [still])
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  // #/catalog, #/how, #/submit scroll to their section (instantly on first load). Only a
  // navigation runs this: `route` keeps its identity across re-renders (a language or motion
  // switch must not throw the reader back to the section), and a click on the current section's
  // link is a new navigation with the same name.
  useEffect(() => {
    const id = SECTION_FOR_ROUTE[route.name]
    const instant = first.current || stillRef.current
    first.current = false
    if (!id) return
    const el = document.getElementById(id)
    if (!el) {
      // lazy section not mounted yet: try again on the next frame
      const raf = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
      return () => cancelAnimationFrame(raf)
    }
    el.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' })
  }, [route])

  const closeSheet = useCallback(() => back(), [])

  return (
    <>
      <a
        className="skip-link"
        href="#/"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        {t('common.skip')}
      </a>
      <Header />
      <main id="main" ref={main} tabIndex={-1}>
        <Hero id="top" />
        <Catalog id="catalog" />
        <HowItWorks id="how" />
        <Suspense fallback={<div className="lazy-placeholder" aria-hidden="true" />}>
          <Submit id="submit" />
        </Suspense>
      </main>
      <Footer />
      <LoadoutBar />
      {route.name === 'mod' ? (
        <Suspense fallback={null}>
          <DetailSheet key={route.mod} name={route.mod} onClose={closeSheet} />
        </Suspense>
      ) : null}
    </>
  )
}

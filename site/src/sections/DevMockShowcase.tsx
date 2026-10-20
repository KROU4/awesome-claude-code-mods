// TEMPORARY dev section: the terminal mock with each mod's preview, one at a time, plus
// all of them as compact card mocks. The Hero agent replaces it (remove it from App.tsx).
import { useMemo, useState } from 'react'
import { MockClient, type PreviewInput } from '../components/mock'
import { useT } from '../i18n'
import { useRegistry } from '../lib/registry'
import './sections.css'

const LOADOUT = ['turn-meter', 'git-glance', 'tool-timeline', 'spinner-pack']
const ALL = '__all__'

export default function DevMockShowcase() {
  const { t, pick } = useT()
  const { registry } = useRegistry()
  const mods = registry.mods
  const [current, setCurrent] = useState<string>(mods[0]?.name ?? ALL)

  const previews = useMemo<PreviewInput[]>(() => {
    const pickMods = current === ALL ? mods.filter((m) => LOADOUT.includes(m.name)) : mods.filter((m) => m.name === current)
    return pickMods.map((m) => ({ ...m.preview, id: m.name, label: m.title }))
  }, [mods, current])

  const cards = useMemo(() => mods.map((m) => ({ mod: m, previews: [{ ...m.preview, id: m.name, label: m.title }] as PreviewInput[] })), [mods])
  const mod = mods.find((m) => m.name === current)

  return (
    <section className="wrap section dev-mock" aria-labelledby="dev-mock-title">
      <div className="section-head">
        <h2 id="dev-mock-title">{t('hero.dev.title')}</h2>
        <p>{t('hero.dev.lead')}</p>
      </div>
      <div className="dev-picker" role="group" aria-label={t('hero.dev.pick')}>
        {mods.map((m) => (
          <button key={m.name} type="button" aria-pressed={current === m.name} onClick={() => setCurrent(m.name)}>
            {m.title}
          </button>
        ))}
        <button type="button" aria-pressed={current === ALL} onClick={() => setCurrent(ALL)}>
          {t('hero.dev.all')}
        </button>
      </div>
      <MockClient key={current} previews={previews} scene={current === ALL ? 'coding' : undefined} />
      {mod ? <p className="dev-caption">{pick(mod.preview.caption ?? '', mod.preview.caption_ru)}</p> : null}

      <h3 className="dev-sub">{t('hero.dev.compact')}</h3>
      <ul className="dev-cards">
        {cards.map(({ mod: m, previews: p }) => (
          <li key={m.name} className="dev-card">
            <MockClient previews={p} compact />
            <p className="dev-card-title">{m.title}</p>
            <p className="dev-card-tag">{pick(m.tagline, m.tagline_ru)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

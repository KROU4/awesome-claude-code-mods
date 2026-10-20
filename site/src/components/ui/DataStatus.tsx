// "live from GitHub · updated 3 min ago" / "copy on this site · updated 2 days ago".
import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { useRegistry } from '../../lib/registry'
import './ui.css'

export default function DataStatus({ className }: { className?: string }) {
  const { t, relative } = useT()
  const { source, updatedAt, loading, ready, error } = useRegistry()
  // re-render once a minute so "3 min ago" stays true
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const where = !ready
    ? error
      ? t('common.data.failed')
      : t('common.data.loading')
    : source === 'live'
      ? t('common.data.live')
      : loading
        ? t('common.data.checking')
        : t('common.data.snapshot')
  return (
    <span
      className={['data-status', className].filter(Boolean).join(' ')}
      data-source={ready ? source : 'none'}
      title={ready && source === 'snapshot' && !loading ? t('common.data.snapshotTitle') : undefined}
    >
      <span className="data-status-dot" aria-hidden="true" />
      {where}
      {ready && updatedAt ? ` · ${t('common.data.updated', { when: relative(updatedAt) })}` : null}
    </span>
  )
}

// Placeholder frame for surfaces whose renderer is not built yet (desktop, VS Code).
import type { CSSProperties } from 'react'
import { useT } from '../../i18n'
import type { MockSurface, SurfaceProps } from './types'

export default function ComingFrame({
  surface,
  rows,
  onSurfaceChange,
}: Pick<SurfaceProps, 'rows' | 'onSurfaceChange'> & { surface: Exclude<MockSurface, 'terminal'> }) {
  const { t } = useT()
  return (
    <div className="mc-coming" style={{ ['--rows' as string]: rows } as CSSProperties} data-surface={surface}>
      <div className="mc-coming-inner">
        <p className="mc-coming-title">{t(surface === 'desktop' ? 'mock.coming.desktop.title' : 'mock.coming.vscode.title')}</p>
        <p className="mc-coming-body">{t('mock.coming.body')}</p>
        {onSurfaceChange ? (
          <button type="button" className="mc-btn" onClick={() => onSurfaceChange('terminal')}>
            {t('mock.coming.toTerminal')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// Icons drawn inside the desktop and VS Code mocks: the same 20×20 grid, 1.6 stroke and
// round caps as components/ui/icons.tsx, so the mock and the site share one icon voice.
// Always decorative (aria-hidden); no product logos.
import type { ReactNode, SVGProps } from 'react'

export type MockIconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function Svg({ size = '1em', children, ...rest }: MockIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="nv-icon"
      {...rest}
    >
      {children}
    </svg>
  )
}

const icon = (paths: ReactNode) => (p: MockIconProps) => <Svg {...p}>{paths}</Svg>

export const IPlus = icon(<path d="M10 4.5v11M4.5 10h11" />)
export const IChevronDown = icon(<path d="m6 8 4 4 4-4" />)
export const IChevronRight = icon(<path d="m8 6 4 4-4 4" />)
export const IClose = icon(<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />)
export const IMore = icon(
  <>
    <circle cx="10" cy="4.8" r=".6" fill="currentColor" />
    <circle cx="10" cy="10" r=".6" fill="currentColor" />
    <circle cx="10" cy="15.2" r=".6" fill="currentColor" />
  </>,
)
export const IMoreH = icon(
  <>
    <circle cx="4.8" cy="10" r=".6" fill="currentColor" />
    <circle cx="10" cy="10" r=".6" fill="currentColor" />
    <circle cx="15.2" cy="10" r=".6" fill="currentColor" />
  </>,
)
export const IArrowUp = icon(<path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />)
export const IStop = (p: MockIconProps) => (
  <Svg {...p}>
    <rect x="6" y="6" width="8" height="8" rx="1.4" fill="currentColor" stroke="none" />
  </Svg>
)
export const IFolder = icon(<path d="M2.8 5.6a1.6 1.6 0 0 1 1.6-1.6h3.3l1.7 1.9h6.2a1.6 1.6 0 0 1 1.6 1.6v6.9a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6Z" />)
export const ILaptop = icon(
  <>
    <rect x="4" y="4.5" width="12" height="8.4" rx="1.4" />
    <path d="M2.5 15.5h15" />
  </>,
)
export const IShield = icon(<path d="M10 2.8 4.2 5v4.6c0 3.6 2.4 6.2 5.8 7.6 3.4-1.4 5.8-4 5.8-7.6V5Z" />)
export const ITerminal = icon(
  <>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <path d="M6 8l2.5 2L6 12M10.5 12.5H14" />
  </>,
)
export const IDiff = icon(<path d="M6 3.5v7M2.5 7h7M10.5 16.5h7M14 3.5l-3.5 3.5L14 10.5" />)
export const IGlobe = icon(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M2.8 10h14.4M10 2.8c2 2 3 4.4 3 7.2s-1 5.2-3 7.2c-2-2-3-4.4-3-7.2s1-5.2 3-7.2Z" />
  </>,
)
export const IFile = icon(
  <>
    <path d="M5.2 2.8h6.2l3.4 3.4v10a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1v-12.4a1 1 0 0 1 1-1Z" />
    <path d="M11.2 2.8v3.6h3.6" />
  </>,
)
export const IPencil = icon(<path d="M12.6 3.9a1.9 1.9 0 0 1 2.7 2.7L7 14.9l-3.5.9.9-3.5ZM11.3 5.2l2.7 2.7" />)
export const ISearch = icon(
  <>
    <circle cx="8.6" cy="8.6" r="5.1" />
    <path d="m12.4 12.4 4.1 4.1" />
  </>,
)
export const IPlug = icon(<path d="M7 2.8v3.6M13 2.8v3.6M5 6.4h10v2.8a5 5 0 0 1-10 0ZM10 14.2v3" />)
export const ICheck = icon(<path d="m4.8 10.4 3.3 3.2 7.1-7.2" />)
export const IAlert = icon(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 6.2v4.6M10 13.6v.2" />
  </>,
)
export const IBlock = icon(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="m4.9 15.1 10.2-10.2" />
  </>,
)
export const IInfo = icon(
  <>
    <circle cx="10" cy="10" r="7.2" />
    <path d="M10 9v4.8M10 6.2v.2" />
  </>,
)
export const ISliders = icon(<path d="M4 6h8M15 6h1M4 14h2M9 14h7M12 4v4M6 12v4" />)
export const IGrip = icon(
  <>
    <circle cx="7.5" cy="6" r=".5" fill="currentColor" />
    <circle cx="12.5" cy="6" r=".5" fill="currentColor" />
    <circle cx="7.5" cy="10" r=".5" fill="currentColor" />
    <circle cx="12.5" cy="10" r=".5" fill="currentColor" />
    <circle cx="7.5" cy="14" r=".5" fill="currentColor" />
    <circle cx="12.5" cy="14" r=".5" fill="currentColor" />
  </>,
)
export const ISidebar = icon(
  <>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <path d="M7.5 3.5v13" />
  </>,
)
export const IBranch = icon(
  <>
    <circle cx="6" cy="4.8" r="1.7" />
    <circle cx="6" cy="15.2" r="1.7" />
    <circle cx="14" cy="6.8" r="1.7" />
    <path d="M6 6.5v7M14 8.5c0 3.2-3.6 3.2-7.4 5.2" />
  </>,
)
export const ISync = icon(<path d="M15.6 8.2A5.8 5.8 0 0 0 5 6.4M4.4 11.8a5.8 5.8 0 0 0 10.6 1.8M5 3.6v2.8h2.8M15 16.4v-2.8h-2.8" />)
export const IFiles = icon(
  <>
    <path d="M7.4 2.8h5.2l3 3v8.4a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z" />
    <path d="M12.4 2.8v3.2h3.2M4 6v10.2a1 1 0 0 0 1 1h7" />
  </>,
)
export const IDebug = icon(<path d="M6.5 4.2v11.6a.6.6 0 0 0 .9.5l8.9-5.8a.6.6 0 0 0 0-1L7.4 3.7a.6.6 0 0 0-.9.5Z" />)
export const IExtensions = icon(
  <>
    <rect x="3" y="8.6" width="4.2" height="4.2" rx=".6" />
    <rect x="3" y="12.8" width="4.2" height="4.2" rx=".6" />
    <rect x="7.2" y="12.8" width="4.2" height="4.2" rx=".6" />
    <rect x="11.6" y="3.2" width="4.2" height="4.2" rx=".6" transform="rotate(12 13.7 5.3)" />
  </>,
)
export const IAccount = icon(
  <>
    <circle cx="10" cy="7.2" r="3.2" />
    <path d="M3.8 17c.8-3 3.3-4.8 6.2-4.8s5.4 1.8 6.2 4.8" />
  </>,
)
export const IGear = icon(
  <>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3 4.9 4.9" />
  </>,
)
export const IBell = icon(<path d="M5.2 13.6V9a4.8 4.8 0 0 1 9.6 0v4.6l1.4 1.6H3.8ZM8.4 17.2a1.7 1.7 0 0 0 3.2 0" />)
export const IHistory = icon(
  <>
    <path d="M3.8 8.2A6.4 6.4 0 1 1 4.6 13" />
    <path d="M3.4 3.9v4.3h4.3M10 6.6V10l2.4 1.6" />
  </>,
)
export const INewChat = icon(
  <>
    <path d="M9 3.6H5a1.6 1.6 0 0 0-1.6 1.6v9.8A1.6 1.6 0 0 0 5 16.6h9.8a1.6 1.6 0 0 0 1.6-1.6v-4" />
    <path d="M14.2 3.2a1.6 1.6 0 0 1 2.3 2.3L10.4 11.6l-2.9.6.6-2.9Z" />
  </>,
)
export const IPaperclip = icon(<path d="m15.6 9.6-5.7 5.7a3.6 3.6 0 0 1-5.1-5.1l6-6a2.4 2.4 0 0 1 3.4 3.4l-5.9 5.9a1.2 1.2 0 0 1-1.7-1.7l5.3-5.3" />)
export const IAt = icon(
  <>
    <circle cx="10" cy="10" r="2.8" />
    <path d="M12.8 10v1.2a2.2 2.2 0 0 0 4.4 0V10a7.2 7.2 0 1 0-2.8 5.7" />
  </>,
)
export const IEye = icon(
  <>
    <path d="M2.6 10S5.3 4.8 10 4.8s7.4 5.2 7.4 5.2-2.7 5.2-7.4 5.2S2.6 10 2.6 10Z" />
    <circle cx="10" cy="10" r="2.2" />
  </>,
)
export const IFastForward = icon(<path d="M3.6 5.6 9 10l-5.4 4.4ZM10.4 5.6 15.8 10l-5.4 4.4Z" />)
export const IBroadcast = icon(
  <>
    <circle cx="10" cy="10" r="1.5" />
    <path d="M6.6 6.6a4.8 4.8 0 0 0 0 6.8M13.4 6.6a4.8 4.8 0 0 1 0 6.8M4.2 4.2a8.2 8.2 0 0 0 0 11.6M15.8 4.2a8.2 8.2 0 0 1 0 11.6" />
  </>,
)

/** The small usage ring next to the model chip (a fraction of the plan's window used). */
export function UsageRing({ value = 0.38, size = '1.15em' }: { value?: number; size?: string }) {
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="nv-icon nv-ring">
      <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2.4} />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        transform="rotate(-90 10 10)"
      />
    </svg>
  )
}

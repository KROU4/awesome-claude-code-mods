// An error boundary: when its children throw while rendering, it shows `fallback` instead, so
// one bad piece (a mock fed with an entry from a newer registry than this build understands, a
// half-typed draft) never takes the whole page down. A new `resetKey` tries the children again.
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  fallback: ReactNode
  /** When it changes, the children are rendered again (the draft changed, another mod opened). */
  resetKey?: string
  children: ReactNode
}

type State = { failed: boolean; key: string | undefined }

export default class Boundary extends Component<Props, State> {
  override state: State = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[showroom] a part of the page failed to render', error, info.componentStack)
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

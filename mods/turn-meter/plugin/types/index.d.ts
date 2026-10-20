export type Turn = { ms: number; tools: number; tokens: number | null }

declare module 'claude-code' {
  interface PluginState {
    'turn-meter': { turns: Turn[]; isHidden: boolean }
  }
}

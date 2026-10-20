/** The live context window's fill, as the last measurement reported it. */
export type Reading = { tokens: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'context-gauge': { reading: Reading | null }
  }
}

/** How many tool calls secret-guard refused this session. */
export type SecretGuardBlocked = number

declare module 'claude-code' {
  interface PluginState {
    'secret-guard': { blocked: number }
  }
}

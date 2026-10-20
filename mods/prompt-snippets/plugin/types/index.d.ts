// The last prompt the person sent this session; null until they send one.
export type LastPrompt = string | null

declare module 'claude-code' {
  interface PluginState {
    'prompt-snippets': { typed: LastPrompt }
  }
}

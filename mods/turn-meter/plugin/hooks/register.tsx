import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Turn } from '../types'

const BARS = '▁▂▃▄▅▆▇█'
const KEEP = 12
const BAR_COLOR = 0x5f9ea0
const SLOW_COLOR = 0xe0783f
const TERMINAL_DEFAULT = 0x01000000

const turns = atom({ plugin: 'turn-meter', key: 'turns' } as const, [])
const isHidden = atom({ plugin: 'turn-meter', key: 'isHidden' } as const, false)

export const register: Register = (on, options) => {
  const seconds = options.slowTurnSeconds
  const slowMs = (typeof seconds === 'number' ? seconds : 120) * 1000
  const isSlow = (turn: Turn) => slowMs > 0 && turn.ms > slowMs

  let startedAt: number | undefined
  let tools = 0
  let isRunning = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'turn-meter',
      description: 'Show the turn meter band above the prompt',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'turn-meter' }, async $ => {
    await update($, isHidden, () => false)

    return { text: 'Turn meter shown above the prompt.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // A prompt typed over a running turn (turnId) or raised during one (another plugin's) joins
    // that turn; one submitted while idle starts the clock.
    if (e.turnId === undefined && !isRunning) {
      startedAt = await $.clock.now()
      tools = 0
    }

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) isRunning = true

    return next(e)
  })

  on('tool.call', ($, e, next) => {
    if (e.agentId === undefined) tools += 1

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    // No prompt.submit seen (a queued prompt, a reload mid-turn): the engine's own duration.
    const ms = startedAt === undefined ? e.durationMs : (await $.clock.now()) - startedAt
    const usage = e.usage
    const turn: Turn = {
      ms,
      tools,
      tokens: usage ? usage.input_tokens + usage.cache_creation_input_tokens + usage.output_tokens : null,
    }
    startedAt = undefined
    tools = 0
    isRunning = false
    await update($, turns, list => [...list, turn].slice(-KEEP))

    if (isSlow(turn) && !e.isAborted) {
      $.ui.toast(`Slow turn: ${summary(turn)} (over ${duration(slowMs)})`)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, turns)
    const last = list.at(-1)

    if (e.props.hasSurvey || last === undefined || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const levels = scale(list)
    let spark
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      spark = <Raster key="spark" columns={list.length} rows={1} cells={cells(list, levels, isSlow)} />
    } else {
      spark = (
        <Text>
          {list.map((turn, i) => (
            <Text color={isSlow(turn) ? 'warning' : 'suggestion'}>{BARS.charAt(levels[i] ?? 0)}</Text>
          ))}
        </Text>
      )
    }

    return (
      <Box flexDirection="row" gap={1}>
        <Text dimColor wrap="truncate-end">
          Last turn {summary(last)}
        </Text>
        {spark}
        <Button key="hide" label="Hide" hotkey="h" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}

function summary(turn: Turn): string {
  const parts = [duration(turn.ms), `${turn.tools} ${turn.tools === 1 ? 'tool' : 'tools'}`]
  if (turn.tokens !== null) parts.push(`${count(turn.tokens)} tokens`)

  return parts.join(' · ')
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`

  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function count(n: number): string {
  const short = (x: number) => (x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ''))
  if (n < 1000) return String(n)
  // From 999,500 the k form would round up to "1000k".
  if (n < 999_500) return `${short(n / 1000)}k`

  return `${short(n / 1_000_000)}M`
}

// One bar level (0..7) per turn, relative to the longest turn shown.
function scale(list: readonly Turn[]): number[] {
  const top = Math.max(1, ...list.map(turn => turn.ms))

  return list.map(turn => Math.max(0, Math.ceil((turn.ms / top) * BARS.length) - 1))
}

// RasterProps.cells: base64 of little-endian u32 triplets [codePoint, foreground, background].
function cells(list: readonly Turn[], levels: readonly number[], isSlow: (turn: Turn) => boolean): string {
  const view = new DataView(new ArrayBuffer(list.length * 12))
  list.forEach((turn, i) => {
    view.setUint32(i * 12, BARS.charCodeAt(levels[i] ?? 0), true)
    view.setUint32(i * 12 + 4, isSlow(turn) ? SLOW_COLOR : BAR_COLOR, true)
    view.setUint32(i * 12 + 8, TERMINAL_DEFAULT, true)
  })
  let binary = ''
  for (const byte of new Uint8Array(view.buffer)) binary += String.fromCharCode(byte)

  return btoa(binary)
}

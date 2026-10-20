import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { FocusTimer } from '../types'

const timer = atom({ plugin: 'focus-timer', key: 'timer' } as const, null)

const MINUTE = 60_000
const USAGE = 'Usage: /focus-timer [minutes 1-180] | pause | stop'

// The one-second ticker of this environment; a reload drops it with its timers.
let ticker: Timer | undefined

const isRunning = (t: FocusTimer | null): t is FocusTimer =>
  t !== null && !t.isDone && t.pausedRemaining === null

const left = (t: FocusTimer, now: number) =>
  t.pausedRemaining ?? Math.max(0, t.endsAt - now)

// 25:00, or 1:30:00 from an hour up; seconds round up so 00:00 means done.
function clockText(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

function bar(fraction: number, width: number) {
  const full = Math.min(width, Math.max(0, Math.round(fraction * width)))

  return '▰'.repeat(full) + '▱'.repeat(width - full)
}

function minutesOption(value: unknown, fallback: number, max: number) {
  const n = Math.round(Number(value))

  return Number.isFinite(n) && n >= 1 && n <= max ? n : fallback
}

function stopTicking() {
  ticker?.cancel()
  ticker = undefined
}

// Ends one interval. A late tick of an older interval must not cancel the
// ticker started since, so `ticker` is cleared only while it is still `own`.
function endInterval(own: Timer) {
  own.cancel()
  if (ticker === own) ticker = undefined
}

// Each second: redraw from the clock (so nothing drifts), or finish once
// endsAt has passed. Only the tick whose write ends the session announces it.
async function tick($: EngineInterface, doneText: string, own: Timer) {
  const now = await $.clock.now()
  const t = await read($, timer)
  if (!isRunning(t)) return endInterval(own)
  if (now < t.endsAt) return $.ui.invalidate('ui.render')

  endInterval(own)
  let isFinished = false
  await update($, timer, cur => {
    isFinished = isRunning(cur) && now >= cur.endsAt
    return isFinished && cur !== null ? { ...cur, isDone: true } : cur
  })
  if (!isFinished) return
  $.ui.toast(doneText)
  await $.ui.notify(doneText, { title: 'Focus timer' })
}

function startTicking($: EngineInterface, doneText: string) {
  stopTicking()
  const own = $.clock.every(1000, () => {
    tick($, doneText, own).catch(err => $.ui.log(`focus-timer: ${String(err)}`, { to: 'debug' }))
  })
  ticker = own
}

async function start($: EngineInterface, minutes: number, doneText: string) {
  const now = await $.clock.now()
  const totalMs = minutes * MINUTE
  await update($, timer, () => ({
    totalMs,
    endsAt: now + totalMs,
    pausedRemaining: null,
    isDone: false,
  }))
  startTicking($, doneText)
}

async function togglePause($: EngineInterface, doneText: string) {
  const now = await $.clock.now()
  const after = await update($, timer, cur => {
    if (cur === null || cur.isDone) return cur

    return cur.pausedRemaining === null
      ? { ...cur, pausedRemaining: left(cur, now) }
      : { ...cur, endsAt: now + cur.pausedRemaining, pausedRemaining: null }
  })
  if (isRunning(after)) startTicking($, doneText)
  else stopTicking()

  return { after, now }
}

async function stop($: EngineInterface) {
  stopTicking()
  await update($, timer, () => null)
}

function dismiss($: EngineInterface) {
  return update($, timer, cur => (cur?.isDone ? null : cur))
}

export const register: Register = (on, options) => {
  const defaultMinutes = minutesOption(options.defaultMinutes, 25, 180)
  const breakMinutes = minutesOption(options.breakMinutes, 5, 60)
  const doneText = `Focus session done. Take a ${breakMinutes} minute break.`

  // Claude Code ships its own /focus (the focus view), so the timer is /focus-timer.
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'focus-timer',
      description: `Start a focus session (${defaultMinutes} min by default), pause/resume or stop it`,
      argumentHint: '[minutes|pause|stop]',
      immediate: true,
    })
    // This fires again on a reload, a worker respawn or an enable, which drop
    // the ticker but keep the state: pick a running countdown up again.
    if (isRunning(await read($, timer))) startTicking($, doneText)

    return next(e)
  })

  on('command.run', { command: 'focus-timer' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const before = await read($, timer)
    const isActive = before !== null && !before.isDone

    if (arg === 'stop') {
      await stop($)

      return { text: isActive ? 'Focus timer stopped.' : 'No focus timer is running.' }
    }

    if (arg === 'pause') {
      const { after, now } = await togglePause($, doneText)
      if (after === null || after.isDone) return { text: 'No focus timer is running.' }
      const rest = clockText(left(after, now))

      return {
        text: isRunning(after)
          ? `Focus timer resumed: ${rest} left.`
          : `Focus timer paused: ${rest} left.`,
      }
    }

    const minutes = arg === '' ? defaultMinutes : Number(arg)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return { text: USAGE }
    await start($, minutes, doneText)

    return { text: `Focus timer started: ${clockText(minutes * MINUTE)}.` }
  })

  // The done line stays until dismissed or the person's next prompt. Never a
  // reason to hold a prompt back: a failure lets it through.
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta && (await read($, timer))?.isDone) await dismiss($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, timer)
    if (t === null || e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    if (t.isDone) {
      return (
        <Box flexDirection="row" gap={1}>
          <Text>
            <Text color="success">✓</Text> Focus done · {clockText(t.totalMs)}
          </Text>
          <Button
            key="dismiss"
            label="Dismiss"
            hotkey="d"
            role="dismiss"
            onPress={() => dismiss($)}
          />
        </Box>
      )
    }

    const rest = left(t, await $.clock.now())
    const isPaused = t.pausedRemaining !== null
    const fraction = 1 - rest / t.totalMs
    // The terminal gets a bar of block glyphs sized to the band; elsewhere a percentage.
    const width = Math.max(4, Math.min(20, e.props.bodyColumns - 56))
    const progress =
      e.surface === 'terminal' ? (
        <Text color="claude" dimColor={isPaused}>
          {bar(fraction, width)}
        </Text>
      ) : (
        <Text dimColor tabular>
          {`${Math.floor(fraction * 100)}%`}
        </Text>
      )

    return (
      <Box flexDirection="row" gap={1}>
        <Text tabular>
          <Text color="claude">◷</Text> Focus · {isPaused ? 'paused · ' : ''}
          {clockText(rest)} left
        </Text>
        {progress}
        <Button
          key="pause"
          label={isPaused ? 'Resume' : 'Pause'}
          hotkey="p"
          variant="primary"
          onPress={() => togglePause($, doneText)}
        />
        <Button key="stop" label="Stop" hotkey="s" onPress={() => stop($)} />
      </Box>
    )
  })
}

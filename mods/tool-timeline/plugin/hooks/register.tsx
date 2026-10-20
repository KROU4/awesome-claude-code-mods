import { atom, read, update } from 'claude-code'
import type { Register, ThemeKey, ToolCallResult } from 'claude-code'

import type { TimelineCall, TimelineStatus } from '../types'

const PANE = 'timeline'
const TITLE = 'Timeline'
const KEEP = 200
const NAME_MAX = 16
const SUMMARY_MAX = 200

const GLYPH: Record<TimelineStatus, string> = { running: '◐', done: '✓', error: '✗', denied: '⊘' }
const COLOR: Record<TimelineStatus, ThemeKey> = { running: 'warning', done: 'success', error: 'error', denied: 'error' }

// Where tools keep what a call is about, the most telling first.
const SUBJECTS = ['file_path', 'notebook_path', 'command', 'pattern', 'path', 'url', 'query', 'description', 'skill', 'prompt']

// How Claude Code's own refusals open, when a permission rule, the mode or the person turns a call down.
const REFUSED = /^(?:The user doesn't want to proceed with this tool use|Permission (?:to .+|for this action) has been denied)/

// This load of the module: `$.state` outlives a reload, the hooks watching a running call do not.
const LOAD = crypto.randomUUID()

const calls = atom({ plugin: 'tool-timeline', key: 'calls' } as const, [])
const dismissed = atom({ plugin: 'tool-timeline', key: 'dismissed' } as const, false)

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'timeline',
      description: 'Show the tool calls of this session in the Timeline pane',
    })

    return next(e)
  })

  on('command.run', { command: 'timeline' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return { text: opened.isPlaced ? 'Timeline opened.' : `Timeline is open, not drawn yet: ${opened.reason}` }
  })

  // A pane the person closed stays closed until they ask for it.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await update($, dismissed, () => true)

    return next(e)
  }).catch(($, e, next) => next(e))

  if (options.autoOpen !== false) {
    let hasOpened = false

    // Unasked, the pane opens only where the surface docks it beside the transcript.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      if (!hasOpened && e.viewport?.isFullscreen === true) {
        hasOpened = true
        if (!(await read($, dismissed))) $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
      }

      return next(e)
    })
  }

  // An observer: when it fails, the call goes on unrecorded.
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id
    const startedAt = await $.clock.now()
    const { summary, isPath } = summarize(e, await $.session.cwd())
    // A hook run again for the same call (a fresh copy of the plugin) replaces its row.
    await update($, calls, list =>
      [
        ...list.filter(call => call.id !== id).map(call => orphanSettled(call, startedAt)),
        { id, tool: e.tool, summary, isPath, status: 'running' as const, startedAt, load: LOAD },
      ].slice(-KEEP),
    )
    // A running call's time moves on screen.
    const ticker = $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    next.signal.addEventListener('abort', () => ticker.cancel())
    // What a call counts as when its run ends without settling (interrupted).
    let status: TimelineStatus = 'error'

    try {
      const ran = await next(e)
      status = statusOf(ran)

      return ran
    } finally {
      ticker.cancel()
      const durationMs = (await $.clock.now()) - startedAt
      // A settings hook's deny arrives as a plain error: the PreToolUse observer below already said so.
      await update($, calls, list =>
        list.map(call =>
          call.id === id ? { ...call, status: call.status === 'denied' ? call.status : status, durationMs } : call,
        ),
      )
    }
  }).catch(($, e, next) => next(e))

  // Settings PreToolUse hooks run beneath every tool.call hook; their deny is told apart here.
  on('classic.PreToolUse', async ($, e, next) => {
    const decided = await next(e)
    if (decided.deny !== undefined) {
      const id = e.tool_use_id
      await update($, calls, list => list.map(call => (call.id === id ? { ...call, status: 'denied' as const } : call)))
    }

    return decided
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, calls)

    if (list.length === 0) {
      return <Text dimColor>No tool calls yet.</Text>
    }

    // The pane's body bounds the rows, and the surface's own height bounds that.
    const room = Math.max(1, Math.min(e.props.scroll.bodyRows, e.viewport?.rows ?? Infinity))
    const shown = list.length <= room ? list : list.slice(list.length - Math.max(1, room - 1))
    const now = await $.clock.now()
    const nameWidth = Math.min(NAME_MAX, Math.max(...shown.map(call => label(call.tool).length)))
    // Left of the summary: the glyph and the name; right of it: a duration of up to 6 cells; 3 gaps.
    const summaryWidth = e.props.bodyColumns - nameWidth - 10

    return (
      <Box flexDirection="column">
        {shown.length < list.length && <Text dimColor>+{list.length - shown.length} earlier</Text>}
        {shown.map(call => (
          <Box flexDirection="row" gap={1}>
            <Text color={COLOR[call.status]}>{GLYPH[call.status]}</Text>
            <Box width={nameWidth} flexShrink={0}>
              <Text wrap="truncate-end">{label(call.tool)}</Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor wrap={call.isPath ? 'truncate-start' : 'truncate-end'}>
                {clip(call.summary, summaryWidth, call.isPath)}
              </Text>
            </Box>
            <Text dimColor tabular>
              {duration(call.durationMs ?? now - call.startedAt)}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}

function statusOf(ran: ToolCallResult): TimelineStatus {
  if (ran.deny !== undefined) return 'denied'
  if (ran.isError !== true) return 'done'

  return REFUSED.test(ran.text ?? '') ? 'denied' : 'error'
}

// A row an earlier load left running lost the hook that would settle it: it ends as an error.
function orphanSettled(call: TimelineCall, now: number): TimelineCall {
  if (call.status !== 'running' || call.load === LOAD) return call

  return { ...call, status: 'error', durationMs: now - call.startedAt }
}

function summarize(input: object, cwd: string): { summary: string; isPath: boolean } {
  for (const key of SUBJECTS) {
    const value: unknown = Reflect.get(input, key)
    if (typeof value !== 'string' || value.trim() === '') continue

    const isPath = key.endsWith('path')
    const text = isPath ? relativeTo(cwd, value) : value.replace(/\s+/g, ' ').trim()

    return { summary: clip(text, SUMMARY_MAX, isPath), isPath }
  }

  return { summary: '', isPath: false }
}

function relativeTo(cwd: string, path: string): string {
  const root = cwd.replace(/\\/g, '/').replace(/\/$/, '')
  const file = path.replace(/\\/g, '/')

  return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : path
}

// A path keeps its end (the file name), anything else its start.
function clip(text: string, width: number, fromStart: boolean): string {
  if (text.length <= width) return text
  if (width < 2) return ''

  return fromStart ? `…${text.slice(text.length - width + 1)}` : `${text.slice(0, width - 1)}…`
}

// mcp__github__create_issue reads as github:create_issue.
function label(tool: string): string {
  return tool.replace(/^mcp__(.+?)__/, '$1:')
}

function duration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const seconds = Math.round(ms / 1000)

  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

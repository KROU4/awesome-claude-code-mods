# focus-timer

A Pomodoro countdown above the prompt, with pause, stop and an end-of-session notification.

## What it draws

In the terminal, while a session runs:

```text
◷ Focus · 18:42 left ▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱ [ Pause ] [ Stop ]
```

Paused:

```text
◷ Focus · paused · 18:42 left ▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱ [ Resume ] [ Stop ]
```

When it ends, a native notification and a toast say `Focus session done. Take a 5 minute break.`, and the band shows:

```text
✓ Focus done · 25:00 [ Dismiss ]
```

- The desktop app draws the same band with the progress as a percentage: `◷ Focus · 18:42 left 25%`.
- The time left is computed from the clock on every redraw, once a second, so it never drifts. A paused session stays exactly where you left it.
- The done line stays until you dismiss it or send your next prompt.

## Commands

| Command | What it does |
| --- | --- |
| `/focus-timer` | Starts a session of the default length (25 minutes). |
| `/focus-timer 50` | Starts a 50-minute session (1 to 180). Restarts one already running. |
| `/focus-timer pause` | Pauses, or resumes a paused session. |
| `/focus-timer stop` | Stops the session and hides the band. |

The command runs at once, even while Claude is working. With the band focused (ctrl+x tab, or a click), `p` pauses or resumes, `s` stops and `d` dismisses the done line.

Claude Code already has a built-in `/focus`, so this command is `/focus-timer`.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `defaultMinutes` | number | `25` | Length of a session started with a bare `/focus-timer` (1 to 180). |
| `breakMinutes` | number | `5` | The break the end-of-session notification suggests (1 to 60). |

Set them with `/config`, or in settings under `pluginConfigs["focus-timer@mod-showroom"].options`.

## Install

- Terminal: `/plugin install focus-timer --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install focus-timer --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- The notification goes through your notification channel (`preferredNotifChannel`). Where there is none, as in the desktop app, only the toast and the done line show.
- The band steps aside while a survey uses that space.

## License

MIT. See [LICENSE](LICENSE).

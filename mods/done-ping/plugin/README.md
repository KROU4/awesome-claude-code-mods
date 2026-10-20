# done-ping

A native notification when a long turn finishes, so you can look away.

## What it draws

When a turn ends after at least `minSeconds` (30 by default), a notification goes out through your notification channel (the `preferredNotifChannel` setting):

```text
┌ Claude Code ─────────────────────────────────┐
│ Claude finished in 3m 5s · 31 tool calls     │
└──────────────────────────────────────────────┘
```

- It says how long the turn took and how many tool calls the main conversation made in it. A subagent's own calls are not counted.
- A turn you interrupted (Esc) is never announced.
- A turn that died on an API error reads `Claude stopped on an error after 4m 12s · 9 tool calls`.
- A subagent's own end is not announced. Only the main conversation's turn is.
- When the notification is not sent, for example with notifications turned off or a terminal with no notification channel, the same line shows as a toast instead.

## Commands

| Command | What it does |
| --- | --- |
| `/done-ping test` | Sends a sample notification and says what happened. |
| `/done-ping` | Says when it notifies, and sends nothing. |

```text
> /done-ping test
  Sample notification sent via kitty.

> /done-ping test
  Sample notification not sent: no-channel, shown as a toast instead.
```

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `minSeconds` | number | `30` | Notify only when a turn took at least this many seconds. |

Set it with `/config`, or in settings under `pluginConfigs["done-ping@mod-showroom"].options`.

## Install

- Terminal: `/plugin install done-ping --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install done-ping --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- The desktop app holds no terminal to notify through, so there you get the toast only.
- With the `terminal_bell` channel the notification is a bell with no text. `/done-ping test` says so.

## License

MIT. See [LICENSE](LICENSE).

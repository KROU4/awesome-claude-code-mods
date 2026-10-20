# tool-timeline

A live pane of every tool call: its status, what it worked on and how long it took.

## What it draws

A **Timeline** pane that lists the session's tool calls as they happen:

```text
✓ Read  src/checkout.ts             0.1s
✓ Grep  applyDiscount               0.2s
✓ Edit  src/cart/total.ts           0.1s
⊘ Read  .env                        0.0s
✓ Write src/cart/total.test.ts      0.1s
✗ Bash  npm test                   12.4s
✓ Edit  src/cart/total.ts           0.1s
◐ Bash  npm test                    3.0s
```

- `◐` running, in the warning color. `✓` done, in the success color. `✗` error and `⊘` denied, in the error color.
- Denied means the call was refused before it ran: by a settings hook (`PreToolUse`), a permission rule, the permission mode, you at the prompt, or a plugin whose `tool.call` hook runs beneath this one.
- The middle column is what the call worked on: a file path relative to the project, a command, a pattern, a URL or a query, on one line. A long path is cut from its start, so the file name stays. Anything else is cut from its end.
- MCP tools read as `server:tool`.
- A running call's time moves every second.
- The pane keeps the last 200 calls. It draws as many as fit its height, with a `+N earlier` line above them.
- An interrupted call ends as `✗`. So does a call that was still running when the plugin reloaded.

## Commands

| Command | What it does |
| --- | --- |
| `/timeline` | Opens the Timeline pane. |

The pane also opens by itself on a fullscreen terminal at least 144 columns wide, or 110 once you have opened it before. On a narrower fullscreen terminal it waits, undrawn, until the window is wide enough. On the terminal's main screen it waits for `/timeline`. Once you close the pane, it does not open by itself again in that session.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `autoOpen` | boolean | `true` | Opens the pane by itself on a fullscreen terminal. Off: only `/timeline` opens it. |

Set it with `/config`, or in settings under `pluginConfigs["tool-timeline@mod-showroom"].options`.

## Install

- Terminal: `/plugin install tool-timeline --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install tool-timeline --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- A call refused by a plugin whose `tool.call` hook runs above this one is not listed.
- Where an organization manages Claude Code, an installed plugin does not see the decisions of settings hooks. There, a call a settings hook denied shows as `✗`.

## License

MIT. See [LICENSE](LICENSE).

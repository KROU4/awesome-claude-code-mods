# context-gauge

See how full the context window is, right in the hint line under the prompt.

## What it draws

A gauge at the end of the dim hint line under the prompt:

```text
? for shortcuts  ctx ▰▰▰▰▱▱ 62% · 124k/200k
```

- **The figures** are Claude Code's own, the ones the status line shows: the input, cache-write and cache-read tokens of the last response, over the model's context window. Claude Code pushes them after every turn, so the gauge sends no requests.
- **Color**: dim like the rest of the line under 60%, the theme's warning color from 60% to 85%, its error color above 85%.
- **Hidden** until a session's first response, and again after a compaction or a `/clear` until the next turn measures the window.
- **Terminal**: under 60% the gauge is added to the end of Claude Code's own hint line, whose indicators stay live. In color the mod draws the line itself, Claude Code's hint text first, because an added part is only ever drawn dim.
- **Desktop app**: the mod always draws the line, since the desktop app does not draw an added part.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `windowTokens` | number | `200000` | Window size in tokens, used only when Claude Code reports none for the session's model. |

Set it with `/config`, or in settings under `pluginConfigs["context-gauge@mod-showroom"].options`.

## Install

- Terminal: `/plugin install context-gauge --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install context-gauge --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- Where an organization manages Claude Code, installed plugins do not see compactions. There the gauge corrects itself on the next turn instead.
- The gauge shows the last turn's reading. It does not move while a turn runs.

## License

MIT. See [LICENSE](LICENSE).

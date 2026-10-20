# turn-meter

Each turn's duration, tool calls and tokens in a band above the prompt, with a 12-turn sparkline.

## What it draws

After every turn, a band above the prompt:

```text
Last turn 3m 5s · 31 tools · 88.4k tokens ▁▂▂▃▁▃▅▂▄▃▂█ [ Hide ]
```

When a turn runs past the threshold, a toast as well:

```text
Slow turn: 3m 5s · 31 tools · 88.4k tokens (over 2m)
```

- **Duration** runs from the prompt you send to the end of the turn.
- **Tools** counts the main conversation's tool calls. A subagent's own calls are not counted.
- **Tokens** adds up input, cache writes and output. Cache reads are left out. A turn with no usage report shows no tokens.
- **Sparkline**: one bar per turn, scaled to the longest of the last 12. The terminal draws colored cells, slow turns in orange. The desktop app draws text bars `▁▂▃▄▅▆▇█`, slow turns in the theme's warning color.
- **Hide** hides the band for the session. With the band focused (ctrl+x tab, or a click), `h` does the same.
- A turn you interrupted raises no toast.
- The band steps aside while a survey uses that space.

## Commands

| Command | What it does |
| --- | --- |
| `/turn-meter` | Shows the band again after Hide. It runs at once, even while Claude is working. |

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `slowTurnSeconds` | number | `120` | A turn longer than this raises a toast. `0` turns the toast off. |

Set it with `/config`, or in settings under `pluginConfigs["turn-meter@mod-showroom"].options`.

## Install

- Terminal: `/plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- The band and the sparkline start empty in each new session.
- After a reload in the middle of a turn, that turn's duration is the one Claude Code reports, and only the tool calls made after the reload are counted.

## License

MIT. See [LICENSE](LICENSE).

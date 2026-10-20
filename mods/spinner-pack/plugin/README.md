# spinner-pack

Themed spinner packs: moon, braille or coffee verbs and glyphs that follow each phase of a turn.

## What it draws

The pack swaps the spinner's word for a themed verb with a themed glyph beside it. Both step as the turn moves from requesting to thinking, tool use and responding. With the `moon` pack, one turn in the terminal reads:

```text
✻ Orbiting ◐…
✻ Waxing ◓… (4s · ↓ 310 tokens)
✻ Eclipsing ◒… (12s · ↓ 1.2k tokens)
✻ Waning ◐… (19s · ↓ 2.4k tokens)
```

The glyph in front, the ellipsis and everything in brackets are Claude Code's own. The mod only rewrites the word.

| Phase | moon | braille | coffee |
| --- | --- | --- | --- |
| requesting | Orbiting ◐ | Computing ⠋ | Grinding ∴ |
| thinking | Waxing ◓ | Computing ⠹ | Steeping ∵ |
| tool input | Eclipsing ◑ | Threading ⠼ | Brewing ∷ |
| tool use | Eclipsing ◒ | Threading ⠦ | Brewing ⁂ |
| responding | Waning ◐ | Weaving ⠇ | Pouring ∴ |

In the desktop app, a row that names its step (`Creating notes.md ◒…`) keeps those words and gains the glyph. Only the generic `Working` takes the pack's verb.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `pack` | string | `moon` | The pack: `moon`, `braille`, `coffee`, or `classic` to leave the spinner untouched. |

Set it with `/config`, or in settings under `pluginConfigs["spinner-pack@mod-showroom"].options`.

## Install

- Terminal: `/plugin install spinner-pack --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install spinner-pack --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- The animated glyph in front of the verb stays Claude Code's. Replacing it would mean drawing the whole line, elapsed time and tokens included, in place of Claude Code's.
- The pack's glyph steps with the turn's phase, not on every animation frame.
- While Claude Code shows a state message of its own (compacting, for one), or a phase the pack does not know, the spinner is left as it is.

## License

MIT. See [LICENSE](LICENSE).

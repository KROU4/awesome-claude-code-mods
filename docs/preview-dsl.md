# Preview DSL

> **Кратко по-русски.** `preview` в `mod.json` описывает, что мод рисует, а сайт по этому описанию рисует мод внутри макета Claude Code: в терминале, в десктопном приложении и в панели VS Code. В `elements` от 1 до 10 элементов. У каждого есть `slot` (место в клиенте) и поля этого места. Строки собираются из сегментов: текст, кнопка, полоса прогресса, спарклайн, ссылка, клавиша. Цвета задаются токенами темы Claude Code или `#rrggbb`. Ниже для каждого слота есть пример JSON и описание того, что нарисует сайт. Если поверхность не рисует этот слот (например, полосу над полем ввода в VS Code), сайт так и пишет и ничего не подделывает. Схема лежит в [schema/mod.schema.json](../schema/mod.schema.json), правила добавления — в [CONTRIBUTING.md](../CONTRIBUTING.md).

The `preview` object in `mod.json` is a declarative mock of what the mod draws. The site renders it inside a faithful mock of the client on three surfaces (terminal, desktop app, VS Code). It is not executed and it is not a screenshot, so keep it honest: show what the code really draws. For every mod whose code CI can read (hosted, and external sources it can clone), the site also lists the hooks and calls that `claude plugin validate` found in the code.

- [The preview object](#the-preview-object)
- [Rows and segments](#rows-and-segments)
- [Colors](#colors)
- [Slots](#slots)
- [Where each slot draws](#where-each-slot-draws)

## The preview object

```json
{
  "scene": "coding",
  "surface": "terminal",
  "caption": "After a slow turn: the meter above the prompt and a toast.",
  "caption_ru": "После долгого хода: счётчик над промптом и уведомление.",
  "elements": [
    { "slot": "above-prompt", "rows": [["Last turn 3m 5s · 31 tools"]] },
    { "slot": "toast", "text": "Slow turn: 3m 5s" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `elements` | Required. 1–10 elements, drawn in the order given within their place. |
| `scene` | The conversation behind the mod: `coding` (edits in a small TypeScript project), `debugging` (a failing test and its fix), `review` (reading a diff), `idle` (an empty session). |
| `transcript` | Your own conversation instead of a scene, up to 12 turns (below). |
| `surface` | The surface shown first: `terminal` or `desktop`. |
| `caption`, `caption_ru` | One line under the mock, up to 140 / 160 characters. |

A turn of `transcript`:

```json
[
  { "role": "user", "text": "Run the tests and fix what fails." },
  { "role": "tool", "tool": "Bash", "input": "npm test", "result": "1 failed, 6 passed", "status": "error" },
  { "role": "assistant", "text": "The parser drops the last token; fixing it." }
]
```

`role` is `user`, `assistant` or `tool`. A tool turn takes `tool`, `input`, `result` and `status` (`done`, `running`, `error`).

## Rows and segments

`rows` is a list of rows (1–30), and `row` is one row. A row is a list of 1–24 segments:

| Segment | Example | Drawn as |
| --- | --- | --- |
| Plain text | `"Focus · 18:42 left"` | Text in the default color. |
| Styled text | `{ "text": "62%", "color": "warning", "bold": true }` | Also `bg`, `dim`, `italic`, `underline`, `inverse`. |
| Button | `{ "button": "Pause", "variant": "primary", "hotkey": "p" }` | `[ Pause ]` in the terminal (primary in the accent color, `p: Pause` with a hotkey), a native button on desktop. |
| Progress bar | `{ "bar": 0.35, "width": 20, "color": "claude" }` | `bar` from 0 to 1, `width` 4–40 cells (12 by default). |
| Sparkline | `{ "spark": [3, 5, 2, 8, 4], "color": "#5f9ea0" }` | One cell per value, `▁` to `█`, 2–60 values. |
| Link | `{ "link": "docs", "href": "https://example.com" }` | Underlined text; https only. |
| Key cap | `{ "kbd": "ctrl+x" }` | The key in inverse. |

## Colors

A color is a Claude Code theme token or a hex `#rrggbb`. Tokens follow the viewer's theme (dark or light) in the mock: `claude`, `text`, `secondary`, `inactive`, `subtle`, `success`, `error`, `warning`, `permission`, `suggestion`, `plan`, `ide`, `remember`, `background`. Prefer tokens: the mod looks right in both themes, as it does in the client.

## Slots

### `above-prompt` — band above the prompt

The rows a mod draws right above the prompt box with `ui.render` on `AbovePrompt`. The terminal mock adds the engine's `[-]` at the right end; the desktop mock shows a row above the prompt box with native-looking buttons.

```json
{ "slot": "above-prompt", "rows": [[{ "text": "◷", "color": "claude" }, " Focus · 18:42 left ", { "bar": 0.25, "width": 20, "color": "claude" }, " ", { "button": "Pause", "variant": "primary", "hotkey": "p" }]] }
```

### `pane` — a pane

A framed pane the mod opens with `$.ui.open`. The terminal mock docks it to the right of the transcript (fullscreen layout) or draws it inline above the prompt; the desktop mock shows a side panel with a title and a close button. `width` is `narrow` (34 columns) or `wide` (46).

```json
{ "slot": "pane", "title": "Timeline", "width": "narrow", "rows": [[{ "text": "✓", "color": "success" }, " Read  ", { "text": "src/hooks/register.tsx", "dim": true }], [{ "text": "◐", "color": "warning" }, " Bash  ", { "text": "npm run build", "dim": true }]] }
```

### `status` — status entry

One entry the mod sets with `$.ui.status`, drawn in the status row under the prompt; entries of several mods are joined with ` · `.

```json
{ "slot": "status", "text": "⎇ main · 3 changed · ↑1 ↓0" }
```

### `toast` — toast

A short message from `$.ui.toast`. The terminal mock shows it at the right end of the status row under the prompt (top right of the transcript in the fullscreen layout); the desktop mock shows it at the top right of the window.

```json
{ "slot": "toast", "text": "Slow turn: 3m 5s · 31 tools (over 2m)" }
```

### `notification` — native notification

A system notification from `$.ui.notify`, drawn as an operating-system notification card outside the client window. `title` defaults to the plugin's name.

```json
{ "slot": "notification", "title": "Claude Code", "text": "Claude finished in 1m 40s · 12 tool calls" }
```

### `command` — slash command

A command the mod registers, drawn as the typed `❯ /command args` row followed by what the command answers: `output` rows under `⎿`, or a `markdown` block (tables, lists, code). `command` matches `/name` (lower case, digits, `-`, `:`).

```json
{ "slot": "command", "command": "/snip", "args": "list", "markdown": "| Name | Snippet |\n| --- | --- |\n| review | Review the staged diff for bugs… |" }
```

```json
{ "slot": "command", "command": "/focus-timer", "args": "25", "output": [["Focus timer started: 25:00."]] }
```

### `tool-deny` — a refused tool call

A tool call the mod refused (a `tool.call` hook that denies). Drawn as the tool row `● Bash(cat .env)` in the error color with `message` as its result line: the text Claude reads.

```json
{ "slot": "tool-deny", "tool": "Bash", "input": "cat config/.env.production", "message": "secret-guard: config/.env.production looks like a secret; ask the person to share what is needed." }
```

### `prompt-rewrite` — a rewritten prompt

A prompt the mod changed before it was sent (`prompt.submit`). Drawn as the prompt the person typed, a small "rewritten by the mod" note and the text that was sent.

```json
{ "slot": "prompt-rewrite", "before": "fix the test", "after": "Fix the failing test in tests/parse.test.ts. Run npm test before and after." }
```

### `spinner` — the working spinner

The spinner line while Claude works, redrawn with `ui.render` on `Spinner`. `verb` replaces the word, `glyphs` (1–12 frames of up to 4 characters) replace the animation, `color` the verb's color. The mock keeps the engine's elapsed time and token count after it.

```json
{ "slot": "spinner", "verb": "Eclipsing", "glyphs": ["◐", "◓", "◑", "◒"], "color": "claude" }
```

### `prompt-hint` — the hint line

The dim line under the prompt (`? for shortcuts`), redrawn with `ui.render` on `PromptHint`. The row replaces the engine's line.

```json
{ "slot": "prompt-hint", "row": [{ "text": "? for shortcuts", "dim": true }, "  ", { "text": "ctx ▰▰▰▰▱▱ 62% · 124k/200k", "color": "warning" }] }
```

### `session-mode` — the mode label

The dim mode labels at the right of the prompt footer (`ui.render` on `SessionMode`), joined with ` & `.

```json
{ "slot": "session-mode", "row": [{ "text": "focus mode", "color": "plan" }] }
```

### `turn-duration` — the turn duration line

The line that closes a turn (`Baked for 3s`), redrawn with `ui.render` on `TurnDuration`. Terminal only.

```json
{ "slot": "turn-duration", "text": "Brewed for 12s · 3 tools · 4.1k tokens" }
```

### `tool-row` — a redrawn tool row

A tool call row redrawn with `ui.render` on `ToolUse` / `ToolResult`. `row` replaces the call line after `● Tool(input)`, `result` replaces the result lines under `⎿`.

```json
{ "slot": "tool-row", "tool": "Read", "input": "src/auth.ts", "row": [{ "text": "182 lines", "dim": true }], "result": [[{ "text": "+ exports: login, logout", "color": "success" }]] }
```

### `message` — a transcript message

A message the mod draws or adds to the transcript: `role` is `user`, `assistant` or `note` (a dim system line), with `rows` or `markdown`.

```json
{ "slot": "message", "role": "note", "markdown": "**Heads up:** this branch is 14 commits behind `origin/main`." }
```

### `info-notice` — info notice

The dim notice row under the welcome logo (`ui.render` on `InfoNotice`). Terminal only.

```json
{ "slot": "info-notice", "row": [{ "text": "3 mods loaded · /plugin to manage", "dim": true }] }
```

### `model-tool` — a tool for Claude

A tool the mod gives the model with `$.tool.register`. Drawn as Claude calling it: a tool row `● name(input)` with `result` rows.

```json
{ "slot": "model-tool", "name": "search_docs", "input": "query: \"ui.render\"", "result": [["3 matches in docs/plugins/mods/interface.md"]] }
```

### `background` — behaviour with nothing on screen

For what the mod does without drawing (saving, syncing, guarding quietly). Drawn as a small caption pill on the mock.

```json
{ "slot": "background", "text": "Appends every prompt to ~/.claude/journal.md" }
```

## Where each slot draws

From the official mods reference (render sites). The site's "Works on" chips use the same table (`surfacesBySlot` in registry.json) together with the entry's `surfaces`.

| Slot | Terminal | Desktop app | VS Code |
| --- | --- | --- | --- |
| `pane`, `message`, `tool-row`, `spinner`, `model-tool`, `tool-deny`, `prompt-rewrite`, `background` | yes | yes | yes |
| `above-prompt`, `command`, `session-mode`, `prompt-hint`, `status`, `toast`, `notification` | yes | yes | no |
| `turn-duration`, `info-notice` | yes | no | no |

VS Code draws mods in its chat panel from extension 2.1.299. When the surface selected in the mock does not draw an element, the site shows a small "Not drawn in VS Code" note in its place.

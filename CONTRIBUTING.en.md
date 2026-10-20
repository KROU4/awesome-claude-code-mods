# Adding a mod

[Русский](CONTRIBUTING.md)

Anyone can add a mod. An entry is one file, `mods/<name>/mod.json`; the code can live in your repository or right here. When a pull request stays inside `mods/<name>/`, the checks pass and you are listed in `maintainers`, the bot merges it without a human.

- [Three ways to add a mod](#three-ways-to-add-a-mod)
- [mod.json reference](#modjson-reference)
- [Where it installs from: source](#where-it-installs-from-source)
- [Preview](#preview)
- [When the bot merges by itself](#when-the-bot-merges-by-itself)
- [A mod hosted in this repository](#a-mod-hosted-in-this-repository)
- [Commands](#commands)

## Three ways to add a mod

1. **The builder on the site.** Open [Submit a mod](https://krou4.github.io/claude-code-mod-showroom/#/submit), fill in the form and watch the preview in the mock client. "Open a pull request on GitHub" opens GitHub with the file ready: GitHub forks the repository for you and offers to create the pull request.
2. **GitHub's web editor.** In the repository click Add file → Create new file, type the path `mods/<name>/mod.json`, paste the entry (sample below) and choose "Propose changes".
3. **git.** Fork, add `mods/<name>/mod.json`, run `npm ci && npm run check` and open a pull request.

The smallest entry for a mod in your own repository:

```json
{
  "$schema": "../../schema/mod.schema.json",
  "name": "neon-band",
  "title": "Neon Band",
  "tagline": "A neon band above the prompt with the session's cost.",
  "tagline_ru": "Неоновая полоса над промптом со стоимостью сессии.",
  "description": "Draws a one-line band above the prompt with the session's cost and model.",
  "author": { "name": "Alice", "github": "alice" },
  "maintainers": ["alice"],
  "category": "interface",
  "license": "MIT",
  "source": { "type": "github", "repo": "alice/neon-band" },
  "surfaces": ["terminal", "desktop"],
  "preview": {
    "scene": "coding",
    "elements": [
      { "slot": "above-prompt", "rows": [[{ "text": "$0.42 · Opus", "color": "claude" }]] }
    ]
  }
}
```

`$schema` turns on completion and checks in your editor. The full schema is [schema/mod.schema.json](schema/mod.schema.json).

## mod.json reference

| Field | Required | What to write |
| --- | --- | --- |
| `name` | yes | The plugin name: the same as in the mod's `.claude-plugin/plugin.json` and as the folder. Lower-case letters, digits and hyphens, up to 50 characters. It may not start with `claude-`, `anthropic-` or `cc-plugin-` and should not have `claude` as a separate word: `claude plugin validate` enforces this. |
| `title` | yes | The name on the site, 2–40 characters. |
| `tagline` | yes | One line in English on what the mod does for the person, 8–100 characters. |
| `tagline_ru` | no | The same in Russian, up to 110 characters. |
| `description` | yes | A paragraph in English, 20–700 characters. `code` spans are fine. |
| `description_ru` | no | The same paragraph in Russian, up to 800 characters. |
| `author` | yes | `{ "name", "github"?, "url"? }`; `url` must be https. |
| `maintainers` | yes | 1–10 GitHub logins that may change the entry without a catalog maintainer. A new entry must include the PR author. |
| `category` | yes | One of `interface`, `insights`, `safety`, `productivity`, `git`, `integrations`, `fun`, `accessibility`. |
| `tags` | no | Up to 8: lower-case letters, digits and hyphens, up to 24 characters. |
| `license` | yes | SPDX identifier of the mod's code license, e.g. `MIT`. |
| `version` | no | Semver, e.g. `0.1.0`. For a hosted mod the marketplace uses the version in plugin.json. |
| `homepage` | no | An https link to the mod's page. |
| `source` | yes | Where it installs from, see [below](#where-it-installs-from-source). |
| `surfaces` | no | Where you tried the mod: `terminal`, `desktop`, `vscode`, `mobile`. |
| `requires` | no | `{ "claudeCode": ">=2.1.299" }`, the lowest Claude Code version it needs. |
| `capabilities` | no | What the mod does beyond drawing: `network`, `processes`, `filesystem` (`none`, `read`, `write`), `model`, `promptRewrite`, `blocksTools`. CI works them out from `claude plugin validate` whenever it can read the code; declare them for code it cannot read. |
| `preview` | yes | What the mod draws, for the mock client on the site, see [preview](#preview). |
| `media` | no | Up to 6 images or videos: `{ "type": "image" \| "video", "src", "alt", "surface"? }`. `src` is an https URL or a path relative to mod.json (`media/band.png`), at most 2 MB. |
| `verified` | — | Set by catalog maintainers only: a person read the code at the pinned version. The bot does not merge a pull request that changes it. |

## Where it installs from: source

| `type` | Fields | When |
| --- | --- | --- |
| `hosted` | — | The code lives here, in `mods/<name>/plugin/`, and CI checks it on every change. |
| `github` | `repo` (`owner/repo`), `path`?, `ref`?, `sha`? | The plugin is the root of a GitHub repository, or the folder `path`. A 40-character `sha` pins the commit that gets installed. |
| `git` | `url` (https, ending in `.git`), `path`?, `ref`?, `sha`? | Any git host. |
| `marketplace` | `marketplace` (`owner/repo` with `.claude-plugin/marketplace.json`), `plugin`?, `repo`?, `path`? | The mod is already in your own marketplace. The catalog shows it, and its install commands point at your marketplace. |

Mods from `hosted`, `github` and `git` sources are served by this repository's marketplace, `mod-showroom`: `/plugin install <name> --marketplace KROU4/claude-code-mod-showroom`.

## Preview

The site draws every mod inside a mock of Claude Code from its `preview`: behind the mod's elements runs a scene (`coding`, `debugging`, `review`, `idle`) or your own `transcript`. `elements` holds 1–10 elements, each a place in the client (`slot`) and what the mod draws there. Rows (`rows`, `row`) are made of segments: a string, `{ "text", "color", "bold", "dim", ... }`, a button `{ "button", "hotkey" }`, a progress bar `{ "bar": 0.4 }`, a sparkline `{ "spark": [1, 3, 2] }`, a link `{ "link", "href" }` or a key cap `{ "kbd": "ctrl+x" }`. Colors are Claude Code theme tokens (`claude`, `success`, `error`, `warning`, `suggestion`, `subtle`, `inactive` and more) or `#rrggbb`.

| `slot` | Example | Drawn in |
| --- | --- | --- |
| `above-prompt` | `{ "slot": "above-prompt", "rows": [["Last turn 3m 5s"]] }` | Terminal, desktop |
| `pane` | `{ "slot": "pane", "title": "Timeline", "width": "narrow", "rows": [["✓ Read src/a.ts"]] }` | Everywhere |
| `status` | `{ "slot": "status", "text": "⎇ main · 3 changed" }` | Terminal, desktop |
| `toast` | `{ "slot": "toast", "text": "Slow turn: 3m 5s" }` | Terminal, desktop |
| `notification` | `{ "slot": "notification", "title": "Claude Code", "text": "Done in 1m 40s" }` | Terminal, desktop |
| `command` | `{ "slot": "command", "command": "/snip", "args": "list", "markdown": "…" }` | Terminal, desktop |
| `tool-deny` | `{ "slot": "tool-deny", "tool": "Bash", "input": "cat .env", "message": "Blocked" }` | Everywhere |
| `prompt-rewrite` | `{ "slot": "prompt-rewrite", "before": "fix it", "after": "Fix the failing test in …" }` | Everywhere |
| `spinner` | `{ "slot": "spinner", "verb": "Eclipsing", "glyphs": ["◐", "◓"] }` | Everywhere |
| `prompt-hint` | `{ "slot": "prompt-hint", "row": [{ "text": "ctx 62%", "color": "warning" }] }` | Terminal, desktop |
| `session-mode` | `{ "slot": "session-mode", "row": ["focus"] }` | Terminal, desktop |
| `turn-duration` | `{ "slot": "turn-duration", "text": "Brewed for 12s · 3 tools" }` | Terminal |
| `tool-row` | `{ "slot": "tool-row", "tool": "Read", "input": "src/a.ts", "row": ["182 lines"] }` | Everywhere |
| `message` | `{ "slot": "message", "role": "note", "markdown": "**Heads up:** …" }` | Everywhere |
| `info-notice` | `{ "slot": "info-notice", "row": ["2 mods loaded · /mods"] }` | Terminal |
| `model-tool` | `{ "slot": "model-tool", "name": "search_docs", "input": "hooks", "result": [["3 hits"]] }` | Everywhere |
| `background` | `{ "slot": "background", "text": "Saves each prompt to a journal" }` | Nothing on screen |

What each slot renders and all its fields: [docs/preview-dsl.md](docs/preview-dsl.md). Show what the mod really draws: previews are compared with the code, and for hosted mods the bot reads the hooks and calls from `claude plugin validate`.

## When the bot merges by itself

The bot merges a pull request without a human only when all of this holds:

1. The Validate check passed for the pull request's latest commit.
2. Every changed file is inside `mods/<name>/` (several entries are fine), there are at most 60 files and each is at most 2 MB. Allowed types: json, md, ts, tsx, js, mjs, cjs, mts, cts, jsx, png, jpg, jpeg, gif, webp, svg, mp4, webm, txt, wav, mp3, ogg and a file named `LICENSE`. Symbolic links are not accepted.
3. For an entry that already exists, you are in its `maintainers` (case does not matter). For a new entry, you are in the new entry's `maintainers`.
4. Only an entry's maintainers can remove it.
5. `verified` is unchanged (a new entry does not set it).
6. The pull request is not a draft, has no `hold` label and targets `main`.

When something is off, the bot adds the `needs-maintainer` label and keeps one comment listing the reasons in English and Russian; a catalog maintainer then reviews the pull request. When Validate itself failed, the comment links to its log: fix the problem and push a new commit. Details, and how to appeal, are in [docs/governance.md](docs/governance.md).

## A mod hosted in this repository

You can put the code in the catalog itself (`"source": { "type": "hosted" }`):

```text
mods/<name>/
├── mod.json
└── plugin/
    ├── .claude-plugin/plugin.json   "name": "<name>", version, description
    ├── hooks/
    │   ├── hooks.json               { "modules": ["./register.tsx"] }
    │   ├── register.tsx
    │   └── <name>.test.tsx          tests for claude plugin test
    ├── types/index.d.ts             when the mod uses $.state
    └── README.md
```

What CI checks for it:

- `claude plugin validate --strict mods/<name>/plugin`: the manifest, the module and its use of the API, with no warnings;
- `claude plugin test mods/<name>/plugin`: your `*.test.ts` and `*.test.tsx` files (the `claude-code/testing` kit);
- the name in `plugin.json` equals `name`, and `hooks.json` lists exactly one module, inside `plugin/`.

After the merge the bot updates `registry.json`, `.claude-plugin/marketplace.json`, the READMEs and the site, and works out from `claude plugin validate --json` which hooks and API calls the mod uses; the site shows them under "What it touches". Hosted mods are MIT-licensed unless the entry says otherwise.

## Commands

You need Node.js 22 or later. The mod checks need Claude Code 2.1.287+ (`claude` on PATH); without it they are skipped with a warning.

| Command | What it does |
| --- | --- |
| `npm ci` | Installs dependencies (only ajv). |
| `npm run check` | The full catalog check: schema, layout, media, `claude plugin validate --strict` and `claude plugin test` for hosted mods. |
| `npm run check:entry -- <name>` | A quick schema check of one entry. |
| `npm test` | Tests of the catalog scripts. |
| `npm run analyze` | Summarises `claude plugin validate --json` for every mod into `data/analysis/`. |
| `npm run build:registry` | Builds `registry.json`, `.claude-plugin/marketplace.json` and the README blocks. The bot normally does this. |
| `npm run enrich` | Stars and dates from GitHub into `data/github.json` (uses `GITHUB_TOKEN` when set). |
| `npm run discover` | Lists mods on GitHub that the catalog lacks (topics `claude-code-mod`, `claude-code-mods`, `claude-mod`). |

Community behaviour follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). To report a harmful mod, see [SECURITY.md](SECURITY.md).

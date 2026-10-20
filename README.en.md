# Mod Showroom

**A showroom of mods for Claude Code.** A catalog of plugins that change the client itself: bands above the prompt, panes, status entries, notifications, spinners, tool-call guards. The site shows every mod inside a mock of the client, and each one installs with a single command.

**[Open the site](https://krou4.github.io/claude-code-mod-showroom/)** · [Русский](README.md) · [Contributing](CONTRIBUTING.en.md) · [Research](docs/research.md)

[![Validate](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/validate.yml/badge.svg)](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/validate.yml)

The catalog lists <!-- count:start -->32 mods<!-- count:end -->. The repository is also the Claude Code marketplace `mod-showroom`.

## Contents

- [What a mod is](#what-a-mod-is)
- [Install](#install)
- [Catalog](#catalog)
- [Add your mod](#add-your-mod)
- [How the repository is protected](#how-the-repository-is-protected)
- [Research](#research)
- [Related directories](#related-directories)
- [License](#license)

## What a mod is

A mod is a Claude Code plugin whose `hooks/hooks.json` names a module of function hooks. The hooks receive the client's events (tool calls, prompts, drawing) and can add to the interface or change behaviour: draw a band above the prompt, open a pane, refuse a tool call. Mods arrived in Claude Code 2.1.287 and run in the terminal, in the desktop app and, in part, in the VS Code panel.

```text
turn-meter/
├── .claude-plugin/
│   └── plugin.json      name, version, description
└── hooks/
    ├── hooks.json       { "modules": ["./register.tsx"] }
    └── register.tsx     export const register = (on) => { … }
```

## Install

You need Claude Code 2.1.287 or later; the desktop app runs mods from its bundled 2.1.286.

**In a Claude Code session in the terminal**, one command is enough. If the marketplace is not added yet, Claude Code offers to add it (2.1.275+):

```text
/plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
```

The same in two steps: add the marketplace once, then install mods by name.

```text
/plugin marketplace add KROU4/claude-code-mod-showroom
/plugin install turn-meter@mod-showroom
```

**From a shell** (2.1.292+):

```sh
claude plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
```

If a session is already open, run `/reload-plugins` in it or start a new one.

**In the desktop app** there is no `/plugin` command. Click "+" next to the prompt box, choose Plugins → Add marketplace, enter `KROU4/claude-code-mod-showroom`, then Add plugin. A mod installed from the terminal at user scope also loads in the desktop app.

**In VS Code** a link of the form `vscode://anthropic.claude-code/install-plugin` installs a mod in one click. GitHub does not render such links, so the "Install in VS Code", "Open in terminal" and "Open in Claude desktop" buttons live on each mod's page [on the site](https://krou4.github.io/claude-code-mod-showroom/).

A mod runs inside your session with your permissions. Read an external mod's code before you install it: every entry links to its source.

## Catalog

Each mod says what it draws, who wrote it and where its code lives: "hosted here" means the code is in `mods/<name>/plugin/` and checked by CI, "external" means it lives in the author's repository. The install command is under the fold.

<!-- mods:start -->
Categories: [Interface](#interface) · [Insights](#insights) · [Safety](#safety) · [Productivity](#productivity) · [Git](#git) · [Fun](#fun)

### Interface

- **[Firstmate Calm](https://krou4.github.io/claude-code-mod-showroom/#/mod/fm)** — Hides tool rows and turns the working spinner into a drifting two-row sailboat; toggled with /calm. <sub>draws: slash command, toast, band above the prompt, transcript messages · by @kunchenguid · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install fm --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Intelligent UI](https://krou4.github.io/claude-code-mod-showroom/#/mod/intelligent-ui)** — Claude's answers as typeset pictures: tables, LaTeX math, charts and diagrams rendered by Typst. <sub>draws: slash command, transcript messages, toast · by @razorback16 · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install cc-intelligent-ui --marketplace razorback16/cc-intelligent-ui
  ```

  </details>
- **[Model Effort Band](https://krou4.github.io/claude-code-mod-showroom/#/mod/model-effort-band)** — A colored band above the prompt with the selected model and the effort of its last request. <sub>draws: band above the prompt · by @YeonwooSung · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install model-effort-band --marketplace YeonwooSung/my-claude-code-mods
  ```

  </details>
- **[Show Your Work](https://krou4.github.io/claude-code-mod-showroom/#/mod/show-your-work)** — Claude shows screenshots and Playwright recordings inline in the chat, with before/after and QA. <sub>draws: tool rows, tool for Claude, slash command, pane, status line, toast · by @iamumeransari · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install show-your-work --marketplace iamumeransari/claude-show-your-work
  ```

  </details>
- **[Skins](https://krou4.github.io/claude-code-mod-showroom/#/mod/skins)** — Tool rows with status, timings and +/− counts, shell and table cards, a usage band and 15 themes. <sub>draws: slash command, toast, tool rows, spinner, turn duration line, band above the prompt, tool for Claude, pane · by @hellosverre · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install skins --marketplace hellosverre/claude-skins
  ```

  </details>

### Insights

- **[Agent Radar](https://krou4.github.io/claude-code-mod-showroom/#/mod/agent-radar)** — A live line above the prompt per running subagent or background shell: time, tools, current step. <sub>draws: band above the prompt, toast, slash command, pane · by @hamzafer · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install agent-radar --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Burn Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/burn-meter)** — Session cost above the prompt with a fire bar, plan-limit bars and the price in burritos. <sub>draws: band above the prompt, toast, slash command, pane · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install burn-meter --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Cache Clock](https://krou4.github.io/claude-code-mod-showroom/#/mod/cache-clock)** — A prompt-cache line under your status line: time left while warm, hit rate, misses, re-cache cost. <sub>draws: slash command, status line · by @hamzafer · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install cache-clock --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Context Bar](https://krou4.github.io/claude-code-mod-showroom/#/mod/context-bar)** — A stacked bar above the prompt showing what fills your context window and where it compacts. <sub>draws: band above the prompt, slash command · by @hamzafer · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install context-bar --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Context Gauge](https://krou4.github.io/claude-code-mod-showroom/#/mod/context-gauge)** — See how full the context window is, right in the hint line under the prompt. <sub>draws: hint line · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install context-gauge --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Flightdeck](https://krou4.github.io/claude-code-mod-showroom/#/mod/flightdeck)** — A live pane of your session: context and cost, every permission check, subagents and a session log. <sub>draws: slash command, pane, status line · by @scasella · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install flightdeck --marketplace scasella/claude-flightdeck
  ```

  </details>
- **[Sub Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/sub-meter)** — Your 5-hour and weekly subscription usage as a bar with the reset time, at the bottom right. <sub>draws: mode label · by @midudev · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install sub-meter --marketplace midudev/better-claude
  ```

  </details>
- **[Token Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/token-meter)** — Each turn's input, output and cache tokens plus the session total, in color on the hint line. <sub>draws: hint line · by @midudev · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install token-meter --marketplace midudev/better-claude
  ```

  </details>
- **[Token Weather](https://krou4.github.io/claude-code-mod-showroom/#/mod/token-weather)** — Context fill as weather above the prompt: icon, percent, tokens and a chart of the last 12 turns. <sub>draws: band above the prompt · by @anthropics · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install token-weather --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Tool Timeline](https://krou4.github.io/claude-code-mod-showroom/#/mod/tool-timeline)** — A live pane of every tool call: its status, what it worked on and how long it took. <sub>draws: slash command, pane · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install tool-timeline --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Turn Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/turn-meter)** — Each turn's duration, tool calls and tokens in a band above the prompt, with a 12-turn sparkline. <sub>draws: band above the prompt, toast, slash command · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Safety

- **[Blast Radius](https://krou4.github.io/claude-code-mod-showroom/#/mod/blast-radius)** — Holds risky shell commands, lists the files, commits or migrations they'd touch: Proceed or Cancel. <sub>draws: pane, tool guard, toast · by @anthropics · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install blast-radius --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Secret Guard](https://krou4.github.io/claude-code-mod-showroom/#/mod/secret-guard)** — Stops Claude from reading .env files, private keys and credentials. <sub>draws: tool guard, toast, status line · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install secret-guard --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Productivity

- **[ctx-handoff](https://krou4.github.io/claude-code-mod-showroom/#/mod/ctx-handoff)** — Fresh-chat handoffs, a warm cache while you're away, and project notes from what you teach Claude. <sub>draws: band above the prompt, status line, slash command, tool guard, toast · by @cablate · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install ctx-handoff --marketplace cablate/ctx-handoff-mod
  ```

  </details>
- **[Done Ping](https://krou4.github.io/claude-code-mod-showroom/#/mod/done-ping)** — A native notification when a long turn finishes, so you can look away. <sub>draws: notification, slash command, toast · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install done-ping --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[effortless](https://krou4.github.io/claude-code-mod-showroom/#/mod/effortless)** — Picks the reasoning effort for every prompt and shows a prompt-cache countdown above the prompt. <sub>draws: band above the prompt, turn duration line, slash command · by @HeyCubit · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install effortless --marketplace HeyCubit/effortless
  ```

  </details>
- **[Focus Timer](https://krou4.github.io/claude-code-mod-showroom/#/mod/focus-timer)** — A Pomodoro countdown above the prompt, with pause, stop and an end-of-session notification. <sub>draws: slash command, band above the prompt, toast, notification · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install focus-timer --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Mod Store](https://krou4.github.io/claude-code-mod-showroom/#/mod/mod-store)** — A /mods pane to search community mods, see what each one can access, and install with a confirm. <sub>draws: slash command, pane, tool for Claude, toast · by @hellosverre · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install mod-store --marketplace hellosverre/mod-store
  ```

  </details>
- **[Next Steps](https://krou4.github.io/claude-code-mod-showroom/#/mod/next-steps)** — Up to three suggested next prompts above the input after each answer; press 1-3 to draft one. <sub>draws: band above the prompt, toast · by @anthropics · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install next-steps --marketplace anthropics/claude-plugins-community
  ```

  </details>
- **[Pin Memo](https://krou4.github.io/claude-code-mod-showroom/#/mod/pin-memo)** — Pinned notes and clickable todo checkboxes above the prompt, kept per folder and session. <sub>draws: slash command, band above the prompt, toast · by @YeonwooSung · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install pin-memo --marketplace YeonwooSung/my-claude-code-mods
  ```

  </details>
- **[Prompt Snippets](https://krou4.github.io/claude-code-mod-showroom/#/mod/prompt-snippets)** — Save a prompt once, insert it anywhere with /snip, and quote your selection with /quote. <sub>draws: slash command · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install prompt-snippets --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Replay Theater](https://krou4.github.io/claude-code-mod-showroom/#/mod/replay-theater)** — Step through the last turn's file edits in a pane, one red and green diff at a time. <sub>draws: slash command, pane · by @anthropics · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install replay-theater --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Git

- **[Git Glance](https://krou4.github.io/claude-code-mod-showroom/#/mod/git-glance)** — Branch, changed files and commits ahead or behind upstream, in a status entry under the prompt. <sub>draws: status line · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install git-glance --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Fun

- **[Boss Fight](https://krou4.github.io/claude-code-mod-showroom/#/mod/boss-fight)** — Failing tests spawn a pixel boss with one HP per failure; each run that fixes tests lands a hit. <sub>draws: pane, toast, status line · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install boss-fight --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Code Pet](https://krou4.github.io/claude-code-mod-showroom/#/mod/code-pet)** — A pixel pet in a pane that eats on tool calls, gets sick on failures and panics at rm -rf. <sub>draws: slash command, pane, status line · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install code-pet --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Spinner Pack](https://krou4.github.io/claude-code-mod-showroom/#/mod/spinner-pack)** — Themed spinner packs: moon, braille or coffee verbs and glyphs that follow each phase of a turn. <sub>draws: spinner · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install spinner-pack --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[textless](https://krou4.github.io/claude-code-mod-showroom/#/mod/textless)** — While Claude works, one pixel-art card stands in for the wall of tool steps in the chat. <sub>draws: tool rows, slash command · by @HeyCubit · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install textless --marketplace HeyCubit/effortless
  ```

  </details>
<!-- mods:end -->

## Add your mod

Anyone can add a mod. An entry is one file, `mods/<name>/mod.json`: a title, a description, where to install from and a preview for the site. There are three ways to add it:

1. **The builder on the site** ([Submit a mod](https://krou4.github.io/claude-code-mod-showroom/#/submit)): fill in the form, watch the live preview and open a pull request with one button.
2. **GitHub's web editor**: Add file → Create new file → `mods/<name>/mod.json`.
3. **git**: fork, add the file, `npm ci && npm run check`, open a pull request.

The mod's code can live in your own repository (`source: github`) or right here in `mods/<name>/plugin/`. When every change is inside `mods/<name>/`, the checks pass and you are listed in `maintainers`, the bot merges the pull request by itself. Details are in [CONTRIBUTING.en.md](CONTRIBUTING.en.md); the preview format is in [docs/preview-dsl.md](docs/preview-dsl.md).

## How the repository is protected

- `main` cannot be deleted or rewritten: deletion and force pushes are blocked with no exceptions, administrators included.
- Changes reach `main` only through pull requests.
- The bot merges a pull request by itself only when every file is inside `mods/<name>/`, the Validate check passed for that exact commit, the author maintains the entries they changed (a new entry lists them in `maintainers`) and the `verified` field is untouched. Everything else waits for a maintainer.
- The bot never runs code from a pull request with write access: it reads the pull request through the GitHub API as data.
- Mistakes are fixed with new commits (reverts); history is never rewritten.

The full model is in [docs/governance.md](docs/governance.md). To report a harmful mod, see [SECURITY.md](SECURITY.md).

## Research

[docs/research.md](docs/research.md): how mods work, where and what they draw, the ways to install them and the links that start Claude Code, which mod directories already exist and how this one differs.

## Related directories

Other places to find mods, taken from our survey of the ecosystem in October 2026.

**Directories and indexes**

- [Awesome Claude Code Mods](https://github.com/karanb192/awesome-claude-code-mods) — The largest index of mods: an automatic GitHub scan, `claude plugin validate` on every mod and an access grade; site at [mods.aidojo.si](https://mods.aidojo.si/).
- [statuslin.es](https://statuslin.es/mods) — A curated gallery whose previews are recorded from the real Claude Code and Claude Desktop.
- [claudemods.chat](https://claudemods.chat) — A catalog and marketplace built from one data file, each mod pinned to a reviewed commit.
- [claude-mods.com](https://claude-mods.com/) — A daily GitHub scan with a manual check and surface tags.
- [modsforClaude](https://modsforclaude.com/) — Filters by category and hook type, with reviews tied to a commit.
- [Claude Mods](https://claudemods.ai/) — Hand-moderated, with a daily mod vote and a JSON feed.
- [CCMods Hub](https://ccmodshub.com/) — A gallery of mods in sections.
- [slopshopper](https://github.com/ryx2/slopshopper) — A daily GitHub scan, with previews from running each mod against a fake mods API.
- [awesome-claude-mods](https://github.com/wh000wh000/awesome-claude-mods) — An evidence-graded index rebuilt every two hours.

**Marketplaces and collections**

- [baselane-sh/mods-catalog](https://github.com/baselane-sh/mods-catalog) — A marketplace whose sources are pinned to commits; an entry is one pull request.
- [whyashthakker/awesome-claude-code-mods](https://github.com/whyashthakker/awesome-claude-code-mods) — Original mods with tests and screenshots drawn from Claude Code's test kit.
- [hamzafer/claude-code-mods](https://hamzafer.github.io/claude-code-mods/) — Mods by category, with screenshots.
- [Plagemes/claude-mods](https://plagemes.github.io/claude-mods/) — Original mods plus a store inside the terminal.
- [Mod Store](https://github.com/hellosverre/mod-store) — A store inside the client: a `/mods` pane to search and install.

**From Anthropic**

- [Mods documentation](https://code.claude.com/docs/en/plugins/mods/overview) — Overview, reference, API, testing, administration.
- [Built-in mods](https://github.com/anthropics/claude-code/tree/main/mods) — Source of the mods that ship with Claude Code.
- [claude-code-playground mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) — Demo mods with screenshots.

**Lists**

- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — A large list of Claude Code resources with a Mods section.

## License

The catalog, scripts, site and the mods in `mods/*/plugin/` are under the [MIT license](LICENSE). External mods keep their authors' licenses (the `license` field of each entry).

This is a community project. It is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.

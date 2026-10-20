# Mod Showroom

**A showroom of mods for Claude Code.** A catalog of plugins that change the client itself: bands above the prompt, panes, status entries, notifications, spinners, tool-call guards. The site shows every mod inside a mock of the client, and each one installs with a single command.

**[Open the site](https://krou4.github.io/claude-code-mod-showroom/)** · [Русский](README.md) · [Contributing](CONTRIBUTING.en.md) · [Research](docs/research.md)

[![Validate](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/validate.yml/badge.svg)](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/validate.yml)

The catalog lists <!-- count:start -->56 mods<!-- count:end -->. The repository is also the Claude Code marketplace `mod-showroom`.

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
Categories: [Interface](#interface) · [Insights](#insights) · [Safety](#safety) · [Productivity](#productivity) · [Git](#git) · [Fun](#fun) · [Accessibility](#accessibility)

### Interface

- **[Claudinator](https://krou4.github.io/claude-code-mod-showroom/#/mod/claudinator)** — Six switchable looks for tool rows, the working line and turn receipts, and nine ingredients to mix. <sub>draws: tool rows, turn duration line, slash command, pane, toast · by @patheonsceo · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install claudinator --marketplace patheonsceo/claudinator
  ```

  </details>
- **[Drawer](https://krou4.github.io/claude-code-mod-showroom/#/mod/drawer)** — \`\`\`dot (Graphviz) and \`\`\`svg fences in a reply become pictures in place while the reply streams. <sub>draws: transcript messages · by @Sureffi · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install drawer --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Filetree](https://krou4.github.io/claude-code-mod-showroom/#/mod/filetree)** — A sidebar file tree with git status and +/- line counts; files Claude reads and writes shimmer. <sub>draws: pane, toast, slash command · by @data-goblin · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install filetree --marketplace data-goblin/claude-code-filetree
  ```

  </details>
- **[Firstmate Calm](https://krou4.github.io/claude-code-mod-showroom/#/mod/fm)** — Hides tool rows and turns the working spinner into a drifting two-row sailboat; toggled with /calm. <sub>draws: slash command, toast, band above the prompt, transcript messages · by @kunchenguid · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install fm --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[glowup](https://krou4.github.io/claude-code-mod-showroom/#/mod/glowup)** — A cockpit pane, packs that restyle colors, tool rows and the spinner, and a pixel pet that reacts. <sub>draws: slash command, transcript messages, tool rows, spinner, pane, status line · by @NovusEdge · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install glowup --marketplace NovusEdge/glowup
  ```

  </details>
- **[Image View](https://krou4.github.io/claude-code-mod-showroom/#/mod/image-view)** — Thumbnails of the images you paste, shown above the prompt instead of bare \[Image \#1\] tags. <sub>draws: band above the prompt · by @jarrodwatts · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install image-view --marketplace jarrodwatts/claude-image-view
  ```

  </details>
- **[Intelligent UI](https://krou4.github.io/claude-code-mod-showroom/#/mod/intelligent-ui)** — Claude's answers as typeset pictures: tables, LaTeX math, charts and diagrams rendered by Typst. <sub>draws: slash command, transcript messages, toast, pane · by @razorback16 · external</sub>
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
- **[Status Line Anywhere](https://krou4.github.io/claude-code-mod-showroom/#/mod/statusline-anywhere)** — Runs your own statusLine command and draws its output in color above the prompt in the desktop app. <sub>draws: band above the prompt · by @NathanAB · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install statusline-anywhere --marketplace NathanAB/statusline-anywhere
  ```

  </details>
- **[Stretchtext Replies](https://krou4.github.io/claude-code-mod-showroom/#/mod/cc-stretch)** — Replies arrive short; click an underlined phrase and it grows in place into the longer version. <sub>draws: transcript messages, slash command, band above the prompt, toast · by @pro-vi · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install cc-stretch --marketplace pro-vi/cc-stretch
  ```

  </details>

### Insights

- **[Agent Radar](https://krou4.github.io/claude-code-mod-showroom/#/mod/agent-radar)** — A live line above the prompt per running subagent or background shell: time, tools, current step. <sub>draws: band above the prompt, toast, slash command, pane · by @hamzafer · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install agent-radar --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Burn Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/burn-meter)** — Session cost above the prompt with a fire bar, plan limits and the price in burritos. <sub>draws: band above the prompt, toast, slash command, pane · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install burn-meter --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Cache Clock](https://krou4.github.io/claude-code-mod-showroom/#/mod/cache-clock)** — A prompt-cache line under your status line: time left while warm, hit rate, misses, re-cache tokens. <sub>draws: slash command, status line · by @hamzafer · external</sub>
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
- **[Sub Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/sub-meter)** — Your 5-hour and weekly subscription usage as a bar with the reset time, at the bottom right. <sub>draws: hint line, mode label · by @midudev · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install sub-meter --marketplace midudev/better-claude
  ```

  </details>
- **[Subagents Plus](https://krou4.github.io/claude-code-mod-showroom/#/mod/subagents-plus)** — A live tree and timeline of every subagent in a /subagents pane, plus a band above the prompt. <sub>draws: band above the prompt, slash command, pane, tool for Claude · by @algonormative · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install subagents-plus --marketplace algonormative/subagents-plus
  ```

  </details>
- **[Time Blame](https://krou4.github.io/claude-code-mod-showroom/#/mod/time-blame)** — Under each answer, the turn's time split into Claude, tools, you and other; /blame sums the session. <sub>draws: turn duration line, slash command, pane · by @karanb192 · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install time-blame --marketplace karanb192/time-blame
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
- **[WeekToken](https://krou4.github.io/claude-code-mod-showroom/#/mod/weektoken)** — Rate-limit pace: 5-hour and weekly usage against elapsed time, with a forecast and burn-up history. <sub>draws: band above the prompt, pane, slash command, toast · by @3dnow · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install weektoken --marketplace 3dnow/claude-mods
  ```

  </details>
- **[What's Agent Doing](https://krou4.github.io/claude-code-mod-showroom/#/mod/whats-agent-doing)** — A box above the prompt saying what the agent is doing right now, for how long, and each step so far. <sub>draws: band above the prompt · by @tzafrir · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install whats-agent-doing --marketplace tzafrir/whats-agent-doing
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

- **[Command Buttons](https://krou4.github.io/claude-code-mod-showroom/#/mod/command-buttons)** — Run and Copy buttons for each shell command in a reply, plus a hotkey band above the prompt. <sub>draws: transcript messages, band above the prompt, toast · by @Faridmurzone · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install command-buttons --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
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
- **[Model Hint](https://krou4.github.io/claude-code-mod-showroom/#/mod/model-hint)** — Suggests haiku, sonnet or opus for the prompt you are typing, with a reason and a Switch button. <sub>draws: band above the prompt, slash command, status line, toast · by @hashswingingslasher · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install model-hint --marketplace hashswingingslasher/model-hint
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

- **[Boss Fight](https://krou4.github.io/claude-code-mod-showroom/#/mod/boss-fight)** — Failing tests spawn a pixel boss with one HP per failure; each run that fixes tests lands a hit. <sub>draws: pane, toast, status line, slash command · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install boss-fight --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Brickfall](https://krou4.github.io/claude-code-mod-showroom/#/mod/brickfall)** — A loud Arkanoid brick breaker in a pane: steer with the mouse, catch capsules, chain volt bricks. <sub>draws: pane, slash command · by @reporails · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install brickfall --marketplace reporails/arcade
  ```

  </details>
- **[Cat Spinner](https://krou4.github.io/claude-code-mod-showroom/#/mod/cat-spinner)** — A pixel-art cat walks above the spinner, sits down to think and reacts to Claude's tools. <sub>draws: slash command, pane, spinner · by @swicken · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install cat-spinner --marketplace swicken/cat-spinner
  ```

  </details>
- **[Clawd Pet](https://krou4.github.io/claude-code-mod-showroom/#/mod/clawd-pet)** — A pixel Clawd above the prompt that shows the running tool, cheers passing tests and naps when idle. <sub>draws: band above the prompt, slash command · by @Revono · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install clawd-pet --marketplace Revono/clawd-pet
  ```

  </details>
- **[Code Pet](https://krou4.github.io/claude-code-mod-showroom/#/mod/code-pet)** — A pixel pet in a pane that eats on tool calls, gets sick on failures and panics at rm -rf. <sub>draws: slash command, pane, status line, toast · by @OneWave-AI · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install code-pet --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Fables](https://krou4.github.io/claude-code-mod-showroom/#/mod/fables)** — A live cartoon above the prompt: Sonnet or Haiku retells tool calls and replies as captioned scenes. <sub>draws: band above the prompt, slash command · by @henrik-thevibe · external</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install fables --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Mindful Breathing](https://krou4.github.io/claude-code-mod-showroom/#/mod/mindful-breathing)** — A guided breathing animation above the prompt while Claude works; the spinner counts the breath. <sub>draws: band above the prompt, spinner, slash command · by @halluton · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install mindful-claude --marketplace halluton/Mindful-Claude
  ```

  </details>
- **[Minefield](https://krou4.github.io/claude-code-mod-showroom/#/mod/minefield)** — Minesweeper in a pane: clear a 9×9 board with the mouse or the keys while Claude works. <sub>draws: pane, slash command · by @reporails · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install minefield --marketplace reporails/arcade
  ```

  </details>
- **[miod](https://krou4.github.io/claude-code-mod-showroom/#/mod/miod)** — A tune made up on the spot for every task; its mood follows what the agent does and its token pace. <sub>draws: band above the prompt, slash command, toast · by @delexw · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install miod --marketplace delexw/miod
  ```

  </details>
- **[Spinner Pack](https://krou4.github.io/claude-code-mod-showroom/#/mod/spinner-pack)** — Themed spinner packs: moon, braille or coffee verbs and glyphs that follow each phase of a turn. <sub>draws: spinner · by @KROU4 · hosted here</sub>
  <details><summary>Install</summary>

  ```text
  /plugin install spinner-pack --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Storytime](https://krou4.github.io/claude-code-mod-showroom/#/mod/storytime)** — A tiny local transformer types a short story above the prompt about what Claude is working on. <sub>draws: band above the prompt, slash command · by @maddiedreese · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install storytime --marketplace maddiedreese/cc-storytime
  ```

  </details>
- **[Terminal Gym](https://krou4.github.io/claude-code-mod-showroom/#/mod/terminal-gym)** — A daily rep goal above the prompt: log sets with +5/+10/+25 and keep a streak while Claude works. <sub>draws: band above the prompt, spinner, toast, slash command, pane · by @DrumAndCode · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install terminal-gym --marketplace DrumAndCode/terminal-gym
  ```

  </details>
- **[textless](https://krou4.github.io/claude-code-mod-showroom/#/mod/textless)** — While Claude works, one pixel-art card stands in for the wall of tool steps in the chat. <sub>draws: tool rows, slash command · by @HeyCubit · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install textless --marketplace HeyCubit/effortless
  ```

  </details>
- **[Verbs](https://krou4.github.io/claude-code-mod-showroom/#/mod/verbs)** — A looping pixel-art picture of the spinner's verb (188 in all) above the spinner while Claude works. <sub>draws: slash command, spinner, toast · by @olliewagner · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install verbs --marketplace olliewagner/verbs
  ```

  </details>

### Accessibility

- **[RTL Terminal](https://krou4.github.io/claude-code-mod-showroom/#/mod/rtl-terminal)** — Arabic, Hebrew, Persian and Urdu replies laid out right-to-left, with bullets on the right. <sub>draws: transcript messages, band above the prompt, slash command · by @MohammedSaud404 · external</sub>
  <details><summary>Install (from the author’s marketplace)</summary>

  ```text
  /plugin install rtl-terminal --marketplace MohammedSaud404/rtl-terminal
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

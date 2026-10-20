# Claude Code mods: research summary

State as of 2026-10-20. This is a short English summary; the full report with tables and sources is in Russian: [research.md](research.md). The raw list of mod repositories is in [ecosystem.md](ecosystem.md).

## Key findings

- **What a mod is.** A Claude Code plugin whose `hooks/hooks.json` has a `modules` key pointing at one TypeScript or JavaScript module. The module runs inside the Claude Code process, receives the client's events through a middleware chain (`($, e, next)`) and can draw interface: panes, a band above the prompt, rewritten messages and tool rows, spinners, toasts, a status entry. Product name: Claude Mods; engineering term: function hooks.
- **Timeline.** Proposed on 2026-09-03 in [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870); usable behind `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` from 2.1.261; named Claude Mods on 2026-09-09; released on 2026-10-01 in Claude Code 2.1.287 (desktop app from 2.1.286), with official docs, a launch post and sample mods. Later releases kept adding API (for example `$.ui.notify` in 2.1.295, text sizes and weights in 2.1.299); the latest version at the time of the research was 2.1.304.
- **Growth.** The karanb192 scanner counted 5,667 mods in 2,912 repositories on 2026-10-20, up from 31 on 2026-09-15 and 359 on 2026-10-02. GitHub topics: `claude-code-mod` 677 repositories, `claude-code-mods` 247.
- **Where mods draw.** Fully in the terminal; in the desktop app's Code tab with known bugs; partly in the VS Code chat panel (extension 2.1.299+, the band above the prompt is not drawn there). Hooks run without drawing in `claude -p`, the Agent SDK and cloud sessions; Cowork, side chats and Remote Control views draw no mod UI.
- **Distribution.** Mods ship through ordinary plugin marketplaces (`.claude-plugin/marketplace.json` at the repository root); npm is barely used. Catalog extras belong in `plugins[i].metadata`, the only place where unknown keys do not make `claude plugin validate --strict` fail.
- **Security.** Mods are not sandboxed: they can read and write files, run processes and reach the network, and installing one shows no capability prompt. By the scanner's grading, 2,976 of 5,667 mods write files or run processes and 626 use the network. `claude plugin validate <path>` lists a mod's hooks and calls without running it.

## Installing

| Where | How | Since |
|---|---|---|
| Terminal session | `/plugin install <mod> --marketplace <owner>/<repo>` | 2.1.275 (asks to confirm the marketplace) |
| Shell | `claude plugin install <mod> --marketplace <owner>/<repo>` | 2.1.292 |
| Desktop Code tab | `/plugin` does not work there; use "+" next to the prompt, then Plugins / Add marketplace / Add plugin, or install from a terminal at user scope | mods from 2.1.286 |
| VS Code | `vscode://anthropic.claude-code/install-plugin?plugin=<name>&marketplace=<owner/repo>`: the only real one-click install link | — |

Links that open Claude Code with a prompt typed but not sent: `claude-cli://open?q=…` (terminal, up to 5,000 characters) and `claude://code/new?q=…` (desktop app). GitHub strips these schemes from rendered Markdown, so working buttons need a website. No documented link adds a marketplace or installs a plugin in the desktop app; the feature request [#62481](https://github.com/anthropics/claude-code/issues/62481) is still open.

## Other directories

Coverage and access analysis are already well served: karanb192's index at [mods.aidojo.si](https://mods.aidojo.si/) (5,667 mods, `claude plugin validate` on each, access grades), [modsforclaude.com](https://modsforclaude.com/) (637), [claude-mods.com](https://claude-mods.com/) (278), [Baselane](https://baselane-sh.github.io/mods-catalog/) (199, pinned commits), [claudemods.chat](https://claudemods.chat) (27 mods, static footprint). There are also three stores inside the client (hellosverre/mod-store, Plagemes, karanb192's mod-finder) and about 30 collections. The name `awesome-claude-code-mods` is used by at least five repositories, which is why this project is called Mod Showroom.

Visual previews are the gap. Only [statuslin.es](https://statuslin.es/mods) shows mods inside the real client (recordings of the real Claude Code and Claude Desktop, 25 curated mods). Others show text, authors' images, or test-kit render trees painted in a browser. On 2026-10-05 a Reddit user asked for exactly this: a place with real previews, because the biggest index is text only.

## What Mod Showroom adds

- Every entry is drawn inside a faithful mock of the client on three surfaces: terminal, desktop app and VS Code (no other directory shows VS Code). Colors, glyphs and layout come from the 2.1.302 binary and the desktop app's CSS. When a surface does not draw what a mod uses, the mock says so instead of faking it.
- Several mods can be combined into one loadout and seen together, with one block of install commands.
- Install buttons are real links: the VS Code install link, a terminal link with the command typed, and a desktop link with a prompt that asks Claude to run the install.
- The repository is also the marketplace `mod-showroom`; capability labels for hosted mods come from `claude plugin validate --json`; an entry is one file added by pull request.

Limits to state plainly: the previews are declarative mocks, not recordings of the real client; the catalog is small (36 entries on 2026-10-20, 9 of them hosted in the repository); the desktop and VS Code mocks were built from documentation and CSS, not from screenshots of the live app.

## How this was researched

Five sweeps on 2026-10-20: directories and sites, official docs and the CHANGELOG, web sources and the timeline, GitHub repositories, and social sources (Hacker News, Reddit through the Arctic Shift mirror, anthropics/claude-code issues). Two more studies covered the mods API (the type declarations of build 2.1.299) and the client's exact look. The merged results hold 338 candidate repositories (239 confirmed by finding `modules` in a `hooks/hooks.json` through the GitHub API), 80 records about directories and collections, and 146 sourced facts.

Honest gaps: a GitHub code-search sweep did not finish, and the planned per-repository verification was replaced by verifying only the repositories added to the catalog, because the user asked to stop the research and work with the findings. Reddit was read through a mirror, several sites did not open, and third-party counts are the sources' own claims. Some points stay unverified, for example whether a `/plugin install` command delivered through `claude-cli://open?q=` runs when the person presses Enter, and whether mods load through claude.ai plugin sync.

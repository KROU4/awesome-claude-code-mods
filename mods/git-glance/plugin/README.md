# git-glance

Branch, changed files and commits ahead or behind upstream, in a status entry under the prompt.

## What it draws

One status entry under the prompt with the git state of the session's folder:

```text
⎇ feature/discount-codes · 3 changed · ↑2 ↓0
```

Other states it shows:

```text
⎇ main · clean · ↑0 ↓2
⎇ fix/cart-rounding · clean
⎇ detached HEAD · 1 changed
```

- **N changed** counts every entry `git status` lists: modified, staged and untracked files. `clean` means none.
- **↑ and ↓** are the commits the branch is ahead of and behind its upstream. A branch with no upstream, or whose upstream is gone, shows no arrows.
- **detached HEAD** means no branch is checked out.
- Outside a git repository, or where git is not installed, the entry is removed.

The entry refreshes:

- when the session starts;
- one second after the last Edit, Write, MultiEdit, NotebookEdit, Bash or PowerShell call, unless Claude Code ran it read-only, as it does a shell `ls`. Calls close together share one refresh;
- every 30 seconds, to catch changes made outside Claude.

It runs `git rev-parse --abbrev-ref HEAD` and `git status --porcelain=v1 -b` in the session's folder with `GIT_OPTIONAL_LOCKS=0`, so it never holds the index lock your own git commands need. One refresh runs at a time. Git never runs inside a tool call, so no tool waits on it.

## Install

- Terminal: `/plugin install git-glance --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install git-glance --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- A change made outside Claude can take up to 30 seconds to show.
- The counts are files, not lines. An untracked folder counts as one entry, as `git status` lists it.

## License

MIT. See [LICENSE](LICENSE).

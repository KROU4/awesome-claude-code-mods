# prompt-snippets

Save a prompt once, insert it anywhere with /snip, and quote your selection with /quote.

## What it draws

Each command answers in one row under the command:

```text
> /snip save review
  Saved snippet review with your last prompt. /snip review inserts it.

> /snip list
  | Name       | Snippet                                                       |
  | ---------- | ------------------------------------------------------------- |
  | commit-msg | Write a conventional commit message for the staged changes.… |
  | explain    | Explain what this function does, step by step.                |
  | review     | Review the staged diff for bugs, missing tests and unclear n… |

> /snip commit-msg
  Inserted snippet commit-msg.

> /quote
  Quoted the selection into the prompt.
```

- The `/snip list` answer is drawn as Markdown, so the table renders as a table in the terminal and in the desktop app. Every other answer is Claude Code's own row.
- Snippets are kept across sessions in the mod's own store.
- Where the session has no prompt box a mod can fill (the desktop app, `claude -p`), `/snip <name>` and `/quote` leave the box alone and answer the text to copy:

```text
> /snip commit-msg
  This session has no prompt box a mod can fill (the desktop app, claude -p). Copy it from here:

    Write a conventional commit message for the staged changes. Keep the subject under 72 characters.
```

## Commands

| Command | What it does |
| --- | --- |
| `/snip save <name>` | Saves the last prompt you sent. Saving under an existing name replaces it. |
| `/snip <name>` | Inserts the snippet into the terminal's prompt box at the cursor. |
| `/snip list` | Answers a table of your snippets: each name and its first 60 characters. |
| `/snip rm <name>` | Removes a snippet. |
| `/quote` | Puts your current mouse selection into the prompt as `> ` lines, followed by a blank line. |

- `/snip save` takes the last prompt you sent from the terminal, the desktop app or Remote Control. Slash commands, reminders and messages from other sessions, agents or channels do not count.
- In a session resumed before you sent anything, `/snip save` reads the transcript instead: the last user message that is not a command line, a tool result, a reminder, the summary `/compact` leaves, or a teammate or channel message.
- Names are 1 to 32 characters of `a-z`, `0-9` and `-`. `save`, `list`, `rm` and `help` are taken by the subcommands.
- Both commands run at once, even while Claude is answering.
- Errors answer plainly, for example `No snippet named x. /snip list shows yours.`

## Install

- Terminal: `/plugin install prompt-snippets --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install prompt-snippets --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- Only the terminal's prompt box takes text from a mod. The desktop app draws its own, and `claude -p` has none.
- `/quote` reads the mouse selection in the desktop app and in the terminal's fullscreen layout. The terminal's main screen never shows a mod its selection, and `/quote` says so there.
- All snippets together hold at most 4 MiB.

## License

MIT. See [LICENSE](LICENSE).

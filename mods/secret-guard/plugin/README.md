# secret-guard

Stops Claude from reading .env files, private keys and credentials.

## What it draws

When Claude tries to read a secret-looking file, the call is refused and Claude is told to ask you for what it needs. A toast names the file, and a status entry counts the blocks in this session:

```text
Bash(cat config/.env.production)
  secret-guard: config/.env.production looks like a secret; ask the person to share what is needed.

toast    ⊘ blocked Bash: config/.env.production
status   secret-guard · 1 blocked
```

If the check itself fails, the call is refused too.

### What counts as a secret

- `.env` and `.env.*`, except `.env.example`, `.env.sample` and `.env.template`
- `*.pem` and `*.key`
- `id_rsa*` and `id_ed25519*`, public keys included (allow `*.pub` to let them through)
- `.npmrc`, `.pypirc`, `credentials.json` and `.aws/credentials`
- anything under a `.ssh/` folder

Matching ignores case and treats `\` and `/` alike. It looks at the file name and at every folder in the path, so `C:\Users\me\.ssh\config`, `~/.aws/credentials` and `C:\repo\.env::$DATA` are all caught.

### What is refused

- **File tools**: Read, Edit, Write, NotebookEdit and Grep (its `path` and `glob`) on such a path. MultiEdit and NotebookRead too, on builds that have them.
- **Shell**: Bash, PowerShell and Monitor commands that read such a path. Readers include `cat`, `less`, `head`, `tail`, `grep` (also `grep -f .env`), `sed`, `awk`, `base64`, `xxd`, `cp`, `mv`, `scp`, `rsync`, `tar`, `curl`, `source`, `python -c`, `Get-Content`, `type` and `[IO.File]::ReadAllText(...)`.
- The shell check also catches `< .env`, `bash -c "..."`, `cmd /c ...`, `ssh host '...'`, `eval "..."`, `$(...)`, `find ... -exec cat`, `... | xargs cat`, `xargs -a .env`, `kubectl exec pod -- cat` and `git show HEAD:.env`. A wildcard such as `.env*` is tried against typical secret names.
- A reader counts only where it runs: as the command, after wrappers such as `sudo`, `env`, `timeout` and `xargs`, after `-exec` or `--`, or as a git subcommand. Text that only mentions a file passes: `git commit -m "Move .env loading into config"`, a here-document body, a single-quoted string.
- Writing (`echo X=1 >> .env`, `cp .env.example .env`), listing (`ls -la .env`) and a grep pattern (`grep -rn ".env" src`) are not reads, so they pass.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `extraPatterns` | string | `""` | Comma-separated globs that also count as secrets, e.g. `.envrc, *.secret, config/prod/*.yml`. |
| `allow` | string | `""` | Comma-separated globs that always pass, checked first, e.g. `fixtures/**, *.pub`. |

In a glob, `*` stays within a folder, `**` crosses folders and `?` is one character. A glob without `/` matches the file name or any folder name. A glob with `/` matches the end of the path.

Set them with `/config`, or in settings under `pluginConfigs["secret-guard@mod-showroom"].options`.

## Install

- Terminal: `/plugin install secret-guard --marketplace KROU4/claude-code-mod-showroom`
- Shell: `claude plugin install secret-guard --marketplace KROU4/claude-code-mod-showroom`
- Desktop app: + next to the prompt box → Plugins → Add marketplace `KROU4/claude-code-mod-showroom` → Add plugin

## Limits

- The shell check reads command lines by their spelling. It is a seatbelt against accidental reads, not a sandbox.
- It does not look inside `docker exec <container> ...` without `--`, or inside the `$(...)` of an unquoted here-document.
- MCP tools are not checked.

## License

MIT. See [LICENSE](LICENSE).

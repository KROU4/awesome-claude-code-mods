# Как устроено управление репозиторием / Governance

[По-русски](#по-русски) · [In English](#in-english)

## По-русски

Каталог правят все: любой может предложить изменение через pull request из форка. Простые изменения записей сливает бот, остальное смотрит мейнтейнер каталога. Историю `main` нельзя потерять: её нельзя удалить или переписать никому, включая администратора.

### Защита ветки main

Два набора правил GitHub (rulesets) на ветку `main`:

| Набор правил | Что запрещает | Кто может обойти |
| --- | --- | --- |
| «main: never deleted or rewritten» | Удаление ветки и force-push (`deletion`, `non_fast_forward`) | Никто, в том числе администратор |
| «main: changes through pull requests» | Прямые коммиты: изменения попадают только через pull request; одобрения не требуются | Только роль администратора репозитория |

GitHub Actions на личном репозитории нельзя добавить в исключения, поэтому бот тоже меняет `main` только через pull request: открывает его и сам сливает. Для этого в настройках включено «Allow GitHub Actions to create and approve pull requests».

### Что бот сливает сам

Бот (workflow [Automerge](../.github/workflows/automerge.yml), решение принимает [scripts/policy.mjs](../scripts/policy.mjs)) сливает pull request, только если выполнено всё сразу:

1. Проверка Validate прошла именно для последнего коммита запроса. Validate запускает код запроса, поэтому её успех — проверка качества, а не защита: всё, что важно для безопасности, бот перепроверяет сам, а сборка каталога пропускает записи, не прошедшие схему.
2. Все изменённые файлы лежат внутри `mods/<имя>/` (записей может быть несколько). Файлы добавлены, изменены, переименованы или удалены внутри этих папок. Файлов не больше 60, каждый до 2 МБ. Разрешены json, md, ts, tsx, js, mjs, cjs, mts, cts, jsx, d.ts, png, jpg, jpeg, gif, webp, svg, mp4, webm, txt, wav, mp3, ogg и `LICENSE` без расширения. Символические ссылки и подмодули не принимаются. Файл, размер или тип которого бот не смог определить, тоже не сливается. Имена папок и файлов состоят из латинских букв, цифр, `.`, `-` и `_`, не заканчиваются точкой, не совпадают с именами, зарезервированными в Windows (`CON`, `NUL`, `COM1` и т. п.), и два имени не отличаются только регистром: иначе маркетплейс перестанет клонироваться в Windows или macOS.
3. Для каждой записи, которая уже есть в `main`, автор запроса указан в её `maintainers` в версии из `main` (регистр не важен). Для новой записи автор указан в `maintainers` новой записи. Мейнтейнер сверяется по логину и по числовому id GitHub: id записывается в `data/maintainers.json`, когда каталог впервые видит логин, и потом не меняется. Если логин теперь принадлежит другому аккаунту, бот не сливает запрос. Если в `main` у папки записи нет читаемого `mod.json`, бот тоже не сливает: такую запись нельзя «забрать», вписав себя в `maintainers`.
4. Удалить запись (её `mod.json`) может только её мейнтейнер: это следует из пункта 3.
5. Поле `verified` не изменилось: если его не было, его нет и сейчас, а новая запись его не задаёт. Запросы, меняющие запись с `verified: true` (код, `sha`, `ref` или само поле), бот не сливает: их смотрит мейнтейнер каталога.
6. Запрос не черновик, на нём нет метки `hold`, он направлен в `main` и открыт не самим ботом.
7. `mod.json` каждой затронутой записи проходит проверку каталога из `main` (схема, имя папки, правила имён плагинов): бот проверяет его сам, не полагаясь на Validate запроса.
8. Код, который люди уже поставили, не меняется. У записи из `main`, которую раздаёт наш маркетплейс (`hosted`, `github`, `git`), ничего не меняется в `mods/<имя>/plugin/`, а у любой записи из `main` не меняется `source` (`type`, `repo`, `url`, `path`, `ref`, `sha`, `plugin`, `marketplace`): от него зависит, откуда ставится мод. Новая запись под именем, у папки которого есть история в `main`, тоже считается изменением кода: те, кто поставил прежний мод, получили бы её как обновление. Первую версию нового мода бот сливает сам: у неё ещё нет установок.
9. Запрос добавляет не больше одной новой записи, и каждый `mod.json` меньше 64 КБ: каталог скачивает каждый посетитель сайта.
10. Кто сделал мод, бот подтверждает только для автора запроса. Если новая запись или правка указывает автором (`author.github`) другой логин, добавляет в `maintainers` кого-то кроме автора запроса или показывает в названии, описаниях в одну строку и имени автора слова, значки и ссылки, похожие на одобрение (`official`, `verified`, `anthropic`, «официальный», ✓, anthropic.com, claude.ai), либо слова, смешивающие латиницу с кириллицей или греческим, запрос смотрит мейнтейнер.

Бот берёт список файлов, их размеры и режимы и `mod.json` из этого же коммита (`compare main...<sha>` и дерево `<sha>`) и сливает именно его: `gh pr merge <номер> --squash --delete-branch --match-head-commit <sha>` (ветку из форка GitHub не трогает). Затем он запускает workflow Sync, который обновляет `registry.json`, маркетплейс, README и сайт.

Примеры:

| Запрос | Что делает бот |
| --- | --- |
| Мейнтейнер `turn-meter` меняет превью в `mods/turn-meter/mod.json` | Сливает |
| Мейнтейнер `turn-meter` меняет `mods/turn-meter/plugin/hooks/register.tsx` | Метка `needs-maintainer`: код уже поставленного мода |
| Мейнтейнер внешнего мода меняет `source.sha` или `source.marketplace` | Метка `needs-maintainer`: новый источник |
| Новый мод `neon-band` с кодом в `plugin/` от автора, указанного в `maintainers` | Сливает |
| Два новых мода в одном запросе или `author.github: "anthropics"` от другого логина | Метка `needs-maintainer` |

### Что бот не сливает

Всё остальное: изменения скриптов, workflow, схемы, сайта, документации, файлы вне `mods/<имя>/`, правки чужих записей и записей с `verified: true`, установку `verified`, изменения кода и источника модов из каталога, всё, что не прошло пункты 7–10. Такие запросы получают метку `needs-maintainer` и один комментарий бота с причинами по-английски и по-русски. Комментарий обновляется при каждой новой проверке, а когда запрос слит или осталась только упавшая проверка Validate, бот снимает метку. Если не прошла сама проверка Validate, бот не ставит метку, а даёт ссылку на журнал проверки.

Запрос, который меняет только генерируемые файлы (`registry.json`, `.claude-plugin/marketplace.json`, `README.md`, `README.en.md`, `data/`), не запускает Validate, а значит, бот его не комментирует и не размечает. Это запросы синхронизации самого бота; запрос человека с такими изменениями мейнтейнер смотрит в общем списке.

### Как бот защищён

- В workflow с правом записи бот никогда не забирает и не запускает код из pull request. Он забирает ветку по умолчанию (доверенные скрипты) и читает запрос через GitHub API как данные, всегда по SHA коммита: список файлов из `compare main...<sha>`, их размеры и режимы из дерева `<sha>`, `mod.json` в `main` и в `<sha>`. Так бот не может принять решение по одному коммиту, а слить другой.
- Номер запроса приходит из артефакта недоверенного прогона Validate. Бот принимает его только как положительное целое число и действует, только если последний коммит, репозиторий и ветка запроса совпадают с теми, что проверила Validate. Иначе он ничего не пишет и не ставит меток. Если артефакта нет (Validate не запустилась или запрос изменил её), бот ищет открытый запрос по тем же трём признакам.
- Схему из `main` бот применяет к `mod.json` запроса как к данным; для этого задание ставит зависимости из `package-lock.json` ветки `main` с `--ignore-scripts`.
- Automerge реагирует только на запуски файла `.github/workflows/validate.yml`: workflow с тем же именем, добавленный в запросе, не считается.
- `pull_request_target` не используется нигде. Ни один скрипт и ни один workflow не делает force-push. Действия (actions) закреплены по SHA коммита, Dependabot обновляет их.
- Validate запускает код запроса (тесты, `claude plugin test`) с токеном только на чтение и без секретов.
- Анализ модов (статический `claude plugin validate` модов из репозитория и внешних репозиториев) идёт в задании Sync только на чтение. Его результат задание `verify` проверяет одними bash и jq ([scripts/verify-catalog-artifact.sh](../scripts/verify-catalog-artifact.sh)): в `data/` только ожидаемые файлы, id в `data/maintainers.json` не меняются, источник каждого плагина в маркетплейсе совпадает с его `mod.json`, README меняется только в генерируемых блоках. Задание с правом записи лишь коммитит проверенные файлы через pull request и само не запускает ни npm, ни node, ни claude. Свой pull request синхронизации бот сливает с `--match-head-commit`, а Sync и выкладка сайта работают только из `main`. Сайт выкладывается, если сборка и проверка прошли, даже когда слить pull request синхронизации не удалось.
- Первые pull request новых участников GitHub может держать до одобрения запуска workflow мейнтейнером. Это настройка репозитория, а не решение бота.

### Метки

| Метка | Что значит |
| --- | --- |
| `needs-maintainer` | Бот не может слить запрос сам; его посмотрит мейнтейнер. |
| `hold` | Не сливать автоматически, даже если правила выполнены. Ставит мейнтейнер; автор может попросить об этом в комментарии. |
| `report` | Сообщение о сломанном или вредном моде. |
| `suggestion` | Предложение добавить мод. |
| `discovery` | Еженедельный список найденных модов, которых нет в каталоге. |

Формы issue молча пропускают метки, которых в репозитории нет, поэтому еженедельное задание Discover создаёт недостающие ([scripts/lib/constants.mjs](../scripts/lib/constants.mjs), `REPO_LABELS`).

### Как обжаловать решение

Если бот отказал, а вы считаете, что правило применено неверно, ответьте в комментарии к запросу и опишите, почему. Мейнтейнер каталога прочитает и сольёт запрос вручную или объяснит, что поправить. Если вы хотите взять на себя запись, автор которой пропал, откройте issue со ссылкой на запись: мейнтейнер может добавить вас в `maintainers`.

### Как исправляют ошибки

Ничего не переписывается и не удаляется. Ошибочный коммит отменяют новым коммитом: `git revert <sha>` в отдельной ветке и pull request. Удалённую запись возвращают тем же способом. Вредный мод убирают из каталога pull request, удаляющим его запись; маркетплейс и сайт обновятся после слияния. Как сообщить о вредном моде — в [SECURITY.md](../SECURITY.md).

### Что значит verified

`verified: true` ставит только мейнтейнер каталога после того, как прочитал код мода на закреплённой версии: для мода из этого репозитория — код в `main`, для внешнего мода нужен `sha` коммита (проверка каталога этого требует). У мода из чужого маркетплейса версию закрепить нельзя. Это не гарантия безопасности, а отметка, что код читал человек. Бот не сливает запросы, которые меняют это поле или запись с `verified: true`: после любого изменения кода мейнтейнер читает его заново.

## In English

Everyone edits the catalog: anyone can propose a change with a pull request from a fork. The bot merges simple entry changes, and a catalog maintainer reviews everything else. The history of `main` cannot be lost: nobody, administrators included, can delete or rewrite it.

### How main is protected

Two GitHub rulesets on `main`:

| Ruleset | What it blocks | Who can bypass |
| --- | --- | --- |
| "main: never deleted or rewritten" | Deleting the branch and force pushes (`deletion`, `non_fast_forward`) | Nobody, administrators included |
| "main: changes through pull requests" | Direct commits: changes land only through pull requests; no approvals required | The repository admin role only |

GitHub Actions cannot be a bypass actor on a personal repository, so the bot also changes `main` only through pull requests it opens and merges itself, with "Allow GitHub Actions to create and approve pull requests" turned on.

### What the bot merges by itself

The bot (the [Automerge](../.github/workflows/automerge.yml) workflow; [scripts/policy.mjs](../scripts/policy.mjs) decides) merges a pull request only when all of this holds:

1. The Validate check passed for the pull request's exact head commit. Validate runs the pull request's code, so its success is a quality check, not a safeguard: the bot re-checks everything that matters for security itself, and the catalog build skips entries that fail the schema.
2. Every changed file is inside `mods/<name>/` (any number of entries), added, modified, renamed or removed within those folders; at most 60 files, none over 2 MB; allowed types only: json, md, ts, tsx, js, mjs, cjs, mts, cts, jsx, d.ts, png, jpg, jpeg, gif, webp, svg, mp4, webm, txt, wav, mp3, ogg, and `LICENSE` without an extension. No symbolic links or submodules. A file whose size or type the bot could not determine is not merged either. Folder and file names use ASCII letters, digits, `.`, `-` and `_`, do not end with a dot, are not names Windows reserves (`CON`, `NUL`, `COM1`, …), and no two differ only in case: otherwise the marketplace stops checking out on Windows or macOS.
3. For every entry that already exists on `main`, the PR author is in the `maintainers` of the version on `main` (case-insensitive). For a new entry, the author is in the new entry's `maintainers`. A maintainer is matched by login and by numeric GitHub id: the id goes into `data/maintainers.json` the first time the catalog sees the login and never changes after that, so a login that now belongs to another account is not merged. A folder on `main` without a readable `mod.json` is not merged either: nobody can adopt it by listing themselves in `maintainers`.
4. Removing an entry (deleting its `mod.json`) is allowed only for its maintainers; rule 3 covers it.
5. `verified` is unchanged versus `main`: absent stays absent, and a new entry does not set it. Pull requests that change an entry with `verified: true` (its code, `sha`, `ref` or the field itself) are not merged by the bot: a catalog maintainer reviews them.
6. The pull request is not a draft, has no `hold` label, targets `main` and was not opened by the bot itself.
7. The `mod.json` of every entry it touches passes the catalog check of `main` (schema, folder name, plugin-name rules): the bot checks it itself instead of trusting the pull request's Validate run.
8. Code people already installed does not change. For an entry on `main` that our marketplace serves (`hosted`, `github`, `git`), nothing under `mods/<name>/plugin/` changes, and for any entry on `main` its `source` (`type`, `repo`, `url`, `path`, `ref`, `sha`, `plugin`, `marketplace`) stays the same: it decides where installs come from. A new entry whose folder has history on `main` counts as a code change too: whoever installed the earlier mod would get it as an update. The first version of a new mod is merged by the bot: it has no installs yet.
9. The pull request adds at most one new entry, and every `mod.json` is under 64 KB: every visitor of the site downloads the catalog.
10. The bot vouches only for the pull request's author. When a new entry or an edit names another login as `author.github`, adds anyone but the author to `maintainers`, or shows words, marks or links that read as an endorsement in the title, taglines or author name (`official`, `verified`, `anthropic`, ✓, anthropic.com, claude.ai), or a word that mixes Latin with Cyrillic or Greek letters, a maintainer reviews it.

The bot takes the file list, the sizes and modes, and `mod.json` from that same commit (`compare main...<sha>` and the tree of `<sha>`) and merges exactly it: `gh pr merge <number> --squash --delete-branch --match-head-commit <sha>` (GitHub leaves a fork's branch alone). Then it starts the Sync workflow, which regenerates `registry.json`, the marketplace, the READMEs and the site.

Examples:

| Pull request | What the bot does |
| --- | --- |
| A maintainer of `turn-meter` changes the preview in `mods/turn-meter/mod.json` | Merges |
| A maintainer of `turn-meter` changes `mods/turn-meter/plugin/hooks/register.tsx` | `needs-maintainer`: code people already installed |
| A maintainer of an external mod changes `source.sha` or `source.marketplace` | `needs-maintainer`: a new source |
| A new mod `neon-band` with code in `plugin/`, from the author it lists in `maintainers` | Merges |
| Two new mods in one pull request, or `author.github: "anthropics"` from another login | `needs-maintainer` |

### What the bot will not merge

Everything else: changes to scripts, workflows, the schema, the site, the docs, any file outside `mods/<name>/`, edits to entries you do not maintain or to entries with `verified: true`, setting `verified`, changes to the code or source of listed mods, anything that fails rules 7–10. Those pull requests get the `needs-maintainer` label and one bot comment listing the reasons in English and Russian, updated on every new check; the bot takes the label off once the pull request is merged or only a failed Validate run is left. When Validate itself failed, the bot adds no label and links to the check's log instead.

A pull request that changes only generated files (`registry.json`, `.claude-plugin/marketplace.json`, `README.md`, `README.en.md`, `data/`) starts no Validate run, so the bot neither comments on it nor labels it. Those are the bot's own sync pull requests; a person's pull request like that is reviewed from the pull request list.

### How the bot is protected

- In the workflow that holds a write token, the bot never checks out or runs pull request code. It checks out the default branch (trusted scripts) and reads the pull request through the GitHub API as data, always by commit SHA: the file list from `compare main...<sha>`, sizes and modes from the tree of `<sha>`, `mod.json` on `main` and at `<sha>`. It cannot decide on one commit and merge another.
- The pull request number comes from an artifact of the untrusted Validate run. The bot accepts it only as a positive integer and acts only when the pull request's head commit, repository and branch equal the ones Validate checked; otherwise it writes nothing and adds no label. Without the artifact (Validate did not start, or the pull request changed it), the bot looks up the open pull request by those same three values.
- The bot applies the schema from `main` to the pull request's `mod.json` as data; for that, the job installs dependencies from `main`'s `package-lock.json` with `--ignore-scripts`.
- Automerge reacts only to runs of the file `.github/workflows/validate.yml`: a workflow with the same name added by a pull request does not count.
- `pull_request_target` is not used anywhere. No script or workflow force-pushes. Actions are pinned to commit SHAs, and Dependabot updates them.
- Validate runs the pull request's code (tests, `claude plugin test`) with a read-only token and no secrets.
- The analysis of mods (static `claude plugin validate` of hosted mods and external repositories) runs in a read-only Sync job. Its output is checked by the `verify` job with bash and jq only ([scripts/verify-catalog-artifact.sh](../scripts/verify-catalog-artifact.sh)): only the expected files in `data/`, no recorded id in `data/maintainers.json` changes, every marketplace plugin's source equals its `mod.json`, and the READMEs change only in their generated blocks. The job with a write token only commits the checked files through a pull request and runs no npm, node or claude itself. The bot merges its sync pull request with `--match-head-commit`, and Sync and the site deploy run from `main` only. The site deploys when the build and the check passed, even if merging the sync pull request failed.
- GitHub may hold the first pull requests of new contributors until a maintainer approves running workflows. That is a repository setting, not the bot's decision.

### Labels

| Label | Meaning |
| --- | --- |
| `needs-maintainer` | The bot cannot merge this by itself; a maintainer will review it. |
| `hold` | Do not merge automatically, even when the rules hold. A maintainer sets it; authors can ask for it in a comment. |
| `report` | A report about a broken or harmful mod. |
| `suggestion` | A suggestion to list a mod. |
| `discovery` | The weekly list of mods found on GitHub that the catalog lacks. |

Issue forms silently drop labels the repository does not have, so the weekly Discover job creates the missing ones ([scripts/lib/constants.mjs](../scripts/lib/constants.mjs), `REPO_LABELS`).

### How to appeal

If the bot refused and you think a rule was applied wrongly, reply on the pull request and say why. A catalog maintainer will read it and either merge by hand or explain what to change. To take over an entry whose author has gone quiet, open an issue linking the entry: a maintainer can add you to `maintainers`.

### How mistakes are undone

Nothing is rewritten or deleted. A bad commit is undone with a new one: `git revert <sha>` on a branch, then a pull request. A removed entry comes back the same way. A harmful mod leaves the catalog through a pull request that deletes its entry; the marketplace and the site update after the merge. To report a harmful mod, see [SECURITY.md](../SECURITY.md).

### What verified means

`verified: true` is set only by a catalog maintainer who has read the mod's code at a pinned version: the code on `main` for a hosted mod, and a commit `sha` for an external one (the catalog check requires it). A mod from someone else's marketplace cannot be pinned. It is not a safety guarantee: it says a person read the code. The bot does not merge pull requests that change the field or an entry with `verified: true`: after any code change a maintainer reads it again.

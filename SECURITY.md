# Security / Безопасность

[In English](#in-english) · [По-русски](#по-русски)

## In English

### Installing a mod runs its code

A mod is code that Claude Code loads into your session. It runs with your permissions: depending on what it calls, it can read and write files, start programs, make network requests, see every tool call and prompt, refuse tool calls or change prompts. Read a mod's code before you install it, especially an external one. Every entry links to its source, and the site shows what `claude plugin validate` found in the code: the hooks it receives and the API calls it makes. The calls the official admin guide asks reviewers to look at are flagged: `$.fs.read`, `$.fs.write`, `$.process.run`, `$.process.spawn`, `$.http.fetch`, `$.env.get`, `$.env.set`, `$.settings.read`, `$.mcp.call`, `$.model.complete`, `$.prompt.submit`, `$.session.send`, and the hooks `tool.call`, `prompt.submit`, `session.append`, `tool.check`.

### What the catalog checks, and what it does not

- Hosted mods (code in `mods/<name>/plugin/`) pass `claude plugin validate --strict` and their own `claude plugin test` on every change.
- External mods are validated statically when the sync job can clone them. Nothing is installed or run.
- The automerge bot merges a new entry when the checks pass and its author is a listed maintainer. **A merged entry has not been read by a person** unless it is marked verified. Once a mod is listed, the bot no longer merges changes to its code or its `source`: a catalog maintainer reads those first, so an update cannot slip new code to the people who installed it.
- **verified** means a catalog maintainer read the mod's code at a pinned version (a commit `sha` for external mods). It is a reading, not a guarantee. The bot does not merge changes to a verified entry: a catalog maintainer reads the new code first.
- The flags "sees prompts and can change them" and "sees tool calls and can refuse them" come from the hooks a mod registers: they say what the code is in a position to do, not that it does it.

### Reporting a harmful mod

If a listed mod steals data, runs unexpected commands, hides what it does, or a public report would help an attacker, report it privately through a [GitHub security advisory](https://github.com/KROU4/claude-code-mod-showroom/security/advisories/new). Include the mod's name, what it does and how you found out. A confirmed harmful mod is removed from the catalog and the marketplace through a pull request, and an issue explains why once that is safe to say.

For a mod that is merely broken, open a [report issue](https://github.com/KROU4/claude-code-mod-showroom/issues/new?template=report-mod.yml). For a vulnerability in the catalog itself (the scripts, the workflows, the site), use the same private advisory link. If that link does not open a form for you, open an issue titled "Private report" with no details, and a maintainer will reach out.

## По-русски

### Установка мода запускает его код

Мод — это код, который Claude Code загружает в вашу сессию. Он работает с вашими правами. В зависимости от того, что он вызывает, мод может читать и писать файлы, запускать программы, ходить в сеть, видеть каждый вызов инструмента и каждый промпт, отклонять вызовы и менять промпты. Перед установкой прочитайте код мода, особенно внешнего. У каждой записи есть ссылка на исходники, а сайт показывает, что нашла в коде `claude plugin validate`: какие хуки мод получает и какие вызовы API делает. Вызовы и хуки, на которые официальное руководство администратора просит смотреть в первую очередь, отмечены отдельно.

### Что каталог проверяет, а что нет

- Моды из этого репозитория (`mods/<имя>/plugin/`) при каждом изменении проходят `claude plugin validate --strict` и свои тесты `claude plugin test`.
- Внешние моды проверяются статически, когда задание синхронизации может их склонировать. Ничего не устанавливается и не запускается.
- Бот сливает новую запись, если проверки прошли и автор указан в `maintainers`. **Слитую запись человек не читал**, если она не отмечена verified. Когда мод уже в каталоге, изменения его кода или `source` бот не сливает: их сначала читает мейнтейнер каталога, поэтому обновление не подсунет новый код тем, кто мод уже поставил.
- **verified** означает, что мейнтейнер каталога прочитал код мода на закреплённой версии (для внешнего мода нужен `sha` коммита). Это отметка о прочтении, а не гарантия. Изменения записи с verified бот не сливает: новый код сначала читает мейнтейнер каталога.
- Отметки «видит промпты и может их менять» и «видит вызовы инструментов и может их отклонять» берутся из хуков, которые мод регистрирует: они говорят, что код может сделать, а не что он это делает.

### Как сообщить о вредном моде

Если мод из каталога крадёт данные, запускает неожиданные команды, скрывает, что делает, или публичный отчёт поможет злоумышленнику, сообщите приватно через [GitHub security advisory](https://github.com/KROU4/claude-code-mod-showroom/security/advisories/new). Укажите имя мода, что он делает и как вы это обнаружили. Подтверждённо вредный мод удаляется из каталога и маркетплейса через pull request, а когда об этом можно говорить открыто, причину объясняет issue.

Если мод просто сломан, откройте [issue по шаблону](https://github.com/KROU4/claude-code-mod-showroom/issues/new?template=report-mod.yml). Об уязвимости в самом каталоге (скрипты, workflow, сайт) сообщайте по той же приватной ссылке. Если ссылка не открывает форму, создайте issue с заголовком «Private report» без подробностей, и мейнтейнер свяжется с вами.

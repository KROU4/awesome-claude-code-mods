<!--
Adding or changing a mod? The bot merges this pull request by itself when every item below holds.
Добавляете или меняете мод? Бот сольёт запрос сам, если выполнены все пункты ниже.
Rules / правила: docs/governance.md
-->

**What this changes / Что меняется:**

- [ ] Every changed file is inside `mods/<name>/` (anything else waits for a maintainer). / Все файлы внутри `mods/<имя>/`.
- [ ] My GitHub login is in the entry's `maintainers`. / Мой логин есть в `maintainers`.
- [ ] `npm run check` passes locally, or I used the online builder. / `npm run check` проходит или запись собрана конструктором.
- [ ] The preview shows what the mod really draws. / Превью показывает то, что мод рисует на самом деле.
- [ ] I did not set or change `verified`. / Поле `verified` не трогал.
- [ ] Hosted mod only: `plugin/` has tests, and `claude plugin validate --strict` and `claude plugin test` pass. / Только для мода в этом репозитории: в `plugin/` есть тесты, обе проверки проходят.

# Как добавить мод

[English](CONTRIBUTING.en.md)

Каталог открыт для всех. Мод попадает в него одним файлом `mods/<имя>/mod.json`, а код может лежать в вашем репозитории или прямо здесь. Если запрос не выходит за папку `mods/<имя>/`, проверки прошли и вы указаны в `maintainers`, бот сольёт его без участия человека.

- [Три способа добавить мод](#три-способа-добавить-мод)
- [Справочник mod.json](#справочник-modjson)
- [Откуда ставить: source](#откуда-ставить-source)
- [Превью](#превью)
- [Когда бот сливает сам](#когда-бот-сливает-сам)
- [Мод в этом репозитории](#мод-в-этом-репозитории)
- [Команды](#команды)

## Три способа добавить мод

1. **Конструктор на сайте.** Откройте [Submit a mod](https://krou4.github.io/claude-code-mod-showroom/#/submit), заполните форму и посмотрите превью в макете клиента. Кнопка «Open a pull request on GitHub» откроет GitHub с готовым файлом: GitHub сам сделает форк и предложит создать pull request.
2. **Веб-интерфейс GitHub.** В репозитории нажмите Add file → Create new file, введите путь `mods/<имя>/mod.json`, вставьте запись (образец ниже) и выберите «Propose changes».
3. **git.** Сделайте форк, создайте `mods/<имя>/mod.json`, выполните `npm ci && npm run check` и откройте pull request.

Минимальная запись для мода в вашем репозитории:

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

Поле `$schema` включает подсказки и проверку в редакторе. Полная схема — [schema/mod.schema.json](schema/mod.schema.json).

## Справочник mod.json

| Поле | Обязательное | Что писать |
| --- | --- | --- |
| `name` | да | Имя плагина: то же, что в `.claude-plugin/plugin.json` мода и в имени папки. Строчные латинские буквы, цифры и дефис, до 50 символов. Не может начинаться с `claude-`, `anthropic-`, `cc-plugin-` и не должно содержать слово `claude` отдельно: так требует `claude plugin validate`. |
| `title` | да | Название на сайте, 2–40 символов. |
| `tagline` | да | Одна строка по-английски о том, что мод даёт человеку, 8–100 символов. |
| `tagline_ru` | нет | То же по-русски, до 110 символов. |
| `description` | да | Абзац по-английски, 20–700 символов. Можно `код` в обратных кавычках. |
| `description_ru` | нет | Тот же абзац по-русски, до 800 символов. |
| `author` | да | `{ "name", "github"?, "url"? }`; `url` только https. |
| `maintainers` | да | 1–10 логинов GitHub, которые могут менять запись без мейнтейнера каталога. Новая запись должна содержать автора запроса. |
| `category` | да | Одна из: `interface`, `insights`, `safety`, `productivity`, `git`, `integrations`, `fun`, `accessibility`. |
| `tags` | нет | До 8 меток: строчные буквы, цифры, дефис, до 24 символов. |
| `license` | да | SPDX-идентификатор лицензии кода мода, например `MIT`. |
| `version` | нет | Semver, например `0.1.0`. Для мода в этом репозитории маркетплейс берёт версию из plugin.json. |
| `homepage` | нет | https-ссылка на страницу мода. |
| `source` | да | Откуда ставить, см. [ниже](#откуда-ставить-source). |
| `surfaces` | нет | Где вы мод проверили: `terminal`, `desktop`, `vscode`, `mobile`. |
| `requires` | нет | `{ "claudeCode": ">=2.1.299" }` — минимальная версия Claude Code. |
| `capabilities` | нет | Что мод делает помимо рисования: `network`, `processes`, `filesystem` (`none`, `read`, `write`), `model`, `promptRewrite`, `blocksTools`. CI вычисляет их сам из `claude plugin validate`, если может прочитать код; укажите их для кода, который CI прочитать не может. |
| `preview` | да | Что мод рисует, для макета клиента на сайте, см. [превью](#превью). |
| `media` | нет | До 6 картинок или видео: `{ "type": "image" \| "video", "src", "alt", "surface"? }`. `src` — https-ссылка или путь относительно mod.json (`media/band.png`), файл до 2 МБ. |
| `verified` | — | Ставят только мейнтейнеры каталога: код на закреплённой версии прочитан человеком. Бот не сольёт запрос, который меняет это поле. |

## Откуда ставить: source

| `type` | Поля | Когда |
| --- | --- | --- |
| `hosted` | — | Код лежит здесь, в `mods/<имя>/plugin/`. Проверяется CI при каждом изменении. |
| `github` | `repo` (`owner/repo`), `path`?, `ref`?, `sha`? | Плагин в корне репозитория GitHub или в папке `path`. `sha` (40 символов) закрепляет коммит, и тогда ставится ровно он. |
| `git` | `url` (https, оканчивается на `.git`), `path`?, `ref`?, `sha`? | Любой git-хостинг. |
| `marketplace` | `marketplace` (`owner/repo` с `.claude-plugin/marketplace.json`), `plugin`?, `repo`?, `path`? | Мод уже есть в вашем маркетплейсе. Каталог только показывает его, а команды установки ведут в ваш маркетплейс. |

Моды с источниками `hosted`, `github` и `git` попадают в маркетплейс `mod-showroom` этого репозитория. Мод ставится командой `/plugin install <имя> --marketplace KROU4/claude-code-mod-showroom`.

## Превью

Сайт рисует каждый мод внутри макета Claude Code по описанию из `preview`: за элементами мода идёт сцена (`coding`, `debugging`, `review`, `idle`) или ваша переписка `transcript`. В `elements` от 1 до 10 элементов. Каждый элемент — это место в клиенте (`slot`) и то, что мод там рисует. Строки (`rows`, `row`) состоят из сегментов: строка текста, `{ "text", "color", "bold", "dim", ... }`, кнопка `{ "button", "hotkey" }`, полоса прогресса `{ "bar": 0.4 }`, спарклайн `{ "spark": [1, 3, 2] }`, ссылка `{ "link", "href" }`, клавиша `{ "kbd": "ctrl+x" }`. Цвета — токены темы Claude Code (`claude`, `success`, `error`, `warning`, `suggestion`, `subtle`, `inactive` и другие) или `#rrggbb`.

| `slot` | Пример | Где рисуется |
| --- | --- | --- |
| `above-prompt` | `{ "slot": "above-prompt", "rows": [["Last turn 3m 5s"]] }` | Терминал, десктоп |
| `pane` | `{ "slot": "pane", "title": "Timeline", "width": "narrow", "rows": [["✓ Read src/a.ts"]] }` | Везде |
| `status` | `{ "slot": "status", "text": "⎇ main · 3 changed" }` | Терминал, десктоп |
| `toast` | `{ "slot": "toast", "text": "Slow turn: 3m 5s" }` | Терминал, десктоп |
| `notification` | `{ "slot": "notification", "title": "Claude Code", "text": "Done in 1m 40s" }` | Терминал, десктоп |
| `command` | `{ "slot": "command", "command": "/snip", "args": "list", "markdown": "…" }` | Терминал, десктоп |
| `tool-deny` | `{ "slot": "tool-deny", "tool": "Bash", "input": "cat .env", "message": "Blocked" }` | Везде |
| `prompt-rewrite` | `{ "slot": "prompt-rewrite", "before": "fix it", "after": "Fix the failing test in …" }` | Везде |
| `spinner` | `{ "slot": "spinner", "verb": "Eclipsing", "glyphs": ["◐", "◓"] }` | Везде |
| `prompt-hint` | `{ "slot": "prompt-hint", "row": [{ "text": "ctx 62%", "color": "warning" }] }` | Терминал, десктоп |
| `session-mode` | `{ "slot": "session-mode", "row": ["focus"] }` | Терминал, десктоп |
| `turn-duration` | `{ "slot": "turn-duration", "text": "Brewed for 12s · 3 tools" }` | Терминал |
| `tool-row` | `{ "slot": "tool-row", "tool": "Read", "input": "src/a.ts", "row": ["182 lines"] }` | Везде |
| `message` | `{ "slot": "message", "role": "note", "markdown": "**Heads up:** …" }` | Везде |
| `info-notice` | `{ "slot": "info-notice", "row": ["2 mods loaded · /mods"] }` | Терминал |
| `model-tool` | `{ "slot": "model-tool", "name": "search_docs", "input": "hooks", "result": [["3 hits"]] }` | Везде |
| `background` | `{ "slot": "background", "text": "Saves each prompt to a journal" }` | Ничего не рисует |

Что рисует каждый слот и все его поля — в [docs/preview-dsl.md](docs/preview-dsl.md). Показывайте то, что мод действительно рисует: превью сверяют с кодом, а у мода из этого репозитория бот берёт список хуков и вызовов из `claude plugin validate`.

## Когда бот сливает сам

Бот сливает pull request без человека, только если выполнено всё сразу:

1. Проверка Validate прошла для последнего коммита запроса.
2. Все изменённые файлы лежат внутри `mods/<имя>/` (записей может быть несколько). Файлов не больше 60, каждый до 2 МБ. Разрешены типы: json, md, ts, tsx, js, mjs, cjs, mts, cts, jsx, png, jpg, jpeg, gif, webp, svg, mp4, webm, txt, wav, mp3, ogg и файл `LICENSE`. Символические ссылки не принимаются.
3. Для записи, которая уже есть в каталоге, вы есть в её `maintainers` (регистр не важен). Для новой записи вы указаны в `maintainers` новой записи.
4. Удалить запись может только её мейнтейнер.
5. Поле `verified` не изменилось (новая запись его не задаёт).
6. Запрос не черновик, на нём нет метки `hold`, он направлен в `main`.

Если что-то не так, бот ставит метку `needs-maintainer` и пишет один комментарий с причинами по-английски и по-русски. Тогда запрос посмотрит мейнтейнер каталога. Если не прошла сама проверка Validate, бот даёт ссылку на её журнал: исправьте ошибку и отправьте новый коммит. Подробности и как обжаловать решение — в [docs/governance.md](docs/governance.md).

## Мод в этом репозитории

Код можно положить прямо в каталог (`"source": { "type": "hosted" }`):

```text
mods/<имя>/
├── mod.json
└── plugin/
    ├── .claude-plugin/plugin.json   "name": "<имя>", версия, описание
    ├── hooks/
    │   ├── hooks.json               { "modules": ["./register.tsx"] }
    │   ├── register.tsx
    │   └── <имя>.test.tsx           тесты для claude plugin test
    ├── types/index.d.ts             если мод использует $.state
    └── README.md
```

Что проверяет CI для такого мода:

- `claude plugin validate --strict mods/<имя>/plugin` — манифест, модуль и использование API без предупреждений;
- `claude plugin test mods/<имя>/plugin` — ваши тесты `*.test.ts` и `*.test.tsx` (тестовый набор `claude-code/testing`);
- имя в `plugin.json` совпадает с `name`, в `hooks.json` ровно один модуль, и он лежит внутри `plugin/`.

После слияния бот обновляет `registry.json`, `.claude-plugin/marketplace.json`, README и сайт, а из отчёта `claude plugin validate --json` вычисляет, какие хуки и вызовы API использует мод. Сайт показывает их в разделе «What it touches». Код модов из этого репозитория распространяется по лицензии MIT, если в записи не указана другая.

## Команды

Нужен Node.js 22 или новее. Для проверок модов нужен Claude Code 2.1.287+ (`claude` в PATH); без него эти проверки пропускаются с предупреждением.

| Команда | Что делает |
| --- | --- |
| `npm ci` | Ставит зависимости (только ajv). |
| `npm run check` | Полная проверка каталога: схема, структура, медиа, `claude plugin validate --strict` и `claude plugin test` для модов в репозитории. |
| `npm run check:entry -- <имя>` | Быстрая проверка одной записи по схеме. |
| `npm test` | Тесты скриптов каталога. |
| `npm run analyze` | Сводка `claude plugin validate --json` по каждому моду в `data/analysis/`. |
| `npm run build:registry` | Собирает `registry.json`, `.claude-plugin/marketplace.json` и блоки README. Обычно это делает бот. |
| `npm run enrich` | Звёзды и даты с GitHub в `data/github.json` (с `GITHUB_TOKEN`, если он есть). |
| `npm run discover` | Ищет на GitHub моды, которых нет в каталоге (топики `claude-code-mod`, `claude-code-mods`, `claude-mod`). |

Поведение в сообществе — по [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). О вредном моде сообщайте по [SECURITY.md](SECURITY.md).

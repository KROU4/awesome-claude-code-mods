# Моды Claude Code: исследование экосистемы

Состояние на 2026-10-20. [English summary](research.en.md) · [Сырой список репозиториев с модами](ecosystem.md)

Отчёт собран из пяти обзоров (каталоги и сайты, официальная документация и CHANGELOG, веб и хронология, репозитории GitHub, соцсети и issues), разбора файла типов API модов и разбора внешнего вида клиента. Как это делалось и чего не хватает, описано в разделе [Методика и ограничения](#методика-и-ограничения).

## Содержание

- [Кратко](#кратко)
- [Что такое моды](#что-такое-моды)
- [Хронология](#хронология)
- [Как ставят и распространяют](#как-ставят-и-распространяют)
- [Экосистема в цифрах](#экосистема-в-цифрах)
- [Каталоги и сайты](#каталоги-и-сайты)
- [Чем отличается Mod Showroom](#чем-отличается-mod-showroom)
- [Возможности API](#возможности-api)
- [Риски и безопасность](#риски-и-безопасность)
- [Методика и ограничения](#методика-и-ограничения)
- [Источники](#источники)

## Кратко

- **Мод** — это плагин Claude Code, у которого в `hooks/hooks.json` есть ключ `modules` с путём к модулю на TypeScript или JavaScript. Модуль работает внутри процесса клиента, перехватывает события и может рисовать интерфейс. Моды вышли 2026-10-01 в версии 2.1.287 (в десктопном приложении с 2.1.286). Предложены они 2026-09-03 в issue [#91870](https://github.com/anthropics/claude-code/issues/91870) под названием Function Hooks.
- **Рост очень быстрый.** Сканер karanb192 на 2026-10-20 насчитал **5667 модов в 2912 репозиториях**, почти все репозитории созданы в октябре 2026. Для сравнения: 2026-09-15 модов было 31, 2026-10-02 — 359. На GitHub тема `claude-code-mod` есть у 677 репозиториев, `claude-code-mods` — у 247.
- **Каталогов уже много:** около 30 коллекций, около 10 сайтов-каталогов и 3 магазина модов внутри самого клиента. Показать мод в настоящем клиенте умеет только statuslin.es (25 модов, записи настоящего Claude Code и Claude Desktop). Остальные дают текст, картинки авторов или деревья отрисовки из тестового набора.
- **Установка одной строкой:** `/plugin install <мод> --marketplace <owner>/<repo>` в сессии (с 2.1.275) или `claude plugin install <мод> --marketplace <owner>/<repo>` в shell (с 2.1.292). Настоящая установка в один клик есть только в VS Code: ссылка `vscode://anthropic.claude-code/install-plugin`. Для терминала и десктопа есть только ссылки, которые открывают сессию с готовым текстом промпта. Ссылки, которая добавляет маркетплейс в десктопе, нет: запрос [#62481](https://github.com/anthropics/claude-code/issues/62481) открыт.
- **Где моды рисуют:** полностью — в терминале, с ограничениями и ошибками — во вкладке Code десктопного приложения, частично — в панели чата VS Code (с расширения 2.1.299). В `claude -p`, Agent SDK, облачных сессиях, Cowork и Remote Control хуки либо работают без отрисовки, либо не работают вовсе.
- **Безопасность:** моды не изолированы, у них есть доступ к файлам, процессам и сети, а установка не показывает, что мод может делать. По данным сканера, 2976 из 5667 модов пишут файлы или запускают процессы, 626 ходят в сеть. Посмотреть возможности мода без запуска можно командой `claude plugin validate`.
- **Наш угол:** Mod Showroom показывает каждый мод в макете клиента на трёх поверхностях (терминал, десктоп, VS Code), позволяет собрать несколько модов вместе и ставит их настоящими ссылками. В каталоге 36 записей, 9 модов лежат в самом репозитории.
- **Объём исследования:** 338 репозиториев-кандидатов (239 подтверждены проверкой дерева файлов), 80 записей о каталогах и коллекциях, 146 фактов с источниками. Поиск по коду GitHub не был доведён до конца, проверка каждого репозитория заменена проверкой только тех, что вошли в каталог.

## Что такое моды

### Мод и соседние механизмы

Официальная формулировка из обсуждения #91870: мод — это обычный плагин, который использует функциональные хуки. Название продукта — Claude Mods, инженерный термин — function hooks.

| | Классический плагин | Settings hook | `statusLine` | Мод |
|---|---|---|---|---|
| Что это | Набор команд, агентов, skills, MCP-серверов, хуков | Команда shell, HTTP-запрос или промпт на событие (`PreToolUse` и др.) | Скрипт, который печатает строку статуса | Модуль TS/JS с функцией `register(on, options)` |
| Где выполняется | Части плагина работают как обычно | Отдельный процесс | Отдельный процесс | Внутри процесса Claude Code, в его TypeScript-рантайме |
| Рисует интерфейс | Нет (кроме тем и стилей вывода) | Нет | Одну строку в терминале | Да: 15 мест отрисовки, панели, полоса над промптом, тосты, статус |
| Меняет поведение | Через свои хуки | Разрешить или запретить, добавить контекст | Нет | Перехват событий по цепочке `next()`: переписать аргументы, промпт, результат, отказать |
| Десктоп | Да | — | Нет: вкладка Code не запускает скрипты `statusLine` | Да, с 2.1.286 |
| Как ставится | Маркетплейс | `settings.json` или плагин | `settings.json` | Маркетплейс, как любой плагин |

Из-за того, что вкладка Code не запускает `statusLine`, появилось много модов, которые переносят строку статуса в десктоп (ctxline-desktop, ccstatusline-desktop, desktop-statusline, claude-dashboard).

Рядом есть и другие способы менять вид клиента без модов: свои темы (`/theme`, файлы `themes/<slug>.json` в плагине, с недели 17 2026 года) и стили вывода (`output-styles/<name>.md`).

### Устройство мода

```text
my-mod/
├── .claude-plugin/
│   └── plugin.json        name, version, description (+ types, если нужен $.state)
├── hooks/
│   ├── hooks.json         {"modules": ["./register.tsx"]}
│   └── register.tsx       export const register = (on, options) => { ... }
├── types/index.d.ts       только для $.state и своих пространств имён
└── *.test.ts              запускает claude plugin test
```

Правила из документации и встроенного скилла `plugin-authoring`:

- В `modules` ровно один путь, относительно `hooks.json`. Ключ `modules` и делает плагин модом. В том же файле могут лежать и классические хуки под ключом `hooks`.
- Расширения модуля: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx`. Только ES-модули, без `import()`. Единственный разрешённый голый импорт — `'claude-code'`. JSX работает с фабрикой `h`.
- Хук подписывается так: `on(pattern, matcher?, hook)`, сам хук получает `($, e, next)`, как промежуточный слой в Koa или Express.
- `$` нельзя деструктурировать или присвоить (`const ui = $.ui` не пройдёт проверку). Имя события — только строковый литерал.
- Элементы интерфейса берутся из `$.ui.resolve(e)`, глобальных элементов нет.
- Порядок модов задаёт клиент: [org-prepend] [user] [org-append] [built-in], мод сам свой порядок не выбирает.
- Сообщество чаще всего пишет модуль на TSX (3577 модов в скане karanb192) или TS (1682), обычно в файле `register.tsx` или `register.ts`.

Лимиты: хук работает до 10 секунд (`prompt.edit` до 50 мс), `.catch` — 1 с; `$.store` — до 4 МиБ JSON; одно дерево отрисовки — до 100000 символов текста; `$.ui.invalidate` — до 10 раз в секунду (30 для показанной панели); `Link` — до 2048 символов. Панель, которую мод открывает сам, появится только при ширине терминала от 144 колонок (от 110, если пользователь уже открывал её вручную).

Встроенные моды: `cc-plugin-agents-md`, `cc-plugin-diff` (команда `/diff`), `cc-plugin-plugin-authoring` (только скилл), `cc-plugin-sec-default`, `cc-plugin-telemetry`, `cc-plugin-you-should-know`. Исходники четырёх из них лежат в [anthropics/claude-code/mods](https://github.com/anthropics/claude-code/tree/main/mods).

Выключить моды можно так: отключить плагин в `/plugin`, запустить с `--safe-mode`, поставить `"disableAllHooks": true`. Организация может оставить только свои моды настройкой `allowManagedModsOnly`. Встроенные моды эти выключатели не трогают.

### Где что рисуется

Места отрисовки (`e.component` в `ui.render`):

| Место | Где в клиенте | Терминал | Десктоп | VS Code |
|---|---|---|---|---|
| `Pane` | Панель в рамке: сбоку в fullscreen от 110 колонок, иначе над промптом | да | да | да |
| `UserMessage`, `AssistantMessage` | Сообщения в транскрипте | да | да | да |
| `ToolUse`, `ToolResult`, `ToolGroup` | Строки вызова инструментов и результатов | да | да | да |
| `AskUserQuestion` | Диалог вопроса | да | да | да |
| `Spinner` | Строка во время хода | да | да | да |
| `AbovePrompt` | Полоса над полем ввода, общая для всех модов | да | да | нет |
| `CommandOutput` | Вывод slash-команды | да | да | нет |
| `SessionMode` | Метки режимов справа в футере | да | да | нет |
| `PromptHint` | Строка подсказки под промптом | да | да | нет |
| `ToolProgress` | Плашка «в фон» под инструментом | да | нет | нет |
| `TurnDuration` | Строка конца хода (`Baked for 3s`) | да | нет | нет |
| `InfoNotice` | Тусклая строка под логотипом | да | нет | нет |

Диалог разрешений мод перерисовать не может, только добавить под ним строку через `$.ui.notice`.

Элементы по поверхностям:

| Элемент | terminal | desktop | vscode | mobile |
|---|---|---|---|---|
| `Box`, `Text`, `Button`, `Link`, `Code`, `Markdown` | да | да | да | да |
| `Input`, `Select` | да | да | да | нет |
| `Svg` | нет | да | да | да |
| `Client` | да | да | нет | нет |
| `Raster`, `Image` | да | нет | нет | нет |

Если в дереве есть элемент, которого поверхность не умеет, дерево отклоняется целиком и рисуется вариант клиента.

Оговорки:

- **VS Code.** Документация обещает отрисовку в панели чата с расширения 2.1.299 (2.1.304 для сессий без загрузки флагов, например Bedrock). При этом в файле типов сборки 2.1.299 написано, что у VS Code пока нет поверхности. По issues: сначала не рисовалось ничего ([#99045](https://github.com/anthropics/claude-code/issues/99045)), позже появились сообщения о полосе над промптом ([#102594](https://github.com/anthropics/claude-code/issues/102594)). Поддержку стоит считать частичной и меняющейся.
- **Mobile** объявлена в типах, но при Remote Control с телефона или десктопа интерфейс модов не рисуется.
- **Десктоп** рисует, но с известными ошибками: первый клик по панели без фокуса только даёт фокус ([#99395](https://github.com/anthropics/claude-code/issues/99395)), любое изменение состояния перерисовывает все места и ломает кнопки ([#99211](https://github.com/anthropics/claude-code/issues/99211)), команды из `$.command.register` там не работают (#99691), `PromptHint` не вызывается (#100116). В боковых чатах, Cowork и проектах моды не рисуют.

## Хронология

| Дата | Событие |
|---|---|
| 2026-05-26 | Открыт запрос [#62481](https://github.com/anthropics/claude-code/issues/62481): ссылка, которая открывает в десктопе «Add marketplace» с готовым адресом. На 2026-10-20 он всё ещё открыт. |
| 2026-09-03 | poteat (Anthropic) открыл [#91870](https://github.com/anthropics/claude-code/issues/91870) «Function Hooks»: функции на TypeScript в стиле Koa, объект `$`, продолжение через `next`. В тот же день Monte9 выложил эталонную реализацию, вечером вышла 2.1.260. |
| 2026-09-04…05 | В 2.1.261 скрытый рантайм включается переменной `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, первые пробы сообщества. ray-amjad завёл первый список модов. |
| 2026-09-09 | Обновление в #91870: продукт называется Claude Mods, function hook остаётся инженерным термином. Опубликованы исходники встроенных модов sec-default, diff и telemetry. |
| 2026-09-14 | Борис Черный (@bcherny) написал, что моды «приземляются», с примером Tetris-мода (sezaakgun/cc-arcade). Около 619 тысяч просмотров. |
| 2026-09-15 | Создан karanb192/awesome-claude-code-mods. Первый скан: 14 из 31 мода могут запускать процессы. |
| 2026-09-17 | 2.1.275: `/plugin install <plugin> --marketplace <source>` в сессии. |
| 2026-09-18…23 | Поддержка AGENTS.md сделана на модах (встроенный `agents-md`). |
| 2026-09-22 | Разбор безопасности от pluto.security. |
| 2026-09-25 | Открыт anthropics/claude-code-playground с образцами token-weather, blast-radius, replay-theater. |
| 2026-09-29 | Интервью Latent Space с Thariq Shihipar о модах. |
| 2026-10-01 | Выход: 2.1.287 (CHANGELOG: «Added Claude Mods: plugins may now modify deeper behavior»), встроенный мод You should know. Десктоп с 2.1.286. Пост в блоге claude.com, руководство на claude.dev (Addy Osmani), раздел документации, витрина claude.dev/mods. Переменная-флаг больше не нужна. Пост «Introducing Claude Mods» на Reddit набрал 1118 очков. |
| 2026-10-02 | У части пользователей моды выключены удалённо на 2.1.288 ([#99130](https://github.com/anthropics/claude-code/issues/99130)). Первые статьи на других языках (Gigazine). |
| 2026-10-05 | На Reddit просят сайт с наглядными превью: существующий каталог «весь текстовый». |
| 2026-10-06 | 2.1.292: `claude plugin install --marketplace` в shell. Видео «Mods in Claude Code» на официальном канале. |
| 2026-10-14 | Отрисовка в панели чата VS Code с расширения 2.1.299. |
| 2026-10-15 | Мод cc-stretch набрал 1343 очка на Reddit. |
| 2026-10-19 | 2.1.304, последняя версия в CHANGELOG на момент исследования. |
| 2026-10-20 | Сканер karanb192: 5667 модов в 2912 репозиториях. |

Что добавлялось в API после выхода (по CHANGELOG):

| Версия | Добавлено |
|---|---|
| 2.1.288 | `$.ui.selection()` |
| 2.1.289 | `ui.fault`; `agent.spawn` для тиммейтов; `validate` проверяет и плагин рядом с marketplace.json |
| 2.1.290 | Типы `ThemeKey` и `Color`; `ceiling` и `agentId` в `tool.check`; скилл `plugin-authoring` выдаёт команду установки |
| 2.1.292 | `prompt.autocomplete`; кэширование промптов в `$.model.complete` |
| 2.1.293 | `isDeferred` в `$.tool.register` |
| 2.1.295 | `$.ui.notify`; дочерние элементы у `Button`; `validate` советует строку установки в README |
| 2.1.299 | `Text`: `size`, `weight`, `mono`, `tabular`; шаги отступов `xs`…`xl`; `$.prompt.media`; `$.session.identity()`; `plugin test` падает, если вызов `$` молчит 10 с |
| 2.1.300 | `prompt.change`; `$.ui.view({agentId})`; `virtualText`; `Text dir` |
| 2.1.301 | `Input rows` |
| 2.1.304 | `decider: "person"`; `e.isReadOnly` в `tool.check`; отрисовка в VS Code для Bedrock, Vertex, Foundry и шлюзов |

## Как ставят и распространяют

### marketplace.json

Моды распространяются так же, как плагины: через маркетплейс, то есть репозиторий с файлом `.claude-plugin/marketplace.json`. npm для самих модов почти не используется.

- Файл должен лежать в **корне** репозитория, иначе сокращение `owner/repo` не сработает. У claude-code-playground файл лежит в подпапке, поэтому его добавляют только клоном.
- Обязательные поля верхнего уровня: `name`, `owner` (`owner.name`), `plugins`. Необязательные: `$schema`, `description` (без него `validate` предупреждает), `version`, `metadata.description`, `metadata.version`, `metadata.pluginRoot`, `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`.
- В записи плагина обязательны `name` и `source`. Можно добавить любые поля `plugin.json`, а также `category`, `tags`, `strict`, `relevance`, `dependencies`, `defaultEnabled`, `displayName`, `metadata`, `headers`, `headersHelper`.
- Неизвестные ключи при загрузке игнорируются, но `validate` на каждый выдаёт предупреждение, и `--strict` падает. Ключи внутри `metadata` предупреждений не дают (проверено локально на 2.1.302). Поэтому данные каталога (превью, поверхности, ссылки) надо класть в `plugins[i].metadata`.
- Авторитетна только `claude plugin validate`: схема на SchemaStore устарела (сгенерирована 2026-04-23), а `anthropic.com/claude-code/marketplace.schema.json` отдаёт 404.

Источники плагина в записи:

| `source` | Формат | С версии |
|---|---|---|
| Относительный путь | `"./mods/x"` (обязателен `./`; `"."` — корень) | — |
| GitHub | `{"source":"github","repo":"o/r","ref"?,"sha"?}` | — |
| Git URL | `{"source":"url","url":"https://…","ref"?,"sha"?}` | — |
| Папка в репозитории | `{"source":"git-subdir","url":"o/r или https","path":"sub/dir","ref"?,"sha"?}` | — |
| npm | `{"source":"npm","package":"@o/p","version"?,"registry"?}` | — |
| Архив | `{"source":"archive","url":"https://…zip","sha256"?}` | 2.1.224 |
| Команда | `{"source":"command","command":"…","timeout"?,"mode"?}` | 2.1.229 |

`sha` — полный SHA из 40 символов. Маркетплейс можно добавить по `owner/repo` (с `#ref`), по git URL, по локальному пути или по https-ссылке прямо на `marketplace.json` (так делают statuslin.es и slopshopper). Менеджер плагинов при этом присылает User-Agent, начинающийся с `Claude-Code-Plugin-Manager`.

Имена: буквы, цифры, `.`, `_`, `-`, начинаются с буквы или цифры. `validate` отклоняет имена плагинов, которые начинаются с `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-` или равны `claude-mods`, и предупреждает, если `claude` стоит отдельным словом. Десктоп не принимает имена длиннее 128 символов.

Известные ловушки:

- `"source": "."` проходит `validate`, но ломает синхронизацию с claude.ai; надо `"./"` ([#101807](https://github.com/anthropics/claude-code/issues/101807)).
- Маркетплейс по URL в десктопе показывает «No plugins in this marketplace yet», если адрес не оканчивается на `.json` ([#102691](https://github.com/anthropics/claude-code/issues/102691)).
- `git-subdir` с адресом не в виде полного https клонируется по SSH и падает у людей без SSH-ключа. По словам claudemods.chat, 2026-10-05 это сломало 51 плагин.
- Синхронизация организаций с GitHub вырезает из `plugin.json` ключ `types`, поэтому моды с `$.state` не грузятся ([#101258](https://github.com/anthropics/claude-code/issues/101258)). Десктоп при синхронизации организации не скачивает плагины из чужих репозиториев.

### Команды установки

| Где | Команда | С версии |
|---|---|---|
| Сессия терминала, одна строка | `/plugin install <мод> --marketplace <owner>/<repo>` | 2.1.275, спрашивает подтверждение маркетплейса |
| Сессия, два шага | `/plugin marketplace add <owner>/<repo>`, затем `/plugin install <мод>@<маркетплейс>` | система плагинов 2.0.12 |
| Shell, одна строка | `claude plugin install <мод> --marketplace <owner>/<repo>` | 2.1.292, без подтверждения, пишет в user settings |
| Shell, два шага | `claude plugin marketplace add <owner>/<repo>`, затем `claude plugin install <мод>@<маркетплейс>` | — |
| Для команды в репозитории | `.claude/settings.json`: `extraKnownMarketplaces` и `enabledPlugins` | работает после trust папки |
| Разработка | `claude --plugin-dir <папка>` или переменная `CLAUDE_CODE_PLUGIN_DIRS` | — |

Сами моды требуют 2.1.287 в терминале и 2.1.286 в десктопе. Если ставить из shell при открытой сессии, нужна команда `/reload-plugins`. Строку `/plugin install <мод> --marketplace <owner>/<repo>` считает основной и встроенный скилл, и совет `claude plugin validate` (с 2.1.295).

### Десктоп

- Команда `/plugin` во вкладке Code не работает.
- По документации: «+» рядом с полем ввода → Add plugins (или Plugins → Browse plugins / Manage plugins) → выбрать плагин и scope. По встроенному скиллу: «+» → Plugins → Add marketplace (`<owner>/<repo>`) → Add plugin. В issues встречается и путь Customize → Plugins → Add marketplace.
- Мод, поставленный из терминала в user scope, грузится и в локальной сессии десктопа.
- Приём statuslin.es: кнопка копирует промпт, который просит Claude выполнить в shell `"${CLAUDE_CODE_EXECPATH:-claude}" plugin marketplace add … && … plugin install …`. Каждая сессия десктопа задаёт `CLAUDE_CODE_EXECPATH`, поэтому команда находит нужный бинарник.
- Аккаунт claude.ai: Customize → Plugins → Add → Add marketplace. Плагины приходят в Claude Code 2.1.273+ как `<name>@synced`. Грузятся ли так моды с модулем хуков, не проверено.
- Официальный каталог — claude.ai/directory, подача через claude.ai/directory/manage (нужен платный план).

### VS Code

`/plugins` открывает Manage plugins с вкладками Plugins и Marketplaces. Плагины и маркетплейсы общие с CLI. Есть настоящая ссылка установки:

```text
vscode://anthropic.claude-code/install-plugin?plugin=<имя>&marketplace=<owner/repo | https URL | git SSH>
```

Она открывает выбор scope и при необходимости предлагает добавить маркетплейс. Ветку можно задать через `%23ref`, имя плагина — до 100 символов.

### Ссылки, которые открывают Claude Code

| Ссылка | Что делает | Ограничения |
|---|---|---|
| `claude-cli://open?q=<текст>&cwd=<путь>&repo=<owner/name>` | Новое окно терминала, промпт набран, но не отправлен | `q` до 5000 символов; под полем ввода предупреждение «Prompt from an external link»; обработчик регистрируется после первого промпта интерактивной сессии |
| `claude://code/new?q=<текст>&folder=<путь>` | Новая сессия Code в десктопе с текстом промпта | `q` до ~14000 символов; папку подтверждает пользователь; плагины и маркетплейсы не открывает |
| `claude://code/new?ssh_host=…&ssh_port=…&ssh_folder=…&q=…` | SSH-сессия в десктопе | десктоп 2.110.0+ |
| `claude://claude.ai/new?q=`, `claude://cowork/new?q=&folder=&file=` | Новый чат или Cowork | моды там не рисуют |
| `vscode://anthropic.claude-code/install-plugin?…` | Установка плагина | см. выше |
| `vscode://anthropic.claude-code/open?prompt=<текст>&session=<id>` | Новая вкладка VS Code с промптом | с 2.1.72 |
| `https://claude.ai/code?prompt=…&repositories=o/r` | Облачная сессия | моды не рисуют |

- GitHub при отрисовке Markdown вырезает схемы `claude-cli://` и `vscode://`. Кликабельные кнопки возможны только на своём сайте, в README — только в блоке кода.
- Выполнится ли `/plugin install …`, пришедший через `q` в `claude-cli://`, после нажатия Enter, никто не проверял. В десктопе `/plugin` не работает, поэтому там такая ссылка бесполезна, но можно передать промпт с shell-командой.
- В issues упоминаются недокументированные `claude://code/continue?session=…` и `claude://resume?session=…`.
- **Issue #62481.** Автор просит ссылку, которая открывает в десктопе «Add marketplace» с готовым адресом. По его словам (из `app.asar`, не проверено), десктоп понимает `claude://claude.ai/customize/plugins/new?marketplace=<url>&plugin=<id>`, но открывает мастер «Create plugin» и отбрасывает параметры, а `/customize/plugins/marketplaces/add` отвечает Not Found. Последняя активность — 2026-10-19.
- Подсказка установки `<claude-code-hint … />` из CLI работает только для официальных маркетплейсов.

### Что используют на практике

В репозиториях и постах встречаются все три формы: `claude plugin marketplace add` + `claude plugin install x@y`, то же через `/plugin`, и однострочная `--marketplace`. Отдельные установщики есть на npm (claude-code-mods, @cmodjs/cli, @g3nomaly/mods, fishstack-mod), но самих модов на npm почти нет: `keywords:claude-code-mod` — 7 пакетов, `keywords:claude-mods` — 0. aitmpl.com ставит моды через `npx claude-code-templates --mod <категория>/<имя>`, копируя папку в `.claude/skills/<имя>/`.

## Экосистема в цифрах

| Показатель | Значение | Источник |
|---|---|---|
| Модов в индексе karanb192 | 5667 в 2912 репозиториях (скан 2026-10-20, Claude Code 2.1.304) | data/mods.json |
| Всего записей в mods.json | 6271: мод 5667, fixture 308, дубликат 166, каталог 126, встроенный 4 | mods.aidojo.si/mods.json |
| Рост индекса | 31 мод (2026-09-15) → 359 (2026-10-02) → 5000+ (2026-10-20) | #91870, Reddit, README |
| Проверка `validate` | прошли 4685, с предупреждениями 732, упали 60 | data/mods.json |
| Доступ по грейду | рисует и помнит 491, читает 1407, пишет или запускает 2976, сеть 626, неизвестно 167 | mods.aidojo.si |
| В каталоге Anthropic | 58–59 модов | mods.aidojo.si |
| Места отрисовки | AbovePrompt 2387, Pane 2371, PromptHint 368, AssistantMessage 267, ToolUse 239, SessionMode 232, Spinner 224, UserMessage 188, ToolResult 169, CommandOutput 146, ToolGroup 141, TurnDuration 102 | data/mods.json |
| Частые события | `ui.render`, `command.run`, `tool.call`, `session.start`, `turn.complete`, `prompt.submit` | data/mods.json |
| Тип файла модуля | tsx 3577, ts 1682, js 270, mjs 138 | data/mods.json |
| Темы GitHub | claude-code-mod 677, claude-code-mods 247, claude-mods 130, function-hooks 97, claude-mod 45 (для сравнения: claude-code-plugin 11790) | поиск GitHub |
| Поиск по коду `"modules" filename:hooks.json` | около 6768 файлов в 1296 репозиториях, много шума; с индексом karanb192 пересекаются 394 | поиск GitHub |
| Пропуски индекса karanb192 | 289 из 861 репозитория с темами модов в нём нет; из 22 проверенных выборочно все оказались модами | наш обзор |
| Соцсети | около 390 постов о модах в r/ClaudeCode и 436 issues в anthropics/claude-code (середина сентября — 2026-10-20) | Arctic Shift, GitHub |
| Репозитории из постов и issues | 216 проверено, у 186 есть `modules` в `hooks/hooks.json` | наш обзор |
| Каталоги | около 30 коллекций, около 10 сайтов, 3 магазина в клиенте | наш обзор |
| Наши кандидаты | 338: подтверждено 239, вероятно 84, возможно 15 ([ecosystem.md](ecosystem.md)) | candidates.json |

Внимание к запуску было неровным: пост в блоге на Hacker News получил 6 очков, а на Reddit «Introducing Claude Mods» — 1118 очков и 206 комментариев, пост о cc-stretch — 1343.

Заметные репозитории (звёзды и очки на 2026-10-20):

| Репозиторий | Что это | Сигналы |
|---|---|---|
| [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/mods) | Исходники 4 встроенных модов и файл типов | официальный |
| [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) | Образцы token-weather, blast-radius, replay-theater со скриншотами | официальный, ссылки из документации |
| [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | Мод next-steps (Thariq Shihipar) в маркетплейсе claude-community | показан на claude.dev/mods |
| [zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser) | Панель браузера рядом с разговором | около 4000 звёзд, главное демо в README karanb192 |
| [kunchenguid/firstmate](https://github.com/kunchenguid/firstmate) | Мод firstmate-calm внутри большого проекта | около 8000 звёзд у проекта |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | 45 модов ruflo по данным karanb192 | около 77 тысяч звёзд у проекта |
| [alexgreensh/token-optimizer](https://github.com/alexgreensh/token-optimizer) | Вариант для десктопа рядом с классическими хуками | около 2603 звёзд |
| [YeonwooSung/my-claude-code-mods](https://github.com/YeonwooSung/my-claude-code-mods) | 17 модов, 63 файла тестов | 1096 звёзд, больше всех под темой claude-code-mods |
| [hex/claude-council](https://github.com/hex/claude-council) | Панель council-pane | около 894 звёзд |
| [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) | 25 модов, сайт со скриншотами, установщик на npm | 303 звезды |
| [HeyCubit/effortless](https://github.com/HeyCubit/effortless) | Подбирает effort для каждого промпта, полоса над промптом | 250 звёзд, посты на 264 и 211 очков |
| [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) | Дерево файлов с git-статусом | 248 звёзд |
| [iamumeransari/claude-show-your-work](https://github.com/iamumeransari/claude-show-your-work) | Картинки и видео в терминале (kitty, Ghostty) | 246 звёзд |
| [jarrodwatts/claude-image-view](https://github.com/jarrodwatts/claude-image-view) | Миниатюры вставленных картинок над промптом | 241 звезда |
| [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) | Скины транскрипта, 15 тем, `/skin` | 172 звезды |
| [midudev/better-claude](https://github.com/midudev/better-claude) | Набор модов midudev, сайт betterclaude.dev | около 148 звёзд |
| [NahumLitvin/prismantis](https://github.com/NahumLitvin/prismantis) | Оформление ответов: таблицы, Mermaid, графики | 145 звёзд, раздел Mods в awesome-claude-code |
| [cablate/ctx-handoff-mod](https://github.com/cablate/ctx-handoff-mod) | Передача контекста, полоса над промптом | 119 звёзд |
| [scasella/claude-flightdeck](https://github.com/scasella/claude-flightdeck) | Панель-дашборд сессии и агентов | 114 звёзд |
| [sezaakgun/cc-arcade](https://github.com/sezaakgun/cc-arcade) | Tetris и ещё 7 игр над промптом | тот самый мод из поста Бориса Черного |
| [pro-vi/cc-stretch](https://github.com/pro-vi/cc-stretch) | Ответы раскрываются по частям, на 83% короче | пост на 1343 очка |
| [henrik-thevibe/Claude-Fables](https://github.com/henrik-thevibe/Claude-Fables) | Мультфильм о работе Claude над промптом | пост на 229 очков |
| [tzafrir/whats-agent-doing](https://github.com/tzafrir/whats-agent-doing) | Строка над промптом объясняет текущий шаг | Show HN, есть в каталоге Anthropic |
| [razorback16/cc-intelligent-ui](https://github.com/razorback16/cc-intelligent-ui) | Ответы через Typst: таблицы, LaTeX, диаграммы | пост на 110 очков |
| [NovusEdge/glowup](https://github.com/NovusEdge/glowup) | Перекраска сообщений, спиннеров, боковая панель | пост на 93 очка |
| [hellosverre/mod-store](https://github.com/hellosverre/mod-store) | Магазин модов внутри клиента, около 2700 модов | данные mods.aidojo.si |
| [whyashthakker/awesome-claude-code-mods](https://github.com/whyashthakker/awesome-claude-code-mods) | 70 своих модов, превью из тестового набора | 80 звёзд |
| [karanb192/cache-tax](https://github.com/karanb192/cache-tax) | Держит кэш промпта тёплым, `/keepwarm` | пост на HN, в избранном у karanb192 |

Полный список с короткими описаниями — в [ecosystem.md](ecosystem.md). Он сгенерирован скриптом и не проверен.

## Каталоги и сайты

Имя `awesome-claude-code-mods` уже занято как минимум пятью репозиториями (karanb192, whyashthakker, testy-cool, lycfyi, magiccreator-ai), поэтому проект называется Mod Showroom.

| Каталог | Адрес | Размер | Как показывает мод | Как ставить | Откуда данные |
|---|---|---|---|---|---|
| Awesome Claude Code Mods (karanb192) | [mods.aidojo.si](https://mods.aidojo.si/) | 5667 | Текстовые карточки, грейд доступа L0–L3, бейджи, JSON; скриншотов нет | Подсказка установки; плагин mod-finder (MCP) | Автоскан GitHub раз в 3 часа + `claude plugin validate` |
| statuslin.es | [statuslin.es/mods](https://statuslin.es/mods) | 25 | Запись настоящего Claude Code в песочнице E2B по сценарию; скриншоты настоящего Claude Desktop for Linux | «Copy install prompt», свой marketplace.json по URL | Подача через вход GitHub, человек проверяет закреплённый коммит |
| modsforClaude | [modsforclaude.com](https://modsforclaude.com/) | 637 | Фильтры по категории и типу хуков, статус проверки на коммит, у части webp | Команд установки на листинге нет | Подача через аккаунт на сайте |
| claude-mods.com | [claude-mods.com](https://claude-mods.com/) | 278 | Теги поверхностей terminal/desktop/mobile, обложки (часто «no screenshot yet») | `marketplace add` + `plugin install` | Ежедневный скан GitHub + ручная проверка |
| claudemods.chat | [claudemods.chat](https://claudemods.chat) | 103 записи, 27 модов | «Footprint»: хуки, события, вызовы `$`; превью нет | `/plugin install <name>@claudemods`, коммиты закреплены | Форма issue + еженедельный автопоиск |
| Claude Mods | [claudemods.ai](https://claudemods.ai/) | 45 | Голосование «мод дня», JSON-фид; скриншотов нет | Строки установки текстом | Ручная модерация |
| CCMods Hub | [ccmodshub.com](https://ccmodshub.com/) | 77 | 24 мода с картинкой или GIF автора | Текстом в FAQ | Не описано |
| Baselane Mods | [baselane-sh.github.io/mods-catalog](https://baselane-sh.github.io/mods-catalog/) | 199 | Входы и выходы возможностей, метки риска; скриншотов нет | `/plugin marketplace add baselane-sh/mods-catalog` | PR с файлом `entries/<name>.json`, бот проверяет и сливает |
| slopshopper | [ryx2/slopshopper](https://github.com/ryx2/slopshopper) | — | Мод запускается в `node:vm` против поддельного API, деревья рисуются текстовой сеткой | Свой marketplace.json по URL | Ежедневный скан GitHub |
| awesome-claude-mods (wh000wh000) | [wh000wh000/awesome-claude-mods](https://github.com/wh000wh000/awesome-claude-mods) | 597 | Оценка по доказательствам, 20 языков, предпочитает записи со скриншотами | — | Пересборка каждые 2 часа |
| whyashthakker | [whyashthakker/awesome-claude-code-mods](https://github.com/whyashthakker/awesome-claude-code-mods) | 70 своих | Деревья из тестового набора, нарисованные в браузере (с честной пометкой) | Свой маркетплейс | Свои моды |
| hamzafer | [hamzafer.github.io/claude-code-mods](https://hamzafer.github.io/claude-code-mods/) | 25 | Статичные PNG | `marketplace add` + `plugin install`, npm-чеклист | Свои моды |
| Plagemes | [plagemes.github.io/claude-mods](https://plagemes.github.io/claude-mods/) | 219 | Веб-магазин и магазин в терминале | `/mods` внутри клиента | Свои моды |
| Mod Store | [hellosverre/mod-store](https://github.com/hellosverre/mod-store) | около 2700 | Панель `/mods` в клиенте, бейджи доступа | Клавиши `i`, `y` | Данные mods.aidojo.si |
| FindMods (DrishtantKaushal) | [AwesomeClaudeCodeMods](https://github.com/DrishtantKaushal/AwesomeClaudeCodeMods) | 82 мода из 38 репозиториев | Анимированные GIF | — | Копии чужих модов; сайт findmods.dev не открылся |
| Claude Code Templates | [aitmpl.com/mods](https://www.aitmpl.com/mods) | 44 | Страница рисуется на клиенте, превью не видно | `npx claude-code-templates --mod …` | Копии чужих модов в репозитории |
| better-claude | [betterclaude.dev](https://betterclaude.dev/) | 8 | Текстовые макеты терминала | «Copy install prompt» для нескольких модов | Моды midudev |
| claude.dev/mods | [claude.dev/mods](https://claude.dev/mods/) | несколько | Анимированные демо терминала с кнопкой Play | Копировать `claude plugin install next-steps@claude-community` | Anthropic |
| Claude Marketplace | [claude.com/marketplace/plugins](https://claude.com/marketplace/plugins) | 341 плагин | Фильтра модов нет | Копировать `claude plugin install <name>@claude-plugins-official` | Anthropic |
| mods.guide | [mods.guide](https://mods.guide) | — | Руководство на 6 языках с поиском | — | Данные karanb192 |
| best-claude-code-mods | [claude-code-mods/best-claude-code-mods](https://github.com/claude-code-mods/best-claude-code-mods) | 43 | Колонка «Reaches», README на 10 языках | Маркетплейс с закреплёнными коммитами | Ручной отбор + `validate` |
| modmyclaude | [modmyclaude/claude-code-mods](https://github.com/modmyclaude/claude-code-mods) | 17 | 3400+ поведенческих тестов, CI против свежего Claude Code | Маркетплейс modmyclaude | Моды в репозитории |

Ещё есть ccmods.dev, claudecodemods.com, modscode.com (справочник кода, по словам dev.to разобрал 1383 мода), Singh-AP/awesome-claude-mods (индексирует 4077), k-mods (корейский, 68 записей), Claude Mod Manager (cmod) и короткие списки awesome-claude-mods. Большие каталоги плагинов (claudemarketplaces.com, claudemarket.ai, buildwithclaude.com, tonsofskills.com, vibeindex.ai, claude-plugins.dev, skillsmp.com, skills.sh) моды отдельно не выделяют. В awesome-claude-code (hesreallyhim) есть раздел Mods с одной записью и ссылкой на karanb192.

Главный вывод: полнота уже закрыта (karanb192, modsforClaude), проверка доступа тоже (karanb192, claudemods.chat, Baselane). Наглядный показ мода в клиенте есть только у statuslin.es, и только для 25 модов. Пользователи прямо просят превью: 2026-10-05 на Reddit написали, что существующий каталог весь текстовый.

## Чем отличается Mod Showroom

- **Каждая запись показана в клиенте.** Сайт рисует мод в макете Claude Code на трёх поверхностях: терминал, вкладка Code десктопного приложения и панель чата VS Code. VS Code не показывает ни один другой каталог. Цвета, глифы и раскладка взяты из бинарника 2.1.302 и CSS приложения (токены тем, `●`/`⏺`, `⎿`, кадры спиннера, две линии промпта без боковых сторон).
- **Поверхности честно.** Если поверхность не рисует место, которое использует мод (например, полосу над промптом в VS Code), макет так и пишет, а не подделывает. У каждой записи есть строка «Работает в» с тремя поверхностями.
- **Несколько модов вместе.** Моды можно собрать в набор, увидеть их вместе в одном макете и получить общий блок команд установки.
- **Установка настоящими ссылками.** VS Code — `vscode://…/install-plugin` (настоящий один клик). Терминал — `claude-cli://open?q=` с набранной командой. Десктоп — `claude://code/new?q=` с промптом, который просит Claude выполнить установку в shell. Плюс строки для копирования и минимальные версии.
- **Каталог — это и маркетплейс.** Репозиторий сам служит маркетплейсом `mod-showroom`: внешние моды ставятся из маркетплейсов авторов, 9 модов лежат прямо в репозитории.
- **Возможности из кода.** Для модов в репозитории список хуков и вызовов берётся из `claude plugin validate --json` и переводится в понятные метки (сеть, процессы, файлы, модель, изменение промптов, блокировка инструментов).
- **Вклад одним файлом.** Запись — один файл `mods/<name>/mod.json` через pull request. Бот сам сливает PR, если всё внутри `mods/<name>/`, проверки прошли и автор указан в `maintainers`. История `main` защищена.
- **Два языка.** Сайт и документы на русском и английском.

Чего у нас нет и что надо говорить прямо:

- Превью — это декларативный макет по описанию из `mod.json`, а не запись настоящего клиента, как у statuslin.es. Насколько честен макет, зависит от описания.
- Каталог маленький: 36 записей против тысяч у агрегаторов. Цель — показать хорошо, а не собрать всё.
- Вид десктопа и VS Code собран по документации и CSS, живое окно приложения мы не снимали.

## Возможности API

Коротко (по файлу типов `claude-code.d.ts` сборки 2.1.299, 22155 строк):

- **Отрисовка.** 15 мест `ui.render` (таблица выше). Хук возвращает своё дерево, оборачивает рисунок клиента через `next(e)` или переписывает его пропсы. Элементы: `Box`, `Text`, `Button`, `Link`, `Code` (в том числе diff), `Markdown`, `Input`, `Select`, `Svg`, `Client` (свой модуль поверхности), `Raster` и `Image` (kitty graphics).
- **Интерфейс вне мест отрисовки.** `$.ui.toast` (стопка тостов справа сверху), `$.ui.status` (строка статуса плагина под промптом), `$.ui.notify` (уведомление ОС: iterm2, kitty, ghostty, звонок терминала), `$.ui.log`, `$.ui.notice` (строка под диалогом разрешения), `$.ui.open` (панель), `$.ui.ask` (диалог с 2–4 вариантами), `$.ui.copy`, `$.ui.selection`.
- **Поле ввода.** `$.prompt.fill`, `$.prompt.suggest`, хуки `prompt.autocomplete` и `prompt.edit` с подсветкой набираемого текста.
- **События.** Больше 40 событий движка: `tool.call` и `tool.check` (разрешить, запретить, переписать), `prompt.submit` (переписать или отбросить промпт), `prompt.section` и `prompt.context` (что читает модель), `session.*`, `turn.*`, `command.run`, `config.set` и другие. Плюс все классические события как `classic.<Event>` и перехват каждого вызова `$`.
- **Пространства `$`.** `ui`, `prompt`, `tool`, `command`, `config`, `agent`, `model` (`complete`, `fork`, `classify`), `session`, `turn`, `audio` (звук только на macOS), `mcp`, `fs`, `store` (до 4 МиБ), `state`, `clock`, `http`, `process` (только CLI), `settings`, `env`, `telemetry`.
- **Цвета.** Ключи темы (`claude`, `success`, `error`, `warning`, `permission`, `planMode`, `diffAdded` и др.) или любой цвет строкой. Хук на `ui.resolve` может перестилизовать элемент для всех остальных модов, так делаются темы.
- **Тесты.** `claude plugin test` запускает `*.test.ts`, набор `'claude-code/testing'` умеет монтировать место отрисовки и отдавать дерево (`$.ui.mount` → `drawn()`), это готовый материал для превью.

Подробная выжимка с номерами строк и точные цвета и глифы клиента лежат в рабочих материалах исследования (`api-0.md` и `visual-4.md`, в репозиторий они не входят). Цвета и глифы оттуда использует макет клиента на сайте.

## Риски и безопасность

- **Изоляции нет.** Это сказано в официальном посте о запуске. Мод работает в процессе клиента, у него есть `$.fs`, `$.process`, `$.http`, `$.env`.
- **Установка ничего не спрашивает о возможностях.** По разбору pluto.security (2026-09-22): мод читает `~/.claude/.credentials.json` без запроса, может нарисовать поддельный запрос пароля над полем ввода, `plugin install` не показывает возможности, а `plugin details` однажды показал у мода «Hooks (0)». В десктопе установка из каталога — один клик без предупреждения. Участник #91870 выложил тестовый мод, который без предупреждения запустил программу и записал файл в домашнюю папку.
- **Масштаб.** По грейду karanb192, 2976 из 5667 модов пишут файлы или запускают процессы, 626 ходят в сеть, у 167 доступ определить не удалось. В первом скане (2026-09-15) процессы могли запускать 14 модов из 31.
- **Чем проверять.** `claude plugin validate ./mod` выводит строки `hooks:` и `calls:` без запуска кода. Официальный список рискованных вызовов: `$.fs.read/write`, `$.process.run/spawn`, `$.http.fetch`, `$.env.get/set`, `$.settings.read`, `$.mcp.call`, `$.model.complete`, `$.prompt.submit`, `$.session.send`; чувствительные хуки: `tool.call`, `prompt.submit`, `session.append`, `tool.check`. Есть сторонний сканер ModVet (Show HN 2026-10-20). Каталог Anthropic проверяет моды автоматически и иногда задерживает их (например, `$.ui.notify` помечается как `MOD_LOCAL_DATA_LEAVES`).
- **Организации.** Встроенный `sec-default` на Team и Enterprise (и на машинах с managed settings) встаёт снаружи всех модов. Он молча обходит классические хуки пользовательских модов, а с 2.1.299 пользовательские моды не могут ослабить правила `ask`. Есть `allowManagedModsOnly`.
- **Тихие поломки.** Моды бывают выключены удалённо переключателем раскатки ([#99130](https://github.com/anthropics/claude-code/issues/99130)), десктоп и VS Code рисуют не всё, мод-сторож может быть включён и при этом ничего не делать (статья practicalsystems.io «The Guard I Installed Was Enabled, Running, and Doing Nothing»). Публичные типы могут отставать от установленной сборки.
- **Цепочка поставки.** Внешний мод может измениться после попадания в каталог. Закрепление `sha`, проверка конкретного коммита и список сопровождающих снижают риск, но не убирают его.
- **Порядок модов.** Моды не выбирают свой порядок, конфликты между ними неизбежны. poteat сам предсказал, что сообщество придёт к общему «менеджеру модов» с данными о совместимости.

Что делает каталог: метки возможностей из `validate`, закреплённые источники, сопровождающие у каждой записи, [SECURITY.md](../SECURITY.md) для жалоб на вредные моды.

## Методика и ограничения

**Когда и на чём.** 2026-10-20, Windows 11. Локальный CLI — 2.1.302, файл типов — из встроенного скилла сборки 2.1.299, последняя версия в CHANGELOG — 2.1.304.

**Обзоры** (рабочие файлы исследования, в репозиторий не входят):

| Файл | Что делали |
|---|---|
| sweep-1.json | Каталоги и сайты: около 35 сайтов, npm, репозитории каталогов, выборочная проверка `hooks.json` примерно в 34 репозиториях |
| sweep-2.json | Официальная документация и CHANGELOG (9276 строк), справка CLI 2.1.302, пробный `claude plugin validate` на тестовом маркетплейсе (ничего не ставили) |
| sweep-3.json | Веб и хронология: #91870 со всеми 264 комментариями, посты в X через fxtwitter, HN Algolia, блоги, YouTube |
| sweep-5.json | Репозитории GitHub: темы, поиск по репозиториям и коду, данные karanb192, деревья примерно 60 репозиториев |
| sweep-6.json | Соцсети: HN, Reddit через зеркало Arctic Shift, issues anthropics/claude-code, проверка 216 репозиториев через API |
| api-0.md | Разбор файла типов API модов |
| visual-4.md | Внешний вид клиента: строки из бинарника, CSS десктопа из кэша, документация |

Из обзоров собраны сводные файлы: `candidates.json` (338 репозиториев), `collections.json` (80 записей о каталогах, часть повторяется между обзорами), `facts.json` (146 фактов с источниками и датами).

**Что значит «подтверждён».** Во время исследования в дереве репозитория через GitHub API нашёлся хотя бы один `hooks/hooks.json` с ключом `modules`. Это разовая проверка. «Вероятно» — мод назван так в данных karanb192, в другом каталоге или в посте, но мы сами не проверяли. «Возможно» — 404, нет структуры плагина, прототип, пакет npm или набор тем.

**Что не доделано — честно.**

- Обзор по поиску в коде GitHub не завершился. Поиск `"modules" filename:hooks.json` делали только в рамках обзора 5, и он сильно зашумлён.
- Отдельная проверка каждого репозитория (файл `verified.json`) не проводилась, он пуст. Пользователь попросил остановить исследование и работать с тем, что найдено. Вместо полной проверки проверялись только репозитории, которые вошли в каталог.
- Поэтому [ecosystem.md](ecosystem.md) — сырой список, а не каталог.

**Ограничения источников.**

- Reddit напрямую закрыт (403), данные взяты из зеркала Arctic Shift; многие посты удалены, ссылки в них не видны.
- Посты в X читались только по известным id. Видео не смотрели, PDF с архитектурой из #91870 не читали.
- Не открылись findmods.dev, claudecodeplugins.dev, claudecodeplugin.org; claude.ai/directory отдал 403; claudecodemarketplace.com не существует.
- Числа сторонних каталогов — их собственные заявления, мы их не пересчитывали. Числа быстро устаревают: за три недели индекс вырос с 31 до 5667 модов.
- Часть фактов о документации в обзоре 5 взята из зеркала ericbuess/claude-code-docs, а не с code.claude.com.
- Живое окно десктопа не снималось; вид собран по CSS и документации.

**Не проверено:**

- выполняется ли `/plugin install …`, пришедший через `claude-cli://open?q=`, по Enter;
- грузятся ли моды с модулем хуков через синхронизацию claude.ai (`@synced`);
- работает ли флаг `--mod`, о котором пишет aitmpl (в `claude --help` 2.1.302 его нет);
- что `npx claude-code-templates --mod` действительно грузится как `<name>@skills-dir` (CHANGELOG 2.1.157 говорит только, что плагины из `.claude/skills` грузятся без маркетплейса);
- есть ли в claude-plugins-official другие моды, кроме code-modernization;
- есть ли `$.http` в текущих публичных сборках (issue #103676 просит его добавить, хотя в сентябре `$.http.fetch` использовали).

**Расхождения.** Файл типов 2.1.299 говорит, что у VS Code нет поверхности, а документация и CHANGELOG говорят, что панель VS Code рисует. В данных karanb192 встречается и 2912, и 2921 репозиторий (разные выгрузки одного дня), и 58 или 59 модов в каталоге Anthropic.

## Источники

Все адреса взяты из файлов исследования.

**Anthropic: документация**

- [Mods: overview](https://code.claude.com/docs/en/plugins/mods/overview), [create](https://code.claude.com/docs/en/plugins/mods/create), [reference](https://code.claude.com/docs/en/plugins/mods/reference.md), [gallery](https://code.claude.com/docs/en/plugins/mods/gallery.md), [admin](https://code.claude.com/docs/en/plugins/mods/admin.md#review-what-a-mod-can-do)
- [Install plugins](https://code.claude.com/docs/en/plugins/install.md), [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md), [Manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference.md), [Publish](https://code.claude.com/docs/en/plugins/publish.md), [Anthropic marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md), [CLI reference](https://code.claude.com/docs/en/plugins/cli-reference.md#plugin-validate), [CLI hints](https://code.claude.com/docs/en/plugins/cli-hints.md), [Components](https://code.claude.com/docs/en/plugins/components.md#themes-and-output-styles), [Org](https://code.claude.com/docs/en/plugins/org.md#require-plugins-per-repository)
- [Deep links](https://code.claude.com/docs/en/deep-links.md), [Desktop](https://code.claude.com/docs/en/desktop.md), [VS Code](https://code.claude.com/docs/en/vs-code.md#share-a-plugin-install-link), [Web quickstart](https://code.claude.com/docs/en/web-quickstart.md#pre-fill-sessions), [Env vars](https://code.claude.com/docs/en/env-vars.md), [Settings reference](https://code.claude.com/docs/en/settings-reference.md#extraknownmarketplaces), [What's new](https://code.claude.com/docs/en/whats-new), [llms.txt](https://code.claude.com/docs/llms.txt)
- [Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude), [Open Claude Desktop with a link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link), [Claude Desktop extensions (3P)](https://claude.com/docs/third-party/claude-desktop/extensions.md)

**Anthropic: репозитории, посты, каталоги**

- [CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [встроенные моды](https://github.com/anthropics/claude-code/tree/main/mods), [claude-code.d.ts](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts), [маркетплейс claude-code](https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json)
- [claude-code-playground mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods), [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json), [claude-plugins-community](https://github.com/anthropics/claude-plugins-community)
- [Customize Claude Code with mods](https://claude.com/blog/claude-code-mods), [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/), [claude.dev/mods](https://claude.dev/mods/), [видео Mods in Claude Code](https://www.youtube.com/watch?v=yUuFvL1lK4k)
- [Claude Marketplace](https://claude.com/marketplace/plugins), [claude.ai/directory](https://claude.ai/directory)

**Issues anthropics/claude-code**

- [#91870](https://github.com/anthropics/claude-code/issues/91870) (обсуждение модов), [#62481](https://github.com/anthropics/claude-code/issues/62481) (ссылка на Add marketplace)
- Поверхности и ошибки: [#99045](https://github.com/anthropics/claude-code/issues/99045), [#102594](https://github.com/anthropics/claude-code/issues/102594), [#100737](https://github.com/anthropics/claude-code/issues/100737), [#99395](https://github.com/anthropics/claude-code/issues/99395), [#99211](https://github.com/anthropics/claude-code/issues/99211), [#99130](https://github.com/anthropics/claude-code/issues/99130), [#103429](https://github.com/anthropics/claude-code/issues/103429)
- Установка и маркетплейсы: [#101807](https://github.com/anthropics/claude-code/issues/101807), [#102691](https://github.com/anthropics/claude-code/issues/102691), [#101889](https://github.com/anthropics/claude-code/issues/101889), [#101258](https://github.com/anthropics/claude-code/issues/101258), [#96110](https://github.com/anthropics/claude-code/issues/96110)
- Ссылки: [#103727](https://github.com/anthropics/claude-code/issues/103727), [#96443](https://github.com/anthropics/claude-code/issues/96443), [#95485](https://github.com/anthropics/claude-code/issues/95485)
- Прочее: [#102330](https://github.com/anthropics/claude-code/issues/102330), [#102379](https://github.com/anthropics/claude-code/issues/102379), [#102470](https://github.com/anthropics/claude-code/issues/102470), [#103626](https://github.com/anthropics/claude-code/issues/103626)

**Каталоги и сообщество**

- [karanb192/awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods/blob/main/README.md) ([SCANNING.md](https://github.com/karanb192/awesome-claude-code-mods/blob/main/SCANNING.md), [data/mods.json](https://github.com/karanb192/awesome-claude-code-mods/blob/main/data/mods.json)), [mods.aidojo.si](https://mods.aidojo.si/) ([mods.json](https://mods.aidojo.si/mods.json))
- [statuslin.es](https://statuslin.es/mods) ([ADR](https://github.com/NathanAB/statuslin.es/tree/main/docs/adr), [install.ts](https://github.com/NathanAB/statuslin.es/blob/main/src/mods/install.ts), [marketplace.json](https://statuslin.es/marketplace.json))
- [claudemods.chat](https://claudemods.chat/) ([CLAUDE.md](https://github.com/omarcevi/claudemods/blob/main/CLAUDE.md)), [claude-mods.com](https://claude-mods.com/), [modsforclaude.com](https://modsforclaude.com/mods), [claudemods.ai](https://claudemods.ai/) ([api/mods.json](https://claudemods.ai/api/mods.json)), [ccmodshub.com](https://ccmodshub.com/), [Baselane](https://baselane-sh.github.io/mods-catalog/), [slopshopper marketplace](https://slopshopper.com/community/marketplace.json), [whyashthakker SCREENSHOTS.md](https://github.com/whyashthakker/awesome-claude-code-mods/blob/main/docs/SCREENSHOTS.md), [hamzafer](https://hamzafer.github.io/claude-code-mods/), [Plagemes](https://plagemes.github.io/claude-mods/), [betterclaude.dev](https://betterclaude.dev/), [claudemodmanager.com](https://claudemodmanager.com), [aitmpl.com/mods](https://www.aitmpl.com/mods) ([README модов](https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/mods/README.md)), [mods.guide](https://mods.guide), [modscode.com](https://modscode.com/claude-mods/), [ccmods.dev](https://ccmods.dev), [claudecodemods.com](https://www.claudecodemods.com/), [claude-code-mods.karanbansal.in](https://claude-code-mods.karanbansal.in/), [findmods.dev](https://findmods.dev)
- Общие каталоги плагинов: [claudemarketplaces.com](https://claudemarketplaces.com/), [claudemarket.ai](https://claudemarket.ai/marketplaces), [buildwithclaude.com](https://www.buildwithclaude.com/), [tonsofskills.com](https://tonsofskills.com/), [vibeindex.ai](https://vibeindex.ai/), [claude-plugins.dev](https://claude-plugins.dev/), [skillsmp.com](https://skillsmp.com/), [skills.sh](https://skills.sh/), [skillsllm.com](https://skillsllm.com/)

**Статьи, посты, соцсети**

- [pluto.security: безопасность function hooks](https://pluto.security/blog/claude-code-function-hooks-security/), [aitmpl.com: function hooks](https://aitmpl.com/blog/function-hooks-claude-code/), [Latent Space: интервью с Thariq](https://www.latent.space/p/thariq), [Gigazine](https://gigazine.net/news/20261002-claude-code-customize-mod/)
- X: [bcherny 2026-09-14](https://x.com/bcherny/status/2099551291601248485), [bcherny 2026-10-01](https://x.com/bcherny/status/2105756563302723721), [trq212](https://x.com/trq212/status/2101009393731223817), [ClaudeDevs](https://x.com/ClaudeDevs/status/2105721434807083061)
- Hacker News: [49925800](https://news.ycombinator.com/item?id=49925800), [49926243](https://news.ycombinator.com/item?id=49926243), [49979254](https://news.ycombinator.com/item?id=49979254), [50003222](https://news.ycombinator.com/item?id=50003222), [49741930](https://news.ycombinator.com/item?id=49741930), [49815421](https://news.ycombinator.com/item?id=49815421), [поиск Algolia](https://hn.algolia.com/api/v1/search_by_date?query=claude%20mods)
- Reddit: [Introducing Claude Mods](https://www.reddit.com/r/ClaudeCode/comments/1wvc7vc/), [1wv8fwb](https://www.reddit.com/r/ClaudeCode/comments/1wv8fwb/), [1wvuk0h](https://www.reddit.com/r/ClaudeCode/comments/1wvuk0h/), [359 модов с поиском](https://www.reddit.com/r/ClaudeCode/comments/1ww1a39/), [просьба о превью](https://www.reddit.com/r/ClaudeCode/comments/1wyi34j/), [строка статуса в десктопе](https://www.reddit.com/r/ClaudeCode/comments/1wwo3t3/), [r/claude 1wyakrn](https://www.reddit.com/r/claude/comments/1wyakrn/)
- Зеркало документации: [ericbuess/claude-code-docs](https://github.com/ericbuess/claude-code-docs/tree/main/docs)
- Схемы: [SchemaStore claude-code-marketplace.json](https://json.schemastore.org/claude-code-marketplace.json)
- npm: [поиск keywords:claude-code-mod](https://registry.npmjs.org/-/v1/search?text=keywords:claude-code-mod)

# Mod Showroom

**Витрина модов для Claude Code.** Каталог плагинов, которые меняют сам клиент: полосы над полем ввода, панели, строки статуса, уведомления, спиннеры, стражи вызовов инструментов. На сайте каждый мод показан внутри макета клиента, а ставится он одной командой.

**[Открыть сайт](https://krou4.github.io/claude-code-mod-showroom/)** · [English](README.en.md) · [Как добавить мод](CONTRIBUTING.md) · [Исследование](docs/research.md)

[![Sync and deploy](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/sync.yml/badge.svg?branch=main)](https://github.com/KROU4/claude-code-mod-showroom/actions/workflows/sync.yml)

Сейчас в каталоге <!-- count:start -->56 модов<!-- count:end -->. Репозиторий одновременно служит маркетплейсом Claude Code `mod-showroom`.

## Содержание

- [Что такое мод](#что-такое-мод)
- [Как поставить](#как-поставить)
- [Каталог](#каталог)
- [Добавить свой мод](#добавить-свой-мод)
- [Как защищён репозиторий](#как-защищён-репозиторий)
- [Исследование](#исследование)
- [Связанные проекты](#связанные-проекты)
- [Лицензия](#лицензия)

## Что такое мод

Мод — это плагин Claude Code, у которого `hooks/hooks.json` указывает на модуль с функциями-хуками. Хуки получают события клиента (вызовы инструментов, промпты, отрисовку) и могут дорисовать интерфейс или изменить поведение: показать полосу над промптом, открыть панель, отклонить вызов инструмента. Моды появились в Claude Code 2.1.287 и работают в терминале, в десктопном приложении и частично в панели VS Code.

```text
turn-meter/
├── .claude-plugin/
│   └── plugin.json      имя, версия, описание
└── hooks/
    ├── hooks.json       { "modules": ["./register.tsx"] }
    └── register.tsx     export const register = (on) => { … }
```

## Как поставить

Нужен Claude Code 2.1.287 или новее; в десктопном приложении моды работают со встроенной версии 2.1.286.

**В сессии Claude Code в терминале** достаточно одной команды. Если маркетплейс ещё не добавлен, Claude Code предложит его добавить (нужна версия 2.1.275+):

```text
/plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
```

То же в два шага: один раз добавить маркетплейс, потом ставить моды по имени.

```text
/plugin marketplace add KROU4/claude-code-mod-showroom
/plugin install turn-meter@mod-showroom
```

**Из оболочки** (2.1.292+):

```sh
claude plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
```

Если сессия уже открыта, выполните в ней `/reload-plugins` или начните новую.

**В десктопном приложении** команды `/plugin` нет. Нажмите «+» рядом с полем ввода, выберите Plugins → Add marketplace, введите `KROU4/claude-code-mod-showroom` и затем Add plugin. Мод, поставленный из терминала для пользователя (scope user), загружается и в десктопе.

**В VS Code** мод ставится в один клик по ссылке `vscode://anthropic.claude-code/install-plugin`. GitHub такие ссылки не показывает, поэтому кнопки «Install in VS Code», «Open in terminal» и «Open in Claude desktop» есть на странице каждого мода [на сайте](https://krou4.github.io/claude-code-mod-showroom/).

Мод выполняется внутри вашей сессии с вашими правами. Перед установкой внешнего мода прочитайте его код: ссылка на исходники есть у каждой записи.

## Каталог

Для каждого мода указано, что он рисует, кто автор и где лежит код: «в этом репозитории» — код в `mods/<имя>/plugin/`: его проверяет CI, а изменения после первой версии читает мейнтейнер каталога; «внешний» — код в репозитории автора. Это код сообщества: прочитайте его перед установкой. Под спойлером команда установки.

<!-- mods:start -->
Категории: [Интерфейс](#интерфейс) · [Сводки](#сводки) · [Безопасность](#безопасность) · [Продуктивность](#продуктивность) · [Git](#git) · [Для настроения](#для-настроения) · [Доступность](#доступность)

### Интерфейс

- **[Claudinator](https://krou4.github.io/claude-code-mod-showroom/#/mod/claudinator)** — Шесть сменных стилей для строк инструментов, индикатора работы и итога хода плюс девять ингредиентов. <sub>рисует: строки инструментов, строка длительности хода, слеш-команда, панель, всплывающее уведомление · автор @patheonsceo · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install claudinator --marketplace patheonsceo/claudinator
  ```

  </details>
- **[Drawer](https://krou4.github.io/claude-code-mod-showroom/#/mod/drawer)** — Блоки \`\`\`dot (Graphviz) и \`\`\`svg в ответе превращаются в картинки прямо на месте, пока ответ печатается. <sub>рисует: сообщения в переписке · автор @Sureffi · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install drawer --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Filetree](https://krou4.github.io/claude-code-mod-showroom/#/mod/filetree)** — Дерево файлов сбоку: статус git, число изменённых строк, а файлы, которые Claude читает и пишет, переливаются. <sub>рисует: панель, всплывающее уведомление, слеш-команда · автор @data-goblin · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install filetree --marketplace data-goblin/claude-code-filetree
  ```

  </details>
- **[Firstmate Calm](https://krou4.github.io/claude-code-mod-showroom/#/mod/fm)** — Скрывает строки инструментов и превращает индикатор работы в плывущий парусник; включается командой /calm. <sub>рисует: слеш-команда, всплывающее уведомление, полоса над полем ввода, сообщения в переписке · автор @kunchenguid · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install fm --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[glowup](https://krou4.github.io/claude-code-mod-showroom/#/mod/glowup)** — Панель-кокпит, паки, меняющие цвета, строки инструментов и спиннер, и пиксельный питомец, который реагирует. <sub>рисует: слеш-команда, сообщения в переписке, строки инструментов, спиннер, панель, строка статуса · автор @NovusEdge · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install glowup --marketplace NovusEdge/glowup
  ```

  </details>
- **[Image View](https://krou4.github.io/claude-code-mod-showroom/#/mod/image-view)** — Показывает миниатюры вставленных картинок над полем ввода, а не одни теги \[Image \#1\]. <sub>рисует: полоса над полем ввода · автор @jarrodwatts · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install image-view --marketplace jarrodwatts/claude-image-view
  ```

  </details>
- **[Intelligent UI](https://krou4.github.io/claude-code-mod-showroom/#/mod/intelligent-ui)** — Ответы Claude в виде свёрстанных картинок: таблицы, формулы LaTeX, графики и диаграммы через Typst. <sub>рисует: слеш-команда, сообщения в переписке, всплывающее уведомление, панель · автор @razorback16 · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install cc-intelligent-ui --marketplace razorback16/cc-intelligent-ui
  ```

  </details>
- **[Model Effort Band](https://krou4.github.io/claude-code-mod-showroom/#/mod/model-effort-band)** — Цветная полоса над полем ввода: выбранная модель и усилие, с которым прошёл её последний запрос. <sub>рисует: полоса над полем ввода · автор @YeonwooSung · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install model-effort-band --marketplace YeonwooSung/my-claude-code-mods
  ```

  </details>
- **[Show Your Work](https://krou4.github.io/claude-code-mod-showroom/#/mod/show-your-work)** — Claude показывает скриншоты и записи Playwright прямо в чате: до и после, с проверками QA. <sub>рисует: строки инструментов, инструмент для Claude, слеш-команда, панель, строка статуса, всплывающее уведомление · автор @iamumeransari · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install show-your-work --marketplace iamumeransari/claude-show-your-work
  ```

  </details>
- **[Skins](https://krou4.github.io/claude-code-mod-showroom/#/mod/skins)** — Строки инструментов со статусом, временем и числом правок, карточки вывода и таблиц, полоса лимитов и 15 тем. <sub>рисует: слеш-команда, всплывающее уведомление, строки инструментов, спиннер, строка длительности хода, полоса над полем ввода, инструмент для Claude, панель · автор @hellosverre · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install skins --marketplace hellosverre/claude-skins
  ```

  </details>
- **[Status Line Anywhere](https://krou4.github.io/claude-code-mod-showroom/#/mod/statusline-anywhere)** — Запускает вашу команду statusLine и рисует её вывод в цвете над полем ввода в десктопном приложении. <sub>рисует: полоса над полем ввода · автор @NathanAB · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install statusline-anywhere --marketplace NathanAB/statusline-anywhere
  ```

  </details>
- **[Stretchtext Replies](https://krou4.github.io/claude-code-mod-showroom/#/mod/cc-stretch)** — Ответы приходят короткими: нажмите на подчёркнутую фразу, и она развернётся на месте в подробный текст. <sub>рисует: сообщения в переписке, слеш-команда, полоса над полем ввода, всплывающее уведомление · автор @pro-vi · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install cc-stretch --marketplace pro-vi/cc-stretch
  ```

  </details>

### Сводки

- **[Agent Radar](https://krou4.github.io/claude-code-mod-showroom/#/mod/agent-radar)** — Живая строка над полем ввода на каждый работающий субагент и фоновую команду: время, инструменты, текущий шаг. <sub>рисует: полоса над полем ввода, всплывающее уведомление, слеш-команда, панель · автор @hamzafer · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install agent-radar --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Burn Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/burn-meter)** — Стоимость сессии над полем ввода: огненная полоса, лимиты тарифа и цена в буррито. <sub>рисует: полоса над полем ввода, всплывающее уведомление, слеш-команда, панель · автор @OneWave-AI · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install burn-meter --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Cache Clock](https://krou4.github.io/claude-code-mod-showroom/#/mod/cache-clock)** — Строка кэша промпта под строкой статуса: сколько кэш ещё тёплый, доля попаданий, промахи, токены на перекэш. <sub>рисует: слеш-команда, строка статуса · автор @hamzafer · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install cache-clock --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Context Bar](https://krou4.github.io/claude-code-mod-showroom/#/mod/context-bar)** — Составная полоса над полем ввода: чем занято окно контекста и когда начнётся автосжатие. <sub>рисует: полоса над полем ввода, слеш-команда · автор @hamzafer · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install context-bar --marketplace hamzafer/claude-code-mods
  ```

  </details>
- **[Context Gauge](https://krou4.github.io/claude-code-mod-showroom/#/mod/context-gauge)** — Заполненность окна контекста прямо в строке подсказки под полем ввода. <sub>рисует: строка подсказки · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install context-gauge --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Flightdeck](https://krou4.github.io/claude-code-mod-showroom/#/mod/flightdeck)** — Живая панель сессии: контекст и стоимость, все проверки разрешений, субагенты и журнал событий. <sub>рисует: слеш-команда, панель, строка статуса · автор @scasella · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install flightdeck --marketplace scasella/claude-flightdeck
  ```

  </details>
- **[Sub Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/sub-meter)** — Расход подписки за 5 часов и за неделю полосой со временем до сброса, в правом нижнем углу. <sub>рисует: строка подсказки, метка режима · автор @midudev · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install sub-meter --marketplace midudev/better-claude
  ```

  </details>
- **[Subagents Plus](https://krou4.github.io/claude-code-mod-showroom/#/mod/subagents-plus)** — Живое дерево и шкала времени всех субагентов в панели /subagents, плюс полоса над полем ввода. <sub>рисует: полоса над полем ввода, слеш-команда, панель, инструмент для Claude · автор @algonormative · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install subagents-plus --marketplace algonormative/subagents-plus
  ```

  </details>
- **[Time Blame](https://krou4.github.io/claude-code-mod-showroom/#/mod/time-blame)** — Под каждым ответом время хода по частям: Claude, инструменты, вы и прочее; /blame подводит итог сессии. <sub>рисует: строка длительности хода, слеш-команда, панель · автор @karanb192 · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install time-blame --marketplace karanb192/time-blame
  ```

  </details>
- **[Token Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/token-meter)** — Токены каждого хода (вход, вывод, кэш) и итог сессии — цветом в строке под полем ввода. <sub>рисует: строка подсказки · автор @midudev · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install token-meter --marketplace midudev/better-claude
  ```

  </details>
- **[Token Weather](https://krou4.github.io/claude-code-mod-showroom/#/mod/token-weather)** — Заполненность контекста как погода над полем ввода: значок, процент, токены и график последних 12 ходов. <sub>рисует: полоса над полем ввода · автор @anthropics · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install token-weather --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Tool Timeline](https://krou4.github.io/claude-code-mod-showroom/#/mod/tool-timeline)** — Панель со всеми вызовами инструментов по ходу работы: статус, файл или команда и время вызова. <sub>рисует: слеш-команда, панель · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install tool-timeline --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Turn Meter](https://krou4.github.io/claude-code-mod-showroom/#/mod/turn-meter)** — Время, вызовы инструментов и токены каждого хода над полем ввода, с мини-графиком последних 12 ходов. <sub>рисует: полоса над полем ввода, всплывающее уведомление, слеш-команда · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install turn-meter --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[WeekToken](https://krou4.github.io/claude-code-mod-showroom/#/mod/weektoken)** — Темп расхода лимитов: сколько потрачено за 5 часов и за неделю против прошедшего времени, прогноз и история. <sub>рисует: полоса над полем ввода, панель, слеш-команда, всплывающее уведомление · автор @3dnow · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install weektoken --marketplace 3dnow/claude-mods
  ```

  </details>
- **[What's Agent Doing](https://krou4.github.io/claude-code-mod-showroom/#/mod/whats-agent-doing)** — Рамка над полем ввода: что агент делает прямо сейчас и как долго, а по нажатию ▸ — пройденные шаги. <sub>рисует: полоса над полем ввода · автор @tzafrir · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install whats-agent-doing --marketplace tzafrir/whats-agent-doing
  ```

  </details>

### Безопасность

- **[Blast Radius](https://krou4.github.io/claude-code-mod-showroom/#/mod/blast-radius)** — Задерживает опасную команду и показывает, какие файлы, коммиты или миграции она затронет: Proceed или Cancel. <sub>рисует: панель, блокировка инструментов, всплывающее уведомление · автор @anthropics · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install blast-radius --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Secret Guard](https://krou4.github.io/claude-code-mod-showroom/#/mod/secret-guard)** — Не даёт Claude читать .env, приватные ключи и файлы с учётными данными. <sub>рисует: блокировка инструментов, всплывающее уведомление, строка статуса · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install secret-guard --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Продуктивность

- **[Command Buttons](https://krou4.github.io/claude-code-mod-showroom/#/mod/command-buttons)** — Кнопки Run и Copy для каждой команды оболочки в ответе и полоса горячих клавиш над полем ввода. <sub>рисует: сообщения в переписке, полоса над полем ввода, всплывающее уведомление · автор @Faridmurzone · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install command-buttons --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[ctx-handoff](https://krou4.github.io/claude-code-mod-showroom/#/mod/ctx-handoff)** — Передаёт длинную сессию в новый чат, держит кэш тёплым, пока вас нет, и ведёт заметки проекта. <sub>рисует: полоса над полем ввода, строка статуса, слеш-команда, блокировка инструментов, всплывающее уведомление · автор @cablate · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install ctx-handoff --marketplace cablate/ctx-handoff-mod
  ```

  </details>
- **[Done Ping](https://krou4.github.io/claude-code-mod-showroom/#/mod/done-ping)** — Системное уведомление, когда долгий ход закончился: можно не следить за экраном. <sub>рисует: системное уведомление, слеш-команда, всплывающее уведомление · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install done-ping --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[effortless](https://krou4.github.io/claude-code-mod-showroom/#/mod/effortless)** — Сам выбирает уровень рассуждений для каждого запроса и показывает над полем ввода, сколько ещё живёт кэш. <sub>рисует: полоса над полем ввода, строка длительности хода, слеш-команда · автор @HeyCubit · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install effortless --marketplace HeyCubit/effortless
  ```

  </details>
- **[Focus Timer](https://krou4.github.io/claude-code-mod-showroom/#/mod/focus-timer)** — Помодоро-таймер над полем ввода: пауза, стоп и уведомление в конце сессии. <sub>рисует: слеш-команда, полоса над полем ввода, всплывающее уведомление, системное уведомление · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install focus-timer --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Mod Store](https://krou4.github.io/claude-code-mod-showroom/#/mod/mod-store)** — Панель /mods: ищите моды сообщества, смотрите, к чему они получают доступ, и ставьте после подтверждения. <sub>рисует: слеш-команда, панель, инструмент для Claude, всплывающее уведомление · автор @hellosverre · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install mod-store --marketplace hellosverre/mod-store
  ```

  </details>
- **[Model Hint](https://krou4.github.io/claude-code-mod-showroom/#/mod/model-hint)** — Подсказывает haiku, sonnet или opus для запроса, который вы печатаете, с причиной и кнопкой Switch. <sub>рисует: полоса над полем ввода, слеш-команда, строка статуса, всплывающее уведомление · автор @hashswingingslasher · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install model-hint --marketplace hashswingingslasher/model-hint
  ```

  </details>
- **[Next Steps](https://krou4.github.io/claude-code-mod-showroom/#/mod/next-steps)** — После каждого ответа над полем ввода появляются до трёх следующих запросов; 1–3 вставляет один черновиком. <sub>рисует: полоса над полем ввода, всплывающее уведомление · автор @anthropics · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install next-steps --marketplace anthropics/claude-plugins-community
  ```

  </details>
- **[Pin Memo](https://krou4.github.io/claude-code-mod-showroom/#/mod/pin-memo)** — Закреплённые заметки и задачи с флажками над полем ввода, отдельно для каждой папки и сессии. <sub>рисует: слеш-команда, полоса над полем ввода, всплывающее уведомление · автор @YeonwooSung · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install pin-memo --marketplace YeonwooSung/my-claude-code-mods
  ```

  </details>
- **[Prompt Snippets](https://krou4.github.io/claude-code-mod-showroom/#/mod/prompt-snippets)** — Сохраните промпт один раз, вставляйте его через /snip, а выделение цитируйте через /quote. <sub>рисует: слеш-команда · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install prompt-snippets --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Replay Theater](https://krou4.github.io/claude-code-mod-showroom/#/mod/replay-theater)** — Пролистайте правки файлов за последний ход в панели, по одному красно-зелёному диффу за шаг. <sub>рисует: слеш-команда, панель · автор @anthropics · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install replay-theater --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Git

- **[Git Glance](https://krou4.github.io/claude-code-mod-showroom/#/mod/git-glance)** — Ветка, изменённые файлы и коммиты впереди или позади upstream в строке статуса под полем ввода. <sub>рисует: строка статуса · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install git-glance --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>

### Для настроения

- **[Boss Fight](https://krou4.github.io/claude-code-mod-showroom/#/mod/boss-fight)** — Упавшие тесты вызывают пиксельного босса с 1 HP за каждый провал; каждый прогон с исправлениями бьёт его. <sub>рисует: панель, всплывающее уведомление, строка статуса, слеш-команда · автор @OneWave-AI · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install boss-fight --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Brickfall](https://krou4.github.io/claude-code-mod-showroom/#/mod/brickfall)** — Яркий арканоид в панели: ракетка за мышью, капсулы с бонусами и цепные взрывы вольт-кирпичей. <sub>рисует: панель, слеш-команда · автор @reporails · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install brickfall --marketplace reporails/arcade
  ```

  </details>
- **[Cat Spinner](https://krou4.github.io/claude-code-mod-showroom/#/mod/cat-spinner)** — Пиксельный кот гуляет над спиннером, садится подумать и реагирует на инструменты Claude. <sub>рисует: слеш-команда, панель, спиннер · автор @swicken · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install cat-spinner --marketplace swicken/cat-spinner
  ```

  </details>
- **[Clawd Pet](https://krou4.github.io/claude-code-mod-showroom/#/mod/clawd-pet)** — Пиксельный Clawd над полем ввода: показывает текущий инструмент, радуется пройденным тестам и спит в простое. <sub>рисует: полоса над полем ввода, слеш-команда · автор @Revono · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install clawd-pet --marketplace Revono/clawd-pet
  ```

  </details>
- **[Code Pet](https://krou4.github.io/claude-code-mod-showroom/#/mod/code-pet)** — Пиксельный питомец на панели: ест при вызовах инструментов, болеет от ошибок и паникует от rm -rf. <sub>рисует: слеш-команда, панель, строка статуса, всплывающее уведомление · автор @OneWave-AI · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install code-pet --marketplace OneWave-AI/claude-code-mods
  ```

  </details>
- **[Fables](https://krou4.github.io/claude-code-mod-showroom/#/mod/fables)** — Мультфильм над полем ввода: Sonnet или Haiku пересказывает вызовы инструментов и реплики сценами с подписями. <sub>рисует: полоса над полем ввода, слеш-команда · автор @henrik-thevibe · внешний</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install fables --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Mindful Breathing](https://krou4.github.io/claude-code-mod-showroom/#/mod/mindful-breathing)** — Пока Claude работает, над полем ввода идёт дыхательное упражнение, а спиннер отсчитывает фазы дыхания. <sub>рисует: полоса над полем ввода, спиннер, слеш-команда · автор @halluton · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install mindful-claude --marketplace halluton/Mindful-Claude
  ```

  </details>
- **[Minefield](https://krou4.github.io/claude-code-mod-showroom/#/mod/minefield)** — Сапёр в панели: разминируйте поле 9×9 мышью или клавишами, пока Claude работает. <sub>рисует: панель, слеш-команда · автор @reporails · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install minefield --marketplace reporails/arcade
  ```

  </details>
- **[miod](https://krou4.github.io/claude-code-mod-showroom/#/mod/miod)** — Своя мелодия для каждой задачи, сочинённая на лету; настроение задают действия агента и темп расхода токенов. <sub>рисует: полоса над полем ввода, слеш-команда, всплывающее уведомление · автор @delexw · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install miod --marketplace delexw/miod
  ```

  </details>
- **[Spinner Pack](https://krou4.github.io/claude-code-mod-showroom/#/mod/spinner-pack)** — Тематический спиннер: луна, шрифт Брайля или кофе; слово и значок меняются с каждой фазой хода. <sub>рисует: спиннер · автор @KROU4 · в этом репозитории</sub>
  <details><summary>Установка</summary>

  ```text
  /plugin install spinner-pack --marketplace KROU4/claude-code-mod-showroom
  ```

  </details>
- **[Storytime](https://krou4.github.io/claude-code-mod-showroom/#/mod/storytime)** — Крошечный локальный трансформер печатает над полем ввода сказку о том, чем сейчас занят Claude. <sub>рисует: полоса над полем ввода, слеш-команда · автор @maddiedreese · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install storytime --marketplace maddiedreese/cc-storytime
  ```

  </details>
- **[Terminal Gym](https://krou4.github.io/claude-code-mod-showroom/#/mod/terminal-gym)** — Дневная норма повторений над полем ввода: отмечайте подходы кнопками +5/+10/+25 и держите серию дней. <sub>рисует: полоса над полем ввода, спиннер, всплывающее уведомление, слеш-команда, панель · автор @DrumAndCode · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install terminal-gym --marketplace DrumAndCode/terminal-gym
  ```

  </details>
- **[textless](https://krou4.github.io/claude-code-mod-showroom/#/mod/textless)** — Пока Claude работает, вместо ленты шагов в чате стоит одна карточка с пиксельной картинкой. <sub>рисует: строки инструментов, слеш-команда · автор @HeyCubit · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install textless --marketplace HeyCubit/effortless
  ```

  </details>
- **[Verbs](https://krou4.github.io/claude-code-mod-showroom/#/mod/verbs)** — Пока Claude работает, над спиннером крутится пиксельная картинка его глагола, своя для каждого из 188. <sub>рисует: слеш-команда, спиннер, всплывающее уведомление · автор @olliewagner · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install verbs --marketplace olliewagner/verbs
  ```

  </details>

### Доступность

- **[RTL Terminal](https://krou4.github.io/claude-code-mod-showroom/#/mod/rtl-terminal)** — Ответы на арабском, иврите, фарси и урду выводятся справа налево, маркеры списков — справа. <sub>рисует: сообщения в переписке, полоса над полем ввода, слеш-команда · автор @MohammedSaud404 · внешний</sub>
  <details><summary>Установка (из маркетплейса автора)</summary>

  ```text
  /plugin install rtl-terminal --marketplace MohammedSaud404/rtl-terminal
  ```

  </details>
<!-- mods:end -->

## Добавить свой мод

Каталог открыт для всех. Запись — это один файл `mods/<имя>/mod.json`: название, описание, откуда ставить и превью для сайта. Добавить её можно тремя способами:

1. **Конструктор на сайте** ([Submit a mod](https://krou4.github.io/claude-code-mod-showroom/#/submit)): заполните форму, посмотрите превью и откройте pull request одной кнопкой.
2. **Через веб-интерфейс GitHub**: Add file → Create new file → `mods/<имя>/mod.json`.
3. **Через git**: форк, файл, `npm ci && npm run check`, pull request.

Код мода может лежать в вашем репозитории (`source: github`) или прямо здесь, в `mods/<имя>/plugin/`. Если все изменения внутри `mods/<имя>/`, проверки прошли и вы указаны в `maintainers`, бот сольёт запрос сам. Подробности в [CONTRIBUTING.md](CONTRIBUTING.md), формат превью в [docs/preview-dsl.md](docs/preview-dsl.md).

## Как защищён репозиторий

- Ветку `main` нельзя удалить или переписать: удаление и force-push запрещены без исключений, даже для администратора.
- Изменения попадают в `main` только через pull request.
- Бот сливает запрос сам, только если все файлы внутри `mods/<имя>/`, проверка Validate прошла для этого самого коммита, автор — мейнтейнер изменённых записей (у новой записи — указан в `maintainers`), а поле `verified` не тронуто. Код и `source` модов, которые уже есть в каталоге, он не меняет: это читает мейнтейнер. Остальное тоже смотрит мейнтейнер.
- Бот не запускает код из pull request с правами на запись: он читает запрос через GitHub API как данные.
- Ошибку исправляют новым коммитом (revert), история не переписывается.

Полная модель — в [docs/governance.md](docs/governance.md). Как сообщить о вредном моде — в [SECURITY.md](SECURITY.md).

## Исследование

[docs/research.md](docs/research.md): как устроены моды, где и что они рисуют, какие есть способы установки и ссылки для запуска, какие каталоги модов уже существуют и чем этот отличается.

## Связанные проекты

Другие места, где искать моды. Список взят из нашего исследования экосистемы в октябре 2026 года.

**Каталоги и индексы**

- [Awesome Claude Code Mods](https://github.com/karanb192/awesome-claude-code-mods) — самый большой индекс модов: автоматический скан GitHub, `claude plugin validate` для каждого мода, оценка доступа; сайт [mods.aidojo.si](https://mods.aidojo.si/).
- [statuslin.es](https://statuslin.es/mods) — курируемая галерея; превью записаны из настоящего Claude Code и Claude Desktop.
- [claudemods.chat](https://claudemods.chat) — каталог и маркетплейс из одного файла данных, каждый мод закреплён на проверенном коммите.
- [claude-mods.com](https://claude-mods.com/) — ежедневный скан GitHub с ручной проверкой и метками поверхностей.
- [modsforClaude](https://modsforclaude.com/) — фильтры по категориям и типам хуков, ревью привязано к коммиту.
- [Claude Mods](https://claudemods.ai/) — ручная модерация, голосование за мод дня, JSON-фид.
- [CCMods Hub](https://ccmodshub.com/) — галерея модов по разделам.
- [slopshopper](https://github.com/ryx2/slopshopper) — ежедневный скан GitHub и превью из прогона мода на имитации API.
- [awesome-claude-mods](https://github.com/wh000wh000/awesome-claude-mods) — индекс, где у каждого мода указано, чем подтверждены данные; обновляется каждые два часа.

**Маркетплейсы и коллекции**

- [baselane-sh/mods-catalog](https://github.com/baselane-sh/mods-catalog) — маркетплейс с источниками, закреплёнными по коммиту; запись добавляется одним pull request.
- [whyashthakker/awesome-claude-code-mods](https://github.com/whyashthakker/awesome-claude-code-mods) — собственные моды с тестами и скриншотами из тестового набора Claude Code.
- [hamzafer/claude-code-mods](https://hamzafer.github.io/claude-code-mods/) — моды по категориям со скриншотами.
- [Plagemes/claude-mods](https://plagemes.github.io/claude-mods/) — собственные моды и магазин внутри терминала.
- [Mod Store](https://github.com/hellosverre/mod-store) — магазин модов прямо в клиенте: панель `/mods` с поиском и установкой.

**От Anthropic**

- [Документация по модам](https://code.claude.com/docs/en/plugins/mods/overview) — обзор, справочник, API, тесты, администрирование.
- [Встроенные моды](https://github.com/anthropics/claude-code/tree/main/mods) — исходники модов, которые поставляются с Claude Code.
- [Моды из claude-code-playground](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) — демонстрационные моды со скриншотами.

**Списки**

- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — большой список ресурсов по Claude Code с разделом Mods.

## Лицензия

Каталог, скрипты, сайт и моды из `mods/*/plugin/` распространяются по лицензии [MIT](LICENSE). Внешние моды остаются под лицензиями своих авторов (поле `license` в записи).

Это проект сообщества. Он не связан с Anthropic и не одобрен ею. Claude и Claude Code — товарные знаки Anthropic.

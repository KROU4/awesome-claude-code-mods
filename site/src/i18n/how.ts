import { defineDict } from './define'

// "How it works" (sections/HowItWorks.tsx, components/how/*). Backticks mark `code` spans.
export default defineDict(
  {
    title: 'How it works',
    lead: 'A mod is a Claude Code plugin whose hooks change the client itself: a band above the prompt, a pane, a status line, the spinner. You install it like any plugin.',

    'step.marketplace': 'Add the marketplace once',
    'step.marketplace.session': 'In any Claude Code session:',
    'step.marketplace.shell': 'Or from a shell:',
    'step.marketplace.desktop':
      'In the desktop app: + next to the prompt box, then Plugins, then Add marketplace, and paste `{repo}`.',
    'step.install': 'Install a mod',
    'step.install.session': 'Pick one in the catalog and install it by name, for example {mod}:',
    'step.install.oneLine': 'Or skip step 1 and do both in one line (Claude Code {v} and later):',
    'step.install.links':
      'Every mod’s page has its lines ready to copy and one-click links for VS Code, the terminal and the desktop app.',
    'step.load': 'It loads into your session',
    'step.load.body':
      'A mod installed with `/plugin` starts drawing right away. Installed from a shell while a session is open: run `/reload-plugins`. In the desktop app, start a new session.',
    'step.load.caption': '{mod} after a long turn: the band above the prompt and a toast.',
    'step.load.versions':
      'Mods draw in the terminal from Claude Code {mods}, in the desktop app from {desktop} and in VS Code from extension {vscode}.',

    'copy.marketplace': 'the command that adds the marketplace',
    'copy.marketplaceShell': 'the shell command that adds the marketplace',
    'copy.install': 'the install command for {mod}',
    'copy.installOneLine': 'the one-line install command for {mod}',

    'anatomy.title': 'Anatomy of a mod',
    'anatomy.lead':
      'Three files. The manifest names the plugin, hooks.json lists the module to load, and register.tsx holds the hooks that decide what to draw and when. This is Turn Meter, from this catalog.',
    'anatomy.files': 'Files of Turn Meter',
    'anatomy.note.manifest': 'name, version, settings',
    'anatomy.note.hooks': 'the module to load',
    'anatomy.note.register': 'the hooks: what to draw, and when',
    'anatomy.range': 'lines {from}–{to} of {total}',
    'anatomy.whole': '{total} lines',
    'anatomy.gap': 'lines {from}–{to}: the sparkline, as Raster cells in the terminal and Text elsewhere',
    'anatomy.source': 'Read the whole mod on GitHub',

    'docs.title': 'Official documentation',
    'docs.lang': 'In English.',
    'docs.overview': 'Mods overview',
    'docs.overview.note': 'What mods are and where they draw',
    'docs.create': 'Create a mod',
    'docs.create.note': 'Writing and testing a mod of your own',
    'docs.reference': 'Mod API reference',
    'docs.reference.note': 'Hooks, $ calls and components',

  },
  {
    title: 'Как это работает',
    lead: 'Мод\u00a0— это плагин Claude Code, хуки которого меняют сам клиент: полоса над полем ввода, панель, строка статуса, спиннер. Ставится он как любой плагин.',

    'step.marketplace': 'Один раз добавьте маркетплейс',
    'step.marketplace.session': 'В любой сессии Claude Code:',
    'step.marketplace.shell': 'Или в оболочке:',
    'step.marketplace.desktop':
      'В десктопном приложении: + рядом с полем ввода, затем Plugins, Add marketplace, и вставьте `{repo}`.',
    'step.install': 'Установите мод',
    'step.install.session': 'Выберите мод в каталоге и поставьте его по имени, например {mod}:',
    'step.install.oneLine': 'Или пропустите шаг 1 и сделайте всё одной строкой (Claude Code {v} и новее):',
    'step.install.links':
      'На странице каждого мода есть готовые строки для копирования и ссылки для установки в один клик: VS Code, терминал и десктопное приложение.',
    'step.load': 'Мод загрузится в вашу сессию',
    'step.load.body':
      'Мод, поставленный через `/plugin`, начинает рисовать сразу. Если ставили из оболочки при открытой сессии, выполните `/reload-plugins`. В десктопном приложении начните новую сессию.',
    'step.load.caption': '{mod} после долгого хода: полоса над полем ввода и всплывающее сообщение.',
    'step.load.versions':
      'Моды рисуют в терминале начиная с Claude Code {mods}, в десктопном приложении с {desktop}, в VS Code с расширения {vscode}.',

    'copy.marketplace': 'команду, которая добавляет маркетплейс',
    'copy.marketplaceShell': 'команду оболочки, которая добавляет маркетплейс',
    'copy.install': 'команду установки {mod}',
    'copy.installOneLine': 'команду установки {mod} одной строкой',

    'anatomy.title': 'Из чего состоит мод',
    'anatomy.lead':
      'Из трёх файлов. Манифест называет плагин, hooks.json указывает модуль, а в register.tsx лежат хуки, которые решают, что рисовать и когда. Это Turn Meter из нашего каталога.',
    'anatomy.files': 'Файлы Turn Meter',
    'anatomy.note.manifest': 'имя, версия, настройки',
    'anatomy.note.hooks': 'какой модуль загрузить',
    'anatomy.note.register': 'хуки: что рисовать и когда',
    'anatomy.range': 'строки {from}–{to} из {total}',
    'anatomy.whole': 'строк: {total}',
    'anatomy.gap': 'строки {from}–{to}: мини-график, в терминале ячейками Raster, в остальных клиентах через Text',
    'anatomy.source': 'Весь мод на GitHub',

    'docs.title': 'Официальная документация',
    'docs.lang': 'На английском.',
    'docs.overview': 'Обзор модов',
    'docs.overview.note': 'Что такое моды и где они рисуют',
    'docs.create': 'Как создать мод',
    'docs.create.note': 'Как написать и проверить свой мод',
    'docs.reference': 'Справочник API модов',
    'docs.reference.note': 'Хуки, вызовы $ и компоненты',

  },
)

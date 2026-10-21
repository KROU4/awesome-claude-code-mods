import { defineDict } from './define'

// Strings of the mock client (components/mock). Text inside the mock terminal itself is
// the client's own English and is not translated.
export default defineDict(
  {
    'toolbar.label': 'Preview controls',
    'surface.label': 'Show in',
    'surface.short.terminal': 'Terminal',
    'surface.short.desktop': 'Desktop',
    'surface.short.vscode': 'VS Code',
    'theme.label': 'Terminal theme',
    'theme.appLabel': 'Theme',
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'layout.label': 'Layout',
    'layout.classic': 'Classic',
    'layout.full': 'Fullscreen',
    'layout.classicTitle': 'Classic layout: the prompt follows the conversation',
    'layout.fullTitle': 'Fullscreen layout: the prompt stays at the bottom and panes dock to the right',
    pause: 'Pause',
    play: 'Play',
    replay: 'Replay',
    'replay.title': 'Play the session again from the start',

    'aria.terminal': 'Claude Code in a terminal, with {mods}',
    'aria.desktop': 'Claude desktop app, Code tab, with {mods}',
    'aria.vscode': 'Claude Code in VS Code, with {mods}',
    'aria.noMods': 'no mods',

    'notDrawn.terminal': 'Not drawn in the terminal',
    'notDrawn.desktop': 'Not drawn in the desktop app',
    'notDrawn.vscode': 'Not drawn in VS Code',
    'notDrawn.list': '{what}: {slots}',

    captured: 'Rendered from the mod’s code',
    background: 'Runs in the background',
    now: 'now',
  },
  {
    'toolbar.label': 'Управление превью',
    'surface.label': 'Показать в',
    'surface.short.terminal': 'Терминал',
    'surface.short.desktop': 'Десктоп',
    'surface.short.vscode': 'VS Code',
    'theme.label': 'Тема терминала',
    'theme.appLabel': 'Тема',
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',
    'layout.label': 'Раскладка',
    'layout.classic': 'Обычная',
    'layout.full': 'Полноэкранная',
    'layout.classicTitle': 'Обычная раскладка: поле ввода идёт сразу за перепиской',
    'layout.fullTitle': 'Полноэкранная раскладка: поле ввода внизу, панели справа',
    pause: 'Пауза',
    play: 'Продолжить',
    replay: 'Сначала',
    'replay.title': 'Проиграть сессию с начала',

    'aria.terminal': 'Claude Code в терминале, моды: {mods}',
    'aria.desktop': 'Десктопное приложение Claude, вкладка Code, моды: {mods}',
    'aria.vscode': 'Claude Code в VS Code, моды: {mods}',
    'aria.noMods': 'нет',

    'notDrawn.terminal': 'В терминале не рисуется',
    'notDrawn.desktop': 'В десктопном приложении не рисуется',
    'notDrawn.vscode': 'В VS Code не рисуется',
    'notDrawn.list': '{what}: {slots}',

    captured: 'Нарисовано кодом мода',
    background: 'Работает в фоне',
    now: 'сейчас',
  },
)

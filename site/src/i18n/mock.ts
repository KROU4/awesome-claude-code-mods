import { defineDict } from './define'

// Strings of the mock client (components/mock). Text inside the mock terminal itself is
// the client's own English and is not translated.
export default defineDict(
  {
    'toolbar.label': 'Preview controls',
    'surface.label': 'Show in',
    'theme.label': 'Terminal theme',
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    fullscreen: 'Fullscreen',
    'fullscreen.title': 'Fullscreen layout: the prompt stays at the bottom and panes dock to the right',
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
    rewritten: 'rewritten by {mod}',
    'notification.from': 'Notification from {app}',

    'coming.desktop.title': 'Desktop app view is on its way',
    'coming.vscode.title': 'VS Code view is on its way',
    'coming.body': 'Switch to Terminal to see this mod now.',
    'coming.toTerminal': 'Show in Terminal',
  },
  {
    'toolbar.label': 'Управление превью',
    'surface.label': 'Показать в',
    'theme.label': 'Тема терминала',
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',
    fullscreen: 'Полный экран',
    'fullscreen.title': 'Полноэкранный режим: поле ввода внизу, панели справа',
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
    rewritten: 'переписано модом {mod}',
    'notification.from': 'Уведомление от {app}',

    'coming.desktop.title': 'Вид десктопного приложения скоро появится',
    'coming.vscode.title': 'Вид VS Code скоро появится',
    'coming.body': 'Переключитесь на терминал, чтобы увидеть мод сейчас.',
    'coming.toTerminal': 'Показать в терминале',
  },
)

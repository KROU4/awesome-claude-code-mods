import { defineDict } from './define'

// Install panel and loadout bar. Starter keys; the Install owner extends this file.
export default defineDict(
  {
    title: 'Install',
    'tab.terminal': 'Terminal',
    'tab.shell': 'Shell',
    'tab.desktop': 'Desktop app',
    'tab.vscode': 'VS Code',
    'tab.ask': 'Ask Claude',
    'link.vscode': 'Install in VS Code',
    'link.terminal': 'Open in terminal',
    'link.terminalHint': 'Opens Claude Code with the install command typed. Press Enter.',
    'link.desktop': 'Open in Claude desktop',
    'links.note': 'These links open apps installed on this computer. You approve the install inside Claude Code.',
    'loadout.title': 'Loadout',
    'loadout.copyAll': 'Copy all',
    'loadout.clear': 'Clear',
  },
  {
    title: 'Установка',
    'tab.terminal': 'Терминал',
    'tab.shell': 'Оболочка',
    'tab.desktop': 'Десктоп',
    'tab.vscode': 'VS Code',
    'tab.ask': 'Попросить Claude',
    'link.vscode': 'Установить в VS Code',
    'link.terminal': 'Открыть в терминале',
    'link.terminalHint': 'Откроет Claude Code с уже набранной командой установки. Нажмите Enter.',
    'link.desktop': 'Открыть в Claude desktop',
    'links.note': 'Ссылки открывают приложения на этом компьютере. Установку вы подтверждаете в Claude Code.',
    'loadout.title': 'Набор',
    'loadout.copyAll': 'Скопировать всё',
    'loadout.clear': 'Очистить',
  },
)

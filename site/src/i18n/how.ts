import { defineDict } from './define'

// "How it works" section. Starter keys; the How owner extends this file.
export default defineDict(
  {
    title: 'How it works',
    lead: 'A mod is a Claude Code plugin whose hooks change the client itself.',
    'step.marketplace': 'Add the marketplace once',
    'step.install': 'Install a mod',
    'step.load': 'It loads into your session',
  },
  {
    title: 'Как это работает',
    lead: 'Мод — это плагин Claude Code, хуки которого меняют сам клиент.',
    'step.marketplace': 'Один раз добавьте маркетплейс',
    'step.install': 'Установите мод',
    'step.load': 'Он загрузится в вашу сессию',
  },
)

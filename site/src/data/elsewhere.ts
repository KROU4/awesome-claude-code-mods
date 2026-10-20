// "More places to find mods" — other directories found by the research sweep
// (_specs/research/sweep-1.json `collections`, checked 2026-10-20). Not affiliated with us.
export type Elsewhere = { name: string; url: string; note: string; note_ru: string }

export const ELSEWHERE: Elsewhere[] = [
  {
    name: 'Awesome Claude Code Mods',
    url: 'https://github.com/karanb192/awesome-claude-code-mods',
    note: 'The largest index, with an access grade per mod',
    note_ru: 'Самый большой индекс, с оценкой доступа для каждого мода',
  },
  {
    name: 'statuslin.es',
    url: 'https://statuslin.es/mods',
    note: 'Curated mods recorded in the real client',
    note_ru: 'Отобранные моды, записанные в настоящем клиенте',
  },
  {
    name: 'modsforClaude',
    url: 'https://modsforclaude.com/',
    note: 'Filter by the hooks a mod uses',
    note_ru: 'Фильтр по хукам, которые использует мод',
  },
  {
    name: 'claude-mods.com',
    url: 'https://claude-mods.com/',
    note: 'Scanned daily, tagged by surface',
    note_ru: 'Ежедневный скан, теги по поверхностям',
  },
  {
    name: 'claudemods.chat',
    url: 'https://claudemods.chat',
    note: 'A small curated marketplace',
    note_ru: 'Небольшой курируемый маркетплейс',
  },
]

import { defineDict } from './define'

// Catalog section, mod cards and the detail sheet (`detail.*`). Starter keys; the
// Catalog and Detail owners extend this file.
export default defineDict(
  {
    title: 'Catalog',
    lead: 'Search by name, tag or author. Each card shows the mod the way the client draws it.',
    'search.label': 'Search mods',
    'search.placeholder': 'Search by name, tag or author',
    'empty.title': 'Nothing matches yet',
    'empty.body': 'Try a shorter search, or add the mod yourself.',
    'empty.submit': 'Submit the first one',
    'card.open': 'Open {title}',
    'card.install': 'Install',
    'card.addToLoadout': 'Add to loadout',
    'card.hosted': 'Hosted here',
    'card.external': 'External',

    'detail.close': 'Close',
    'detail.notFound': 'There is no mod named {name} in the catalog.',
  },
  {
    title: 'Каталог',
    lead: 'Ищите по названию, тегу или автору. На каждой карточке мод выглядит так, как его рисует клиент.',
    'search.label': 'Поиск модов',
    'search.placeholder': 'Название, тег или автор',
    'empty.title': 'Пока ничего не нашлось',
    'empty.body': 'Попробуйте запрос короче или добавьте мод сами.',
    'empty.submit': 'Добавить первый',
    'card.open': 'Открыть {title}',
    'card.install': 'Установить',
    'card.addToLoadout': 'В набор',
    'card.hosted': 'Хранится здесь',
    'card.external': 'Внешний',

    'detail.close': 'Закрыть',
    'detail.notFound': 'Мода с именем {name} в каталоге нет.',
  },
)

// Helper for per-area dictionaries. RU must cover every EN key (checked by TypeScript);
// it may add plural forms EN does not need (`.few`, `.many`).

export type Lang = 'en' | 'ru'

export type DictPair<E extends Record<string, string>> = {
  en: E
  ru: { [K in keyof E]: string } & Record<string, string>
}

export function defineDict<E extends Record<string, string>>(
  en: E,
  ru: { [K in keyof E]: string } & Record<string, string>,
): DictPair<E> {
  return { en, ru }
}

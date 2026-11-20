import { Language } from '../types';

export type MultiLangText = Partial<Record<Language, string>> & {
  ar?: string;
  fr?: string;
};

/**
 * Resolves a localized string cleanly across all 5 supported languages
 * (ar, fr, amz, en, es), guaranteeing no missing-language fallback glitches.
 */
export function pickLang(lang: Language, map: MultiLangText): string {
  return (
    map[lang] ??
    map.fr ??
    map.en ??
    map.ar ??
    map.amz ??
    map.es ??
    ''
  );
}

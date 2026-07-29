import { UiLanguage } from '@conversation-copilot/shared-types';
import { TranslationKey, Translations } from './types';
import { ptBR } from './pt-BR';
import { en } from './en';

const dictionaries: Record<UiLanguage, Translations> = {
  'pt-BR': ptBR,
  en: en
};

/**
 * Retorna a tradução formatada para uma determinada chave.
 * Caso a chave não exista no idioma selecionado, utiliza pt-BR como fallback.
 */
export function t(key: TranslationKey, lang: UiLanguage = 'pt-BR'): string {
  const dict = dictionaries[lang] || dictionaries['pt-BR'];
  return dict[key] || ptBR[key] || key;
}

export type { TranslationKey, Translations };
export { ptBR, en };

import type { TranslationKey } from './ru';

export type { TranslationKey };

export type Lang = 'ru' | 'en';

/** Plural forms per Intl.PluralRules; `other` is the mandatory fallback. */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };

/** A plain string, or plural forms selected by the `n` parameter. */
export type Message = string | PluralMessage;

export type Dictionary = Readonly<Record<TranslationKey, Message>>;

export type TranslationParams = Readonly<Record<string, string | number>>;

/**
 * Text kept as a key instead of a rendered string, so it re-renders when the language
 * changes. Services store messages in this form rather than as ready-made strings.
 */
export interface LocalizedText {
  readonly key: TranslationKey;
  readonly params?: TranslationParams;
}

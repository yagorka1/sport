import { signal } from '@angular/core';
import { en } from './en';
import { ru, TranslationKey } from './ru';
import {
  Dictionary,
  Lang,
  LocalizedText,
  Message,
  PluralMessage,
  TranslationParams,
} from './i18n.model';

/**
 * Runtime translations without a library. The current language lives in a signal, so any
 * template, computed() or effect() that renders text through t() or the `t` pipe re-runs
 * by itself when the language changes — no reload, which matters inside the APK.
 *
 * The state is module-level rather than in a service on purpose: plain formatting helpers
 * (formatValue, formatDuration, date labels) need the locale too and have no injector.
 */

export const LANGS: readonly Lang[] = ['ru', 'en'];

const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { ru, en };

const LOCALES: Readonly<Record<Lang, string>> = { ru: 'ru-RU', en: 'en-US' };

const STORAGE_KEY = 'lang';

const current = signal<Lang>(initialLang());

/** The active language. */
export const lang = current.asReadonly();

applyToDocument(current());

export function setLang(next: Lang): void {
  if (next === current()) return;
  current.set(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage may be unavailable (private mode) — the choice then lasts for the session.
  }
  applyToDocument(next);
}

/** BCP 47 locale for Intl formatting of numbers and dates. */
export function locale(): string {
  return LOCALES[current()];
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const lang = current();
  const message: Message = DICTIONARIES[lang][key] ?? ru[key];
  const template = typeof message === 'string' ? message : selectPlural(message, lang, params);
  return interpolate(template, params);
}

export function translate(text: LocalizedText): string {
  return t(text.key, text.params);
}

/** For keys assembled at runtime, e.g. `workout.${type}`. */
export function isTranslationKey(key: string): key is TranslationKey {
  return Object.hasOwn(ru, key);
}

/** Wraps untranslatable text (an SDK error message, say) so it fits LocalizedText slots. */
export function rawText(message: string): LocalizedText {
  return { key: 'error.raw', params: { message } };
}

const pluralRules = new Map<Lang, Intl.PluralRules>();

function selectPlural(message: PluralMessage, lang: Lang, params?: TranslationParams): string {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALES[lang]);
    pluralRules.set(lang, rules);
  }
  const n = Number(params?.['n'] ?? 0);
  return message[rules.select(n)] ?? message.other;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? value.toLocaleString(locale()) : value;
  });
}

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ru' || stored === 'en') return stored;
  } catch {
    // Fall through to the browser language.
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ru';
  return browser.startsWith('ru') ? 'ru' : 'en';
}

function applyToDocument(next: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = next;
  document.title = DICTIONARIES[next]['app.title'] as string;
}

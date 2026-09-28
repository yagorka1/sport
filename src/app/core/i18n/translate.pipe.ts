import { Pipe, PipeTransform } from '@angular/core';
import { LocalizedText, TranslationKey, TranslationParams } from './i18n.model';
import { t, translate } from './i18n';

/**
 * `{{ 'nav.overview' | t }}`, `{{ 'status.ready' | t: { n: 3 } }}` or `{{ sync.message() | t }}`.
 *
 * Impure on purpose: a pure pipe would cache the result per key and miss a language
 * change. The call is cheap, and the signal read inside t() lets the zoneless scheduler
 * re-render the view when the language switches.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  transform(
    value: TranslationKey | LocalizedText | null | undefined,
    params?: TranslationParams,
  ): string {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? t(value, params) : translate(value);
  }
}

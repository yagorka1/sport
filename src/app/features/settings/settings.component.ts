import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { HealthService } from '@core/health/health.service';
import { SyncService } from '@core/sync/sync.service';
import { StatsStore } from '@core/stats/stats.store';
import { METRICS } from '@core/metrics/metric.registry';
import { isFirebaseConfigured } from '@core/data/firebase';
import { LANGS, lang, locale, setLang, t } from '@core/i18n/i18n';
import { Lang, TranslationKey } from '@core/i18n/i18n.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-settings',
  imports: [TranslatePipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  protected readonly sync = inject(SyncService);
  private readonly stats = inject(StatsStore);

  protected readonly allMetrics = METRICS;
  protected readonly firebaseReady = isFirebaseConfigured();

  protected readonly langs = LANGS;
  protected readonly lang = lang;
  protected readonly setLang = setLang;

  protected readonly running = computed(() => this.sync.state() === 'running');

  protected readonly statusLabel = computed(() => {
    switch (this.health.status()) {
      case 'checking':
        return t('status.checking');
      case 'ready':
        return t('status.ready', { n: this.health.granted().size });
      case 'needs-permission':
        return t('status.needsPermission');
      case 'unavailable':
        return t('status.unavailable');
      case 'demo':
        return t('status.demo');
    }
  });

  protected readonly lastSync = computed(() => {
    const at = this.sync.lastSyncAt();
    return at ? new Date(at).toLocaleString(locale()) : t('settings.neverSynced');
  });

  protected langLabel(option: Lang): TranslationKey {
    return option === 'ru' ? 'lang.ru' : 'lang.en';
  }

  protected async grant(): Promise<void> {
    if (await this.health.requestAccess()) {
      await this.sync.sync();
      await this.stats.load();
    }
  }

  protected async run(full: boolean): Promise<void> {
    await this.sync.sync(full);
    await this.stats.load();
  }
}

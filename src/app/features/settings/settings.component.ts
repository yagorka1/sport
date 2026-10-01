import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { HealthService } from '@core/health/health.service';
import { SyncService } from '@core/sync/sync.service';
import { StatsStore } from '@core/stats/stats.store';
import { METRICS, activeMetrics, defaultGoal, findMetric } from '@core/metrics/metric.registry';
import { MetricDescriptor } from '@core/metrics/metric.model';
import { GoalsService } from '@core/goals/goals.service';
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
  private readonly goals = inject(GoalsService);

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

  /** Metrics that have a daily goal at all; weight and resting heart rate do not. */
  protected readonly goalMetrics = computed(() =>
    activeMetrics().filter((m) => m.dailyGoal !== null),
  );

  protected isCustomGoal(metric: MetricDescriptor): boolean {
    return metric.dailyGoal !== defaultGoal(metric.id);
  }

  /** Steps are set in hundreds, kilometers in tenths — whatever matches the display precision. */
  protected goalStep(metric: MetricDescriptor): number {
    return metric.decimals > 0 ? 0.1 : (metric.dailyGoal ?? 0) >= 1000 ? 100 : 1;
  }

  protected async saveGoal(metric: MetricDescriptor, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const value = input.valueAsNumber;
    // An empty or invalid value means "back to the default".
    await this.goals.set(metric.id, Number.isFinite(value) && value > 0 ? value : null);
    // When the goal did not actually change, no binding updates — put the real value back.
    input.value = String(findMetric(metric.id)?.dailyGoal ?? '');
  }

  protected resetGoal(metric: MetricDescriptor): Promise<void> {
    return this.goals.set(metric.id, null);
  }

  protected langLabel(option: Lang): TranslationKey {
    return option === 'ru' ? 'lang.ru' : 'lang.en';
  }

  protected async grant(): Promise<void> {
    if (await this.health.requestAccess()) {
      await this.sync.sync();
      await this.stats.load();
    }
  }

  /**
   * Asks for whatever is still missing (history, workout details, routes), then re-reads
   * everything, since already synced days and workouts lack the newly readable data.
   */
  protected async grantMissing(): Promise<void> {
    const historyBefore = this.health.history();
    await this.health.requestAccess();
    const gained =
      this.health.accessComplete() ||
      (historyBefore !== 'granted' && this.health.history() === 'granted');
    if (gained) {
      await this.run(true);
    }
  }

  protected async run(full: boolean): Promise<void> {
    await this.sync.sync(full);
    await this.stats.load();
  }
}

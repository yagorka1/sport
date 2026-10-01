import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { HealthService } from '@core/health/health.service';
import { StatsStore } from '@core/stats/stats.store';
import { SyncService } from '@core/sync/sync.service';
import { GoalsService } from '@core/goals/goals.service';
import { isFirebaseConfigured } from '@core/data/firebase';
import { lang, setLang } from '@core/i18n/i18n';
import { TranslationKey } from '@core/i18n/i18n.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly health = inject(HealthService);
  private readonly stats = inject(StatsStore);
  private readonly sync = inject(SyncService);
  private readonly goals = inject(GoalsService);

  protected readonly firebaseReady = isFirebaseConfigured();
  private readonly booted = signal(false);

  /** Show the sign-in screen only once Firebase is configured and has answered. */
  protected readonly needsSignIn = computed(
    () => this.firebaseReady && this.auth.ready() && this.auth.user() === null,
  );

  protected readonly hasRealData = computed(() =>
    this.stats.summaries().some((s) => s.daysWithData > 0),
  );

  /** Label of the language the sign-in screen switch leads to. */
  protected readonly otherLangKey = computed<TranslationKey>(() =>
    lang() === 'ru' ? 'lang.en' : 'lang.ru',
  );

  constructor() {
    // Load data only after the user is known: that decides whether we read Firestore
    // or the local source.
    effect(() => {
      const settled = !this.firebaseReady || this.auth.ready();
      if (!settled || this.needsSignIn() || this.booted()) return;

      this.booted.set(true);
      void this.boot();
    });
  }

  protected toggleLang(): void {
    setLang(lang() === 'ru' ? 'en' : 'ru');
  }

  private async boot(): Promise<void> {
    // Goals are fetched alongside the rest; a failure keeps the local copy.
    void this.goals.load().catch(() => undefined);
    await this.health.initialize();
    await this.stats.load();
    await this.sync.refreshLastSync();
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HealthService } from '@core/health/health.service';
import { FirestoreStatsRepository } from '@core/data/firestore-stats.repository';
import { DayMetrics } from '@core/data/stats.repository';
import { isFirebaseConfigured } from '@core/data/firebase';
import { AuthService } from '@core/auth/auth.service';
import { lastDays } from '@core/util/dates';
import { rawText } from '@core/i18n/i18n';
import { LocalizedText } from '@core/i18n/i18n.model';

export type SyncState = 'idle' | 'running' | 'done' | 'error';

/**
 * Moves data from Health Connect into Firestore.
 *
 * Sync only ever runs on the phone — there is nothing to read Health Connect from in a
 * browser. The web build just displays whatever the mobile app has written.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly health = inject(HealthService);
  private readonly repo = inject(FirestoreStatsRepository);
  private readonly auth = inject(AuthService);

  readonly state = signal<SyncState>('idle');
  readonly message = signal<LocalizedText | null>(null);
  readonly lastSyncAt = signal<string | null>(null);

  /** The first sync grabs a year of history; later a small window is enough. */
  private static readonly INITIAL_DAYS = 365;
  private static readonly INCREMENTAL_DAYS = 30;

  canSync(): boolean {
    return (
      Capacitor.isNativePlatform() &&
      isFirebaseConfigured() &&
      this.auth.user() !== null &&
      this.health.status() === 'ready'
    );
  }

  async refreshLastSync(): Promise<void> {
    if (!isFirebaseConfigured() || !this.auth.user()) return;
    this.lastSyncAt.set(await this.repo.lastSyncAt());
  }

  /** @param full true — re-read the whole year, ignoring the previous sync. */
  async sync(full = false): Promise<void> {
    if (!this.canSync()) {
      this.message.set({ key: 'sync.notAvailable' });
      this.state.set('error');
      return;
    }

    this.state.set('running');
    try {
      const previous = await this.repo.lastSyncAt();
      const range = lastDays(
        full || !previous ? SyncService.INITIAL_DAYS : SyncService.INCREMENTAL_DAYS,
      );

      const metrics = this.health.readableMetrics();
      this.message.set({ key: 'sync.readingMetrics', params: { n: metrics.length } });

      const days = new Map<string, DayMetrics>();
      for (const metric of metrics) {
        const points = await this.health.source.readDaily(metric, range);
        for (const point of points) {
          // Zero days are skipped: an empty day and a day without data look the same,
          // and documents cost reads.
          if (point.value === 0) continue;
          const day = days.get(point.date) ?? {};
          day[metric.id] = point.value;
          days.set(point.date, day);
        }
      }

      this.message.set({ key: 'sync.savingDays' });
      await this.repo.saveDays(days);

      this.message.set({ key: 'sync.readingWorkouts' });
      const workouts = await this.health.source.readWorkouts(range);
      await this.repo.saveWorkouts(workouts);

      const now = new Date().toISOString();
      await this.repo.markSynced(now);
      this.lastSyncAt.set(now);

      this.state.set('done');
      this.message.set({
        key: 'sync.done',
        params: { days: days.size, workouts: workouts.length, from: range.from, to: range.to },
      });
    } catch (e) {
      this.state.set('error');
      this.message.set(e instanceof Error ? rawText(e.message) : { key: 'sync.failed' });
    }
  }
}

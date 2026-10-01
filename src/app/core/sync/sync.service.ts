import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HealthService } from '@core/health/health.service';
import { FirestoreStatsRepository } from '@core/data/firestore-stats.repository';
import { DayMetrics } from '@core/data/stats.repository';
import { isFirebaseConfigured } from '@core/data/firebase';
import { AuthService } from '@core/auth/auth.service';
import { DateRange, Workout } from '@core/metrics/metric.model';
import { addDays, lastDays, splitRange, toDayKey, today } from '@core/util/dates';
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

  /**
   * How far back a full sync reaches. Without the history permission Health Connect
   * returns at most ~30 days before the first grant anyway, so a year is plenty; with it,
   * go back far enough to catch everything the source apps ever wrote.
   */
  private static readonly FULL_DAYS = 365;
  private static readonly FULL_DAYS_WITH_HISTORY = 10 * 365;

  /**
   * An incremental sync resumes from the previous one, re-reading a few days before it:
   * watches and source apps often deliver records hours or days late.
   */
  private static readonly OVERLAP_DAYS = 7;

  /**
   * Bump when a sync starts writing something older data lacks; the next sync on every
   * device then re-reads the full history once. 2 — workout routes; 3 — workout details
   * (heart rate chart, speed, elevation, steps, laps…).
   */
  private static readonly SCHEMA = 3;

  /** Long ranges are read year by year to keep each bridge call and aggregation small. */
  private static readonly CHUNK_DAYS = 365;

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

  /** @param full true — re-read the whole available history, ignoring the previous sync. */
  async sync(full = false): Promise<void> {
    if (!this.canSync()) {
      this.message.set({ key: 'sync.notAvailable' });
      this.state.set('error');
      return;
    }

    this.state.set('running');
    try {
      const previous = await this.repo.lastSyncAt();
      // Data written by an older sync lacks fields added since (e.g. workout routes), and an
      // incremental sync would never revisit it — so the first sync after an upgrade is full.
      const outdated = (await this.repo.syncSchema()) < SyncService.SCHEMA;
      const range = this.syncRange(full || outdated ? null : previous);
      const chunks = splitRange(range, SyncService.CHUNK_DAYS);

      const metrics = this.health.readableMetrics();
      this.message.set({ key: 'sync.readingMetrics', params: { n: metrics.length } });

      const days = new Map<string, DayMetrics>();
      for (const metric of metrics) {
        for (const chunk of chunks) {
          const points = await this.health.source.readDaily(metric, chunk);
          for (const point of points) {
            // Zero days are skipped: an empty day and a day without data look the same,
            // and documents cost reads.
            if (point.value === 0) continue;
            const day = days.get(point.date) ?? {};
            day[metric.id] = point.value;
            days.set(point.date, day);
          }
        }
      }

      this.message.set({ key: 'sync.savingDays' });
      await this.repo.saveDays(days);

      this.message.set({ key: 'sync.readingWorkouts' });
      const read: Workout[] = [];
      for (const chunk of chunks) {
        read.push(...(await this.health.source.readWorkouts(chunk)));
      }
      const workouts = await this.syncRoutes(read, range);
      await this.repo.saveWorkouts(workouts);

      const now = new Date().toISOString();
      await this.repo.markSynced(now, SyncService.SCHEMA);
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

  /**
   * Copies GPS routes into Firestore and settles each workout's `route` status. Routes
   * already stored are not read again — re-syncing the same days would otherwise re-download
   * every track.
   */
  private async syncRoutes(workouts: readonly Workout[], range: DateRange): Promise<Workout[]> {
    const withRoutes = workouts.filter((w) => w.route === 'available');
    if (withRoutes.length === 0) return [...workouts];

    this.message.set({ key: 'sync.readingRoutes', params: { n: withRoutes.length } });
    const stored = new Map((await this.repo.loadWorkouts(range)).map((w) => [w.id, w.route]));

    const result: Workout[] = [];
    for (const workout of workouts) {
      if (workout.route !== 'available' || stored.get(workout.id) === 'available') {
        result.push(workout);
        continue;
      }
      const route = await this.health.source.readRoute(workout.id);
      if (route.status === 'data' && route.points.length > 1) {
        await this.repo.saveRoute(workout.id, route.points);
        result.push(workout);
      } else {
        result.push({ ...workout, route: route.status === 'consent' ? 'consent' : 'none' });
      }
    }
    return result;
  }

  /**
   * Full history on the first run (or on request); otherwise everything since the last sync,
   * however long ago it was — a fixed window would leave a gap after a long break.
   */
  private syncRange(previous: string | null): DateRange {
    if (!previous) {
      return lastDays(
        this.health.history() === 'granted'
          ? SyncService.FULL_DAYS_WITH_HISTORY
          : SyncService.FULL_DAYS,
      );
    }
    const from = addDays(new Date(previous), -SyncService.OVERLAP_DAYS);
    return { from: toDayKey(from), to: today() };
  }
}

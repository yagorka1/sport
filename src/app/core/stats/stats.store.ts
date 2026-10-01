import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DailyPoint,
  DateRange,
  MetricId,
  Period,
  RouteResult,
  Workout,
} from '@core/metrics/metric.model';
import { activeMetrics, findMetric } from '@core/metrics/metric.registry';
import { MetricSummary, fillGaps, summarize } from '@core/metrics/aggregate';
import { HealthService } from '@core/health/health.service';
import { FirestoreStatsRepository } from '@core/data/firestore-stats.repository';
import { isFirebaseConfigured } from '@core/data/firebase';
import { AuthService } from '@core/auth/auth.service';
import { addDays, fromDayKey, rangeForPeriod, toDayKey } from '@core/util/dates';
import { rawText } from '@core/i18n/i18n';
import { LocalizedText } from '@core/i18n/i18n.model';

/**
 * Dashboard state. Where the data comes from:
 *   • Firestore — when the project is configured and the user is signed in (the main path);
 *   • straight from the source otherwise, so the app stays usable before Firebase is set up
 *     and so the browser shows a populated UI right away.
 */
@Injectable({ providedIn: 'root' })
export class StatsStore {
  private readonly health = inject(HealthService);
  private readonly repo = inject(FirestoreStatsRepository);
  private readonly auth = inject(AuthService);

  readonly period = signal<Period>('week');
  readonly loading = signal(false);
  readonly error = signal<LocalizedText | null>(null);

  private readonly series = signal<Map<MetricId, DailyPoint[]>>(new Map());
  private readonly previousSeries = signal<Map<MetricId, DailyPoint[]>>(new Map());
  readonly workouts = signal<readonly Workout[]>([]);

  readonly range = computed<DateRange>(() => rangeForPeriod(this.period()));

  /** Summaries for every enabled metric — what the dashboard renders. */
  readonly summaries = computed<readonly MetricSummary[]>(() => {
    const range = this.range();
    const series = this.series();
    const previous = this.previousSeries();
    return activeMetrics().map((metric) =>
      summarize(
        metric,
        fillGaps(series.get(metric.id) ?? [], range),
        previous.get(metric.id) ?? [],
      ),
    );
  });

  /** One metric's series with gaps filled — for the chart on the detail page. */
  points(metricId: MetricId): readonly DailyPoint[] {
    return fillGaps(this.series().get(metricId) ?? [], this.range());
  }

  summary(metricId: MetricId): MetricSummary | null {
    const metric = findMetric(metricId);
    if (!metric) return null;
    return (
      this.summaries().find((s) => s.metric.id === metricId) ??
      summarize(metric, this.points(metricId))
    );
  }

  setPeriod(period: Period): void {
    if (period === this.period()) return;
    this.period.set(period);
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const range = this.range();
      const previousRange = shiftBack(range);

      if (this.useFirestore()) {
        const [current, previous, workouts] = await Promise.all([
          this.repo.loadSeries(range),
          this.repo.loadSeries(previousRange),
          this.repo.loadWorkouts(range),
        ]);
        this.series.set(current);
        this.previousSeries.set(previous);
        this.workouts.set(workouts);
      } else {
        this.series.set(await this.readFromSource(range));
        this.previousSeries.set(await this.readFromSource(previousRange));
        this.workouts.set(await this.health.source.readWorkouts(range));
      }
    } catch (e) {
      this.error.set(e instanceof Error ? rawText(e.message) : { key: 'stats.loadFailed' });
    } finally {
      this.loading.set(false);
    }
  }

  /** From the loaded period when possible; a direct link to an older workout goes to Firestore. */
  async loadWorkout(id: string): Promise<Workout | null> {
    const loaded = this.workouts().find((w) => w.id === id);
    if (loaded) return loaded;
    return this.useFirestore() ? this.repo.loadWorkout(id) : null;
  }

  async loadRoute(workout: Workout): Promise<RouteResult> {
    if (!this.useFirestore()) {
      return workout.route === 'available' || workout.route === 'consent'
        ? this.health.source.readRoute(workout.id)
        : { status: 'none' };
    }
    if (workout.route === 'consent') return { status: 'consent' };
    const points = await this.repo.loadRoute(workout.id);
    return points ? { status: 'data', points } : { status: 'none' };
  }

  /** Only where Health Connect is at hand, i.e. in the Android app. */
  canRequestRoute(): boolean {
    return !this.health.isDemo && this.health.status() === 'ready';
  }

  /**
   * Asks Health Connect for a route that needs the user's consent and, once shared, stores it
   * so the website can show it too. A declined request leaves the status as is, to retry later.
   */
  async requestRoute(workout: Workout): Promise<RouteResult> {
    const result = await this.health.source.requestRoute(workout.id);
    if (result.status !== 'data' || result.points.length < 2) return result;

    if (this.useFirestore()) {
      await this.repo.saveRoute(workout.id, result.points);
      await this.repo.setWorkoutRoute(workout.id, 'available');
    }
    this.workouts.update((list) =>
      list.map((w) => (w.id === workout.id ? { ...w, route: 'available' } : w)),
    );
    return result;
  }

  private useFirestore(): boolean {
    return isFirebaseConfigured() && this.auth.user() !== null;
  }

  private async readFromSource(range: DateRange): Promise<Map<MetricId, DailyPoint[]>> {
    const result = new Map<MetricId, DailyPoint[]>();
    for (const metric of activeMetrics()) {
      result.set(metric.id, await this.health.source.readDaily(metric, range));
    }
    return result;
  }
}

/** The preceding range of the same length — the baseline for the "±%" comparison. */
function shiftBack(range: DateRange): DateRange {
  const from = fromDayKey(range.from);
  const to = fromDayKey(range.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return { from: toDayKey(addDays(from, -days)), to: toDayKey(addDays(from, -1)) };
}

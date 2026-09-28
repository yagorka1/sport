import { DailyPoint, DateRange, MetricId, Workout } from '@core/metrics/metric.model';

/** One day's slice: raw values of every metric for that day. */
export type DayMetrics = Record<MetricId, number>;

/**
 * Statistics storage. The interface is kept separate from Firestore so a local
 * implementation (SQLite/IndexedDB) can be dropped in later without touching the rest.
 */
export interface StatsRepository {
  loadSeries(range: DateRange): Promise<Map<MetricId, DailyPoint[]>>;
  saveDays(days: Map<string, DayMetrics>): Promise<void>;
  loadWorkouts(range: DateRange): Promise<Workout[]>;
  saveWorkouts(workouts: readonly Workout[]): Promise<void>;
  lastSyncAt(): Promise<string | null>;
  markSynced(at: string): Promise<void>;
}

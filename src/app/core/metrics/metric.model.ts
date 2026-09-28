/**
 * Metric model. To add a new metric (heart rate, sleep, weight) it is enough to
 * append a descriptor in metric.registry.ts and declare the matching record type
 * in the native plugin (HealthConnectPlugin.kt). The dashboard, the sync and the
 * storage layer stay untouched.
 */

import type { TranslationKey } from '@core/i18n/i18n.model';

export type MetricId = string;

/** How to collapse several values inside a single day. */
export type Aggregation = 'sum' | 'avg' | 'max' | 'last';

export interface MetricDescriptor {
  /** Stable key: the Firestore field name and the URL segment. Never rename after the first sync. */
  readonly id: MetricId;
  /** Translation keys (see core/i18n/ru.ts), so titles and units follow the UI language. */
  readonly titleKey: TranslationKey;
  readonly shortTitleKey?: TranslationKey;
  readonly unitKey: TranslationKey;
  /** Record type key for the native layer. Must exist in RECORD_TYPES in HealthConnectPlugin.kt. */
  readonly healthType: string;
  readonly aggregation: Aggregation;
  readonly decimals: number;
  /** Factor from Health Connect units to display units (e.g. meters to kilometers). */
  readonly scale: number;
  readonly color: string;
  readonly icon: string;
  /** Daily goal; null for metrics without one (weight, resting heart rate). */
  readonly dailyGoal: number | null;
  readonly order: number;
  /** Disabled metrics request no permissions and are not synced. */
  readonly enabled: boolean;
}

/** A single daily value. `date` is a local calendar date formatted as YYYY-MM-DD. */
export interface DailyPoint {
  readonly date: string;
  readonly value: number;
}

export interface MetricSeries {
  readonly metricId: MetricId;
  readonly points: readonly DailyPoint[];
}

export interface Workout {
  readonly id: string;
  /** Health Connect exercise type key, e.g. 'running', 'strength_training'. */
  readonly type: string;
  /** Title the user gave the session; null means "use the translated type name". */
  readonly title: string | null;
  /** ISO-8601 with offset. */
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationSec: number;
  readonly calories: number | null;
  readonly distanceM: number | null;
  readonly avgHeartRate: number | null;
  readonly maxHeartRate: number | null;
  /** Writing app package, e.g. 'com.google.android.apps.fitness'. */
  readonly source: string | null;
}

export interface DateRange {
  /** Inclusive, YYYY-MM-DD. */
  readonly from: string;
  /** Inclusive, YYYY-MM-DD. */
  readonly to: string;
}

export type Period = 'week' | 'month' | 'quarter' | 'year';

export const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

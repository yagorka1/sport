import { locale } from '@core/i18n/i18n';
import { MetricDescriptor, MetricId } from './metric.model';

/**
 * The single place where metrics are declared.
 *
 * To add a metric:
 *   1. append a descriptor here with enabled: true;
 *   2. add its `metric.<id>.*` keys to core/i18n/ru.ts and core/i18n/en.ts;
 *   3. make sure `healthType` exists in RECORD_TYPES in HealthConnectPlugin.kt;
 *   4. done — dashboard, detail page, sync and Firestore pick it up on their own.
 *
 * Heart rate, sleep and weight are already prepared below, switched off: they only
 * need enabled: true plus an APK rebuild to request the new permissions.
 */
export const METRICS: readonly MetricDescriptor[] = [
  {
    id: 'steps',
    titleKey: 'metric.steps.title',
    unitKey: 'metric.steps.unit',
    healthType: 'steps',
    aggregation: 'sum',
    decimals: 0,
    scale: 1,
    color: '#4f8ff7',
    icon: '👟',
    dailyGoal: 8000,
    order: 10,
    enabled: true,
  },
  {
    id: 'calories',
    titleKey: 'metric.calories.title',
    shortTitleKey: 'metric.calories.short',
    unitKey: 'metric.calories.unit',
    healthType: 'active_calories',
    aggregation: 'sum',
    decimals: 0,
    scale: 1,
    color: '#f7854f',
    icon: '🔥',
    dailyGoal: 400,
    order: 20,
    enabled: true,
  },
  {
    id: 'distance',
    titleKey: 'metric.distance.title',
    unitKey: 'metric.distance.unit',
    healthType: 'distance',
    aggregation: 'sum',
    decimals: 2,
    // Health Connect reports meters, we display kilometers.
    scale: 0.001,
    color: '#39b98a',
    icon: '📍',
    dailyGoal: 5,
    order: 30,
    enabled: true,
  },
  {
    id: 'exercise_minutes',
    titleKey: 'metric.exercise_minutes.title',
    shortTitleKey: 'metric.exercise_minutes.short',
    unitKey: 'metric.exercise_minutes.unit',
    healthType: 'exercise_time',
    aggregation: 'sum',
    // Health Connect reports seconds.
    scale: 1 / 60,
    decimals: 0,
    color: '#a469f0',
    icon: '⏱',
    dailyGoal: 30,
    order: 40,
    enabled: true,
  },

  // --- Prepared but disabled. Flip `enabled` when needed. ---
  {
    id: 'resting_hr',
    titleKey: 'metric.resting_hr.title',
    unitKey: 'metric.resting_hr.unit',
    healthType: 'resting_heart_rate',
    aggregation: 'avg',
    decimals: 0,
    scale: 1,
    color: '#e0555f',
    icon: '❤️',
    dailyGoal: null,
    order: 50,
    enabled: false,
  },
  {
    id: 'sleep',
    titleKey: 'metric.sleep.title',
    unitKey: 'metric.sleep.unit',
    healthType: 'sleep',
    aggregation: 'sum',
    // Health Connect reports seconds.
    scale: 1 / 3600,
    decimals: 1,
    color: '#5b6ee0',
    icon: '😴',
    dailyGoal: 8,
    order: 60,
    enabled: false,
  },
  {
    id: 'weight',
    titleKey: 'metric.weight.title',
    unitKey: 'metric.weight.unit',
    healthType: 'weight',
    aggregation: 'last',
    decimals: 1,
    scale: 1,
    color: '#8a8f98',
    icon: '⚖️',
    dailyGoal: null,
    order: 70,
    enabled: false,
  },
];

const BY_ID = new Map<MetricId, MetricDescriptor>(METRICS.map((m) => [m.id, m]));

/** Metrics that take part in sync and display, in presentation order. */
export function activeMetrics(): readonly MetricDescriptor[] {
  return METRICS.filter((m) => m.enabled).sort((a, b) => a.order - b.order);
}

export function findMetric(id: MetricId): MetricDescriptor | undefined {
  return BY_ID.get(id);
}

/** Converts to display units. Raw data is always stored in Health Connect units. */
export function toDisplay(metric: MetricDescriptor, rawValue: number): number {
  return rawValue * metric.scale;
}

export function formatValue(metric: MetricDescriptor, rawValue: number): string {
  const value = toDisplay(metric, rawValue);
  return value.toLocaleString(locale(), {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
}

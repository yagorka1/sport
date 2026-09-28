import { DailyPoint, DateRange, MetricDescriptor, Workout } from '@core/metrics/metric.model';
import { TranslationKey } from '@core/i18n/i18n.model';

/**
 * A source of raw health data. The abstraction keeps the dashboard unaware of whether
 * we read Health Connect on a phone, demo data in a browser or (later) an imported
 * export file.
 */
export interface HealthSource {
  readonly kind: 'health-connect' | 'demo' | 'import';
  readonly labelKey: TranslationKey;

  isAvailable(): Promise<boolean>;

  /** Which of the requested metrics are already granted. */
  grantedMetrics(metrics: readonly MetricDescriptor[]): Promise<Set<string>>;

  /** Shows the system dialog; returns the resulting set of granted metrics. */
  requestAccess(metrics: readonly MetricDescriptor[]): Promise<Set<string>>;

  /** Values in Health Connect units, without conversion to display units. */
  readDaily(metric: MetricDescriptor, range: DateRange): Promise<DailyPoint[]>;

  readWorkouts(range: DateRange): Promise<Workout[]>;
}

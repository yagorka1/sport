import {
  DailyPoint,
  DateRange,
  MetricDescriptor,
  RouteResult,
  Workout,
} from '@core/metrics/metric.model';
import { TranslationKey } from '@core/i18n/i18n.model';
import { AccessStatus } from './health-connect.plugin';

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

  /** History access and whether anything requestable is still missing. */
  accessStatus(metrics: readonly MetricDescriptor[]): Promise<AccessStatus>;

  /** Values in Health Connect units, without conversion to display units. */
  readDaily(metric: MetricDescriptor, range: DateRange): Promise<DailyPoint[]>;

  /** `route` is 'available' when the source has a route, 'none' otherwise. */
  readWorkouts(range: DateRange): Promise<Workout[]>;

  readRoute(workoutId: string): Promise<RouteResult>;

  /** Asks the user to share a route that came back as 'consent'. */
  requestRoute(workoutId: string): Promise<RouteResult>;
}

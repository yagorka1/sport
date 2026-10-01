import {
  DailyPoint,
  DateRange,
  MetricDescriptor,
  RouteResult,
  Workout,
} from '@core/metrics/metric.model';
import { HealthSource } from './health-source';
import { AccessStatus, HealthConnect } from './health-connect.plugin';

/** The real source: Health Connect on Android, through our native plugin. */
export class HealthConnectSource implements HealthSource {
  readonly kind = 'health-connect' as const;
  readonly labelKey = 'source.healthConnect' as const;

  async isAvailable(): Promise<boolean> {
    const result = await HealthConnect.isAvailable();
    return result.available;
  }

  async grantedMetrics(metrics: readonly MetricDescriptor[]): Promise<Set<string>> {
    const { granted } = await HealthConnect.checkPermissions({
      types: metrics.map((m) => m.healthType),
    });
    return this.toMetricIds(metrics, granted);
  }

  async requestAccess(metrics: readonly MetricDescriptor[]): Promise<Set<string>> {
    const { granted } = await HealthConnect.requestPermissions({
      types: metrics.map((m) => m.healthType),
    });
    return this.toMetricIds(metrics, granted);
  }

  accessStatus(metrics: readonly MetricDescriptor[]): Promise<AccessStatus> {
    return HealthConnect.accessStatus({ types: metrics.map((m) => m.healthType) });
  }

  async readDaily(metric: MetricDescriptor, range: DateRange): Promise<DailyPoint[]> {
    const { points } = await HealthConnect.readDaily({
      type: metric.healthType,
      from: range.from,
      to: range.to,
      aggregation: metric.aggregation,
    });
    return points.map((p) => ({ date: p.date, value: p.value }));
  }

  async readWorkouts(range: DateRange): Promise<Workout[]> {
    const { workouts } = await HealthConnect.readWorkouts({ from: range.from, to: range.to });
    return workouts.map(({ hasRoute, ...w }) => ({ ...w, route: hasRoute ? 'available' : 'none' }));
  }

  async readRoute(workoutId: string): Promise<RouteResult> {
    return HealthConnect.readRoute({ id: workoutId });
  }

  async requestRoute(workoutId: string): Promise<RouteResult> {
    return HealthConnect.requestRoute({ id: workoutId });
  }

  openSettings(): Promise<void> {
    return HealthConnect.openSettings();
  }

  /** The plugin answers in healthType terms — map them back to metric ids. */
  private toMetricIds(metrics: readonly MetricDescriptor[], grantedTypes: string[]): Set<string> {
    const grantedSet = new Set(grantedTypes);
    return new Set(metrics.filter((m) => grantedSet.has(m.healthType)).map((m) => m.id));
  }
}

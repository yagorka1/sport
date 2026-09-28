import { DailyPoint, DateRange, MetricDescriptor, Workout } from '@core/metrics/metric.model';
import { eachDay, fromDayKey } from '@core/util/dates';
import { HealthSource } from './health-source';

/**
 * Source for the browser, where Health Connect simply does not exist. It makes the UI
 * workable without a phone. Values are deterministic — the same date always yields the
 * same number — so charts do not jitter between reloads.
 *
 * Data from this source is always labelled as demo in the UI.
 */
export class DemoSource implements HealthSource {
  readonly kind = 'demo' as const;
  readonly labelKey = 'source.demo' as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async grantedMetrics(metrics: readonly MetricDescriptor[]): Promise<Set<string>> {
    return new Set(metrics.map((m) => m.id));
  }

  async requestAccess(metrics: readonly MetricDescriptor[]): Promise<Set<string>> {
    return this.grantedMetrics(metrics);
  }

  async readDaily(metric: MetricDescriptor, range: DateRange): Promise<DailyPoint[]> {
    return eachDay(range).map((date) => ({
      date,
      value: this.valueFor(metric, date),
    }));
  }

  async readWorkouts(range: DateRange): Promise<Workout[]> {
    const workouts: Workout[] = [];
    for (const date of eachDay(range)) {
      const day = fromDayKey(date);
      // Workouts on Tuesdays, Thursdays and Saturdays.
      if (![2, 4, 6].includes(day.getDay())) continue;

      const template = TEMPLATES[hash(date) % TEMPLATES.length];
      const durationSec = template.minutes * 60;
      const start = new Date(day);
      start.setHours(19, 0, 0, 0);
      const end = new Date(start.getTime() + durationSec * 1000);

      workouts.push({
        id: `demo-${date}`,
        type: template.type,
        title: null,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        durationSec,
        calories: Math.round(template.minutes * 8 + (hash(date) % 60)),
        distanceM: template.distanceM,
        avgHeartRate: 128 + (hash(date) % 14),
        maxHeartRate: 158 + (hash(date) % 16),
        source: 'demo',
      });
    }
    return workouts.reverse();
  }

  /** Baseline + weekly rhythm + deterministic spread. */
  private valueFor(metric: MetricDescriptor, date: string): number {
    const base = BASE_VALUES[metric.id] ?? metric.dailyGoal ?? 100;
    const weekday = fromDayKey(date).getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.75 : 1.05;
    const noise = 0.75 + (hash(`${metric.id}:${date}`) % 50) / 100;
    return Math.round(base * weekendFactor * noise);
  }
}

/** Values in Health Connect units: steps, kcal, meters, seconds. */
const BASE_VALUES: Record<string, number> = {
  steps: 8600,
  calories: 430,
  distance: 6200,
  exercise_minutes: 2100,
  resting_hr: 58,
  sleep: 26000,
  weight: 78,
};

const TEMPLATES = [
  { type: 'running', minutes: 42, distanceM: 7400 },
  { type: 'strength_training', minutes: 55, distanceM: null },
  { type: 'cycling', minutes: 68, distanceM: 21500 },
  { type: 'swimming', minutes: 40, distanceM: 1500 },
];

/** Small stable string hash — a source of "randomness" without a generator. */
function hash(input: string): number {
  let acc = 0;
  for (let i = 0; i < input.length; i++) {
    acc = (acc * 31 + input.charCodeAt(i)) >>> 0;
  }
  return acc;
}

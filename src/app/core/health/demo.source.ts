import {
  DailyPoint,
  DateRange,
  HeartRateSeries,
  LatLng,
  MetricDescriptor,
  RouteResult,
  Workout,
  WorkoutLap,
} from '@core/metrics/metric.model';
import { eachDay, fromDayKey } from '@core/util/dates';
import { HealthSource } from './health-source';
import { AccessStatus } from './health-connect.plugin';

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

  async accessStatus(): Promise<AccessStatus> {
    // Demo data is generated for any date, so there is nothing to unlock.
    return { history: 'unsupported', complete: true };
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

      const calories = Math.round(template.minutes * 8 + (hash(date) % 60));
      const avgHeartRate = 128 + (hash(date) % 14);
      const onFoot = template.type === 'running';
      workouts.push({
        id: `demo-${date}`,
        type: template.type,
        title: null,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        durationSec,
        calories,
        totalCalories: calories + Math.round(template.minutes * 1.3),
        distanceM: template.distanceM,
        steps: onFoot ? Math.round(template.minutes * 162) : null,
        avgHeartRate,
        minHeartRate: 92 + (hash(date) % 10),
        maxHeartRate: 158 + (hash(date) % 16),
        avgSpeedMps: template.distanceM ? template.distanceM / durationSec : null,
        maxSpeedMps: template.distanceM ? (template.distanceM / durationSec) * 1.35 : null,
        elevationGainM: template.outdoor ? 40 + (hash(date) % 90) : null,
        avgCadence: onFoot ? 160 + (hash(date) % 14) : null,
        avgPowerW: null,
        maxPowerW: null,
        notes: null,
        laps: onFoot && template.distanceM ? demoLaps(durationSec, template.distanceM) : [],
        heartRate: demoHeartRate(date, durationSec, avgHeartRate),
        source: 'demo',
        route: template.outdoor ? 'available' : 'none',
      });
    }
    return workouts.reverse();
  }

  async readRoute(workoutId: string): Promise<RouteResult> {
    const date = workoutId.replace(/^demo-/, '');
    const template = TEMPLATES[hash(date) % TEMPLATES.length];
    if (!template.outdoor || !template.distanceM) return { status: 'none' };
    return { status: 'data', points: demoLoop(date, template.distanceM) };
  }

  async requestRoute(workoutId: string): Promise<RouteResult> {
    return this.readRoute(workoutId);
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
  { type: 'running', minutes: 42, distanceM: 7400, outdoor: true },
  { type: 'strength_training', minutes: 55, distanceM: null, outdoor: false },
  { type: 'cycling', minutes: 68, distanceM: 21500, outdoor: true },
  { type: 'swimming', minutes: 40, distanceM: 1500, outdoor: false },
];

/** One lap per full kilometer, slightly uneven, plus the remainder. */
function demoLaps(durationSec: number, distanceM: number): WorkoutLap[] {
  const laps: WorkoutLap[] = [];
  const secPerM = durationSec / distanceM;
  for (let done = 0; done < distanceM; done += 1000) {
    const lengthM = Math.min(1000, distanceM - done);
    const wobble = 1 + ((hash(`${done}`) % 9) - 4) / 100;
    laps.push({ durationSec: Math.round(lengthM * secPerM * wobble), lengthM });
  }
  return laps;
}

/** Warm-up, a working plateau with intervals, cool-down — 30-second buckets. */
function demoHeartRate(date: string, durationSec: number, avg: number): HeartRateSeries {
  const stepSec = 30;
  const count = Math.ceil(durationSec / stepSec);
  const bpm = Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const shape = t < 0.12 ? t / 0.12 : t > 0.9 ? (1 - t) / 0.1 : 1;
    const intervals = 6 * Math.sin(i / 4 + (hash(date) % 7));
    return Math.round(avg - 35 + 40 * shape + intervals);
  });
  return { stepSec, bpm };
}

/** Demo routes start in Gorky Park, Moscow. */
const DEMO_START: LatLng = [55.7298, 37.601];

/**
 * A closed, gently wobbling loop of roughly the given length — enough to look like a real
 * track on the map. The phase depends on the date, so each workout gets its own shape.
 */
function demoLoop(date: string, distanceM: number): LatLng[] {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((DEMO_START[0] * Math.PI) / 180);
  const radius = distanceM / (2 * Math.PI);
  const phase = (hash(date) % 360) * (Math.PI / 180);
  const steps = Math.max(60, Math.round(distanceM / 15));

  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const r = radius * (1 + 0.18 * Math.sin(3 * angle + phase) + 0.07 * Math.sin(7 * angle));
    // Shifted so the loop starts and ends at DEMO_START rather than circling around it.
    const x = r * Math.cos(angle + phase) - radius * Math.cos(phase);
    const y = r * Math.sin(angle + phase) - radius * Math.sin(phase);
    points.push([DEMO_START[0] + y / metersPerDegLat, DEMO_START[1] + x / metersPerDegLng]);
  }
  return points;
}

/** Small stable string hash — a source of "randomness" without a generator. */
function hash(input: string): number {
  let acc = 0;
  for (let i = 0; i < input.length; i++) {
    acc = (acc * 31 + input.charCodeAt(i)) >>> 0;
  }
  return acc;
}

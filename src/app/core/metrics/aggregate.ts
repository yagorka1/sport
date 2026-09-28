import { DailyPoint, DateRange, MetricDescriptor } from './metric.model';
import { toDisplay } from './metric.registry';
import { eachDay } from '@core/util/dates';

export interface MetricSummary {
  readonly metric: MetricDescriptor;
  /** Period value in raw units: a sum for 'sum', an average otherwise. */
  readonly total: number;
  /** Average per day in raw units. */
  readonly perDay: number;
  /** Change vs the preceding range of the same length, in percent. null when there is no baseline. */
  readonly deltaPercent: number | null;
  readonly bestDay: DailyPoint | null;
  /** How many days met the goal. null for metrics without a goal. */
  readonly goalDays: number | null;
  /** Current run of consecutive days meeting the goal, counted back from the last day. */
  readonly streak: number | null;
  readonly daysWithData: number;
}

/** A series without holes: days with no data become 0, otherwise the chart collapses. */
export function fillGaps(points: readonly DailyPoint[], range: DateRange): DailyPoint[] {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  return eachDay(range).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

export function summarize(
  metric: MetricDescriptor,
  points: readonly DailyPoint[],
  previousPoints: readonly DailyPoint[] = [],
): MetricSummary {
  const withData = points.filter((p) => p.value > 0);
  const total = aggregateValue(metric, points);
  const previousTotal = aggregateValue(metric, previousPoints);

  return {
    metric,
    total,
    perDay: withData.length > 0 ? sum(withData) / withData.length : 0,
    deltaPercent:
      previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null,
    bestDay: withData.length > 0 ? withData.reduce((a, b) => (b.value > a.value ? b : a)) : null,
    goalDays: metric.dailyGoal === null ? null : points.filter((p) => hitsGoal(metric, p)).length,
    streak: metric.dailyGoal === null ? null : currentStreak(metric, points),
    daysWithData: withData.length,
  };
}

function aggregateValue(metric: MetricDescriptor, points: readonly DailyPoint[]): number {
  const withData = points.filter((p) => p.value > 0);
  if (withData.length === 0) return 0;

  switch (metric.aggregation) {
    case 'sum':
      return sum(withData);
    case 'avg':
      return sum(withData) / withData.length;
    case 'max':
      return Math.max(...withData.map((p) => p.value));
    case 'last':
      return withData[withData.length - 1].value;
  }
}

export function hitsGoal(metric: MetricDescriptor, point: DailyPoint): boolean {
  return metric.dailyGoal !== null && toDisplay(metric, point.value) >= metric.dailyGoal;
}

/** Counted from the end of the series, so today's unfinished day does not break the streak. */
function currentStreak(metric: MetricDescriptor, points: readonly DailyPoint[]): number {
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (hitsGoal(metric, points[i])) {
      streak++;
    } else if (i < points.length - 1) {
      break;
    }
  }
  return streak;
}

function sum(points: readonly DailyPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}

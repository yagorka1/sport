import { Component, computed, input } from '@angular/core';
import { DailyPoint, MetricDescriptor } from '@core/metrics/metric.model';
import { formatValue, toDisplay } from '@core/metrics/metric.registry';
import { formatDayLabel } from '@core/util/dates';
import { t } from '@core/i18n/i18n';
import { TranslatePipe } from '@core/i18n/translate.pipe';

interface Bar {
  readonly label: string;
  readonly value: number;
  /** Height as a percentage of the maximum. */
  readonly height: number;
  readonly goalHit: boolean;
  readonly tooltip: string;
}

/**
 * Bar chart on flex layout (no SVG): it scales correctly at any width, from a narrow
 * phone to a wide monitor. Long ranges collapse into weekly bars — 365 bars would
 * otherwise turn into mush.
 */
@Component({
  selector: 'app-bar-chart',
  imports: [TranslatePipe],
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss',
})
export class BarChartComponent {
  readonly metric = input.required<MetricDescriptor>();
  readonly points = input.required<readonly DailyPoint[]>();

  /** Above this many bars we group by week. */
  private static readonly MAX_BARS = 70;

  private readonly buckets = computed<readonly DailyPoint[]>(() => {
    const points = this.points();
    if (points.length <= BarChartComponent.MAX_BARS) return points;

    const weeks: DailyPoint[] = [];
    for (let i = 0; i < points.length; i += 7) {
      const week = points.slice(i, i + 7);
      const total = week.reduce((acc, p) => acc + p.value, 0);
      const isSum = this.metric().aggregation === 'sum';
      const withData = week.filter((p) => p.value > 0).length;
      weeks.push({
        date: week[0].date,
        value: isSum ? total : withData > 0 ? total / withData : 0,
      });
    }
    return weeks;
  });

  /** A weekly goal is larger than a daily one, otherwise the goal line leaves the chart. */
  private readonly effectiveGoal = computed<number | null>(() => {
    const goal = this.metric().dailyGoal;
    if (goal === null) return null;
    const grouped = this.buckets().length !== this.points().length;
    return grouped && this.metric().aggregation === 'sum' ? goal * 7 : goal;
  });

  protected readonly bars = computed<readonly Bar[]>(() => {
    const metric = this.metric();
    const buckets = this.buckets();
    const goal = this.effectiveGoal();
    const max = Math.max(...buckets.map((p) => p.value), goal ?? 0, 1);

    return buckets.map((point) => ({
      label: formatDayLabel(point.date),
      value: point.value,
      height: (point.value / max) * 100,
      goalHit: goal !== null ? toDisplay(metric, point.value) >= goal : point.value > 0,
      tooltip: `${formatDayLabel(point.date)}: ${formatValue(metric, point.value)} ${t(metric.unitKey)}`,
    }));
  });

  protected readonly goalLine = computed<number | null>(() => {
    const metric = this.metric();
    const goal = this.effectiveGoal();
    if (goal === null) return null;

    const rawGoal = goal / metric.scale;
    const max = Math.max(...this.buckets().map((p) => p.value), rawGoal, 1);
    return (rawGoal / max) * 100;
  });
}

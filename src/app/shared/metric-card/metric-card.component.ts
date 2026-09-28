import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetricSummary } from '@core/metrics/aggregate';
import { formatValue } from '@core/metrics/metric.registry';
import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-metric-card',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.scss',
})
export class MetricCardComponent {
  readonly summary = input.required<MetricSummary>();
  /** Caption under the value, e.g. "8,600 per day on average". */
  readonly caption = input<string>('');

  protected readonly value = computed(() => {
    const { metric, total } = this.summary();
    return formatValue(metric, total);
  });

  /** Progress bar fill: the share of days that met the goal. */
  protected readonly progress = computed<number | null>(() => {
    const summary = this.summary();
    if (summary.goalDays === null) return null;
    const days = Math.max(summary.daysWithData, 1);
    return Math.min(100, Math.round((summary.goalDays / days) * 100));
  });

  protected abs(n: number): number {
    return Math.abs(n);
  }
}

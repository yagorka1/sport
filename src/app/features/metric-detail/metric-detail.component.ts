import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsStore } from '@core/stats/stats.store';
import { findMetric, formatValue } from '@core/metrics/metric.registry';
import { formatDayLabel } from '@core/util/dates';
import { BarChartComponent } from '@shared/bar-chart/bar-chart.component';
import { PeriodSwitchComponent } from '@shared/period-switch/period-switch.component';
import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-metric-detail',
  imports: [BarChartComponent, PeriodSwitchComponent, RouterLink, TranslatePipe],
  templateUrl: './metric-detail.component.html',
  styleUrl: './metric-detail.component.scss',
})
export class MetricDetailComponent {
  /** Supplied by the `metric/:id` route thanks to withComponentInputBinding. */
  readonly id = input<string>('');

  protected readonly stats = inject(StatsStore);

  protected readonly metric = computed(() => findMetric(this.id()) ?? null);
  protected readonly points = computed(() => this.stats.points(this.id()));
  protected readonly summary = computed(() => this.stats.summary(this.id()));

  protected formatted(rawValue: number): string {
    const metric = this.metric();
    return metric ? formatValue(metric, rawValue) : '—';
  }

  protected dayLabel(day: string): string {
    return formatDayLabel(day);
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }
}

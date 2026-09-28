import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsStore } from '@core/stats/stats.store';
import { SyncService } from '@core/sync/sync.service';
import { MetricSummary } from '@core/metrics/aggregate';
import { formatValue } from '@core/metrics/metric.registry';
import { Workout } from '@core/metrics/metric.model';
import { formatDuration } from '@core/util/dates';
import { t } from '@core/i18n/i18n';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { workoutTitle } from '@core/i18n/workout-title';
import { MetricCardComponent } from '@shared/metric-card/metric-card.component';
import { PeriodSwitchComponent } from '@shared/period-switch/period-switch.component';

@Component({
  selector: 'app-dashboard',
  imports: [MetricCardComponent, PeriodSwitchComponent, RouterLink, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly stats = inject(StatsStore);
  protected readonly sync = inject(SyncService);

  protected readonly isEmpty = computed(() =>
    this.stats.summaries().every((s) => s.daysWithData === 0),
  );

  protected readonly recentWorkouts = computed(() => this.stats.workouts().slice(0, 4));

  protected readonly totalWorkoutTime = computed(() =>
    formatDuration(this.stats.workouts().reduce((acc, w) => acc + w.durationSec, 0)),
  );

  protected caption(summary: MetricSummary): string {
    if (summary.daysWithData === 0) return t('caption.noData');
    if (summary.streak !== null && summary.streak > 1) {
      return t('caption.streak', { n: summary.streak });
    }
    if (summary.goalDays !== null) {
      return t('caption.goalDays', { done: summary.goalDays, n: summary.daysWithData });
    }
    return t('caption.perDay', { value: formatValue(summary.metric, summary.perDay) });
  }

  protected title(workout: Workout): string {
    return workoutTitle(workout);
  }

  protected duration(seconds: number): string {
    return formatDuration(seconds);
  }
}

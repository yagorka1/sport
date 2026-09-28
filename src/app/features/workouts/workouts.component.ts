import { Component, computed, inject } from '@angular/core';
import { StatsStore } from '@core/stats/stats.store';
import { Workout } from '@core/metrics/metric.model';
import { formatDateTime, formatDuration } from '@core/util/dates';
import { locale } from '@core/i18n/i18n';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { workoutTitle, workoutTypeTitle } from '@core/i18n/workout-title';
import { PeriodSwitchComponent } from '@shared/period-switch/period-switch.component';

interface TypeStat {
  readonly type: string;
  readonly count: number;
  readonly totalSec: number;
}

@Component({
  selector: 'app-workouts',
  imports: [PeriodSwitchComponent, TranslatePipe],
  templateUrl: './workouts.component.html',
  styleUrl: './workouts.component.scss',
})
export class WorkoutsComponent {
  protected readonly stats = inject(StatsStore);

  protected readonly byType = computed<readonly TypeStat[]>(() => {
    const totals = new Map<string, TypeStat>();
    for (const workout of this.stats.workouts()) {
      const existing = totals.get(workout.type);
      totals.set(workout.type, {
        type: workout.type,
        count: (existing?.count ?? 0) + 1,
        totalSec: (existing?.totalSec ?? 0) + workout.durationSec,
      });
    }
    return [...totals.values()].sort((a, b) => b.totalSec - a.totalSec);
  });

  protected title(workout: Workout): string {
    return workoutTitle(workout);
  }

  /** Grouping is by type, so the group is named after the type, not a session title. */
  protected typeTitle(type: string): string {
    return workoutTypeTitle(type);
  }

  protected duration(seconds: number): string {
    return formatDuration(seconds);
  }

  protected km(meters: number): string {
    return (meters / 1000).toLocaleString(locale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected when(workout: Workout): string {
    return formatDateTime(workout.startedAt);
  }

  /** Pace in min/km — distance sports only; it is meaningless for strength training. */
  protected pace(workout: Workout): string | null {
    if (!workout.distanceM || workout.distanceM < 300) return null;
    const secPerKm = workout.durationSec / (workout.distanceM / 1000);
    const minutes = Math.floor(secPerKm / 60);
    const seconds = Math.round(secPerKm % 60);
    return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
  }
}

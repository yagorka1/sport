import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsStore } from '@core/stats/stats.store';
import { Workout } from '@core/metrics/metric.model';
import { formatDateTime, formatDuration } from '@core/util/dates';
import { formatKm, formatPace, hasRoute } from '@core/util/workout-format';
import { TranslationKey } from '@core/i18n/i18n.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { workoutTitle, workoutTypeTitle } from '@core/i18n/workout-title';
import { PeriodSwitchComponent } from '@shared/period-switch/period-switch.component';

interface TypeStat {
  readonly type: string;
  readonly count: number;
  readonly totalSec: number;
}

type SortKey = 'date' | 'duration' | 'distance' | 'calories';

/** Descending comparators: the biggest (or newest) first. Missing values go last. */
const SORTERS: Readonly<Record<SortKey, (a: Workout, b: Workout) => number>> = {
  date: (a, b) => b.startedAt.localeCompare(a.startedAt),
  duration: (a, b) => b.durationSec - a.durationSec,
  distance: (a, b) => (b.distanceM ?? -1) - (a.distanceM ?? -1),
  calories: (a, b) => (b.calories ?? -1) - (a.calories ?? -1),
};

@Component({
  selector: 'app-workouts',
  imports: [PeriodSwitchComponent, RouterLink, TranslatePipe],
  templateUrl: './workouts.component.html',
  styleUrl: './workouts.component.scss',
})
export class WorkoutsComponent {
  protected readonly stats = inject(StatsStore);

  /** null — all types. */
  protected readonly typeFilter = signal<string | null>(null);
  protected readonly sort = signal<SortKey>('date');

  protected readonly sortOptions: ReadonlyArray<{ value: SortKey; label: TranslationKey }> = [
    { value: 'date', label: 'workouts.sort.date' },
    { value: 'duration', label: 'workouts.sort.duration' },
    { value: 'distance', label: 'workouts.sort.distance' },
    { value: 'calories', label: 'workouts.sort.calories' },
  ];

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

  protected readonly visible = computed<readonly Workout[]>(() => {
    const type = this.typeFilter();
    const list = this.stats.workouts().filter((w) => type === null || w.type === type);
    return list.sort(SORTERS[this.sort()]);
  });

  /** Workouts synced by a version without routes have no `route` field at all. */
  protected readonly routesNotSynced = computed(() =>
    this.stats.workouts().some((w) => w.route === undefined),
  );

  protected toggleType(type: string): void {
    this.typeFilter.update((current) => (current === type ? null : type));
  }

  protected setSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as SortKey);
  }

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
    return formatKm(meters);
  }

  protected when(workout: Workout): string {
    return formatDateTime(workout.startedAt);
  }

  protected pace(workout: Workout): string | null {
    return formatPace(workout);
  }

  protected hasRoute(workout: Workout): boolean {
    return hasRoute(workout);
  }
}

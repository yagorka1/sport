import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsStore } from '@core/stats/stats.store';
import { Workout, WorkoutLap } from '@core/metrics/metric.model';
import { formatDateTime, formatDuration } from '@core/util/dates';
import {
  formatKm,
  formatNumber,
  formatPace,
  formatPaceOf,
  formatSpeedKmh,
  prefersSpeed,
  sourceAppName,
} from '@core/util/workout-format';
import { locale, rawText, t } from '@core/i18n/i18n';
import { LocalizedText, TranslationKey } from '@core/i18n/i18n.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { workoutTitle } from '@core/i18n/workout-title';
import { HeartRateChartComponent } from '@shared/heart-rate-chart/heart-rate-chart.component';
import { RouteMapComponent } from '@shared/route-map/route-map.component';

interface Fact {
  readonly label: TranslationKey;
  readonly value: string;
}

interface Section {
  readonly title: TranslationKey;
  readonly facts: readonly Fact[];
}

@Component({
  selector: 'app-workout-detail',
  imports: [HeartRateChartComponent, RouteMapComponent, RouterLink, TranslatePipe],
  templateUrl: './workout-detail.component.html',
  styleUrl: './workout-detail.component.scss',
})
export class WorkoutDetailComponent {
  /** Supplied by the `workouts/:id` route thanks to withComponentInputBinding. */
  readonly id = input<string>('');

  protected readonly stats = inject(StatsStore);

  protected readonly workout = resource({
    params: () => this.id() || undefined,
    loader: ({ params }) => this.stats.loadWorkout(params),
  });

  protected readonly route = resource({
    params: () => this.workout.value() ?? undefined,
    loader: ({ params }) => this.stats.loadRoute(params),
  });

  protected readonly routePoints = computed(() => {
    const route = this.route.value();
    return route?.status === 'data' && route.points.length > 1 ? route.points : null;
  });

  /** Everything the workout has, grouped; values that were not recorded are left out. */
  protected readonly sections = computed<readonly Section[]>(() => {
    const w = this.workout.value();
    if (!w) return [];
    const kcal = t('unit.kcal');
    const bpm = t('unit.bpm');

    const sections: Section[] = [
      {
        title: 'details.section.main',
        facts: facts([
          ['details.time', this.timeRange(w)],
          ['route.duration', formatDuration(w.durationSec)],
          ['metric.distance.title', w.distanceM ? `${formatKm(w.distanceM)} ${t('unit.km')}` : null],
          ...this.speedFacts(w),
          ['metric.steps.title', w.steps ? formatNumber(w.steps) : null],
          ['details.cadence', w.avgCadence ? `${formatNumber(w.avgCadence)} ${t('unit.spm')}` : null],
          [
            'details.elevationGain',
            w.elevationGainM ? `${formatNumber(w.elevationGainM)} ${t('unit.m')}` : null,
          ],
        ]),
      },
      {
        title: 'details.section.energy',
        facts: facts([
          ['details.activeCalories', w.calories !== null ? `${formatNumber(w.calories)} ${kcal}` : null],
          [
            'details.totalCalories',
            w.totalCalories ? `${formatNumber(w.totalCalories)} ${kcal}` : null,
          ],
        ]),
      },
      {
        title: 'details.section.heart',
        facts: facts([
          ['details.avg', w.avgHeartRate !== null ? `${w.avgHeartRate} ${bpm}` : null],
          ['details.min', w.minHeartRate ? `${w.minHeartRate} ${bpm}` : null],
          ['details.max', w.maxHeartRate !== null ? `${w.maxHeartRate} ${bpm}` : null],
        ]),
      },
      {
        title: 'details.section.power',
        facts: facts([
          ['details.avg', w.avgPowerW ? `${formatNumber(w.avgPowerW)} ${t('unit.w')}` : null],
          ['details.max', w.maxPowerW ? `${formatNumber(w.maxPowerW)} ${t('unit.w')}` : null],
        ]),
      },
    ];
    return sections.filter((s) => s.facts.length > 0);
  });

  /** The chart needs at least a couple of real samples. */
  protected readonly heartRate = computed(() => {
    const series = this.workout.value()?.heartRate;
    return series && series.bpm.filter((v) => v !== null).length > 1 ? series : null;
  });

  protected readonly laps = computed<readonly WorkoutLap[]>(() => this.workout.value()?.laps ?? []);

  protected readonly requesting = signal(false);
  protected readonly requestError = signal<LocalizedText | null>(null);

  protected async allowRoute(workout: Workout): Promise<void> {
    this.requesting.set(true);
    this.requestError.set(null);
    try {
      const result = await this.stats.requestRoute(workout);
      if (result.status === 'data') {
        this.route.set(result);
      } else {
        this.requestError.set({ key: 'route.declined' });
      }
    } catch (e) {
      this.requestError.set(e instanceof Error ? rawText(e.message) : { key: 'route.loadFailed' });
    } finally {
      this.requesting.set(false);
    }
  }

  protected title(workout: Workout): string {
    return workoutTitle(workout);
  }

  protected when(workout: Workout): string {
    return formatDateTime(workout.startedAt);
  }

  protected source(workout: Workout): string | null {
    return sourceAppName(workout.source === 'demo' ? null : workout.source);
  }

  protected lapDuration(lap: WorkoutLap): string {
    const minutes = Math.floor(lap.durationSec / 60);
    const seconds = lap.durationSec % 60;
    return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
  }

  protected lapLength(lap: WorkoutLap): string {
    return lap.lengthM ? `${formatKm(lap.lengthM)} ${t('unit.km')}` : '—';
  }

  protected lapPace(lap: WorkoutLap): string {
    return lap.lengthM ? formatPaceOf(lap.durationSec, lap.lengthM) : '—';
  }

  private timeRange(w: Workout): string {
    const time = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
    return `${time.format(new Date(w.startedAt))} – ${time.format(new Date(w.endedAt))}`;
  }

  /** Pace for running and walking, speed for rides; max speed whenever it was recorded. */
  private speedFacts(w: Workout): Array<[TranslationKey, string | null]> {
    const kmh = t('unit.kmh');
    const avgSpeed = w.avgSpeedMps ?? (w.distanceM ? w.distanceM / w.durationSec : null);
    const pace = formatPace(w);
    return [
      prefersSpeed(w)
        ? ['details.avgSpeed', avgSpeed ? `${formatSpeedKmh(avgSpeed)} ${kmh}` : null]
        : ['route.pace', pace ? t('workouts.pace', { pace }) : null],
      ['details.maxSpeed', w.maxSpeedMps ? `${formatSpeedKmh(w.maxSpeedMps)} ${kmh}` : null],
    ];
  }
}

function facts(entries: ReadonlyArray<[TranslationKey, string | null]>): Fact[] {
  return entries
    .filter((entry): entry is [TranslationKey, string] => entry[1] !== null)
    .map(([label, value]) => ({ label, value }));
}

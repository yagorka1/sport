import { Workout } from '@core/metrics/metric.model';
import { isTranslationKey, t } from './i18n';
import { ru } from './ru';

/**
 * Russian default titles that older builds of the native plugin wrote into Firestore
 * instead of leaving `title` empty. They are treated as "no custom title", so such
 * workouts still get translated by their type.
 */
const LEGACY_DEFAULT_TITLES: ReadonlySet<string> = new Set(
  Object.entries(ru)
    .filter(([key]) => key.startsWith('workout.'))
    .map(([, title]) => title as string),
);

export function workoutTypeTitle(type: string): string {
  const key = `workout.${type}`;
  return t(isTranslationKey(key) ? key : 'workout.other');
}

/** The user's own session title when there is one, otherwise the translated type name. */
export function workoutTitle(workout: Pick<Workout, 'type' | 'title'>): string {
  const custom = workout.title?.trim();
  if (custom && !LEGACY_DEFAULT_TITLES.has(custom)) return custom;
  return workoutTypeTitle(workout.type);
}

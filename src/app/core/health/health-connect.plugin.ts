import { registerPlugin } from '@capacitor/core';

/**
 * TypeScript contract of our native plugin.
 * Implementation: android/app/src/main/java/.../HealthConnectPlugin.kt
 * On the web platform none of these methods is ever called — see HealthService.
 */

export interface AvailabilityResult {
  /** true when Health Connect is installed and usable. */
  available: boolean;
  /** 'ok' | 'update_required' | 'not_installed' | 'not_supported' */
  status: string;
}

export interface PermissionsResult {
  /** healthType keys that are actually granted. */
  granted: string[];
}

export interface DailyPointDto {
  /** YYYY-MM-DD in the device's local time zone. */
  date: string;
  /** Value in Health Connect units (steps, kcal, meters, seconds). */
  value: number;
}

export interface WorkoutDto {
  id: string;
  type: string;
  /** Only a title the user set on the session; the UI translates the type otherwise. */
  title: string | null;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  calories: number | null;
  distanceM: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  source: string | null;
}

export interface HealthConnectPlugin {
  isAvailable(): Promise<AvailabilityResult>;

  checkPermissions(options: { types: string[] }): Promise<PermissionsResult>;

  /** Opens the Health Connect system dialog. Returns what was actually granted. */
  requestPermissions(options: { types: string[] }): Promise<PermissionsResult>;

  /** Daily aggregation of one record type over a range (both bounds inclusive). */
  readDaily(options: {
    type: string;
    from: string;
    to: string;
    aggregation: string;
  }): Promise<{ points: DailyPointDto[] }>;

  readWorkouts(options: { from: string; to: string }): Promise<{ workouts: WorkoutDto[] }>;

  /** Health Connect screen in system settings, so the user can adjust access. */
  openSettings(): Promise<void>;
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');

import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DailyPoint, DateRange, MetricId, Workout } from '@core/metrics/metric.model';
import { AuthService } from '@core/auth/auth.service';
import { db } from './firebase';
import { DayMetrics, StatsRepository } from './stats.repository';

/**
 * Firestore layout:
 *   users/{uid}                        { lastSyncAt }
 *   users/{uid}/days/{YYYY-MM-DD}      { date, metrics: { steps: 8123, distance: 6200, ... } }
 *   users/{uid}/workouts/{id}          Workout
 *
 * Metrics are fields inside a day document rather than separate documents: a new metric
 * needs no migration, and a range of any length is read with a single query.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreStatsRepository implements StatsRepository {
  private readonly auth = inject(AuthService);

  /** Firestore caps a batch at 500 operations. */
  private static readonly BATCH_LIMIT = 450;

  async loadSeries(range: DateRange): Promise<Map<MetricId, DailyPoint[]>> {
    const snapshot = await getDocs(
      query(
        collection(db(), this.daysPath()),
        where('date', '>=', range.from),
        where('date', '<=', range.to),
        orderBy('date'),
      ),
    );

    const series = new Map<MetricId, DailyPoint[]>();
    for (const document of snapshot.docs) {
      const data = document.data() as { date: string; metrics?: DayMetrics };
      for (const [metricId, value] of Object.entries(data.metrics ?? {})) {
        if (typeof value !== 'number') continue;
        const points = series.get(metricId) ?? [];
        points.push({ date: data.date, value });
        series.set(metricId, points);
      }
    }
    return series;
  }

  async saveDays(days: Map<string, DayMetrics>): Promise<void> {
    const entries = [...days.entries()];
    for (let i = 0; i < entries.length; i += FirestoreStatsRepository.BATCH_LIMIT) {
      const batch = writeBatch(db());
      for (const [date, metrics] of entries.slice(i, i + FirestoreStatsRepository.BATCH_LIMIT)) {
        // merge: syncing one metric must not wipe the others already written for that day.
        batch.set(doc(db(), this.daysPath(), date), { date, metrics }, { merge: true });
      }
      await batch.commit();
    }
  }

  async loadWorkouts(range: DateRange): Promise<Workout[]> {
    const snapshot = await getDocs(
      query(
        collection(db(), this.workoutsPath()),
        // Lexicographic order of ISO strings matches chronological order.
        where('startedAt', '>=', `${range.from}T00:00:00`),
        where('startedAt', '<=', `${range.to}T23:59:59.999Z`),
        orderBy('startedAt', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => d.data() as Workout);
  }

  async saveWorkouts(workouts: readonly Workout[]): Promise<void> {
    for (let i = 0; i < workouts.length; i += FirestoreStatsRepository.BATCH_LIMIT) {
      const batch = writeBatch(db());
      for (const workout of workouts.slice(i, i + FirestoreStatsRepository.BATCH_LIMIT)) {
        batch.set(doc(db(), this.workoutsPath(), workout.id), workout, { merge: true });
      }
      await batch.commit();
    }
  }

  async lastSyncAt(): Promise<string | null> {
    const snapshot = await getDoc(doc(db(), 'users', this.uid()));
    const data = snapshot.data() as { lastSyncAt?: string } | undefined;
    return data?.lastSyncAt ?? null;
  }

  async markSynced(at: string): Promise<void> {
    await setDoc(doc(db(), 'users', this.uid()), { lastSyncAt: at }, { merge: true });
  }

  private uid(): string {
    const user = this.auth.user();
    if (!user) {
      throw new Error('No signed-in user');
    }
    return user.uid;
  }

  private daysPath(): string {
    return `users/${this.uid()}/days`;
  }

  private workoutsPath(): string {
    return `users/${this.uid()}/workouts`;
  }
}

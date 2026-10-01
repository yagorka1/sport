import { Injectable, inject, signal } from '@angular/core';
import { MetricId } from '@core/metrics/metric.model';
import { defaultGoal, setGoalOverrides } from '@core/metrics/metric.registry';
import { FirestoreStatsRepository } from '@core/data/firestore-stats.repository';
import { isFirebaseConfigured } from '@core/data/firebase';
import { AuthService } from '@core/auth/auth.service';

type Goals = Readonly<Record<MetricId, number>>;

const STORAGE_KEY = 'goals';

/**
 * The user's daily goals, in display units (steps, kcal, km, minutes).
 *
 * Stored in the user's Firestore document so the phone and the website agree, and mirrored
 * in localStorage so goals apply before Firestore answers and without signing in.
 * Only goals that differ from the built-in default are kept.
 */
@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly repo = inject(FirestoreStatsRepository);
  private readonly auth = inject(AuthService);

  private readonly goals = signal<Goals>(readStored());

  constructor() {
    setGoalOverrides(this.goals());
  }

  /** Firestore wins over the local copy: it is what the other device sees. */
  async load(): Promise<void> {
    if (!this.useFirestore()) return;
    const remote = await this.repo.loadGoals();
    if (remote) this.apply(remote);
  }

  /** A goal equal to the default is stored as "no override", so a later default change applies. */
  async set(metricId: MetricId, value: number | null): Promise<void> {
    const next: Record<MetricId, number> = { ...this.goals() };
    if (value === null || value <= 0 || value === defaultGoal(metricId)) {
      delete next[metricId];
    } else {
      next[metricId] = value;
    }
    this.apply(next);
    if (this.useFirestore()) {
      await this.repo.saveGoals(next);
    }
  }

  private apply(goals: Goals): void {
    this.goals.set(goals);
    setGoalOverrides(goals);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    } catch {
      // Storage may be unavailable (private mode) — goals then last for the session.
    }
  }

  private useFirestore(): boolean {
    return isFirebaseConfigured() && this.auth.user() !== null;
  }
}

function readStored(): Goals {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === 'number' && v > 0),
    ) as Goals;
  } catch {
    return {};
  }
}

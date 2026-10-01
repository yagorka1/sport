import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'metric/:id',
    loadComponent: () =>
      import('@features/metric-detail/metric-detail.component').then((m) => m.MetricDetailComponent),
  },
  {
    path: 'workouts',
    loadComponent: () =>
      import('@features/workouts/workouts.component').then((m) => m.WorkoutsComponent),
  },
  {
    path: 'workouts/:id',
    loadComponent: () =>
      import('@features/workout-detail/workout-detail.component').then(
        (m) => m.WorkoutDetailComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('@features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];

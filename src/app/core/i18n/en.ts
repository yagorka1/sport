import type { Dictionary } from './i18n.model';

export const en: Dictionary = {
  'app.title': 'My sports stats',

  'lang.ru': 'Русский',
  'lang.en': 'English',

  'nav.overview': 'Overview',
  'nav.workouts': 'Workouts',
  'nav.settings': 'Settings',

  'signin.text':
    'Sign in with your Google account — the same one you use on your phone. The Android app ' +
    'reads Health Connect and stores the data in your personal part of the database, and the ' +
    'website displays it.',
  'signin.button': 'Sign in with Google',

  'banner.noFirebase.before': 'Firebase is not configured — showing demo data. Fill in',
  'banner.noFirebase.after': ', see README.',
  'banner.web': 'This is the web version: Health Connect is only available in the Android app.',
  'banner.noData': 'No synced data yet — showing demo values.',

  'period.week': 'Week',
  'period.month': 'Month',
  'period.quarter': '3 months',
  'period.year': 'Year',

  'common.loading': 'Loading…',

  'dashboard.syncing': 'Syncing…',
  'dashboard.refresh': '⟳ Refresh',
  'dashboard.empty':
    'No data for the selected period. Open the app on your phone, grant access to ' +
    'Health Connect and tap “Refresh”.',
  'dashboard.allWorkouts': 'all →',
  'dashboard.noWorkouts': 'No workouts in this period.',

  'caption.noData': 'no data',
  'caption.streak': '{n}-day goal streak',
  'caption.goalDays': {
    one: 'goal met on {done} of {n} day',
    other: 'goal met on {done} of {n} days',
  },
  'caption.perDay': '{value} per day on average',

  'detail.notFound': 'Metric not found.',
  'detail.toOverview': 'Back to overview',
  'detail.totalForPeriod': 'total for the period',
  'detail.avgForPeriod': 'average for the period',
  'detail.vsPrevious': 'vs previous period',
  'detail.perDay': 'Daily average',
  'detail.bestDay': 'Best day',
  'detail.goal': 'Goal ({goal} {unit}/day)',
  'detail.goalDays': '{done} of {total} days',
  'detail.streak': 'Streak',
  'detail.streakDays': {
    one: '{n} day in a row',
    other: '{n} days in a row',
  },

  'chart.goal': 'goal {goal}',

  'workouts.empty': 'No workouts in the selected period.',
  'workouts.count': {
    one: '{n} workout',
    other: '{n} workouts',
  },
  'workouts.pace': '{pace} /km',

  'unit.km': 'km',
  'unit.kcal': 'kcal',
  'unit.bpm': 'bpm',

  'duration.hoursMinutes': '{h} h {m} min',
  'duration.minutes': '{m} min',

  'settings.language': 'Language',
  'settings.account': 'Account',
  'settings.signOut': 'Sign out',
  'settings.notSignedIn': 'Not signed in.',
  'settings.notSignedInNoFirebase': 'Not signed in (Firebase is not configured).',
  'settings.source': 'Data source',
  'settings.needPermission': 'Access to Health Connect is required, otherwise there is nothing to read.',
  'settings.grant': 'Grant access',
  'settings.unavailable':
    'Health Connect was not found on this device. Install it from Google Play (on Android 14+ ' +
    'it is built into the system).',
  'settings.healthConnectSettings': 'Health Connect settings',
  'settings.sync': 'Sync',
  'settings.lastSync': 'Last sync',
  'settings.neverSynced': 'never',
  'settings.syncNow': 'Sync now',
  'settings.resyncYear': 'Re-read the whole year',
  'settings.syncMobileOnly':
    'Only available in the Android app: Health Connect is on-device storage and cannot be read ' +
    'from a browser. The website shows whatever the phone has synced.',
  'settings.metrics': 'Metrics',
  'settings.metricsHint.definedIn': 'The set is defined in',
  'settings.metricsHint.enable': '. To turn on a disabled metric, set',
  'settings.metricsHint.rebuild': 'and rebuild the app.',
  'settings.on': 'on',
  'settings.off': 'off',

  'status.checking': 'checking',
  'status.ready': 'access granted ({n})',
  'status.needsPermission': 'no access',
  'status.unavailable': 'unavailable',
  'status.demo': 'demo',

  'source.demo': 'Demo data',
  'source.healthConnect': 'Health Connect',

  'sync.notAvailable': 'Sync is only available in the Android app after signing in and granting access',
  'sync.readingMetrics': {
    one: 'Reading Health Connect: {n} metric…',
    other: 'Reading Health Connect: {n} metrics…',
  },
  'sync.savingDays': 'Saving days…',
  'sync.readingWorkouts': 'Reading workouts…',
  'sync.done': 'Done. Days: {days}, workouts: {workouts} ({from} — {to})',
  'sync.failed': 'Sync failed',

  'stats.loadFailed': 'Failed to load statistics',

  'auth.noFirebase': 'Firebase is not configured: fill in src/environments/environment.ts',
  'auth.cancelled': 'Sign-in cancelled',
  'auth.unauthorizedDomain':
    'This domain is not allowed in Firebase → Authentication → Settings → Authorized domains',
  'auth.noIdToken': 'Google returned no idToken',
  'auth.failed': 'Sign-in failed',

  'error.raw': '{message}',

  'metric.steps.title': 'Steps',
  'metric.steps.unit': 'steps',
  'metric.calories.title': 'Calories',
  'metric.calories.short': 'Kcal',
  'metric.calories.unit': 'kcal',
  'metric.distance.title': 'Distance',
  'metric.distance.unit': 'km',
  'metric.exercise_minutes.title': 'Active minutes',
  'metric.exercise_minutes.short': 'Activity',
  'metric.exercise_minutes.unit': 'min',
  'metric.resting_hr.title': 'Resting heart rate',
  'metric.resting_hr.unit': 'bpm',
  'metric.sleep.title': 'Sleep',
  'metric.sleep.unit': 'h',
  'metric.weight.title': 'Weight',
  'metric.weight.unit': 'kg',

  'workout.running': 'Running',
  'workout.running_treadmill': 'Treadmill running',
  'workout.walking': 'Walking',
  'workout.hiking': 'Hiking',
  'workout.cycling': 'Cycling',
  'workout.cycling_stationary': 'Stationary bike',
  'workout.swimming': 'Swimming',
  'workout.swimming_open_water': 'Open water swimming',
  'workout.strength_training': 'Strength training',
  'workout.weightlifting': 'Weightlifting',
  'workout.hiit': 'HIIT',
  'workout.yoga': 'Yoga',
  'workout.elliptical': 'Elliptical',
  'workout.rowing': 'Rowing machine',
  'workout.stair_climbing': 'Stair climbing',
  'workout.football': 'Football',
  'workout.basketball': 'Basketball',
  'workout.tennis': 'Tennis',
  'workout.boxing': 'Boxing',
  'workout.skiing': 'Skiing',
  'workout.snowboarding': 'Snowboarding',
  'workout.calisthenics': 'Calisthenics',
  'workout.stretching': 'Stretching',
  'workout.other': 'Workout',
};

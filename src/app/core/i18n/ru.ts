import type { Message } from './i18n.model';

/**
 * Russian dictionary — the reference one: its keys define TranslationKey, and every
 * other dictionary must provide the same set.
 * Plural messages pick a form by the `n` parameter (one / few / many / other).
 */
export const ru = {
  'app.title': 'Моя статистика спорта',

  'lang.ru': 'Русский',
  'lang.en': 'English',

  'nav.overview': 'Обзор',
  'nav.workouts': 'Тренировки',
  'nav.settings': 'Настройки',

  'signin.text':
    'Войдите Google-аккаунтом — тем же, что и на телефоне. Приложение на Android читает ' +
    'Health Connect и складывает данные в ваш личный раздел базы, а сайт показывает их.',
  'signin.button': 'Войти через Google',

  'banner.noFirebase.before': 'Firebase не настроен — показаны демо-данные. Заполните',
  'banner.noFirebase.after': ', см. README.',
  'banner.web': 'Это веб-версия: Health Connect доступен только в Android-приложении.',
  'banner.noData': 'Пока нет синхронизированных данных — показаны демо-значения.',

  'period.week': 'Неделя',
  'period.month': 'Месяц',
  'period.quarter': '3 месяца',
  'period.year': 'Год',

  'common.loading': 'Загружаю…',

  'dashboard.syncing': 'Синк…',
  'dashboard.refresh': '⟳ Обновить',
  'dashboard.empty':
    'За выбранный период данных нет. Откройте приложение на телефоне, выдайте доступ к ' +
    'Health Connect и нажмите «Обновить».',
  'dashboard.allWorkouts': 'все →',
  'dashboard.noWorkouts': 'За период тренировок нет.',

  'caption.noData': 'нет данных',
  'caption.streak': {
    one: '{n} день подряд с целью',
    few: '{n} дня подряд с целью',
    many: '{n} дней подряд с целью',
    other: '{n} дня подряд с целью',
  },
  'caption.goalDays': 'цель выполнена {done} из {n} дн.',
  'caption.perDay': 'в среднем {value} за день',

  'detail.notFound': 'Метрика не найдена.',
  'detail.toOverview': 'На обзор',
  'detail.totalForPeriod': 'всего за период',
  'detail.avgForPeriod': 'в среднем за период',
  'detail.vsPrevious': 'к прошлому периоду',
  'detail.perDay': 'В среднем за день',
  'detail.bestDay': 'Лучший день',
  'detail.goal': 'Цель ({goal} {unit}/день)',
  'detail.goalDays': '{done} из {total} дн.',
  'detail.streak': 'Серия',
  'detail.streakDays': '{n} дн. подряд',

  'chart.goal': 'цель {goal}',

  'workouts.empty': 'За выбранный период тренировок нет.',
  'workouts.count': '{n} шт',
  'workouts.pace': '{pace} /км',

  'unit.km': 'км',
  'unit.kcal': 'ккал',
  'unit.bpm': 'уд/мин',

  'duration.hoursMinutes': '{h} ч {m} мин',
  'duration.minutes': '{m} мин',

  'settings.language': 'Язык',
  'settings.account': 'Аккаунт',
  'settings.signOut': 'Выйти',
  'settings.notSignedIn': 'Не выполнен вход.',
  'settings.notSignedInNoFirebase': 'Не выполнен вход (Firebase не настроен).',
  'settings.source': 'Источник данных',
  'settings.needPermission': 'Нужен доступ к Health Connect, иначе читать нечего.',
  'settings.grant': 'Выдать доступ',
  'settings.unavailable':
    'Health Connect не найден на устройстве. Установите его из Google Play (на Android 14+ ' +
    'он встроен в систему).',
  'settings.healthConnectSettings': 'Настройки Health Connect',
  'settings.sync': 'Синхронизация',
  'settings.lastSync': 'Последний синк',
  'settings.neverSynced': 'ещё не было',
  'settings.syncNow': 'Синхронизировать',
  'settings.resyncYear': 'Перечитать год заново',
  'settings.syncMobileOnly':
    'Доступна только в Android-приложении: Health Connect — локальное хранилище телефона, ' +
    'из браузера его не прочитать. Сайт показывает то, что синхронизировала мобилка.',
  'settings.metrics': 'Метрики',
  'settings.metricsHint.definedIn': 'Набор задан в',
  'settings.metricsHint.enable': '. Чтобы включить выключенную метрику — поставьте',
  'settings.metricsHint.rebuild': 'и пересоберите приложение.',
  'settings.on': 'вкл',
  'settings.off': 'выкл',

  'status.checking': 'проверяю',
  'status.ready': 'доступ есть ({n})',
  'status.needsPermission': 'нет доступа',
  'status.unavailable': 'недоступен',
  'status.demo': 'демо',

  'source.demo': 'Демо-данные',
  'source.healthConnect': 'Health Connect',

  'sync.notAvailable':
    'Синхронизация доступна только в приложении на Android после входа и выдачи доступа',
  'sync.readingMetrics': 'Читаю Health Connect: метрик — {n}…',
  'sync.savingDays': 'Сохраняю дни…',
  'sync.readingWorkouts': 'Читаю тренировки…',
  'sync.done': 'Готово. Дней: {days}, тренировок: {workouts} ({from} — {to})',
  'sync.failed': 'Ошибка синхронизации',

  'stats.loadFailed': 'Не удалось загрузить статистику',

  'auth.noFirebase': 'Firebase не настроен: заполните src/environments/environment.ts',
  'auth.cancelled': 'Вход отменён',
  'auth.unauthorizedDomain':
    'Домен не разрешён в Firebase → Authentication → Settings → Authorized domains',
  'auth.noIdToken': 'Google не вернул idToken',
  'auth.failed': 'Не удалось войти',

  /** Passes through text that has no translation, e.g. an exception message from an SDK. */
  'error.raw': '{message}',

  'metric.steps.title': 'Шаги',
  'metric.steps.unit': 'шагов',
  'metric.calories.title': 'Калории',
  'metric.calories.short': 'Ккал',
  'metric.calories.unit': 'ккал',
  'metric.distance.title': 'Дистанция',
  'metric.distance.unit': 'км',
  'metric.exercise_minutes.title': 'Минуты активности',
  'metric.exercise_minutes.short': 'Активность',
  'metric.exercise_minutes.unit': 'мин',
  'metric.resting_hr.title': 'Пульс покоя',
  'metric.resting_hr.unit': 'уд/мин',
  'metric.sleep.title': 'Сон',
  'metric.sleep.unit': 'ч',
  'metric.weight.title': 'Вес',
  'metric.weight.unit': 'кг',

  // Keys follow the exercise type keys emitted by HealthConnectPlugin.kt.
  'workout.running': 'Бег',
  'workout.running_treadmill': 'Бег на дорожке',
  'workout.walking': 'Ходьба',
  'workout.hiking': 'Поход',
  'workout.cycling': 'Велосипед',
  'workout.cycling_stationary': 'Велотренажёр',
  'workout.swimming': 'Плавание',
  'workout.swimming_open_water': 'Плавание на открытой воде',
  'workout.strength_training': 'Силовая',
  'workout.weightlifting': 'Тяжёлая атлетика',
  'workout.hiit': 'HIIT',
  'workout.yoga': 'Йога',
  'workout.elliptical': 'Эллипс',
  'workout.rowing': 'Гребной тренажёр',
  'workout.stair_climbing': 'Ступени',
  'workout.football': 'Футбол',
  'workout.basketball': 'Баскетбол',
  'workout.tennis': 'Теннис',
  'workout.boxing': 'Бокс',
  'workout.skiing': 'Лыжи',
  'workout.snowboarding': 'Сноуборд',
  'workout.calisthenics': 'Калистеника',
  'workout.stretching': 'Растяжка',
  'workout.other': 'Тренировка',
} satisfies Record<string, Message>;

export type TranslationKey = keyof typeof ru;

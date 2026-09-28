# My Sports Stats

An Angular app that shows personal workout and activity statistics.
It runs as a website and is also packaged as an Android APK. Data comes from
**Health Connect** on the phone and is stored in **Firestore** — there is no custom backend.

The UI is available in **Russian** and **English**; the language can be switched on the fly.

## How it works

```
Health Connect (phone)  →  APK (Angular + Kotlin plugin)  →  Firestore  →  website
```

**Why it is built this way.** Google no longer offers a cloud API for health data:
the Google Fit API was retired in favour of Health Connect, and Health Connect is
on-device storage with no server side. So only an Android app can read the data;
the website shows whatever the phone has already written to Firestore.
A browser without synced data shows demo data and clearly marks it with a banner.

Firestore stands in for a backend: the client talks to the database directly, and access
is restricted by the rules in `firestore.rules` — each user can only see their own
`users/{uid}` subtree.

### Data model

```
users/{uid}                     { lastSyncAt }
users/{uid}/days/{YYYY-MM-DD}   { date, metrics: { steps: 8123, distance: 6200, ... } }
users/{uid}/workouts/{id}       { type, title, startedAt, durationSec, calories, ... }
```

Metrics are fields inside a day document rather than separate documents: a new metric
needs no migration, and a period of any length is read with a single query.

A workout's `title` is set only when the user named the session themselves; otherwise it is
`null`, and the UI shows the name of the workout `type` in the current language.

## Stack

Versions checked against the npm and Maven registries on September 28, 2026:

| | version | notes |
|---|---|---|
| Angular | 22.2 | zoneless by default, so `zone.js` is not installed at all |
| TypeScript | 6.0.x | a hard requirement of Angular 22 (`>=6.0 <6.1`), not 7.x |
| Capacitor | 8.5 | JDK 21, Kotlin 2.2.20, AGP 8.13, compileSdk 36; minSdk raised to 26 (see below) |
| firebase (JS SDK) | 12.19 | modular API, without `@angular/fire` |
| @capacitor-firebase/authentication | 8.5 | native Google Sign-In for the APK |
| androidx.health.connect:connect-client | 1.1.0 | latest stable (1.2.0 is still alpha) |

Capacitor generates `minSdk` 24 (Android 7), but `connect-client` declares minSdk 26
(Health Connect requires Android 8+), so `apply-native.ps1` raises it to 26 — otherwise the
manifest merger fails the build.

## Project structure

```
src/app/core/metrics/      metric model and registry, aggregation
src/app/core/health/       data sources: Health Connect / demo
src/app/core/data/         Firebase and the statistics repository
src/app/core/sync/         Health Connect → Firestore transfer
src/app/core/i18n/         translations: ru/en dictionaries, t() and the `t` pipe
src/app/features/          screens: overview, metric, workouts, settings
native/android/            Kotlin plugin and manifest for the native project
scripts/apply-native.ps1   copies native\android into the generated android\
```

## Running the web version

```powershell
npm install
npm start          # http://localhost:4200
```

Until Firebase is configured the app runs on demo data, so you can look at the UI right away.

## Setting up Firebase

1. Create a project at https://console.firebase.google.com
2. **Build → Firestore Database → Create database** (production mode).
3. **Authentication → Sign-in method → Google** — enable it.
4. **Project settings → Your apps → Web (`</>`)** — copy the config
   into `src/environments/environment.ts`.
5. Rules: **Firestore → Rules** — paste the contents of `firestore.rules`,
   then click Publish.
6. For local development: **Authentication → Settings → Authorized domains** —
   `localhost` is already there.

## Building the APK

Capacitor 8 requires **JDK 21**, Android SDK 36, and Android Studio Otter (2025.2.1)
or newer. The easiest way is to install the latest Android Studio — it brings the SDK too.

```powershell
npm run build:mobile
npx cap add android
powershell -ExecutionPolicy Bypass -File scripts\apply-native.ps1
```

`apply-native.ps1` copies the Kotlin plugin and the manifest into `android\`, adds the
dependencies to Gradle and raises `minSdk` to 26. Re-run it after every `cap add`/`cap update`.

Gradle needs to know where the JDK and the SDK are. If `npm run apk:debug` fails with
`JAVA_HOME is not set`, point `JAVA_HOME` at the JDK bundled with Android Studio
(`<Android Studio>\jbr`) and `ANDROID_HOME` at the SDK, then open a new terminal:

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', '<Android Studio>\jbr', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', '<path to Android SDK>', 'User')
```

Next — Google sign-in in the APK:

7. In Firebase: **Project settings → Your apps → Add app → Android**,
   package name `com.egor.sportstats`.
8. Add the **SHA-1** of the debug key:
   ```powershell
   keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```
9. Download `google-services.json` → put it into `android\app\`.
10. Add to `android\app\src\main\res\values\strings.xml`:
    ```xml
    <string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
    ```
    The Web client ID is in Google Cloud Console → Credentials → OAuth 2.0 Client IDs,
    type "Web application" (copy it into `environment.ts` as well).

Build:

```powershell
npm run apk:debug     # android\app\build\outputs\apk\debug\app-debug.apk
npm run android:run   # build and run on a connected phone
```

On the phone: open the app → **Settings → Grant access** → tick the data you need in the
Health Connect system dialog → **Sync now**. After that the data shows up on the website too.

### If Health Connect is "unavailable"

On Android 14+ it is built into the system. On Android 8–13 you need to install the
**Health Connect** app from Google Play. Data gets into Health Connect from apps such as
Google Fit, Samsung Health, Zepp or Strava — it does not measure anything by itself.

## Translations

The UI language is picked automatically from the browser/device language (Russian for
`ru-*`, English otherwise) and can be changed in **Settings → Language**; the choice is
saved in `localStorage`.

Translations use a small signal-based layer instead of an external library, so switching
the language re-renders the UI instantly, without a reload:

- `src/app/core/i18n/ru.ts` — the reference dictionary; its keys define the `TranslationKey` type;
- `src/app/core/i18n/en.ts` — must contain exactly the same keys (the compiler checks this);
- in templates: `{{ 'nav.overview' | t }}` or `{{ 'status.ready' | t: { n: 3 } }}`;
- in code: `t('caption.perDay', { value })`;
- plural forms are objects like `{ one, few, many, other }`, selected by the `n` parameter
  via `Intl.PluralRules`;
- services keep messages as `LocalizedText` (`{ key, params }`) rather than finished strings,
  so the text is re-translated when the language changes.

To add a language, add its dictionary next to `en.ts` and register it in `LANGS`,
`DICTIONARIES` and `LOCALES` in `i18n.ts`.

## Adding a metric

Resting heart rate, sleep and weight are already prepared — they only need `enabled: true`.

For a new metric:

1. `src/app/core/metrics/metric.registry.ts` — a descriptor: translation keys, goal, color,
   `scale` (conversion from Health Connect units) and `healthType`.
2. `src/app/core/i18n/ru.ts` and `en.ts` — the `metric.<id>.title`, `metric.<id>.unit`
   (and optionally `metric.<id>.short`) keys.
3. `native/android/.../HealthConnectPlugin.kt` — an entry in `recordTypes`
   with the same key: permission + `AggregateMetric` + conversion to a number.
4. `native/android/app/src/main/AndroidManifest.xml` — the matching
   `android.permission.health.READ_*`.
5. `scripts\apply-native.ps1`, rebuild the APK, grant access again.

The dashboard, charts, sync and Firestore pick the metric up automatically — no need to touch them.

## Hosting the website

```powershell
npm install -g firebase-tools
firebase login
firebase init hosting     # public directory: www, SPA: yes
firebase deploy
```

The Firebase Hosting domain is added to Authorized domains automatically,
so Google sign-in works there right away.

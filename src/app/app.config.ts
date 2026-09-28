import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

/**
 * No change detection provider here on purpose: Angular 22 is zoneless by default
 * and zone.js is not installed. Adding provideZoneChangeDetection() would opt back
 * into the old behaviour — the app relies on signals, so it does not need zones.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withHashLocation: inside the APK the page is served from file://, where the
    // History API breaks navigation.
    // withComponentInputBinding: the :id route param lands directly in a component input().
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
  ],
};

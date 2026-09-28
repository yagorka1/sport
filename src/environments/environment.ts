/**
 * Firebase configuration. Copy the values from the Firebase console:
 *   Project settings -> Your apps -> Web app -> SDK setup and configuration.
 *
 * These keys are not secrets (they ship to the browser either way); access to the data
 * is restricted by Firestore security rules — see firestore.rules.
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME.firebaseapp.com',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME.firebasestorage.app',
    messagingSenderId: 'REPLACE_ME',
    appId: 'REPLACE_ME',
  },
  /** Web client ID from Google Cloud (OAuth 2.0, type "Web application"). Required for APK sign-in. */
  googleWebClientId: 'REPLACE_ME.apps.googleusercontent.com',
};

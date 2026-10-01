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
    apiKey: 'AIzaSyDQZbtM5hwUIr0DSmuBDAimVdkdJ_jvgTs',
    authDomain: 'sport-helth.firebaseapp.com',
    projectId: 'sport-helth',
    storageBucket: 'sport-helth.firebasestorage.app',
    messagingSenderId: '434242695275',
    appId: '1:434242695275:web:17f3d037893cbe8c7ac12e',
  },
  /** Web client ID from Google Cloud (OAuth 2.0, type "Web application"). Required for APK sign-in. */
  googleWebClientId: '434242695275-a61pgv9t4s5qulh12rddnck5d0t9tij3.apps.googleusercontent.com',
};

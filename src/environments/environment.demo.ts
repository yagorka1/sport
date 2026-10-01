/**
 * Demo build: Firebase is left unconfigured on purpose, so the app skips sign-in and runs
 * on generated data. For checking the UI locally: `npm run start:demo`.
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'REPLACE_ME',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  googleWebClientId: '',
};

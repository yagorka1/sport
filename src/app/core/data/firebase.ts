import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { environment } from '@env';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

export function firebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(environment.firebase);
  }
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

/**
 * Firestore with a persistent local cache: the app opens and browses history offline,
 * and sync writes reach the server once connectivity is back.
 */
export function db(): Firestore {
  if (!firestore) {
    try {
      firestore = initializeFirestore(firebaseApp(), {
        localCache: persistentLocalCache(),
      });
    } catch {
      // initializeFirestore throws if the instance already exists (e.g. after HMR).
      firestore = getFirestore(firebaseApp());
    }
  }
  return firestore;
}

export function isFirebaseConfigured(): boolean {
  return !environment.firebase.apiKey.startsWith('REPLACE_ME');
}

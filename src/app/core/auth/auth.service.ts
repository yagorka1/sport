import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '@core/data/firebase';
import { rawText } from '@core/i18n/i18n';
import { LocalizedText } from '@core/i18n/i18n.model';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** null means signed out; the "not known yet" state is covered by `ready`. */
  readonly user = signal<AppUser | null>(null);
  /** Firebase has answered once — until then show neither the dashboard nor the sign-in screen. */
  readonly ready = signal(false);
  readonly error = signal<LocalizedText | null>(null);

  constructor() {
    // Without a Firebase config we do not initialise it at all: the app runs in demo
    // mode and must not crash on placeholder keys.
    if (!isFirebaseConfigured()) {
      this.ready.set(true);
      return;
    }

    onAuthStateChanged(firebaseAuth(), (user) => {
      this.user.set(user ? toAppUser(user) : null);
      this.ready.set(true);
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.error.set(null);
    if (!isFirebaseConfigured()) {
      this.error.set({ key: 'auth.noFirebase' });
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        await this.signInNative();
      } else {
        await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      }
    } catch (e) {
      this.error.set(describeError(e));
    }
  }

  async signOut(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    }
    await signOut(firebaseAuth());
  }

  /**
   * Popup sign-in does not work inside a WebView, so the token is obtained by the native
   * Google Sign-In and then handed to the JS SDK — otherwise Firestore queries from the
   * WebView would run as a different (anonymous) user.
   */
  private async signInNative(): Promise<void> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      this.error.set({ key: 'auth.noIdToken' });
      return;
    }
    await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
  }
}

function toAppUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

function describeError(e: unknown): LocalizedText {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return { key: 'auth.cancelled' };
  }
  if (code === 'auth/unauthorized-domain') {
    return { key: 'auth.unauthorizedDomain' };
  }
  return e instanceof Error ? rawText(e.message) : { key: 'auth.failed' };
}

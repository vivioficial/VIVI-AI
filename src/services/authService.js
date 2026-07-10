// Authentication service — wraps Firebase Auth with a stable interface.
// Falls back to local/mock behavior when Firebase is not configured.

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

// In-memory fallback user for offline/unconfigured mode
let _localUser = null;
let _localToken = null;

const LOCAL_USER_KEY = 'vivi_local_user';
const LOCAL_TOKEN_KEY = 'vivi_local_token';

function loadLocalUser() {
  try {
    const stored = localStorage.getItem(LOCAL_USER_KEY);
    if (stored) _localUser = JSON.parse(stored);
    _localToken = localStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    _localUser = null;
    _localToken = null;
  }
}

function saveLocalUser(user, token) {
  _localUser = user;
  _localToken = token;
  if (user) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(LOCAL_TOKEN_KEY);
  }
}

loadLocalUser();

// Normalize a Firebase user into a plain object compatible with the app
function normalizeUser(fbUser) {
  if (!fbUser) return null;
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: fbUser.email,
    display_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    emailVerified: fbUser.emailVerified,
    full_name: fbUser.displayName,
  };
}

export const authService = {
  /**
   * Subscribe to auth state changes.
   * Returns an unsubscribe function.
   */
  onAuthStateChanged(callback) {
    if (!isFirebaseConfigured || !auth) {
      // In local mode, immediately call callback with current local user
      setTimeout(() => callback(_localUser), 0);
      return () => {};
    }
    return onAuthStateChanged(auth, (fbUser) => {
      callback(normalizeUser(fbUser));
    });
  },

  /** Get the current authenticated user */
  async me() {
    if (!isFirebaseConfigured || !auth) {
      return _localUser;
    }
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    return normalizeUser(fbUser);
  },

  /** Sign in with email and password */
  async loginViaEmailPassword(email, password) {
    if (!isFirebaseConfigured || !auth) {
      // Local fallback: only active when Firebase is not configured (development mode).
      // This should NEVER be reached in production — configure VITE_FIREBASE_* env vars.
      console.warn(
        '[Auth] Running in offline/local mode. ' +
        'Configure VITE_FIREBASE_* environment variables to enable real authentication.'
      );
      const fakeUser = { id: 'local-user', uid: 'local-user', email, display_name: email.split('@')[0] };
      saveLocalUser(fakeUser, 'local-token');
      return fakeUser;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return normalizeUser(cred.user);
  },

  /** Register a new user with email and password */
  async register({ email, password }) {
    if (!isFirebaseConfigured || !auth) {
      const fakeUser = { id: 'local-user', uid: 'local-user', email, display_name: email.split('@')[0] };
      saveLocalUser(fakeUser, 'local-token');
      return fakeUser;
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-critical
    }
    return normalizeUser(cred.user);
  },

  /** Sign in with a third-party provider (e.g., 'google') */
  async loginWithProvider(provider, redirectUrl = '/') {
    if (!isFirebaseConfigured || !auth) {
      window.location.href = redirectUrl;
      return;
    }
    if (provider === 'google') {
      const googleProvider = new GoogleAuthProvider();
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        window.location.href = redirectUrl;
        return normalizeUser(cred.user);
      } catch (err) {
        throw new Error(err.message || 'Google sign-in failed');
      }
    }
    throw new Error(`Provider '${provider}' is not supported`);
  },

  /** Verify OTP — Firebase uses email link / verification, not OTP */
  async verifyOtp({ email, otpCode }) {
    // Firebase email verification is automatic — treat OTP as a no-op
    if (!isFirebaseConfigured || !auth) return { access_token: 'local-token' };
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('No authenticated user');
    return { access_token: await fbUser.getIdToken() };
  },

  /** Resend OTP (verification email) */
  async resendOtp(email) {
    if (!isFirebaseConfigured || !auth) return;
    const fbUser = auth.currentUser;
    if (fbUser) await sendEmailVerification(fbUser);
  },

  /** Sign out the current user */
  async logout(redirectUrl) {
    if (!isFirebaseConfigured || !auth) {
      saveLocalUser(null, null);
    } else {
      await signOut(auth);
    }
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  /** Request a password reset email */
  async resetPasswordRequest(email) {
    if (!isFirebaseConfigured || !auth) return;
    await sendPasswordResetEmail(auth, email);
  },

  /** Complete a password reset using the OOB code from the email link */
  async resetPassword({ resetToken, newPassword }) {
    if (!isFirebaseConfigured || !auth) return;
    await confirmPasswordReset(auth, resetToken, newPassword);
  },

  /** Store an auth token in localStorage */
  setToken(token) {
    if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
  },

  /** Redirect the user to the login page */
  redirectToLogin(returnUrl) {
    window.location.href = '/login';
  },

  /** Update the current user's profile */
  async updateMe(patch) {
    if (!isFirebaseConfigured || !auth) {
      if (_localUser) saveLocalUser({ ..._localUser, ...patch }, _localToken);
      return _localUser;
    }
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    const updates = {};
    if (patch.display_name || patch.displayName) {
      updates.displayName = patch.display_name || patch.displayName;
    }
    if (patch.photoURL) updates.photoURL = patch.photoURL;
    if (Object.keys(updates).length > 0) {
      await updateProfile(fbUser, updates);
    }
    return normalizeUser(fbUser);
  },
};

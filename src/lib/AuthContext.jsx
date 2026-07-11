import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const AuthContext = createContext();

/**
 * AuthProvider — Firebase Authentication.
 * Mantiene exactamente la misma API pública que la versión anterior
 * (user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
 * authError, appPublicSettings, authChecked, logout, navigateToLogin,
 * checkUserAuth, checkAppState) para no romper ningún consumidor.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null); // Concepto de Base44 sin equivalente en Firebase; se conserva por compatibilidad.

  useEffect(() => {
    // onAuthStateChanged es la fuente de verdad de la sesión en Firebase:
    // se dispara al cargar (restaurando la sesión persistida) y en cada
    // login/logout. La persistencia local es el comportamiento por defecto
    // del SDK web, por lo que la sesión sobrevive al refrescar la página.
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setUser(mapFirebaseUser(firebaseUser));
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        setAuthError(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      },
      (error) => {
        console.error('Auth state listener error:', error);
        setAuthError({ type: 'unknown', message: error.message || 'Authentication error' });
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    );
    return unsubscribe;
  }, []);

  const mapFirebaseUser = (firebaseUser) => ({
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
    email: firebaseUser.email,
    display_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
    photo_url: firebaseUser.photoURL || null,
    email_verified: firebaseUser.emailVerified,
  });

  /** Relee el usuario actual de Firebase. Conservado por compatibilidad de API. */
  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const current = auth.currentUser;
      if (current) {
        await current.reload();
        setUser(mapFirebaseUser(auth.currentUser));
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  /** En Firebase no hay "public settings" de app (concepto de Base44).
   *  Conservado por compatibilidad: solo refresca el estado del usuario. */
  const checkAppState = async () => {
    setAuthError(null);
    await checkUserAuth();
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    const from = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?from=${from}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

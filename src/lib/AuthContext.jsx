import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const AuthContext = createContext();

// Función de análisis de errores de producción para Firebase
const parseFirebaseError = (error) => {
  if (!error) return null;
  
  const code = error.code || '';
  let message = 'Ocurrió un error inesperado en el sistema de autenticación.';
  let type = 'unknown';

  switch (code) {
    case 'auth/unauthorized-domain':
      type = 'infrastructure_error';
      message = 'Este dominio no está autorizado en la consola de Firebase para realizar autenticaciones.';
      break;
    case 'auth/invalid-api-key':
      type = 'infrastructure_error';
      message = 'La clave de API proporcionada es inválida o no tiene permisos.';
      break;
    case 'auth/network-request-failed':
      type = 'network_error';
      message = 'Error de red. Comprueba tu conexión a internet antes de intentarlo de nuevo.';
      break;
    case 'auth/invalid-app':
      type = 'infrastructure_error';
      message = 'La aplicación de Firebase interna no se inicializó correctamente o el App ID es inválido.';
      break;
    case 'auth/internal-error':
      type = 'server_error';
      message = 'Error interno en los servidores de autenticación de Firebase.';
      break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      type = 'auth_required';
      message = 'Credenciales incorrectas. Acceso denegado.';
      break;
    default:
      message = error.message || message;
  }

  return { type, code, message };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null); // Conservado estrictamente como null para no romper código dependiente

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setUser(mapFirebaseUser(firebaseUser));
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        setIsLoadingAuth(false);
        setAuthChecked(true);
      },
      (error) => {
        console.error('Auth state listener error:', error);
        setAuthError(parseFirebaseError(error));
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

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const current = auth.currentUser;
      if (current) {
        await current.reload();
        setUser(mapFirebaseUser(auth.currentUser));
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(parseFirebaseError(error) || { type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

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
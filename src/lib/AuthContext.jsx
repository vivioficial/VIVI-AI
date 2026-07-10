import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

/** True when the error looks like a network/server outage rather than an app-level error. */
const isNetworkError = (e) => {
  if (e instanceof TypeError && /fetch|network/i.test(e.message)) return true;
  const s = e?.status ?? 0;
  return !s || s === 0 || s >= 500;
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appId = appParams.appId;

      // ── Step 1: Fetch app public settings (optional — skip if Base44 is down) ──
      if (appId) {
        try {
          const headers = { 'X-App-Id': appId };
          if (appParams.token) headers['Authorization'] = 'Bearer ' + appParams.token;

          const res = await fetch(`/api/apps/public/prod/public-settings/by-id/${appId}`, { headers });

          if (res.ok) {
            const publicSettings = await res.json();
            setAppPublicSettings(publicSettings);
          } else if (res.status === 403) {
            const data = await res.json().catch(() => ({}));
            const reason = data?.extra_data?.reason;
            if (reason === 'auth_required' || reason === 'user_not_registered') {
              setAuthError({ type: reason, message: data.message || reason });
            } else {
              setAuthError({ type: reason || 'forbidden', message: data.message || 'Access denied' });
            }
            setIsLoadingPublicSettings(false);
            setIsLoadingAuth(false);
            return;
          }
          // Non-403 errors: fall through to local mode
        } catch (netErr) {
          // Network error or Base44 unavailable — continue in local mode.
          console.warn('[Auth] Base44 public settings unreachable, continuing in local mode:', netErr?.message);
        }
      }

      setIsLoadingPublicSettings(false);

      // ── Step 2: Check user authentication ──
      // Run if we have a stored token OR if no appId (pure local mode).
      if (appParams.token || !appId) {
        await checkUserAuth();
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else if (!isNetworkError(error)) {
        console.error('User auth check failed:', error);
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
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

// Application parameters — reads app-level configuration from environment variables.
// No longer depends on Base44.

export const appParams = {
  appName: import.meta.env.VITE_APP_NAME || 'Vivi AI',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
};

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// Base44 Vite plugin is optional — it provides dev-time tools but is not required.
// Set VITE_ENABLE_BASE44_PLUGIN=true to re-enable it when running inside Base44 builder.
let base44Plugin = null;
if (process.env.VITE_ENABLE_BASE44_PLUGIN === 'true') {
  try {
    const base44 = (await import('@base44/vite-plugin')).default;
    base44Plugin = base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    });
  } catch {
    // Plugin not installed or not needed
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ...(base44Plugin ? [base44Plugin] : []),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

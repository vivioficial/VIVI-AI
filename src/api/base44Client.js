/**
 * base44Client.js — Legacy entry point kept for backward compatibility.
 *
 * All code that does `import { base44 } from '@/api/base44Client'` continues
 * to work unchanged. The actual implementation lives in viviBackend.js which
 * wraps Base44 with local fallbacks so the app keeps running even when Base44
 * is unavailable.
 */
export { base44 } from './viviBackend';

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localBackend } from '@/lib/localBackend';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Determine which backend to use.
// Base44 is active when an appId is configured (via env or URL param).
// If Base44 is unavailable or not configured, Vivi falls back to the
// local backend (localStorage + direct LLM API) so all features remain
// functional without any Base44 dependency.
const isBase44Configured = Boolean(appId);

let _base44Client = null;

function getBase44Client() {
  if (_base44Client) return _base44Client;
  try {
    _base44Client = createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    });
    return _base44Client;
  } catch (err) {
    console.warn('[base44Client] Failed to create Base44 client — falling back to local backend.', err.message);
    return null;
  }
}

/**
 * `base44` — unified backend client.
 *
 * When Base44 is configured this is a transparent proxy to the real SDK client.
 * When it is not configured (or unavailable) every call is routed to the local
 * backend which provides the identical API surface using localStorage + direct
 * LLM API calls.
 *
 * Consuming code never needs to check which backend is active — it just calls
 * `base44.auth.me()`, `base44.entities.Memory.list()`, etc. as normal.
 */
export const base44 = isBase44Configured
  ? (getBase44Client() ?? localBackend)
  : localBackend;

/** True when using Base44, false when using the local fallback. */
export const isBase44Available = isBase44Configured && base44 !== localBackend;

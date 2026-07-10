/**
 * viviBackend.js — Abstraction layer over Base44.
 *
 * Priority order for every operation:
 *   1. Base44 SDK  (cloud — full capabilities)
 *   2. Local fallback (localStorage + browser APIs — offline / Base44 unavailable)
 *
 * All existing code continues to `import { base44 } from '@/api/base44Client'`.
 * base44Client.js re-exports `base44` from here, so no other imports need changing.
 *
 * Design rules:
 *  - Network-level errors (no connectivity, 502/503/504, TypeError fetch)
 *    → fall back to local implementation silently.
 *  - Auth errors (401, 403) → propagate as-is (expected, not a Base44 outage).
 *  - Once Base44 is detected as down, all subsequent calls use local mode
 *    until the page is reloaded (avoids repeated network hangs).
 */

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Returns true when `e` is a network/infrastructure failure rather than an
 * application-level error (401, 403, 404, 422, …).
 */
const isNetworkError = (e) => {
  if (e instanceof TypeError && /fetch|network/i.test(e.message)) return true;
  const s = e?.status ?? e?.response?.status;
  if (!s || s === 0 || s >= 500) return true;
  return false;
};

// ─── Raw Base44 client (null when init fails or appId missing) ────────────────

let _raw = null;

try {
  const { appId, token, functionsVersion, appBaseUrl } = appParams;
  if (appId) {
    _raw = createClient({ appId, token, functionsVersion, serverUrl: '', requiresAuth: false, appBaseUrl });
  }
} catch (e) {
  console.warn('[Vivi] Base44 SDK init failed — running in local mode:', e?.message);
}

/**
 * Three-state availability flag:
 *   null  = not yet determined
 *   true  = Base44 reachable
 *   false = Base44 unavailable, use local fallback
 */
let _available = null;

/** Probe Base44 once and cache the result. */
async function probeBase44() {
  if (_available !== null) return _available;
  if (!_raw) { _available = false; return false; }
  try {
    await _raw.auth.me();
    _available = true;
  } catch (e) {
    // 401 / 403 → server is UP, user just not authenticated.
    _available = (e?.status === 401 || e?.status === 403) ? true : false;
  }
  return _available;
}

// ─── Local entity store (localStorage CRUD) ───────────────────────────────────

class LocalStore {
  constructor(name) {
    this._key = `vivi_db_${name}`;
  }
  _load() {
    try { return JSON.parse(localStorage.getItem(this._key) || '[]'); } catch { return []; }
  }
  _save(arr) {
    try { localStorage.setItem(this._key, JSON.stringify(arr)); } catch {}
  }

  async list(_sort, limit = 200) {
    const items = this._load();
    return items.slice(-Math.max(1, limit)).reverse();
  }
  async filter(query = {}, _sort, limit = 200) {
    const items = this._load().filter(i =>
      Object.entries(query).every(([k, v]) => i[k] === v)
    );
    return items.slice(-Math.max(1, limit));
  }
  async create(data) {
    const all = this._load();
    const record = { id: uid(), created_date: new Date().toISOString(), ...data };
    all.push(record);
    this._save(all);
    return record;
  }
  async update(id, patch) {
    const all = this._load();
    const idx = all.findIndex(i => i.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...patch };
    this._save(all);
    return all[idx];
  }
  async delete(id) {
    this._save(this._load().filter(i => i.id !== id));
  }
  async deleteMany(query = {}) {
    const entries = Object.entries(query);
    this._save(
      this._load().filter(i => !entries.every(([k, v]) => i[k] === v))
    );
  }
  async bulkCreate(records) {
    const all = this._load();
    const created = records.map(r => ({ id: uid(), created_date: new Date().toISOString(), ...r }));
    this._save([...all, ...created]);
    return created;
  }
}

const _stores = {};
const store = (name) => (_stores[name] ??= new LocalStore(name));

// ─── Local auth ───────────────────────────────────────────────────────────────

const LOCAL_AUTH_KEY = 'vivi_local_auth';

const localAuth = {
  _get() { try { return JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY)); } catch { return null; } },
  _set(u) { try { localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(u)); } catch {} },
  _clear() { try { localStorage.removeItem(LOCAL_AUTH_KEY); } catch {} },

  async me() {
    const u = this._get();
    if (!u) { const e = new Error('Not authenticated'); e.status = 401; throw e; }
    return u;
  },
  async loginViaEmailPassword(email, _password) {
    const user = { id: btoa(email).replace(/=/g, ''), email, display_name: email.split('@')[0], role: 'user', is_founder: false };
    this._set(user);
    return user;
  },
  loginWithProvider(_provider, redirect = '/') {
    window.location.href = `/login?local=1&from=${encodeURIComponent(redirect)}`;
  },
  async register({ email, _password }) { return { success: true }; },
  async verifyOtp({ email, _otpCode }) {
    const user = { id: btoa(email).replace(/=/g, ''), email, display_name: email.split('@')[0], role: 'user', is_founder: false };
    this._set(user);
    return { access_token: btoa(`${email}:${Date.now()}`), user };
  },
  async resendOtp(_email) { return { success: true }; },
  setToken(_token) { /* no-op in local mode */ },
  async resetPasswordRequest(_email) { return { success: true }; },
  async resetPassword(_opts) { return { success: true }; },
  logout(redirect) {
    this._clear();
    if (typeof redirect === 'string') window.location.href = redirect;
    else if (redirect === undefined) window.location.href = '/';
  },
  redirectToLogin(returnUrl) {
    window.location.href = `/login${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`;
  },
  async updateMe(patch) {
    const user = this._get() || {};
    const updated = { ...user, ...patch };
    this._set(updated);
    return updated;
  },
};

// ─── Local integrations ───────────────────────────────────────────────────────

const localIntegrations = {
  Core: {
    async InvokeLLM({ responseType } = {}) {
      console.warn('[Vivi] Base44 unavailable — LLM call skipped');
      const msg =
        'Lo siento, el servicio de inteligencia artificial no está disponible ahora mismo. ' +
        'Estoy trabajando en modo local. Por favor, verifica tu conexión o configuración de Base44.';
      return responseType === 'json_object' ? {} : msg;
    },
    async GenerateSpeech() {
      // Primary TTS (browser SpeechSynthesis) is handled by ViviVoice directly.
      // This cloud-TTS fallback just returns null so ViviVoice's error handler fires.
      return null;
    },
    async GenerateImage() {
      console.warn('[Vivi] Base44 unavailable — image generation skipped');
      return null;
    },
    async UploadFile({ file } = {}) {
      if (!file) return { file_url: null };
      return { file_url: URL.createObjectURL(file) };
    },
    async ExtractDataFromUploadedFile() {
      return {};
    },
  },
};

// ─── Proxy builders ───────────────────────────────────────────────────────────

/** Mark Base44 as down and log once. */
function markDown(context) {
  if (_available !== false) {
    _available = false;
    console.warn(`[Vivi] Base44 unreachable (${context}) — switched to local mode`);
  }
}

/** Try Base44, fall back to local on network error. */
async function tryBase44(base44Fn, localFn, context) {
  if (_available === false || !_raw) return localFn();
  try {
    const result = await base44Fn();
    _available = true;
    return result;
  } catch (e) {
    if (isNetworkError(e)) {
      markDown(context);
      return localFn();
    }
    throw e;
  }
}

/** Synchronous pass-through with try/catch (for redirects, setToken, etc.). */
function tryBase44Sync(base44Fn, localFn, context) {
  if (_available === false || !_raw) return localFn();
  try {
    return base44Fn();
  } catch {
    markDown(context);
    return localFn();
  }
}

// ─── Auth proxy ───────────────────────────────────────────────────────────────

const authProxy = {
  me: () => tryBase44(() => _raw.auth.me(), () => localAuth.me(), 'auth.me'),
  loginViaEmailPassword: (e, p) =>
    tryBase44(() => _raw.auth.loginViaEmailPassword(e, p), () => localAuth.loginViaEmailPassword(e, p), 'auth.login'),
  loginWithProvider: (provider, redirect) =>
    tryBase44Sync(() => _raw.auth.loginWithProvider(provider, redirect), () => localAuth.loginWithProvider(provider, redirect), 'auth.loginWithProvider'),
  register: (opts) =>
    tryBase44(() => _raw.auth.register(opts), () => localAuth.register(opts), 'auth.register'),
  verifyOtp: (opts) =>
    tryBase44(() => _raw.auth.verifyOtp(opts), () => localAuth.verifyOtp(opts), 'auth.verifyOtp'),
  resendOtp: (email) =>
    tryBase44(() => _raw.auth.resendOtp(email), () => localAuth.resendOtp(email), 'auth.resendOtp'),
  setToken: (token) =>
    tryBase44Sync(() => _raw.auth.setToken(token), () => localAuth.setToken(token), 'auth.setToken'),
  resetPasswordRequest: (email) =>
    tryBase44(() => _raw.auth.resetPasswordRequest(email), () => localAuth.resetPasswordRequest(email), 'auth.resetPasswordRequest'),
  resetPassword: (opts) =>
    tryBase44(() => _raw.auth.resetPassword(opts), () => localAuth.resetPassword(opts), 'auth.resetPassword'),
  logout: (redirect) =>
    tryBase44Sync(() => _raw.auth.logout(redirect), () => localAuth.logout(redirect), 'auth.logout'),
  redirectToLogin: (returnUrl) =>
    tryBase44Sync(() => _raw.auth.redirectToLogin(returnUrl), () => localAuth.redirectToLogin(returnUrl), 'auth.redirectToLogin'),
  updateMe: (patch) =>
    tryBase44(() => _raw.auth.updateMe(patch), () => localAuth.updateMe(patch), 'auth.updateMe'),
};

// ─── Entity proxy ─────────────────────────────────────────────────────────────

const ENTITY_METHODS = ['list', 'filter', 'create', 'update', 'delete', 'deleteMany', 'bulkCreate'];

function makeEntityProxy(name) {
  const local = store(name);
  const proxy = {};
  for (const method of ENTITY_METHODS) {
    proxy[method] = (...args) =>
      tryBase44(
        () => {
          const entity = _raw?.entities?.[name];
          if (!entity || typeof entity[method] !== 'function') return local[method](...args);
          return entity[method](...args);
        },
        () => local[method](...args),
        `entities.${name}.${method}`
      );
  }
  return proxy;
}

const entitiesProxy = new Proxy({}, {
  get(_, name) {
    return makeEntityProxy(String(name));
  },
});

// ─── Integrations proxy ───────────────────────────────────────────────────────

const CORE_METHODS = ['InvokeLLM', 'GenerateSpeech', 'GenerateImage', 'UploadFile', 'ExtractDataFromUploadedFile'];

const coreProxy = {};
for (const method of CORE_METHODS) {
  coreProxy[method] = (...args) =>
    tryBase44(
      () => _raw.integrations.Core[method](...args),
      () => localIntegrations.Core[method](...args),
      `integrations.Core.${method}`
    );
}

const integrationsProxy = { Core: coreProxy };

// ─── Public API ───────────────────────────────────────────────────────────────

export const backend = {
  auth: authProxy,
  entities: entitiesProxy,
  integrations: integrationsProxy,
  /** Async probe — resolves true if Base44 is reachable. */
  isAvailable: probeBase44,
  /** Whether Base44 is currently being used (null = unknown). */
  get available() { return _available; },
};

/** Named export matching the existing import style everywhere else. */
export const base44 = backend;

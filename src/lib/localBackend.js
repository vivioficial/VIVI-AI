/**
 * localBackend.js — Fallback backend when Base44 is unavailable.
 *
 * Provides the same API surface as the Base44 SDK client so that all
 * modules can import `base44` from `@/api/base44Client` and get either the
 * real Base44 backend or this local implementation — zero code changes needed
 * in any consuming module.
 *
 * Storage:  localStorage (entities, user session)
 * LLM:      Direct fetch to OpenAI or Gemini using VITE_* env vars.
 *           Falls back to a safe stub if no API key is configured.
 *
 * Firebase note: this module is structured so that the localStorage calls
 * can be swapped for Firestore with a simple find-and-replace.
 * Set VITE_FIREBASE_* env vars and swap the entityStore implementation.
 */

// ─── Tiny entity store backed by localStorage ─────────────────────────────────

function readStore(name) {
  try {
    return JSON.parse(localStorage.getItem(`vivi_${name}`) || '[]');
  } catch {
    return [];
  }
}

function writeStore(name, rows) {
  try {
    localStorage.setItem(`vivi_${name}`, JSON.stringify(rows));
  } catch {
    // Quota exceeded — discard oldest half.
    try {
      rows.splice(0, Math.floor(rows.length / 2));
      localStorage.setItem(`vivi_${name}`, JSON.stringify(rows));
    } catch { /* silent */ }
  }
}

function genId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hash a password using SHA-256 via SubtleCrypto before storing it.
 * Passwords are NEVER stored as plaintext.
 */
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a CRUD entity object matching the Base44 entities API surface:
 *   Entity.list(sortField?, limit?)
 *   Entity.filter(predicates, sortField?, limit?)
 *   Entity.create(data)
 *   Entity.update(id, patch)
 *   Entity.delete(id)
 */
function makeEntity(name) {
  return {
    list(sortField = '-created_date', limit = 200) {
      let rows = readStore(name);
      const desc = String(sortField).startsWith('-');
      const field = String(sortField).replace(/^-/, '');
      rows.sort((a, b) => {
        const av = a[field] ?? 0;
        const bv = b[field] ?? 0;
        return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
      });
      return Promise.resolve(rows.slice(0, limit));
    },

    filter(predicates = {}, sortField = 'created_date', limit = 200) {
      let rows = readStore(name).filter((row) =>
        Object.entries(predicates).every(([k, v]) => row[k] === v)
      );
      const desc = String(sortField).startsWith('-');
      const field = String(sortField).replace(/^-/, '');
      rows.sort((a, b) => {
        const av = a[field] ?? 0;
        const bv = b[field] ?? 0;
        return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
      });
      return Promise.resolve(rows.slice(0, limit));
    },

    create(data) {
      const rows = readStore(name);
      const row = {
        id: genId(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        ...data,
      };
      rows.push(row);
      writeStore(name, rows);
      return Promise.resolve(row);
    },

    update(id, patch) {
      const rows = readStore(name);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return Promise.reject(new Error(`${name} ${id} not found`));
      rows[idx] = { ...rows[idx], ...patch, updated_date: new Date().toISOString() };
      writeStore(name, rows);
      return Promise.resolve(rows[idx]);
    },

    delete(id) {
      const rows = readStore(name).filter((r) => r.id !== id);
      writeStore(name, rows);
      return Promise.resolve({ id });
    },

    /** Delete all rows matching predicates (Base44 deleteMany compat). */
    deleteMany(predicates = {}) {
      const rows = readStore(name).filter(
        (row) => !Object.entries(predicates).every(([k, v]) => row[k] === v)
      );
      writeStore(name, rows);
      return Promise.resolve({ deleted: true });
    },

    /** Bulk-create rows (Base44 bulkCreate compat). */
    bulkCreate(records = []) {
      const rows = readStore(name);
      const created = records.map((data) => {
        const row = {
          id: genId(),
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          ...data,
        };
        rows.push(row);
        return row;
      });
      writeStore(name, rows);
      return Promise.resolve(created);
    },
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const USER_KEY = 'vivi_local_user';
const TOKEN_KEY = 'vivi_local_token';

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

const localAuth = {
  me() {
    const user = loadUser();
    if (!user) return Promise.reject(Object.assign(new Error('Not authenticated'), { status: 401 }));
    return Promise.resolve(user);
  },

  updateMe(patch) {
    const user = loadUser();
    if (!user) return Promise.reject(new Error('Not authenticated'));
    const updated = { ...user, ...patch };
    saveUser(updated);
    return Promise.resolve(updated);
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  async loginViaEmailPassword(email, password) {
    // Local mode: compare hashed passwords.
    const hash = await hashPassword(password);
    const users = readStore('_users');
    const user = users.find((u) => u.email === email && u._passwordHash === hash);
    if (!user) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    const { _passwordHash: _unusedPasswordHash, ...safe } = user;
    saveUser(safe);
    localStorage.setItem(TOKEN_KEY, genId());
    return safe;
  },

  async register({ email, password }) {
    const users = readStore('_users');
    if (users.find((u) => u.email === email)) {
      throw new Error('An account with this email already exists');
    }
    // Store pending registration with hashed password; OTP flow is skipped in local mode.
    const hash = await hashPassword(password);
    const pending = { email, _passwordHash: hash, _pending: true };
    writeStore('_pending_registrations', [
      ...readStore('_pending_registrations'),
      pending,
    ]);
    return { email, requires_otp: false };
  },

  async verifyOtp({ email }) {
    // Local mode: auto-approve.
    const pending = readStore('_pending_registrations');
    const entry = pending.find((p) => p.email === email);
    if (!entry) throw new Error('No pending registration found for this email');

    const users = readStore('_users');
    const { _pending: _unusedPending, ...userData } = entry;
    const newUser = {
      id: genId(),
      email,
      display_name: email.split('@')[0],
      role: 'user',
      is_founder: false,
      created_date: new Date().toISOString(),
      ...userData,
    };
    users.push(newUser);
    writeStore('_users', users);
    writeStore('_pending_registrations', pending.filter((p) => p.email !== email));

    const { _passwordHash: _unusedPasswordHash, ...safe } = newUser;
    const token = genId();
    saveUser(safe);
    localStorage.setItem(TOKEN_KEY, token);
    return { access_token: token, user: safe };
  },

  async resendOtp(email) {
    // Local mode: no-op.
    console.info('[localBackend] resendOtp called for', email, '(local mode: no-op)');
    return { sent: true };
  },

  logout(redirectUrl) {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    if (redirectUrl) window.location.href = redirectUrl;
  },

  redirectToLogin(returnUrl) {
    window.location.href = `/login${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`;
  },

  loginWithProvider(_provider, _redirectUrl) {
    // Local mode: OAuth providers not supported; redirect to manual login.
    console.warn('[localBackend] OAuth not supported in local mode. Redirecting to /login.');
    window.location.href = '/login';
  },

  async resetPasswordRequest(email) {
    // Local mode: simulate sending a reset link.
    console.info('[localBackend] resetPasswordRequest called for', email, '(local mode: no-op)');
    // Store a reset token tied to the email so resetPassword can verify it.
    const token = genId();
    const resets = readStore('_resets');
    resets.push({ email, token, created: Date.now() });
    writeStore('_resets', resets);
    return { sent: true, _dev_token: token };
  },

  async resetPassword({ resetToken, newPassword }) {
    const resets = readStore('_resets');
    const entry = resets.find((r) => r.token === resetToken);
    if (!entry) throw new Error('Invalid or expired reset link');

    const users = readStore('_users');
    const idx = users.findIndex((u) => u.email === entry.email);
    if (idx === -1) throw new Error('Account not found');

    // Hash new password before storing — never store passwords as plaintext.
    users[idx]._passwordHash = await hashPassword(newPassword);
    writeStore('_users', users);
    writeStore('_resets', resets.filter((r) => r.token !== resetToken));
    return { success: true };
  },
};

// ─── LLM integrations ─────────────────────────────────────────────────────────

async function invokeOpenAI({ prompt, system, model = 'gpt-4o-mini' }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function invokeGemini({ prompt, model = 'gemini-2.0-flash-lite' }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/**
 * InvokeLLM — matches the Base44 `integrations.Core.InvokeLLM` signature.
 * Tries OpenAI → Gemini → stub fallback in that order.
 * The `_add_context_from_internet` parameter is not supported in local mode.
 */
async function InvokeLLM({ prompt, response_json_schema, add_context_from_internet: _add_context_from_internet, model }) {
  let text = null;

  // Prefer OpenAI if key is set.
  if (import.meta.env.VITE_OPENAI_API_KEY) {
    try { text = await invokeOpenAI({ prompt }); } catch (e) { console.warn('[localBackend] OpenAI failed:', e.message); }
  }

  // Fall back to Gemini.
  if (text === null && import.meta.env.VITE_GEMINI_API_KEY) {
    // Map Base44 model identifiers to Gemini model names.
    const geminiModel = model === 'gemini_3_flash' ? 'gemini-2.0-flash' : 'gemini-2.0-flash-lite';
    try { text = await invokeGemini({ prompt, model: geminiModel }); } catch (e) { console.warn('[localBackend] Gemini failed:', e.message); }
  }

  // Final fallback: no LLM configured.
  if (text === null) {
    text = 'Estoy en modo sin conexión. Configura VITE_OPENAI_API_KEY o VITE_GEMINI_API_KEY para habilitar las respuestas de IA.';
  }

  // Parse JSON if a schema was requested.
  if (response_json_schema) {
    try { return JSON.parse(text); } catch { /* return raw text */ }
  }

  return text;
}

/**
 * GenerateSpeech — TTS stub.
 * Base44 provides cloud TTS; in local mode we fall back to the browser's
 * built-in SpeechSynthesis (handled inside ViviVoice). Return null here so
 * ViviVoice's existing browser-TTS branch takes over.
 */
function GenerateSpeech() {
  return Promise.resolve(null);
}

/**
 * UploadFile — file upload stub.
 * In local mode, return a data URL stub so callers don't crash.
 */
function UploadFile({ file } = {}) {
  if (!file) return Promise.resolve({ url: null });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result });
    reader.onerror = () => resolve({ url: null });
    reader.readAsDataURL(file);
  });
}

/**
 * ExtractDataFromUploadedFile — extraction stub.
 * Delegates to InvokeLLM with the file URL if a vision model is available.
 */
async function ExtractDataFromUploadedFile({ file_url, extraction_prompt } = {}) {
  if (!file_url) return null;
  return InvokeLLM({
    prompt: extraction_prompt || `Extrae y resume el contenido del archivo: ${file_url}`,
  });
}

/**
 * GenerateImage — image generation stub.
 * In local mode, return a placeholder so callers don't crash.
 */
function GenerateImage({ prompt } = {}) {
  console.warn('[localBackend] GenerateImage not supported in local mode. Prompt:', prompt);
  return Promise.resolve({ url: null, error: 'Image generation requires Base44 or a configured image API.' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const localBackend = {
  auth: localAuth,

  entities: {
    Memory: makeEntity('Memory'),
    Conversation: makeEntity('Conversation'),
    ChatMessage: makeEntity('ChatMessage'),
    User: makeEntity('User'),
    ImprovementProposal: makeEntity('ImprovementProposal'),
    ToolAction: makeEntity('ToolAction'),
    KnowledgeEntry: makeEntity('KnowledgeEntry'),
    VenezuelaDollar: makeEntity('VenezuelaDollar'),
    VenezuelaData: makeEntity('VenezuelaData'),
    VenezuelaManualData: makeEntity('VenezuelaManualData'),
  },

  integrations: {
    Core: {
      InvokeLLM,
      GenerateSpeech,
      GenerateImage,
      UploadFile,
      ExtractDataFromUploadedFile,
    },
  },

  /** Health check: always passes in local mode. */
  isAvailable() {
    return true;
  },
};

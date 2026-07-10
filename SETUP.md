# Guía de Configuración — Vivi AI

Esta guía cubre la configuración completa de Firebase, OpenAI y Gemini para dejar Vivi AI 100% operativa.

---

## Paso 1: Copiar el archivo de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con los valores de cada sección a continuación. **Nunca subas este archivo a git** — ya está en `.gitignore`.

---

## Paso 2: Configurar Firebase

Firebase proporciona **autenticación**, **base de datos** (Firestore) y **almacenamiento de archivos** (Storage).

### 2.1 Crear el proyecto Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com/)
2. Haz clic en **"Añadir proyecto"**
3. Asigna el nombre: `vivi-ai` (o el que prefieras)
4. Desactiva Google Analytics si no lo necesitas → **Crear proyecto**

### 2.2 Registrar la aplicación web

1. En el panel del proyecto, haz clic en el icono **`</>`** (Web)
2. Asigna el apodo: `Vivi AI Web`
3. **No** actives Firebase Hosting aquí (se configura por separado si se desea)
4. Haz clic en **"Registrar app"**

### 2.3 Copiar las credenciales

Firebase mostrará un bloque como este:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Copia cada valor al `.env.local`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 2.4 Habilitar Authentication

1. En el menú izquierdo → **Build → Authentication**
2. Haz clic en **"Comenzar"**
3. En la pestaña **"Sign-in method"**, habilita:
   - ✅ **Correo electrónico/contraseña**
   - ✅ **Google** (requiere configurar el correo de soporte del proyecto)

### 2.5 Habilitar Firestore Database

1. En el menú → **Build → Firestore Database**
2. Haz clic en **"Crear base de datos"**
3. Selecciona la región más cercana (ej: `us-central1` o `southamerica-east1`)
4. Elige **"Comenzar en modo de producción"**
5. Haz clic en **"Habilitar"**

**Reglas de seguridad de Firestore** — pega esto en la pestaña "Reglas":

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cada usuario solo accede a sus propios documentos
    match /{collection}/{docId} {
      allow read, write: if request.auth != null
        && (resource == null || resource.data.created_by_id == request.auth.uid);
      allow create: if request.auth != null;
    }
  }
}
```

### 2.6 Habilitar Firebase Storage

1. En el menú → **Build → Storage**
2. Haz clic en **"Comenzar"**
3. Acepta las reglas por defecto
4. Selecciona la región (igual que Firestore)

**Reglas de Storage** — pega esto en la pestaña "Reglas":

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Paso 3: Configurar OpenAI (Recomendado)

OpenAI habilita: **respuestas GPT-4**, **imágenes DALL-E**, **voz TTS (Paulina)** y **visión de archivos**.

### 3.1 Obtener API Key

1. Ve a [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Haz clic en **"Create new secret key"**
3. Asigna el nombre: `vivi-ai`
4. Copia la clave (solo se muestra una vez)

### 3.2 Configurar en .env.local

```env
VITE_OPENAI_API_KEY=sk-proj-...
VITE_OPENAI_MODEL=gpt-4o-mini
```

> **Modelos disponibles:**
> - `gpt-4o-mini` — Rápido, económico, recomendado para producción
> - `gpt-4o` — Más potente, mayor costo
> - `gpt-4-turbo` — Equilibrio entre velocidad y capacidad

### 3.3 Habilitar facturación

OpenAI requiere un método de pago activo. Ve a [platform.openai.com/settings/billing](https://platform.openai.com/settings/billing) y añade una tarjeta.

> **Tip de costos:** Con `gpt-4o-mini`, el uso típico de un asistente conversacional cuesta aproximadamente $0.01–$0.05 USD por hora de uso intensivo.

---

## Paso 4: Configurar Google Gemini (Alternativa a OpenAI)

Si prefieres usar Gemini en lugar de (o además de) OpenAI:

### 4.1 Obtener API Key

1. Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Haz clic en **"Create API key"**
3. Selecciona tu proyecto de Google Cloud (o crea uno nuevo)
4. Copia la clave

### 4.2 Configurar en .env.local

```env
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-1.5-flash
```

> **Modelos disponibles:**
> - `gemini-1.5-flash` — Rápido y económico, recomendado
> - `gemini-1.5-pro` — Mayor capacidad de razonamiento
> - `gemini-2.0-flash-exp` — Experimental, más reciente

> **Prioridad:** Si tienes ambas claves configuradas, Vivi usa **OpenAI primero** y Gemini como respaldo. Si solo configuras Gemini, Vivi lo usa exclusivamente.

---

## Paso 5: Archivo .env.local completo

Ejemplo completo con todos los valores configurados:

```env
# ── Firebase ──────────────────────────────────────────────────
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_FIREBASE_STORAGE_BUCKET=mi-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# ── OpenAI ────────────────────────────────────────────────────
VITE_OPENAI_API_KEY=sk-proj-...
VITE_OPENAI_MODEL=gpt-4o-mini

# ── Gemini (opcional, alternativa a OpenAI) ───────────────────
# VITE_GEMINI_API_KEY=AIzaSy...
# VITE_GEMINI_MODEL=gemini-1.5-flash

# ── App ───────────────────────────────────────────────────────
VITE_APP_NAME=Vivi AI
VITE_APP_VERSION=1.0.0
```

---

## Paso 6: Ejecutar y verificar

```bash
npm run dev
```

Al abrir `http://localhost:5173`:

1. ✅ La pantalla de login debe aparecer
2. ✅ Registra una cuenta nueva → debe enviarte email de verificación
3. ✅ Inicia sesión → verás el avatar de Vivi
4. ✅ Toca la pantalla → Vivi comienza a escuchar
5. ✅ Habla → Vivi responde con voz

Si algo falla, revisa la consola del navegador (`F12 → Console`) para mensajes de error.

---

## Configuración del Founder

El perfil de Founder da acceso especial al panel de control avanzado y al saludo personalizado de Vivi.

Para marcar una cuenta como Founder:

1. En Firebase Console → Firestore → colección `users`
2. Busca el documento con el UID de tu usuario
3. Añade el campo: `is_founder: true` (tipo: boolean)

O bien, desde la consola de Firebase con el SDK Admin:
```js
await db.collection('users').doc(uid).set({ is_founder: true }, { merge: true });
```

---

## Solución de Problemas Comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Firebase not configured" en consola | Variables VITE_FIREBASE_* vacías | Verifica `.env.local` y reinicia `npm run dev` |
| Login falla silenciosamente | Auth no habilitada en Firebase | Habilita Email/Password en Firebase Console |
| Vivi no responde texto | API key LLM ausente o inválida | Verifica VITE_OPENAI_API_KEY o VITE_GEMINI_API_KEY |
| Vivi no habla (sin sonido) | Sin micrófono/altavoz, o HTTPS requerido | En producción usar HTTPS; en local Chrome permite HTTP |
| Error 403 en Firestore | Reglas de seguridad incorrectas | Pega las reglas del Paso 2.5 |
| Error CORS en Storage | Bucket no configurado | Verifica VITE_FIREBASE_STORAGE_BUCKET |

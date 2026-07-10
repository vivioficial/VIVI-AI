# Vivi AI — Arquitectura del Sistema

> **Versión:** Vivi AI Recovery Stable v1.0  
> **Estado:** Totalmente operativa en modo local (localBackend).  
> **Próxima fase:** Integración Firebase / OpenAI / Gemini (sin modificar módulos).

---

## Tabla de Contenidos

1. [Visión general](#1-visión-general)
2. [Diagrama de capas](#2-diagrama-de-capas)
3. [Capa de abstracción de backend](#3-capa-de-abstracción-de-backend)
4. [Sistema de módulos](#4-sistema-de-módulos)
5. [Catálogo de módulos](#5-catálogo-de-módulos)
6. [Bus de eventos](#6-bus-de-eventos)
7. [Flujo de conversación](#7-flujo-de-conversación)
8. [Flujo de voz](#8-flujo-de-voz)
9. [Flujo de memoria](#9-flujo-de-memoria)
10. [Flujo del avatar](#10-flujo-del-avatar)
11. [Cómo conectar Firebase](#11-cómo-conectar-firebase)
12. [Cómo conectar OpenAI / Gemini](#12-cómo-conectar-openai--gemini)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Comandos de desarrollo](#14-comandos-de-desarrollo)

---

## 1. Visión general

Vivi es una asistente personal de IA con voz, avatar animado y memoria persistente.
La arquitectura está diseñada en capas desacopladas: los **módulos** nunca se
llaman directamente entre sí — se comunican a través de un **EventBus** central.
El **backend** (localStorage, Base44, o Firebase) es intercambiable sin tocar
ningún módulo.

```
┌──────────────────────────────────────────────────────────────┐
│                          React UI                            │
│         src/pages/Vivi.jsx · src/components/vivi/            │
│                  ↕  useVivi() hook                           │
├──────────────────────────────────────────────────────────────┤
│                   Sistema de Módulos                         │
│   ViviCore · ViviVoice · ViviAvatar · ViviMemory · …        │
│              ↕  EventBus (pub/sub)                           │
├──────────────────────────────────────────────────────────────┤
│              Capa de Abstracción de Backend                  │
│     src/api/base44Client.js  →  src/lib/localBackend.js      │
│           (swappable: Base44 | Firebase | local)             │
├──────────────────────────────────────────────────────────────┤
│               Almacenamiento / LLM / Voz                     │
│   localStorage · OpenAI · Gemini · Web SpeechSynthesis       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Diagrama de capas

```
src/
├── api/
│   └── base44Client.js        ← Punto de entrada único para el backend
│
├── lib/
│   ├── localBackend.js        ← Implementación local (localStorage + LLM)
│   ├── AuthContext.jsx        ← React context de autenticación
│   ├── app-params.js          ← Parámetros de configuración (env + URL)
│   └── query-client.js        ← TanStack Query config
│
├── vivi/
│   ├── index.js               ← Bootstrap: crea bus, registra módulos, inicia
│   ├── events.js              ← Registro central de nombres de eventos
│   ├── emotionConfig.js       ← Paleta de emociones del avatar
│   ├── core/
│   │   ├── EventBus.js        ← Pub/sub desacoplado
│   │   ├── ModuleBase.js      ← Contrato base de todos los módulos
│   │   └── ModuleRegistry.js  ← Ciclo de vida: register → init → swap → destroy
│   ├── modules/               ← 30+ módulos independientes
│   ├── hooks/
│   │   └── useVivi.js         ← Único puente React ↔ sistema de módulos
│   └── tools/                 ← Herramientas auxiliares de módulos
│
├── pages/                     ← Páginas React
└── components/                ← Componentes UI
```

---

## 3. Capa de abstracción de backend

**Archivo:** `src/api/base44Client.js`

Este archivo es la única importación de backend en todo el proyecto.
Todos los módulos usan `import { base44 } from '@/api/base44Client'`.

```js
// Decisión automática en tiempo de ejecución:
export const base44 = isBase44Configured
  ? (getBase44Client() ?? localBackend)   // Base44 en la nube
  : localBackend;                          // localStorage + LLM directo
```

### API pública del backend (implementada por localBackend y Base44 SDK)

```
base44.auth.me()                          → usuario autenticado
base44.auth.updateMe(patch)               → actualizar perfil
base44.auth.loginViaEmailPassword(e, p)   → login local
base44.auth.logout(redirectUrl)           → cerrar sesión
base44.auth.redirectToLogin(returnUrl)    → redirigir a login

base44.entities.Memory.list(sort, limit)         → listar memorias
base44.entities.Memory.filter(predicates)        → filtrar memorias
base44.entities.Memory.create(data)              → crear memoria
base44.entities.Memory.update(id, patch)         → actualizar
base44.entities.Memory.delete(id)                → eliminar
base44.entities.ChatMessage.list(sort, limit)    → historial de chat
base44.entities.Conversation.*                   → conversaciones
base44.entities.User.*                           → usuarios
base44.entities.ImprovementProposal.*            → propuestas VDE
base44.entities.ToolAction.*                     → acciones TOOR
base44.entities.KnowledgeEntry.*                 → base de conocimiento

base44.integrations.Core.InvokeLLM(params)       → llamada al LLM
base44.integrations.Core.GenerateSpeech(params)  → TTS en la nube
base44.integrations.Core.GenerateImage(params)   → generación de imagen
base44.integrations.Core.UploadFile(params)      → subir archivo
base44.integrations.Core.ExtractDataFromUploadedFile(params)
```

### localBackend (modo offline)

**Archivo:** `src/lib/localBackend.js`

- **Auth:** SHA-256 hash para contraseñas. Token local en `localStorage`.
- **Entities:** CRUD completo en `localStorage` (clave `vivi_{EntityName}`).
- **InvokeLLM:** Intenta OpenAI → Gemini → stub de texto plano (en ese orden).
- **GenerateSpeech:** Devuelve `null`; ViviVoice usa `SpeechSynthesis` del navegador.
- **UploadFile:** Lee el archivo como `data URL` usando `FileReader`.

---

## 4. Sistema de módulos

### EventBus (`src/vivi/core/EventBus.js`)

Pub/sub simple y síncrono. Los módulos se suscriben a eventos en `init()` y
se dan de baja automáticamente en `destroy()`.

```js
bus.on(EVENTS.VOICE_USER_SPEECH, handler)   // → devuelve función unsub
bus.emit(EVENTS.CORE_REPLY, payload)
bus.off(event, handler)
```

### ModuleBase (`src/vivi/core/ModuleBase.js`)

Contrato que todos los módulos extienden:

| Método | Descripción |
|--------|-------------|
| `init(registry)` | Inicialización asíncrona. Se llama automáticamente. |
| `destroy()` | Limpieza de listeners y recursos. |
| `subscribe(event, handler)` | Suscripción auto-limpiada al destruir. |
| `emit(event, payload)` | Emitir evento en el bus. |
| `safe(fn, fallback)` | Ejecutar con aislamiento de errores. |
| `health()` | Reporte de salud del módulo. |

### ModuleRegistry (`src/vivi/core/ModuleRegistry.js`)

Gestiona el ciclo de vida:

```js
registry.register(module)       // registrar
registry.initAll()              // iniciar todos en orden
registry.get('core')            // obtener por nombre
registry.swap('core', newMod)   // hot-swap sin afectar otros módulos
registry.healthCheck()          // diagnóstico completo
```

### Bootstrap (`src/vivi/index.js`)

Singleton `getVivi()` — crea el bus, registra todos los módulos, los inicia.
La UI accede al sistema completo a través de este singleton vía `useVivi()`.

---

## 5. Catálogo de módulos

### Módulos principales (operativos en v1.0)

| Módulo | Nombre interno | Responsabilidad |
|--------|----------------|-----------------|
| `ViviCore` | `core` | Cerebro de conversación. Recibe input, construye contexto, llama al LLM, emite respuesta. |
| `ViviVoice` | `voice` | STT (Web Speech API) + TTS (SpeechSynthesis / Base44 cloud). Máquina de estados half-duplex. |
| `ViviAvatar` | `avatar` | Controlador de estado visual. Escucha eventos y emite `AVATAR_STATE_CHANGE`. |
| `ViviMemory` | `memory` | Memoria persistente. Carga contexto permanente al inicio, extrae hechos de cada turno. |
| `ViviSettings` | `settings` | Preferencias del usuario (idioma, voz, perfil). |
| `ViviReasoning` | `reasoning` | Análisis de intención y verificación de hechos antes de responder. |
| `ViviConversationEngine` | `conversation_engine` | Detección de temas, seguimiento de contexto, resumen de conversaciones largas. |
| `ViviEmotionEngine` | `emotion_engine` | Análisis emocional del texto. Emite `AVATAR_EMOTION` para el avatar. |

### Módulos extendidos

| Módulo | Nombre interno | Responsabilidad |
|--------|----------------|-----------------|
| `ViviSecurity` | `security` | Control de acceso, autenticación del fundador. |
| `ViviFounderAuth` | `founder_auth` | Reconocimiento especial del fundador de HRYET. |
| `ViviFounderConsole` | `founder_console` | Panel de diagnóstico avanzado para el fundador. |
| `ViviKnowledge` | `knowledge` | Base de conocimiento estructurada. |
| `ViviRealtimeFacts` | `realtime_facts` | Hechos en tiempo real (dólar venezolano, clima, etc.). |
| `ViviVenezuela` | `venezuela` | Datos económicos de Venezuela via API. |
| `ViviVenezuelaManual` | `venezuela_manual` | Datos manuales de Venezuela (Academia). |
| `ViviVAD` | `vad` | Voice Activity Detection — barge-in (interrupción). |
| `ViviTOOR` | `toor` | Herramientas autónomas (TOOR = Tool-Oriented Operation Runtime). |
| `ViviBaseBrain` | `base_brain` | Razonamiento base, sin LLM. |
| `ViviVDE` | `vde` | Vivi Development Engine — propuestas de auto-mejora. |
| `ViviVisionEngine` | `vision_engine` | Análisis de imágenes con LLM. |
| `ViviAudioEngine` | `audio_engine` | Análisis de audio. |
| `ViviLearningEngine` | `learning_engine` | Motor de aprendizaje continuo. |
| `ViviIntegrations` | `integrations` | Integraciones externas (webhooks, APIs). |
| `ViviNotifications` | `notifications` | Sistema de notificaciones UI. |
| `ViviLogger` | `logger` | Log centralizado de eventos del sistema. |
| `ViviApi` | `api` | API pública del sistema para uso externo. |

---

## 6. Bus de eventos

Todos los nombres de eventos están en `src/vivi/events.js`.
Nunca usar strings literales — siempre importar `EVENTS`.

### Eventos críticos del flujo de conversación

```
VOICE_LISTENING_START    → avatar: listening
VOICE_USER_SPEECH        → core procesa el texto
CORE_THINKING            → avatar: thinking
CORE_REPLY               → voice habla la respuesta
VOICE_SPEAKING_START     → avatar: speaking
VOICE_SPEAKING_END       → avatar: idle → auto-resume listening
```

### Eventos de memoria

```
MEMORY_RECALLED          → contexto cargado al inicio
MEMORY_STORED            → nueva memoria guardada
```

### Eventos del avatar

```
AVATAR_STATE_CHANGE      → nuevo estado visual (idle/listening/thinking/speaking)
AVATAR_GESTURE           → gesto (nod/doubt/null)
AVATAR_EMOTION           → emoción (neutral/happy/curious/sad/…)
```

---

## 7. Flujo de conversación

```
Usuario habla / escribe
        │
        ▼
   ViviVoice (STT)
   emite VOICE_USER_SPEECH
        │
        ▼
   ViviCore.handleInput(text)
   ├── ViviReasoning.analyze(text)      → análisis de intención
   ├── ViviMemory.recall()              → contexto de memorias
   ├── ViviConversationEngine.summarize() → resumen si conversación larga
   ├── emite CORE_THINKING
   ├── base44.integrations.Core.InvokeLLM(prompt + contexto)
   └── emite CORE_REPLY { text, confidence }
        │
        ▼
   ViviVoice.speak(text)
   emite VOICE_SPEAKING_START → VOICE_SPEAKING_END
        │
        ▼
   Auto-resume listening (conversación continua)
```

---

## 8. Flujo de voz

### STT (Speech-to-Text)
- Motor: `window.SpeechRecognition` (Web Speech API del navegador)
- Idioma: configurable por el usuario via `ViviSettings`
- Modo: continuo con interim results
- Barge-in: `ViviVAD` detecta actividad de voz y cancela TTS si el usuario interrumpe

### TTS (Text-to-Speech)
- **Modo local:** `window.speechSynthesis` (SpeechSynthesis API del navegador)
- **Modo Base44 cloud:** `base44.integrations.Core.GenerateSpeech()` → audio URL → `<audio>`
- **Modo futuro Firebase:** conectar a ElevenLabs / Google Cloud TTS via `localBackend` swap

### Máquina de estados ViviVoice
```
IDLE → LISTENING → THINKING → SPEAKING → IDLE (y vuelta)
```
Half-duplex: Vivi no se escucha a sí misma mientras habla.

---

## 9. Flujo de memoria

```
Inicio de sesión
├── ViviMemory.loadPermanentContext()
│   ├── base44.entities.Memory.list()     → todas las memorias del usuario
│   └── base44.entities.ChatMessage.list() → últimos 20 mensajes
│   emite MEMORY_RECALLED
│
Cada turno de conversación
├── ViviCore extrae hechos del intercambio
├── base44.entities.Memory.create({ content, category, importance })
│   emite MEMORY_STORED
│
Recall para el prompt
└── ViviMemory.buildMemoryPrompt()
    → agrupa memorias por categoría
    → construye contexto estructurado para el LLM
```

**Categorías de memoria:** nombre, preferencia, trabajo, empresa, rutina, meta,
idea, recordatorio, calendario, hecho, relación, historia, proyecto, decisión,
documento, tarea, hito.

---

## 10. Flujo del avatar

`ViviAvatar` es una **máquina de estados pura** — zero lógica de IA o voz.

```
Eventos de entrada          Estado visual resultante
─────────────────────────────────────────────────────
VOICE_LISTENING_START    →  listening (aura cian)
VOICE_LISTENING_END      →  idle
CORE_THINKING            →  thinking (aura gris-azul)
VOICE_SPEAKING_START     →  speaking (aura púrpura brillante)
VOICE_SPEAKING_END       →  idle (aura púrpura suave)
AVATAR_GESTURE (nod)     →  gesto de asentimiento 1.5s
AVATAR_GESTURE (doubt)   →  gesto de duda 1.5s
AVATAR_EMOTION (...)     →  emoji + color de aura según emoción
```

El componente React `src/components/vivi/ViviAvatar.jsx` lee el estado
exclusivamente a través del hook `useVivi()`. Nunca accede a módulos directamente.

---

## 11. Cómo conectar Firebase

No se requiere modificar ningún módulo. Solo hay que implementar un nuevo backend
que cumpla la misma API surface que `localBackend`.

### Pasos

1. **Crear `src/lib/firebaseBackend.js`** con la misma estructura que `localBackend.js`:
   ```js
   export const firebaseBackend = {
     auth: { me, updateMe, loginViaEmailPassword, logout, ... },
     entities: {
       Memory: makeFirestoreEntity('memories'),
       ChatMessage: makeFirestoreEntity('chat_messages'),
       ...
     },
     integrations: { Core: { InvokeLLM, GenerateSpeech, ... } },
   };
   ```

2. **Actualizar `src/api/base44Client.js`** para seleccionar el backend:
   ```js
   import { firebaseBackend } from '@/lib/firebaseBackend';
   
   const isFirebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
   
   export const base44 = isFirebaseConfigured
     ? firebaseBackend
     : isBase44Configured
       ? (getBase44Client() ?? localBackend)
       : localBackend;
   ```

3. **Configurar variables de entorno** en `.env.local` (ver sección 13).

4. **Sin tocar ningún otro archivo.** Todos los módulos (`ViviCore`, `ViviMemory`,
   etc.) seguirán importando `base44` de `@/api/base44Client` y funcionarán
   automáticamente con Firebase.

---

## 12. Cómo conectar OpenAI / Gemini

OpenAI y Gemini ya están soportados en `localBackend.js`.
Solo hay que configurar las claves de API en `.env.local`:

```
VITE_OPENAI_API_KEY=sk-...
VITE_GEMINI_API_KEY=AI...
```

### Prioridad de LLM (en `localBackend.js`)
```
1. OpenAI (si VITE_OPENAI_API_KEY está configurado)
2. Gemini (si VITE_GEMINI_API_KEY está configurado)
3. Stub (texto de modo offline — sin API key)
```

### Para usar un modelo específico de OpenAI
Editar `src/lib/localBackend.js` → función `invokeOpenAI`:
```js
async function invokeOpenAI({ prompt, model = 'gpt-4o' }) { ... }
```

### Para agregar un nuevo proveedor LLM
Agregar una función `invokeXxx()` en `localBackend.js` y añadirla a la cadena
en `InvokeLLM()`. **Cero cambios en módulos.**

---

## 13. Variables de entorno

Ver `.env.example` en la raíz del proyecto para la lista completa y documentada.

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `VITE_OPENAI_API_KEY` | No | Habilita GPT-4o-mini como LLM principal |
| `VITE_GEMINI_API_KEY` | No | Habilita Gemini como LLM secundario |
| `VITE_FIREBASE_API_KEY` | No | Habilita Firebase como backend (fase futura) |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | No | Firebase app ID |
| `VITE_BASE44_APP_ID` | No | Habilita Base44 como backend en la nube |

Sin ninguna variable configurada, Vivi funciona completamente en modo local
usando `localStorage` y el stub de IA (sin LLM real).

---

## 14. Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo local
npm run dev

# Compilar para producción
npm run build

# Lint (verificar errores de código)
npm run lint

# Lint con corrección automática
npm run lint:fix

# Vista previa del build de producción
npm run preview
```

---

## Estado de la versión v1.0

| Sistema | Estado | Notas |
|---------|--------|-------|
| Inicio / Boot | ✅ Operativo | Singleton `getVivi()` inicializa todos los módulos |
| Conversación | ✅ Operativo | ViviCore + ViviReasoning + ViviConversationEngine |
| Voz (STT) | ✅ Operativo | Web Speech API del navegador |
| Voz (TTS) | ✅ Operativo | SpeechSynthesis del navegador (local) |
| Memoria | ✅ Operativo | localStorage via localBackend |
| Avatar | ✅ Operativo | Máquina de estados pura, zero dependencias externas |
| LLM (OpenAI) | ✅ Listo | Configurar `VITE_OPENAI_API_KEY` |
| LLM (Gemini) | ✅ Listo | Configurar `VITE_GEMINI_API_KEY` |
| Firebase | ⏸️ Pendiente | Arquitectura preparada, implementación futura |
| Build | ✅ Sin errores | 2308 módulos, 0 errores |
| Lint | ✅ Sin errores | 0 errores, 0 advertencias |

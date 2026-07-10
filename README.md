# Vivi AI — Asistente Personal Inteligente

**Versión:** Recovery Stable v1.0  
**Creado por:** Henrry Moyses García Rojas — HRYET  
**Estado:** ✅ Listo para configuración de credenciales y despliegue en producción

---

Vivi es una asistente personal de inteligencia artificial con voz, personalidad venezolana, memoria persistente y un sistema de módulos completamente desacoplado. El backend es Firebase (auth/Firestore/Storage) + OpenAI o Gemini como LLM.

---

## Inicio Rápido

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd VIVI-AI
npm install
```

### 2. Configurar credenciales

```bash
cp .env.local.example .env.local
# Edita .env.local con tus credenciales (ver SETUP.md para instrucciones detalladas)
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

---

## Credenciales Necesarias

Edita `.env.local` con los valores de tu proyecto:

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Sí | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sí | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Sí | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Sí | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sí | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Sí | Firebase App ID |
| `VITE_OPENAI_API_KEY` | Recomendada | GPT-4, DALL-E, TTS, Vision |
| `VITE_GEMINI_API_KEY` | Alternativa | Google Gemini como LLM |

> **Sin credenciales:** la app arranca en modo demo con Web Speech API y almacenamiento en memoria (no persiste entre sesiones).

Consulta **[SETUP.md](./SETUP.md)** para el proceso completo paso a paso.

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción → `dist/` |
| `npm run lint` | Linter ESLint |
| `npm run lint:fix` | Corrección automática de lint |
| `npm run preview` | Vista previa del build de producción |

---

## Estructura del Proyecto

```
VIVI-AI/
├── src/
│   ├── api/              # base44Client.js — shim de compatibilidad
│   ├── services/         # Firebase, Auth, Firestore, LLM, Storage
│   ├── vivi/             # Sistema central de Vivi
│   │   ├── core/         # EventBus, ModuleBase, ModuleRegistry
│   │   ├── modules/      # 35+ módulos independientes
│   │   ├── hooks/        # useVivi — bridge React ↔ sistema
│   │   ├── tests/        # Tests unitarios de módulos core
│   │   └── index.js      # Bootstrap del sistema singleton
│   ├── pages/            # Pantallas de la aplicación
│   ├── components/       # Componentes React reutilizables
│   ├── hooks/            # useChat, usePullToRefresh, etc.
│   └── lib/              # AuthContext, QueryClient, utilidades
├── public/               # Assets estáticos
├── .env.local.example    # Plantilla de variables de entorno
├── SETUP.md              # Guía de configuración completa
├── CHANGELOG.md          # Historial de cambios
└── docs/                 # Documentación técnica
    ├── ARCHITECTURE.md   # Arquitectura del sistema
    ├── MODULES.md        # Catálogo de módulos
    └── DEPLOYMENT.md     # Guía de despliegue en producción
```

---

## Documentación Técnica

- **[SETUP.md](./SETUP.md)** — Configuración de Firebase, OpenAI y Gemini
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Arquitectura del sistema Vivi
- **[docs/MODULES.md](./docs/MODULES.md)** — Catálogo completo de módulos
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Despliegue en producción
- **[CHANGELOG.md](./CHANGELOG.md)** — Historial de versiones

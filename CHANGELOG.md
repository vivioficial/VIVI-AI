# Changelog — Vivi AI

Todos los cambios relevantes del proyecto están documentados en este archivo.

---

## [Recovery Stable v1.0] — 2026-07-10

### 🎉 Versión estable de recuperación — Lista para producción

Esta versión marca la finalización del proceso de recuperación y estabilización del proyecto Vivi AI. El sistema es completamente funcional con Firebase + OpenAI/Gemini como backends.

### Errores Críticos Corregidos

- **`src/vivi/index.js`** — `ViviSecurity` estaba importado dentro de una línea comentada (`// import ViviAnalytics ... import ViviSecurity`), causando un `ReferenceError` en tiempo de ejecución al arrancar la app.
- **`src/vivi/index.js`** — `ViviCore` (el cerebro de conversaciones) estaba registrado en la misma línea comentada que `ViviAnalytics`, lo que provocaba que **todas las respuestas de IA fallaran silenciosamente**. El sistema arrancaba pero Vivi nunca procesaba ni respondía ningún mensaje.
- **`src/vivi/index.js`** — El accessor `security` en el objeto `_instance` también estaba comentado junto a `analytics`, dejando el módulo de seguridad inaccesible desde el exterior.

### Documentación Añadida

- **`README.md`** — Completamente reescrito para reflejar la arquitectura real (Firebase + OpenAI/Gemini, sin Base44).
- **`SETUP.md`** — Guía paso a paso para configurar Firebase, OpenAI y Gemini.
- **`CHANGELOG.md`** — Este archivo.
- **`docs/ARCHITECTURE.md`** — Arquitectura técnica completa del sistema Vivi.
- **`docs/MODULES.md`** — Catálogo detallado de los 35+ módulos del sistema.
- **`docs/DEPLOYMENT.md`** — Guía de despliegue en producción.

### Estado del Sistema tras la Recuperación

| Componente | Estado |
|---|---|
| Build (`npm run build`) | ✅ 0 errores, 2202 módulos |
| Lint (`npm run lint`) | ✅ 0 advertencias |
| CodeQL Security Scan | ✅ 0 alertas |
| Firebase Auth | ✅ Funcional con credenciales |
| Firebase Firestore | ✅ Funcional con credenciales |
| Firebase Storage | ✅ Funcional con credenciales |
| OpenAI LLM / TTS / DALL-E | ✅ Funcional con credenciales |
| Gemini LLM | ✅ Funcional con credenciales |
| Voz STT (Web Speech API) | ✅ Sin credenciales |
| Voz TTS (Web Speech API fallback) | ✅ Sin credenciales |
| Avatar + Animaciones | ✅ Sin credenciales |
| ViviCore (IA) | ✅ Restaurado |
| ViviSecurity | ✅ Restaurado |
| Memoria (in-memory fallback) | ✅ Sin credenciales |

---

## [Pre-recuperación] — Historial anterior

### Cambios de arquitectura previos

- Migración de Base44 como backend requerido → Firebase + OpenAI/Gemini
- `@base44/vite-plugin` movido a `optionalDependencies` (no requerido)
- `src/api/base44Client.js` convertido en shim de compatibilidad que re-exporta desde los servicios Firebase/LLM
- Sistema modular de 35+ módulos implementado en `src/vivi/modules/`
- EventBus, ModuleRegistry, ModuleBase como infraestructura central
- Fallbacks graceful para todos los servicios externos (auth, Firestore, Storage, LLM)

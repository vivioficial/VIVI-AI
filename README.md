# Vivi AI

Vivi AI is an intelligent AI voice assistant built with modern web technologies.

The project is fully independent from Base44 and uses Firebase + Gemini through a provider adapter architecture.

---

# Technology Stack

- React
- Vite
- Firebase Authentication
- Firebase Firestore
- Firebase Storage
- Google Gemini API
- Web Speech API
- Progressive Web App (PWA)
- Vercel

---

# Requirements

- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

---

# Environment Variables

Create a `.env.local` file:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

VITE_GEMINI_API_KEY=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Never commit `.env.local` or service account credentials.

---

# Development

```bash
npm run dev
```

---

# Production Build

```bash
npm run build
```

Preview production:

```bash
npm run preview
```

---

# Deployment

Production is deployed on Vercel.

Every push to the `main` branch automatically triggers a new production deployment.

Environment variables must be configured inside Vercel before deployment.

---

# Firebase Configuration

Before deploying verify:

- Authentication enabled
- Firestore enabled
- Storage enabled

Authorized domains:

- localhost
- vivi-ai-main.vercel.app

If using a custom domain, add it as well.

---

# Features

- Voice conversations
- Speech Recognition
- Text-to-Speech
- Gemini AI integration
- Firebase Authentication
- Conversation memory
- Animated avatar
- Image analysis
- File uploads
- Tool system
- Provider adapter architecture
- Responsive interface
- Progressive Web App (PWA)

---

# Architecture

Vivi AI uses a provider adapter architecture.

External providers such as Firebase, Gemini, Storage and future AI providers are isolated behind adapters, allowing them to be replaced without changing the application's business logic.

---

# Project Structure

```
src/
 ├── assets/
 ├── components/
 ├── contexts/
 ├── hooks/
 ├── lib/
 │    └── firebase.js
 ├── pages/
 ├── services/
 └── App.jsx
```

---

# Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

---

# Security

- Never hardcode API keys.
- Never commit `.env.local`.
- Never commit Firebase Service Account credentials.
- Rotate compromised keys immediately.
- Store secrets only in Vercel Environment Variables.

---

# License

Copyright © 2026

**Vivi AI**

Created and designed by **Henrry Moisés García Rojas**

All rights reserved.
# Vivi AI

Vivi AI is an intelligent voice assistant built with modern web technologies.

The project no longer depends on Base44.

## Stack

- React
- Vite
- Firebase Authentication
- Firebase Hosting / Firestore
- Google Gemini API
- Web Speech API (Speech Recognition & Speech Synthesis)
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

VITE_GEMINI_API_KEY=
```

Never commit these keys to Git.

---

# Development

Run the application locally:

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

After pushing to GitHub, Vercel automatically builds and deploys the latest version.

---

# Firebase Configuration

Before deploying, verify:

- Firebase Authentication enabled.
- Authorized Domains include:

```
localhost
vivi-ai-main.vercel.app
```

If using a custom domain, add it as well.

---

# Features

- Voice conversations
- Speech-to-Text
- Text-to-Speech
- Gemini AI integration
- Firebase Authentication
- Conversation memory
- Animated avatar
- Responsive interface
- Progressive Web App (PWA)

---

# Project Structure

```
src/
 ├── components/
 ├── pages/
 ├── hooks/
 ├── services/
 ├── lib/
 │    └── firebase.js
 ├── contexts/
 ├── assets/
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

Do not hardcode API keys.

All Firebase credentials must be provided through environment variables.

Remove all demo fallback values before production.

---

# License

Copyright © 2026

Vivi AI

Created by Henrry Moisés García Rojas.

All rights reserved.

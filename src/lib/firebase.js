import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

// Validación estricta para entorno de producción "Fail-Fast"
for (const envVar of requiredEnvVars) {
  const val = import.meta.env[envVar];
  if (!val || val.includes("demo-") || val.trim() === "") {
    throw new Error(`[FATAL] La variable de entorno obligatoria ${envVar} no está definida o contiene un valor demo inválido.`);
  }
}

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDWtwJ0KnHmpkuAda3zivzIIRRKMAHemS0",
  authDomain: "vivi-ai-24a43.firebaseapp.com",
  projectId: "vivi-ai-24a43",
  storageBucket: "vivi-ai-24a43.firebasestorage.app",
  messagingSenderId: "965906696167",
  appId: "1:965906696167:web:009e6ad9ef18128eff5f42",
  measurementId: "G-C300RZYB70"
};

// Evita la duplicación de instancias durante el Hot Module Replacement (HMR) de Vite
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;

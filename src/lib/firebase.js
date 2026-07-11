import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let auth;
let db;
let storage;
let firebaseInitialized = false;

try {
  const required = Object.values(firebaseConfig).every(Boolean);

  if (!required) {
    throw new Error("Missing Firebase environment variables.");
  }

  app = initializeApp(firebaseConfig);

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  setPersistence(auth, browserLocalPersistence).catch(console.warn);

  firebaseInitialized = true;
} catch (error) {
  console.error("Firebase initialization failed:", error);
  firebaseInitialized = false;
}

export {
  app,
  auth,
  db,
  storage,
  firebaseInitialized
};

export default app;

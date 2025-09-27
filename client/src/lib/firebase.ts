import { initializeApp } from "firebase/app";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase config is valid
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;

let app: any = null;
let auth: any = null;
let googleProvider: any = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
  }
}

export { auth, googleProvider };

export const signInWithGoogle = () => {
  if (!auth || !googleProvider) {
    throw new Error("Firebase not configured. Please provide Firebase credentials.");
  }
  return signInWithRedirect(auth, googleProvider);
};

export const handleRedirectResult = () => {
  if (!auth) {
    return Promise.resolve(null);
  }
  return getRedirectResult(auth);
};

export const signOutUser = () => {
  if (!auth) {
    return Promise.resolve();
  }
  return signOut(auth);
};

export const isFirebaseReady = () => {
  return !!auth;
};

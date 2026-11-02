import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyADAEmGgoROCdA3SKUOiA7Qh65HVlNyRIk",
  authDomain: "opandz-backend.firebaseapp.com",
  projectId: "opandz-backend",
  storageBucket: "opandz-backend.firebasestorage.app",
  messagingSenderId: "604541348926",
  appId: "1:604541348926:web:2cdf614c955291dfc8b56f",
  measurementId: "G-NSYKM2BFHD"
};

// Initialize Firebase (singleton — safe for Next.js hot-reloads)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Analytics only runs in the browser (not during SSR)
const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);

export { app, auth, googleProvider, analyticsPromise };

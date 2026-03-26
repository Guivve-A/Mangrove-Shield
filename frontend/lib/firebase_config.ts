import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "studio-8904974087-7cc0a",
  appId: "1:803967894260:web:e6a95c3e2eefb14fb654a1",
  storageBucket: "studio-8904974087-7cc0a.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "studio-8904974087-7cc0a.firebaseapp.com",
  messagingSenderId: "803967894260"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

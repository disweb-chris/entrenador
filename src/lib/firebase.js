import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1wMwZV74g5tjcnqS8ZeGjdWixJD0Rofw",
  authDomain: "entrenador-b3153.firebaseapp.com",
  projectId: "entrenador-b3153",
  storageBucket: "entrenador-b3153.firebasestorage.app",
  messagingSenderId: "678500998412",
  appId: "1:678500998412:web:e78958fd9691b221cbbd29"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

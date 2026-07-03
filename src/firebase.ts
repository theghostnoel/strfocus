import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEe91S-qy9rHk-eSgZvqJgN-SwTi1cquQ",
  authDomain: "aerobic-pursuit-6mvz5.firebaseapp.com",
  projectId: "aerobic-pursuit-6mvz5",
  storageBucket: "aerobic-pursuit-6mvz5.firebasestorage.app",
  messagingSenderId: "1011838344206",
  appId: "1:1011838344206:web:32801c6339275a8260b05f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore with the custom database ID from config
export const db = getFirestore(app, "ai-studio-englishflashcard-8e06dd9e-9243-4eaf-9eea-5248ec123c6b");

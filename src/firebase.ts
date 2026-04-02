import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ai-studio-applet-webapp-8697f.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-8697f",
  storageBucket: "ai-studio-applet-webapp-8697f.firebasestorage.app",
  messagingSenderId: "835273034234",
  appId: "1:835273034234:web:c03ce7ed61a63b231b7c43"
};

const app = initializeApp(firebaseConfig);
// Käytetään käyttäjän nimettyä tietokantaa oletuksen (default) sijaan
export const db = getFirestore(app, "ai-studio-9b4c2e97-b74b-4e1d-a566-ccafac43195d");

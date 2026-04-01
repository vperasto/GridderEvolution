import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCAoXe5ijpLRMZUjmpPTYme3CrFm7wGDOU",
  authDomain: "ai-studio-applet-webapp-8697f.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-8697f",
  storageBucket: "ai-studio-applet-webapp-8697f.firebasestorage.app",
  messagingSenderId: "835273034234",
  appId: "1:835273034234:web:c03ce7ed61a63b231b7c43"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

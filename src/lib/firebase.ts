import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Firebase configuration from the automatically generated file
const firebaseConfig = {
  apiKey: "AIzaSyCBJKJ52Tqo4yu-i8DsLjxeuy79JOn1Emc",
  authDomain: "analytical-scout-vqvh5.firebaseapp.com",
  projectId: "analytical-scout-vqvh5",
  storageBucket: "analytical-scout-vqvh5.firebasestorage.app",
  messagingSenderId: "1045762222280",
  appId: "1:1045762222280:web:1cd7a84dfdf20025d51dfd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-06c44878-7240-46d1-849f-1326be83917b");
export const googleProvider = new GoogleAuthProvider();

// Standard test connection to Firestore as per guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection check successful.");
  } catch (error) {
    console.log("Firestore connection check completed. If you see authorization errors, that is expected until authentication is complete:", error);
  }
}
testConnection();

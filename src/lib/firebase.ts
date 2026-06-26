import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Detect if running in local/mock mode (no real Firebase project)
export const isLocalMode = !firebaseConfig.projectId || firebaseConfig.projectId === 'mock-project';

// Initialize Firebase App (safe even with mock config)
const app = initializeApp(firebaseConfig);

// Initialize Firestore (used only in live mode)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth and Google OAuth Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Only test Firestore connection in live Firebase mode
async function testConnection() {
  if (isLocalMode) {
    console.log('Running in local mode — skipping Firestore connection check.');
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection check successful.');
  } catch (error) {
    console.log('Firestore connection check completed (auth errors expected until signed in):', error);
  }
}
testConnection();

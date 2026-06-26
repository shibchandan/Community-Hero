import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Detect if running in local/mock mode (no real Firebase project)
export const isLocalMode = !firebaseConfig.projectId || firebaseConfig.projectId === 'mock-project';

// Initialize Firebase App (safe even with mock config)
const app = initializeApp(firebaseConfig);

// Initialize Firestore (used only in live mode)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Auth is handled entirely by the custom backend (/api/auth/login & /api/auth/register)
// Firebase Auth is NOT used — this prevents auth/invalid-api-key errors in local mode
export const auth = null;
export const googleProvider = null;

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

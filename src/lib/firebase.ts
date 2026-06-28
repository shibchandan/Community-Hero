import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// isLocalMode: skip Firestore live listeners and use REST API polling when:
// 1. No real Firebase project configured, OR
// 2. Running on localhost (window.location.hostname is localhost/127.0.0.1)
export const isLocalMode =
  !firebaseConfig.projectId ||
  firebaseConfig.projectId === 'mock-project' ||
  (typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname));

// Initialize Firebase App (safe even with mock config)
console.log("Initializing Firebase with real credentials - v1.0.1");
const config = firebaseConfig as any;
const app = initializeApp(config);

// Initialize Firestore (used only in live mode)
export const db = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

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

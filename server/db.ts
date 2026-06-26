import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Issue } from '../src/types';

export interface Credential {
  email: string;
  passwordHash: string;
  userId: string;
}

// Read Firebase configuration dynamically from the config file
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({
    apiKey: "mock_api_key_for_local_fallback",
    authDomain: "mock-project.firebaseapp.com",
    projectId: "mock-project",
    storageBucket: "mock-project.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:1234567890abcdef",
    firestoreDatabaseId: "(default)"
  }, null, 2), 'utf8');
}
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export const isLocalMode = !firebaseConfig.projectId || firebaseConfig.projectId === 'mock-project';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore using the configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Local file storage paths for fallback persistence mode
const usersFile = path.join(process.cwd(), 'server', 'data_users.json');
const issuesFile = path.join(process.cwd(), 'server', 'data_issues.json');
const credentialsFile = path.join(process.cwd(), 'server', 'data_credentials.json');
const sessionFile = path.join(process.cwd(), 'server', 'data_session.json');

// Helper to write JSON files safely
function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

// Helper to read JSON files safely
function readJsonFile(filePath: string): any | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading from ${filePath}:`, err);
  }
  return null;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function getCredential(email: string): Promise<Credential | null> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const creds = readJsonFile(credentialsFile) || {};
    return creds[sanitizedEmail] || null;
  }
  const docRef = doc(db, 'credentials', sanitizedEmail);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Credential;
  }
  return null;
}

export async function saveCredential(email: string, passwordHash: string, userId: string): Promise<void> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const creds = readJsonFile(credentialsFile) || {};
    creds[sanitizedEmail] = { email: sanitizedEmail, passwordHash, userId };
    writeJsonFile(credentialsFile, creds);
    return;
  }
  await setDoc(doc(db, 'credentials', sanitizedEmail), {
    email: sanitizedEmail,
    passwordHash,
    userId
  });
}





// --- Durable Persistence Firestore Helpers ---

export async function getUsers(): Promise<User[]> {
  if (isLocalMode) {
    const list = readJsonFile(usersFile);
    return list || [];
  }
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => doc.data() as User);
}

export async function saveUser(user: User): Promise<void> {
  if (isLocalMode) {
    const list: User[] = await getUsers();
    const idx = list.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    writeJsonFile(usersFile, list);
    return;
  }
  await setDoc(doc(db, 'users', user.id), user);
}

export async function getIssues(): Promise<Issue[]> {
  if (isLocalMode) {
    const list = readJsonFile(issuesFile);
    return list || [];
  }
  const snapshot = await getDocs(collection(db, 'issues'));
  return snapshot.docs.map(doc => doc.data() as Issue);
}

export async function saveIssue(issue: Issue): Promise<void> {
  if (isLocalMode) {
    const list: Issue[] = await getIssues();
    const idx = list.findIndex(i => i.id === issue.id);
    if (idx !== -1) {
      list[idx] = issue;
    } else {
      list.push(issue);
    }
    writeJsonFile(issuesFile, list);
    return;
  }
  await setDoc(doc(db, 'issues', issue.id), issue);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  if (isLocalMode) {
    const list = await getIssues();
    return list.find(i => i.id === id) || null;
  }
  const docRef = doc(db, 'issues', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Issue;
  }
  return null;
}

export async function getCurrentSession(): Promise<User | null> {
  if (isLocalMode) {
    const session = readJsonFile(sessionFile);
    return session ? session.currentUserSession : DEFAULT_USERS[0];
  }
  const docRef = doc(db, 'metadata', 'session');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.currentUserSession || null;
  }
  return null;
}

export async function setCurrentSession(user: User | null): Promise<void> {
  if (isLocalMode) {
    writeJsonFile(sessionFile, { currentUserSession: user });
    return;
  }
  await setDoc(doc(db, 'metadata', 'session'), { currentUserSession: user });
}

// Seeding DB if collections/files are empty (providing a rich initial dataset)


// Distance Calculation utility
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

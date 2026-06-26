import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { User, Issue } from '../src/types';

export interface Credential {
  email: string;
  passwordHash: string;
  userId: string;
}

// isLocalMode: use local JSON files when we don't have a service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : '';
const hasAdminKey = !!serviceAccountPath && fs.existsSync(serviceAccountPath);
export const isLocalMode = !hasAdminKey;

export let db: any = null;

if (!isLocalMode) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  db = getFirestore();
}

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
  const docSnap = await db.collection('credentials').doc(sanitizedEmail).get();
  if (docSnap.exists) {
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
  await db.collection('credentials').doc(sanitizedEmail).set({
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
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((doc: any) => doc.data() as User);
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
  await db.collection('users').doc(user.id).set(user);
}

export async function getIssues(): Promise<Issue[]> {
  if (isLocalMode) {
    const list = readJsonFile(issuesFile);
    return list || [];
  }
  const snapshot = await db.collection('issues').get();
  return snapshot.docs.map((doc: any) => doc.data() as Issue);
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
  await db.collection('issues').doc(issue.id).set(issue);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  if (isLocalMode) {
    const list = await getIssues();
    return list.find(i => i.id === id) || null;
  }
  const docSnap = await db.collection('issues').doc(id).get();
  if (docSnap.exists) {
    return docSnap.data() as Issue;
  }
  return null;
}

export async function getCurrentSession(): Promise<User | null> {
  if (isLocalMode) {
    const session = readJsonFile(sessionFile);
    return session && session.currentUserSession ? session.currentUserSession : null;
  }
  const docSnap = await db.collection('metadata').doc('session').get();
  if (docSnap.exists) {
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
  await db.collection('metadata').doc('session').set({ currentUserSession: user });
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

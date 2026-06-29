import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { User, Issue } from '../src/types';

// Dynamically load the config file if it exists, otherwise fall back to a safe mock config object and auto-write it.
let firebaseConfig: any = {
  apiKey: "mock_api_key_for_local_fallback",
  authDomain: "mock-project.firebaseapp.com",
  projectId: "mock-project",
  storageBucket: "mock-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:1234567890abcdef",
  firestoreDatabaseId: "(default)"
};

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json from server/db.ts:', err);
  }
} else {
  try {
    fs.writeFileSync(configPath, JSON.stringify(firebaseConfig, null, 2), 'utf8');
    console.log('✅ Auto-created missing firebase-applet-config.json at startup of server/db.ts.');
  } catch (err) {
    console.error('Failed to auto-create firebase-applet-config.json:', err);
  }
}

export interface Credential {
  email: string;
  passwordHash: string;
  userId: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

// Determine if we have a valid service account key
const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
const isFilePath = envKey.endsWith('.json') || envKey.startsWith('./');
const serviceAccountPath = isFilePath ? path.resolve(process.cwd(), envKey) : '';
const hasAdminKey = (isFilePath && fs.existsSync(serviceAccountPath)) || (!isFilePath && envKey.includes('{'));

// Set isLocalMode to false if we have a real Firebase project ID, so we can connect to the live DB
export let isLocalMode =
  (!hasAdminKey && (!firebaseConfig.projectId || firebaseConfig.projectId === 'mock-project'));

export let db: any = null;

if (!isLocalMode) {
  try {
    if (getApps().length === 0) {
      if (hasAdminKey) {
        let serviceAccount;
        if (isFilePath) {
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        } else {
          serviceAccount = JSON.parse(envKey);
        }
        initializeApp({
          credential: cert(serviceAccount)
        });
      } else {
        // Fallback to ADC / project config for Cloud Run context
        initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
    }
    const adminApp = getApps()[0];
    db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(adminApp);
  } catch (err) {
    console.error('Failed to initialize Firestore admin, falling back to local JSON mode:', err);
    isLocalMode = true;
  }
}

// Helper to detect if gRPC error is NOT_FOUND (indicating database is not found or not initialized)
function isFirestoreNotFoundError(err: any): boolean {
  const msg = err?.message || '';
  const code = err?.code;
  return code === 5 || 
         msg.includes('NOT_FOUND') || 
         msg.includes('Database') || 
         msg.includes('not found') ||
         msg.includes('5 NOT_FOUND') ||
         msg.includes('does not exist');
}

// Helper to dynamically toggle local mode fallback
function enableLocalModeFallback() {
  if (!isLocalMode) {
    console.warn("⚠️ Firestore database 'default' was not found or is not initialized in your Firebase Project.");
    console.warn("⚠️ Falling back to local JSON file storage so that the app remains fully functional.");
    console.warn("👉 To use Firestore, make sure to click 'Create Database' in the Firestore tab of your Firebase Console.");
    isLocalMode = true;
  }
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
  // Use bcrypt with 10 salt rounds for production-level resistance to brute-force attacks
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
  if (!hash) return false;
  // If the hash starts with a bcrypt identifier, use bcrypt to verify
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, hash);
    } catch (err) {
      console.error('Error in bcrypt compare:', err);
      return false;
    }
  }
  // Fallback for legacy SHA-256 hashes
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  return legacyHash === hash;
}

export function compareSecurityAnswer(answer: string, hash: string): boolean {
  if (!hash) return false;
  const sanitized = answer.toLowerCase().trim();
  // Check using bcrypt first
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(sanitized, hash);
    } catch (err) {
      console.error('Error in bcrypt answer compare:', err);
      return false;
    }
  }
  // Check using legacy SHA-256
  const legacyHash = crypto.createHash('sha256').update(sanitized).digest('hex');
  return legacyHash === hash;
}

export async function getCredential(email: string): Promise<Credential | null> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const creds = readJsonFile(credentialsFile) || {};
    return creds[sanitizedEmail] || null;
  }
  try {
    const docSnap = await db.collection('credentials').doc(sanitizedEmail).get();
    if (docSnap.exists) {
      return docSnap.data() as Credential;
    }
    return null;
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const creds = readJsonFile(credentialsFile) || {};
      return creds[sanitizedEmail] || null;
    }
    throw err;
  }
}

export async function saveCredential(
  email: string,
  passwordHash: string,
  userId: string,
  securityQuestion?: string,
  securityAnswerHash?: string
): Promise<void> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const creds = readJsonFile(credentialsFile) || {};
    creds[sanitizedEmail] = {
      email: sanitizedEmail,
      passwordHash,
      userId,
      securityQuestion,
      securityAnswerHash
    };
    writeJsonFile(credentialsFile, creds);
    return;
  }
  try {
    await db.collection('credentials').doc(sanitizedEmail).set({
      email: sanitizedEmail,
      passwordHash,
      userId,
      securityQuestion: securityQuestion || null,
      securityAnswerHash: securityAnswerHash || null
    });
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const creds = readJsonFile(credentialsFile) || {};
      creds[sanitizedEmail] = {
        email: sanitizedEmail,
        passwordHash,
        userId,
        securityQuestion,
        securityAnswerHash
      };
      writeJsonFile(credentialsFile, creds);
      return;
    }
    throw err;
  }
}





// --- Durable Persistence Firestore Helpers ---

export async function getUsers(): Promise<User[]> {
  if (isLocalMode) {
    const list = readJsonFile(usersFile);
    return list || [];
  }
  try {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map((doc: any) => doc.data() as User);
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const list = readJsonFile(usersFile);
      return list || [];
    }
    throw err;
  }
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
  try {
    await db.collection('users').doc(user.id).set(user);
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
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
    throw err;
  }
}

export async function getIssues(): Promise<Issue[]> {
  if (isLocalMode) {
    const list = readJsonFile(issuesFile);
    return list || [];
  }
  try {
    const snapshot = await db.collection('issues').get();
    return snapshot.docs.map((doc: any) => doc.data() as Issue);
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const list = readJsonFile(issuesFile);
      return list || [];
    }
    throw err;
  }
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
  try {
    await db.collection('issues').doc(issue.id).set(issue);
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
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
    throw err;
  }
}

export async function deleteIssue(id: string): Promise<void> {
  if (isLocalMode) {
    const list: Issue[] = await getIssues();
    const filtered = list.filter(i => i.id !== id);
    writeJsonFile(issuesFile, filtered);
    return;
  }
  try {
    await db.collection('issues').doc(id).delete();
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const list: Issue[] = await getIssues();
      const filtered = list.filter(i => i.id !== id);
      writeJsonFile(issuesFile, filtered);
      return;
    }
    throw err;
  }
}

export async function getIssueById(id: string): Promise<Issue | null> {
  if (isLocalMode) {
    const list = await getIssues();
    return list.find(i => i.id === id) || null;
  }
  try {
    const docSnap = await db.collection('issues').doc(id).get();
    if (docSnap.exists) {
      return docSnap.data() as Issue;
    }
    return null;
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const list = await getIssues();
      return list.find(i => i.id === id) || null;
    }
    throw err;
  }
}

export async function getCurrentSession(): Promise<User | null> {
  if (isLocalMode) {
    const session = readJsonFile(sessionFile);
    return session && session.currentUserSession ? session.currentUserSession : null;
  }
  try {
    const docSnap = await db.collection('metadata').doc('session').get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data.currentUserSession || null;
    }
    return null;
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const session = readJsonFile(sessionFile);
      return session && session.currentUserSession ? session.currentUserSession : null;
    }
    throw err;
  }
}

export async function setCurrentSession(user: User | null): Promise<void> {
  if (isLocalMode) {
    writeJsonFile(sessionFile, { currentUserSession: user });
    return;
  }
  try {
    await db.collection('metadata').doc('session').set({ currentUserSession: user });
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      writeJsonFile(sessionFile, { currentUserSession: user });
      return;
    }
    throw err;
  }
}

// Seeding DB if collections/files are empty (providing a rich initial dataset)
export async function ensureSeededData() {
  try {
    const defaultUsers = [
      {
        id: 'user_admin_shibchandan',
        name: 'Admin Shibchandan',
        email: 'shibchandan11@gmail.com',
        role: 'authority',
        points: 500,
        trust_score: 100,
        badges: ['SLA Champion', 'Civic Mentor', 'City Administrator'],
        completed_reports: 12,
        validations_count: 45,
        area: 'City-Wide Authority'
      },
      {
        id: 'user_aarav',
        name: 'Aarav Sharma',
        email: 'aarav@example.com',
        role: 'citizen',
        points: 280,
        trust_score: 95,
        badges: ['Civic Sentry', 'Supreme Validator'],
        completed_reports: 8,
        validations_count: 22,
        area: 'Connaught Place'
      },
      {
        id: 'user_priya',
        name: 'Priya Patel',
        email: 'priya@example.com',
        role: 'citizen',
        points: 150,
        trust_score: 90,
        badges: ['Pothole Patrol'],
        completed_reports: 4,
        validations_count: 12,
        area: 'Karol Bagh'
      },
      {
        id: 'user_rahul',
        name: 'Rahul Verma',
        email: 'rahul@example.com',
        role: 'citizen',
        points: 90,
        trust_score: 88,
        badges: ['Civic Recruit'],
        completed_reports: 2,
        validations_count: 5,
        area: 'Dwarka'
      }
    ];

    const defaultCredentials: Record<string, Credential> = {
      'shibchandan11@gmail.com': {
        email: 'shibchandan11@gmail.com',
        passwordHash: hashPassword('123456'),
        userId: 'user_admin_shibchandan',
        securityQuestion: 'What was your childhood nickname?',
        securityAnswerHash: hashPassword('hero')
      },
      'aarav@example.com': {
        email: 'aarav@example.com',
        passwordHash: hashPassword('123456'),
        userId: 'user_aarav',
        securityQuestion: 'What was your childhood nickname?',
        securityAnswerHash: hashPassword('hero')
      },
      'priya@example.com': {
        email: 'priya@example.com',
        passwordHash: hashPassword('123456'),
        userId: 'user_priya',
        securityQuestion: 'What was your childhood nickname?',
        securityAnswerHash: hashPassword('hero')
      },
      'rahul@example.com': {
        email: 'rahul@example.com',
        passwordHash: hashPassword('123456'),
        userId: 'user_rahul',
        securityQuestion: 'What was your childhood nickname?',
        securityAnswerHash: hashPassword('hero')
      }
    };

    const defaultIssues = [
      {
        id: 'issue_1',
        category: 'road',
        title: 'Critical Pothole Cluster on Outer Circle',
        description: 'Severe potholes on the main outer circle road near Block E. Multiple motorcyclists have lost balance attempting to avoid them during peak evening hours.',
        status: 'community_verified',
        location: {
          lat: 28.6295,
          lng: 77.2185,
          address: 'Block E, Connaught Place Outer Circle, New Delhi',
          area: 'Connaught Place',
          city: 'New Delhi'
        },
        severity: 'high',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'user_priya',
        reportedByName: 'Priya Patel',
        mediaUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
        department: 'Municipal Highway & Roads Division',
        upvotes: 14,
        downvotes: 1,
        votedUsers: {
          'user_aarav': 'valid',
          'user_rahul': 'valid',
          'user_admin_shibchandan': 'valid'
        },
        comments: [
          {
            id: 'comment_1',
            userId: 'user_aarav',
            userName: 'Aarav Sharma',
            userRole: 'citizen',
            text: 'This is extremely dangerous. I saw a near-accident here yesterday too.',
            createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        timeline: [
          {
            id: 't_1_1',
            status: 'reported',
            title: 'Issue Reported',
            description: 'Reported by Priya Patel.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Priya Patel'
          },
          {
            id: 't_1_2',
            status: 'ai_verified',
            title: 'AI Verification Completed',
            description: 'Auto-categorized as road with high severity. Department routed: Municipal Highway & Roads Division.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Samadhan Setu AI'
          },
          {
            id: 't_1_3',
            status: 'community_verified',
            title: 'Community Verified!',
            description: 'Sufficient upvotes reached to push into government workflow.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Samadhan Setu Platform'
          }
        ],
        slaDays: 7,
        escalated: false,
        escalationDate: null,
        resolutionProofUrl: null,
        resolutionNotes: null,
        resolvedAt: null,
        urgencyReason: 'High hazard for two-wheelers, risk of collision'
      },
      {
        id: 'issue_2',
        category: 'garbage',
        title: 'Overflowing Garbage Compactor and Illegal Dumping',
        description: 'The municipal garbage dump station near Karol Bagh Market is completely overflowing onto the main road. Foul smell is making walking impossible and street dogs are scattering it.',
        status: 'assigned',
        location: {
          lat: 28.6435,
          lng: 77.1915,
          address: 'Near Karol Bagh Metro Station, Karol Bagh, New Delhi',
          area: 'Karol Bagh',
          city: 'New Delhi'
        },
        severity: 'medium',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'user_aarav',
        reportedByName: 'Aarav Sharma',
        mediaUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
        department: 'Sanitation & Waste Disposal Department',
        upvotes: 8,
        downvotes: 0,
        votedUsers: {
          'user_priya': 'valid'
        },
        comments: [],
        timeline: [
          {
            id: 't_2_1',
            status: 'reported',
            title: 'Issue Reported',
            description: 'Reported by Aarav Sharma.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Aarav Sharma'
          },
          {
            id: 't_2_2',
            status: 'ai_verified',
            title: 'AI Verification Completed',
            description: 'Auto-categorized as garbage with medium severity. Department routed: Sanitation & Waste Disposal Department.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Samadhan Setu AI'
          },
          {
            id: 't_2_3',
            status: 'assigned',
            title: 'Government Department Assigned',
            description: 'Assigned to Sanitation & Waste Disposal Department for urgent clearance.',
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            by: 'Admin Shibchandan'
          }
        ],
        slaDays: 3,
        escalated: false,
        escalationDate: null,
        resolutionProofUrl: null,
        resolutionNotes: null,
        resolvedAt: null,
        urgencyReason: 'Sanitary hazard, potential disease vector'
      },
      {
        id: 'issue_3',
        category: 'water',
        title: 'Major Drinking Water Pipeline Leakage',
        description: 'Continuous stream of fresh drinking water leaking from underground joint near Dwarka Sector 10 metro station. Thousands of gallons are being wasted hourly.',
        status: 'in_progress',
        location: {
          lat: 28.5815,
          lng: 77.0595,
          address: 'Dwarka Sector 10 Corridor, New Delhi',
          area: 'Dwarka',
          city: 'New Delhi'
        },
        severity: 'high',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'user_rahul',
        reportedByName: 'Rahul Verma',
        mediaUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
        department: 'Urban Water Resources Board',
        upvotes: 22,
        downvotes: 0,
        votedUsers: {
          'user_admin_shibchandan': 'valid',
          'user_priya': 'valid'
        },
        comments: [
          {
            id: 'comment_3_1',
            userId: 'user_admin_shibchandan',
            userName: 'Admin Shibchandan',
            userRole: 'authority',
            text: 'Dispatched emergency maintenance team to block off water valve and start repairs.',
            createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        timeline: [
          {
            id: 't_3_1',
            status: 'reported',
            title: 'Issue Reported',
            description: 'Reported by Rahul Verma.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Rahul Verma'
          },
          {
            id: 't_3_2',
            status: 'ai_verified',
            title: 'AI Verification Completed',
            description: 'Auto-categorized as water with high severity. Department routed: Urban Water Resources Board.',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Samadhan Setu AI'
          },
          {
            id: 't_3_3',
            status: 'in_progress',
            title: 'Maintenance Commenced',
            description: 'Repair crews on-site replacing pipe gaskets.',
            timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Admin Shibchandan'
          }
        ],
        slaDays: 4,
        escalated: false,
        escalationDate: null,
        resolutionProofUrl: null,
        resolutionNotes: null,
        resolvedAt: null,
        urgencyReason: 'Severe clean water loss and street flooding risk'
      },
      {
        id: 'issue_4',
        category: 'streetlight',
        title: 'Broken Streetlights in Radial Road 4',
        description: 'Entire stretch of radial road 4 connecting inner and outer circle is pitch black after 7 PM. Severe security hazard for female pedestrians.',
        status: 'resolved',
        location: {
          lat: 28.6315,
          lng: 77.2195,
          address: 'Radial Road 4, Connaught Place, New Delhi',
          area: 'Connaught Place',
          city: 'New Delhi'
        },
        severity: 'high',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'user_priya',
        reportedByName: 'Priya Patel',
        mediaUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
        department: 'Public Lighting & Electricity Authority',
        upvotes: 19,
        downvotes: 1,
        votedUsers: {
          'user_aarav': 'valid'
        },
        comments: [],
        timeline: [
          {
            id: 't_4_1',
            status: 'reported',
            title: 'Issue Reported',
            description: 'Reported by Priya Patel.',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Priya Patel'
          },
          {
            id: 't_4_2',
            status: 'ai_verified',
            title: 'AI Verification Completed',
            description: 'Auto-categorized as streetlight with high severity. Department routed: Public Lighting & Electricity Authority.',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Samadhan Setu AI'
          },
          {
            id: 't_4_3',
            status: 'resolved',
            title: 'Resolution Completed',
            description: 'Replaced 8 blown LED light assemblies and restored underground feed line.',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            by: 'Admin Shibchandan'
          }
        ],
        slaDays: 5,
        escalated: false,
        escalationDate: null,
        resolutionProofUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
        resolutionNotes: 'All bulbs replaced and tested for light output index.',
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    if (isLocalMode) {
      if (!fs.existsSync(usersFile)) {
        writeJsonFile(usersFile, defaultUsers);
        console.log('✅ Local data_users.json auto-seeded.');
      }

      if (!fs.existsSync(credentialsFile)) {
        writeJsonFile(credentialsFile, defaultCredentials);
        console.log('✅ Local data_credentials.json auto-seeded.');
      }

      if (!fs.existsSync(sessionFile)) {
        writeJsonFile(sessionFile, {
          currentUserSession: defaultUsers[0]
        });
        console.log('✅ Local data_session.json auto-seeded.');
      }

      if (!fs.existsSync(issuesFile)) {
        writeJsonFile(issuesFile, defaultIssues);
        console.log('✅ Local data_issues.json auto-seeded.');
      }
    } else {
      // Live Firestore Mode: Auto-seed the collections if issues is empty
      try {
        const issuesSnap = await db.collection('issues').limit(1).get();
        if (issuesSnap.empty) {
          console.log('🔥 Live Firestore is empty. Initializing automatic database seeding...');
          
          for (const issue of defaultIssues) {
            await db.collection('issues').doc(issue.id).set(issue);
          }
          
          for (const user of defaultUsers) {
            await db.collection('users').doc(user.id).set(user);
          }
          
          for (const [email, cred] of Object.entries(defaultCredentials)) {
            await db.collection('credentials').doc(email).set(cred);
          }
          
          await db.collection('metadata').doc('session').set({
            currentUserSession: defaultUsers[0]
          });
          
          console.log('✅ Live Firestore auto-seeded successfully!');
        }
      } catch (fErr: any) {
        if (isFirestoreNotFoundError(fErr)) {
          console.warn('⚠️ Firestore database was not found or is not initialized yet. Falling back to local mode.');
        } else {
          console.error('Error seeding Firestore collections:', fErr?.message || fErr);
        }
        // Fallback to local mode on failure
        enableLocalModeFallback();
      }
    }
  } catch (err) {
    console.error('Error in database auto-seeding:', err);
  }
}

// Ensure database is seeded on load
ensureSeededData();


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

// --- OTP & Password Reset Simulation ---

export interface OTPRecord {
  email: string;
  code: string;
  token: string;
  expiresAt: number;
}

export interface SimulatedNotification {
  id: string;
  email: string;
  type: 'email' | 'sms';
  subject: string;
  body: string;
  code: string;
  link: string;
  timestamp: number;
}

const otpsFile = path.join(process.cwd(), 'server', 'data_otps.json');
const notificationsFile = path.join(process.cwd(), 'server', 'data_notifications.json');

export async function saveOTP(email: string, code: string, token: string, expiresAt: number): Promise<void> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const otps = readJsonFile(otpsFile) || {};
    otps[sanitizedEmail] = { email: sanitizedEmail, code, token, expiresAt };
    writeJsonFile(otpsFile, otps);
    return;
  }
  try {
    await db.collection('otps').doc(sanitizedEmail).set({
      email: sanitizedEmail,
      code,
      token,
      expiresAt
    });
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const otps = readJsonFile(otpsFile) || {};
      otps[sanitizedEmail] = { email: sanitizedEmail, code, token, expiresAt };
      writeJsonFile(otpsFile, otps);
      return;
    }
    throw err;
  }
}

export async function getOTP(email: string): Promise<OTPRecord | null> {
  const sanitizedEmail = email.toLowerCase().trim();
  if (isLocalMode) {
    const otps = readJsonFile(otpsFile) || {};
    return otps[sanitizedEmail] || null;
  }
  try {
    const docSnap = await db.collection('otps').doc(sanitizedEmail).get();
    if (docSnap.exists) {
      return docSnap.data() as OTPRecord;
    }
    return null;
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const otps = readJsonFile(otpsFile) || {};
      return otps[sanitizedEmail] || null;
    }
    throw err;
  }
}

export async function getOTPByToken(token: string): Promise<OTPRecord | null> {
  if (isLocalMode) {
    const otps: Record<string, OTPRecord> = readJsonFile(otpsFile) || {};
    const found = Object.values(otps).find(o => o.token === token);
    return found || null;
  }
  try {
    const snapshot = await db.collection('otps').where('token', '==', token).limit(1).get();
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as OTPRecord;
    }
    return null;
  } catch (err: any) {
    if (isFirestoreNotFoundError(err)) {
      enableLocalModeFallback();
      const otps: Record<string, OTPRecord> = readJsonFile(otpsFile) || {};
      const found = Object.values(otps).find(o => o.token === token);
      return found || null;
    }
    throw err;
  }
}

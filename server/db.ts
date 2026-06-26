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

export const DEFAULT_USERS: User[] = [
  {
    id: 'user_citizen_1',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@civic.in',
    role: 'citizen',
    points: 340,
    trust_score: 94,
    badges: ['Pothole Patrol', 'Local Hero', 'Waste Warden'],
    completed_reports: 8,
    validations_count: 24,
    area: 'Connaught Place'
  },
  {
    id: 'user_citizen_2',
    name: 'Neha Patel',
    email: 'neha.patel@gmail.com',
    role: 'citizen',
    points: 120,
    trust_score: 82,
    badges: ['Street Light Sentry'],
    completed_reports: 2,
    validations_count: 11,
    area: 'Dwarka'
  },
  {
    id: 'user_authority_1',
    name: 'Inspector Suresh Kumar',
    email: 'suresh.kumar@municipal.gov.in',
    role: 'authority',
    points: 500,
    trust_score: 100,
    badges: ['SLA Champion', 'Civic Mentor'],
    completed_reports: 45,
    validations_count: 120,
    area: 'City-Wide Authority'
  }
];

const MOCK_IMAGES = {
  road: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
  garbage: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
  streetlight: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
  safety: 'https://images.unsplash.com/photo-1508847154043-be12a3b64ea6?auto=format&fit=crop&w=600&q=80'
};

export const DEFAULT_ISSUES: Issue[] = [
  {
    id: 'issue_1',
    category: 'road',
    title: 'Severe Potholes near Connaught Place Outer Circle',
    description: 'Extremely deep potholes near Connaught Place Outer Circle lane. Multiple motorcyclists have lost balance and had to swerve dangerously into heavy traffic to avoid them.',
    status: 'in_progress',
    location: {
      lat: 28.6304,
      lng: 77.2177,
      address: 'Connaught Place Outer Circle, New Delhi, Delhi 110001',
      area: 'Connaught Place',
      city: 'New Delhi'
    },
    severity: 'high',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_1',
    reportedByName: 'Aarav Sharma',
    mediaUrl: MOCK_IMAGES.road,
    department: 'MCD / Road & Highway Division',
    upvotes: 18,
    downvotes: 1,
    votedUsers: { 'user_citizen_1': 'valid', 'user_citizen_2': 'valid' },
    comments: [
      {
        id: 'c1',
        userId: 'user_citizen_2',
        userName: 'Neha Patel',
        userRole: 'citizen',
        text: 'Agreed, this is super dangerous during monsoons when it gets water-logged. Glad it got verified.',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'c2',
        userId: 'user_authority_1',
        userName: 'Inspector Suresh Kumar',
        userRole: 'authority',
        text: 'Assigned to the Connaught Place maintenance crew. Repair schedule is set for tomorrow morning.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      {
        id: 't1',
        status: 'reported',
        title: 'Issue Logged',
        description: 'Reported by Aarav Sharma with high severity.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Aarav Sharma'
      },
      {
        id: 't2',
        status: 'ai_verified',
        title: 'AI Inspection Passed',
        description: 'Computer vision analyzed image. Pothole detected. Confidence: 94%. Department mapped: Municipal Corporation.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Community Hero AI'
      },
      {
        id: 't3',
        status: 'community_verified',
        title: 'Community Validated',
        description: 'Voted valid by 18 community members. Trust threshold achieved.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Civic Community'
      },
      {
        id: 't4',
        status: 'assigned',
        title: 'Authority Assigned',
        description: 'Acknowledged and assigned to MCD Road Division.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Inspector Suresh Kumar'
      },
      {
        id: 't5',
        status: 'in_progress',
        title: 'Work In Progress',
        description: 'SLA Active. Maintenance crew dispatched with hot asphalt mix.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'MCD Maintenance Crew'
      }
    ],
    slaDays: 7,
    escalated: false,
    escalationDate: null,
    resolutionProofUrl: null,
    resolutionNotes: null,
    resolvedAt: null,
    urgencyReason: 'Accident hazard for cyclists and heavy buses'
  },
  {
    id: 'issue_2',
    category: 'garbage',
    title: 'Overflowing Municipal Garbage Dump near Karol Bagh Market',
    description: 'The local municipal dustbin has not been cleared for four days. Garbage has spilled all over the main road, causing heavy traffic congestion and emitting an unbearable odor near the market entrance.',
    status: 'community_verified',
    location: {
      lat: 28.6444,
      lng: 77.1900,
      address: 'Padam Singh Rd, Karol Bagh, New Delhi, Delhi 110005',
      area: 'Karol Bagh',
      city: 'New Delhi'
    },
    severity: 'high',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_2',
    reportedByName: 'Neha Patel',
    mediaUrl: MOCK_IMAGES.garbage,
    department: 'MCD / Waste Management Department',
    upvotes: 25,
    downvotes: 0,
    votedUsers: { 'user_citizen_1': 'valid', 'user_citizen_2': 'valid' },
    comments: [],
    timeline: [
      {
        id: 't2_1',
        status: 'reported',
        title: 'Trash Overflow Reported',
        description: 'Reported by Neha Patel near public dining space.',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Neha Patel'
      },
      {
        id: 't2_2',
        status: 'ai_verified',
        title: 'AI Verification Completed',
        description: 'Analyzed waste volume. Severity: High. Department mapped: Waste Management.',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Community Hero AI'
      },
      {
        id: 't2_3',
        status: 'community_verified',
        title: 'Validated by Community',
        description: 'Verified as valid. Escalated warning tags added.',
        timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Civic Community'
      }
    ],
    slaDays: 3,
    escalated: true,
    escalationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    resolutionProofUrl: null,
    resolutionNotes: null,
    resolvedAt: null,
    urgencyReason: 'Sanitation hazards, food business impact, and rat infestation risk'
  },
  {
    id: 'issue_3',
    category: 'streetlight',
    title: 'Non-functional Streetlights - Dark Stretch near Dwarka Sector 10 Metro',
    description: 'All three consecutive streetlights are completely out on the pathway leading to the metro station. The entire lane is in pitch darkness, posing a major safety concern for daily commuters walking home late.',
    status: 'resolved',
    location: {
      lat: 28.5812,
      lng: 77.0594,
      address: 'Metro Station Pathway, Dwarka Sector 10, New Delhi, Delhi 110075',
      area: 'Dwarka',
      city: 'New Delhi'
    },
    severity: 'medium',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_1',
    reportedByName: 'Aarav Sharma',
    mediaUrl: MOCK_IMAGES.streetlight,
    department: 'BSES / Public Lighting Division',
    upvotes: 12,
    downvotes: 0,
    votedUsers: { 'user_citizen_1': 'valid' },
    comments: [
      {
        id: 'c3',
        userId: 'user_authority_1',
        userName: 'Inspector Suresh Kumar',
        userRole: 'authority',
        text: 'SLA timeframe: 5 days. Replacing bulbs and repairing electrical cabling.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      {
        id: 't3_1',
        status: 'reported',
        title: 'Reported Dark Alley',
        description: 'Reported by Aarav Sharma.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Aarav Sharma'
      },
      {
        id: 't3_2',
        status: 'ai_verified',
        title: 'AI Detection Passed',
        description: 'Identified broken public luminaire. Mapped to BSES Public Lighting.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Community Hero AI'
      },
      {
        id: 't3_3',
        status: 'assigned',
        title: 'Assigned to Lighting Division',
        description: 'Assigned to BSES repair crew #4.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Inspector Suresh Kumar'
      },
      {
        id: 't3_4',
        status: 'resolved',
        title: 'Issue Resolved & Sealed',
        description: 'Replaced HPS luminaires with high-efficiency LED lights. Corridors fully illuminated.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'BSES Lighting Team'
      }
    ],
    slaDays: 5,
    escalated: false,
    escalationDate: null,
    resolutionProofUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Bulbs replaced with bright LEDs. Checked entire line for power failure; photodetectors cleaned and functional.',
    resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    urgencyReason: 'Crime prevention and safety on pedestrian access path'
  }
];

// --- Durable Persistence Firestore Helpers ---

export async function getUsers(): Promise<User[]> {
  if (isLocalMode) {
    const list = readJsonFile(usersFile);
    return list || DEFAULT_USERS;
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
    return list || DEFAULT_ISSUES;
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
export async function seedIfNeeded(): Promise<void> {
  try {
    if (isLocalMode) {
      console.log('Seeding and updating default users to Local JSON (India)...');
      if (!fs.existsSync(usersFile)) {
        writeJsonFile(usersFile, DEFAULT_USERS);
      }
      if (!fs.existsSync(issuesFile)) {
        writeJsonFile(issuesFile, DEFAULT_ISSUES);
      }
      if (!fs.existsSync(sessionFile)) {
        writeJsonFile(sessionFile, { currentUserSession: DEFAULT_USERS[0] });
      }
      console.log('Local seeding/update complete for India.');
      return;
    }

    console.log('Seeding and updating default users to Firestore (India)...');
    for (const u of DEFAULT_USERS) {
      await setDoc(doc(db, 'users', u.id), u);
    }

    console.log('Seeding and updating default issues to Firestore (India)...');
    for (const i of DEFAULT_ISSUES) {
      await setDoc(doc(db, 'issues', i.id), i);
    }

    // Always ensure the default session is set up with Aarav Sharma (index 0)
    await setDoc(doc(db, 'metadata', 'session'), { currentUserSession: DEFAULT_USERS[0] });
    
    console.log('Firestore seeding/update complete for India.');
  } catch (err) {
    console.error('Error seeding Firestore:', err);
  }
}

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

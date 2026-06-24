import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Issue } from '../src/types';

// Read Firebase configuration dynamically from the config file
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore using the configured database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export const DEFAULT_USERS: User[] = [
  {
    id: 'user_citizen_1',
    name: 'Sarah Jenkins',
    email: 'sarah.j@civic.org',
    role: 'citizen',
    points: 340,
    trust_score: 94,
    badges: ['Pothole Patrol', 'Local Hero', 'Waste Warden'],
    completed_reports: 8,
    validations_count: 24,
    area: 'Mission District'
  },
  {
    id: 'user_citizen_2',
    name: 'Marcus Chen',
    email: 'marcus.c@gmail.com',
    role: 'citizen',
    points: 120,
    trust_score: 82,
    badges: ['Street Light Sentry'],
    completed_reports: 2,
    validations_count: 11,
    area: 'SOMA'
  },
  {
    id: 'user_authority_1',
    name: 'Inspector Rodriguez',
    email: 'rodriguez@municipal.gov',
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
    title: 'Severe Pothole on Market Street Lane 2',
    description: 'Extremely deep pothole right in the middle of the bus lane. Multiple cyclists had to swerve dangerously into oncoming traffic to avoid it.',
    status: 'in_progress',
    location: {
      lat: 37.7749,
      lng: -122.4194,
      address: '950 Market St, San Francisco, CA 94102',
      area: 'Market District'
    },
    severity: 'high',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_1',
    reportedByName: 'Sarah Jenkins',
    mediaUrl: MOCK_IMAGES.road,
    department: 'Municipal Corporation / Road & Traffic Division',
    upvotes: 18,
    downvotes: 1,
    votedUsers: { 'user_citizen_1': 'valid', 'user_citizen_2': 'valid' },
    comments: [
      {
        id: 'c1',
        userId: 'user_citizen_2',
        userName: 'Marcus Chen',
        userRole: 'citizen',
        text: 'Agreed, this is super dangerous at night. Glad it got verified.',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'c2',
        userId: 'user_authority_1',
        userName: 'Inspector Rodriguez',
        userRole: 'authority',
        text: 'Assigned to the Market Street repair crew. Repair schedule is set for tomorrow morning.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      {
        id: 't1',
        status: 'reported',
        title: 'Issue Logged',
        description: 'Reported by Sarah Jenkins with high severity.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Sarah Jenkins'
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
        description: 'Acknowledged and assigned to Road & Traffic Division.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Inspector Rodriguez'
      },
      {
        id: 't5',
        status: 'in_progress',
        title: 'Work In Progress',
        description: 'SLA Active. Maintenance crew dispatched with hot asphalt mix.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Road & Traffic Division'
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
    title: 'Overflowing Trash Bins & Dumpsters near Mission Plaza',
    description: 'The garbage hasn\'t been cleared for three days. It has spilled onto the sidewalk, attracting rodents and producing a horrible odor. Right next to outdoor cafes.',
    status: 'community_verified',
    location: {
      lat: 37.7649,
      lng: -122.4194,
      address: '16th & Valencia St, San Francisco, CA 94110',
      area: 'Mission District'
    },
    severity: 'high',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_2',
    reportedByName: 'Marcus Chen',
    mediaUrl: MOCK_IMAGES.garbage,
    department: 'San Francisco Public Works / Waste Management',
    upvotes: 25,
    downvotes: 0,
    votedUsers: { 'user_citizen_1': 'valid', 'user_citizen_2': 'valid' },
    comments: [],
    timeline: [
      {
        id: 't2_1',
        status: 'reported',
        title: 'Trash Overflow Reported',
        description: 'Reported by Marcus Chen near public dining space.',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Marcus Chen'
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
    title: 'Broken Streetlight - Dark Corridor on 16th St',
    description: 'Three consecutive streetlights are completely out. The block is in pitch blackness, causing significant safety concerns for commuters returning late from the BART station.',
    status: 'resolved',
    location: {
      lat: 37.7650,
      lng: -122.4200,
      address: '2200 16th St, San Francisco, CA 94103',
      area: 'Mission District'
    },
    severity: 'medium',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'user_citizen_1',
    reportedByName: 'Sarah Jenkins',
    mediaUrl: MOCK_IMAGES.streetlight,
    department: 'Electricity Board / Public Lighting',
    upvotes: 12,
    downvotes: 0,
    votedUsers: { 'user_citizen_1': 'valid' },
    comments: [
      {
        id: 'c3',
        userId: 'user_authority_1',
        userName: 'Inspector Rodriguez',
        userRole: 'authority',
        text: 'SLA timeframe: 5 days. Replacing bulbs and testing photocell sensors.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    timeline: [
      {
        id: 't3_1',
        status: 'reported',
        title: 'Reported Dark Alley',
        description: 'Reported by Sarah Jenkins.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Sarah Jenkins'
      },
      {
        id: 't3_2',
        status: 'ai_verified',
        title: 'AI Detection Passed',
        description: 'Identified broken public luminaire. Mapped to Electricity Board.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Community Hero AI'
      },
      {
        id: 't3_3',
        status: 'assigned',
        title: 'Assigned to Lighting Division',
        description: 'Assigned to electrical dispatch crew #4.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Inspector Rodriguez'
      },
      {
        id: 't3_4',
        status: 'resolved',
        title: 'Issue Resolved & Sealed',
        description: 'Replaced HPS luminaires with high-efficiency LED lights. Corridors fully illuminated.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        by: 'Electricity Board Dispatch'
      }
    ],
    slaDays: 5,
    escalated: false,
    escalationDate: null,
    resolutionProofUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Bulbs replaced with bright LEDs. Checked entire line for power failure; photodetectors cleaned and functional.',
    resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    urgencyReason: 'Crime prevention and safety on BART access path'
  }
];

// --- Durable Persistence Firestore Helpers ---

export async function getUsers(): Promise<User[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => doc.data() as User);
}

export async function saveUser(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.id), user);
}

export async function getIssues(): Promise<Issue[]> {
  const snapshot = await getDocs(collection(db, 'issues'));
  return snapshot.docs.map(doc => doc.data() as Issue);
}

export async function saveIssue(issue: Issue): Promise<void> {
  await setDoc(doc(db, 'issues', issue.id), issue);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  const docRef = doc(db, 'issues', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Issue;
  }
  return null;
}

export async function getCurrentSession(): Promise<User | null> {
  const docRef = doc(db, 'metadata', 'session');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.currentUserSession || null;
  }
  return null;
}

export async function setCurrentSession(user: User | null): Promise<void> {
  await setDoc(doc(db, 'metadata', 'session'), { currentUserSession: user });
}

// Seeding Firestore DB if collections are empty (providing a rich initial dataset)
export async function seedIfNeeded(): Promise<void> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding default users to Firestore...');
      for (const u of DEFAULT_USERS) {
        await setDoc(doc(db, 'users', u.id), u);
      }
    }
    const issuesSnap = await getDocs(collection(db, 'issues'));
    if (issuesSnap.empty) {
      console.log('Seeding default issues to Firestore...');
      for (const i of DEFAULT_ISSUES) {
        await setDoc(doc(db, 'issues', i.id), i);
      }
    }
    const sessionSnap = await getDoc(doc(db, 'metadata', 'session'));
    if (!sessionSnap.exists()) {
      await setDoc(doc(db, 'metadata', 'session'), { currentUserSession: DEFAULT_USERS[0] });
    }
    console.log('Firestore seeding verification complete.');
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

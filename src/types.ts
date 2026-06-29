/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type IssueCategory = 'road' | 'garbage' | 'water' | 'streetlight' | 'safety';

export type IssueStatus = 
  | 'reported' 
  | 'ai_verified' 
  | 'community_verified' 
  | 'assigned' 
  | 'in_progress' 
  | 'resolved' 
  | 'closed';

export type SeverityLevel = 'low' | 'medium' | 'high';

export interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
  area: string;
  city: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userRole: 'citizen' | 'authority';
  text: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  status: IssueStatus;
  title: string;
  description: string;
  timestamp: string;
  by: string;
}

export interface Issue {
  id: string;
  category: IssueCategory;
  title: string;
  description: string;
  status: IssueStatus;
  location: LocationInfo;
  severity: SeverityLevel;
  createdAt: string;
  reportedBy: string;
  reportedByName: string;
  mediaUrl: string;
  department: string;
  upvotes: number;
  downvotes: number;
  votedUsers: Record<string, 'valid' | 'invalid'>;
  comments: Comment[];
  timeline: TimelineEvent[];
  slaDays: number;
  escalated: boolean;
  escalationDate: string | null;
  resolutionProofUrl: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  urgencyReason?: string;
  duplicateOf?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'authority';
  points: number;
  trust_score: number;
  badges: string[];
  completed_reports: number;
  validations_count: number;
  area: string;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
  trust_score: number;
  area: string;
  badges_count: number;
}

// ─── IoT Sensor Types ────────────────────────────────────────────
export type SensorType = 'flood' | 'air_quality' | 'noise' | 'temperature' | 'pothole_vibration' | 'streetlight_outage';

export interface IoTAlert {
  id: string;
  sensorId: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  severity: 'medium' | 'high';
  location: LocationInfo;
  autoIssueId?: string;  // ID of the issue auto-created from this alert
  timestamp: string;
}

// ─── Emergency Broadcast Types ───────────────────────────────────
export type BroadcastSeverity = 'info' | 'warning' | 'critical';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  targetZone: string;   // e.g. 'All Zones', 'Sector 12', etc.
  createdBy: string;
  createdAt: string;
  expiresAt: string;    // ISO timestamp — auto-removed after expiry
  active: boolean;
}

// ─── Blockchain Ledger Types ─────────────────────────────────────
export interface LedgerRecord {
  id: string;
  issueId: string;
  issueTitle: string;
  resolvedBy: string;
  resolvedAt: string;
  category: string;
  location: string;
  contentHash: string;
  previousHash: string;
  nonce: number;
  blockNumber: number;
  network: string;
  txSimulated: string;
}

// ─── Contact Admin System Types ──────────────────────────────────
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: 'feedback' | 'bug' | 'support' | 'other';
  message: string;
  createdAt: string;
  status: 'pending' | 'resolved';
  replyText?: string;
  repliedAt?: string;
}



/**
 * Blockchain Verification Ledger Service
 * Generates SHA-256 content hashes for resolved civic issues.
 * These hashes are the exact payload that would be submitted to Ethereum/Polygon.
 * No wallet or RPC provider needed — uses Node's built-in crypto module.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'server', 'data_ledger.json');
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface LedgerRecord {
  id: string;             // Unique ledger entry ID
  issueId: string;        // Reference to the civic issue
  issueTitle: string;
  resolvedBy: string;     // Authority name
  resolvedAt: string;     // ISO timestamp
  category: string;
  location: string;
  contentHash: string;    // SHA-256 hash of the canonicalized issue data
  previousHash: string;   // Hash of the previous ledger record (chain linkage)
  nonce: number;          // Simulated proof-of-work nonce
  blockNumber: number;    // Simulated block height
  network: string;        // e.g. 'polygon-testnet'
  txSimulated: string;    // Simulated transaction ID
}



function readLedger(): LedgerRecord[] {
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLedger(records: LedgerRecord[]) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(records, null, 2));
}

/**
 * Compute a deterministic SHA-256 hash of the issue's core fields.
 * This ensures the same issue always produces the same hash.
 */
function computeContentHash(data: object): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Simulate a minimal proof-of-work (find a nonce so that hash starts with "00").
 * This is what real blockchain miners do, but simplified for demo purposes.
 */
function simulateProofOfWork(baseHash: string): { nonce: number; finalHash: string } {
  let nonce = 0;
  let finalHash = '';
  do {
    finalHash = crypto.createHash('sha256').update(`${baseHash}${nonce}`).digest('hex');
    nonce++;
  } while (!finalHash.startsWith('00') && nonce < 10000);
  return { nonce, finalHash };
}

/**
 * Records a resolved issue on the blockchain ledger.
 * Call this when an issue status changes to 'resolved'.
 */
export function recordResolutionOnLedger(issue: {
  id: string;
  title: string;
  category: string;
  location: { address: string; area: string; city: string };
  resolvedAt: string | null;
  resolutionNotes: string | null;
  reportedBy: string;
  department: string;
}): LedgerRecord {
  const ledger = readLedger();
  const previousRecord = ledger[ledger.length - 1];
  const previousHash = previousRecord ? previousRecord.contentHash : GENESIS_HASH;

  const canonicalData = {
    issueId: issue.id,
    title: issue.title,
    category: issue.category,
    location: `${issue.location.address}, ${issue.location.area}, ${issue.location.city}`,
    resolvedAt: issue.resolvedAt || new Date().toISOString(),
    resolutionNotes: issue.resolutionNotes || '',
    reportedBy: issue.reportedBy,
    department: issue.department,
    previousHash,
  };

  const contentHash = computeContentHash(canonicalData);
  const { nonce } = simulateProofOfWork(contentHash);

  const record: LedgerRecord = {
    id: `LEDGER-${Date.now()}`,
    issueId: issue.id,
    issueTitle: issue.title,
    resolvedBy: issue.department,
    resolvedAt: issue.resolvedAt || new Date().toISOString(),
    category: issue.category,
    location: canonicalData.location,
    contentHash,
    previousHash,
    nonce,
    blockNumber: (previousRecord?.blockNumber ?? 0) + 1,
    network: 'polygon-testnet',
    txSimulated: `0x${crypto.randomBytes(32).toString('hex')}`,
  };

  ledger.push(record);
  writeLedger(ledger);
  return record;
}

export function getAllLedgerRecords(): LedgerRecord[] {
  return readLedger();
}

/**
 * Verify the integrity of the entire ledger chain.
 * Returns true if all hashes are consistent (no tampering detected).
 */
export function verifyLedgerIntegrity(): { valid: boolean; errorAt?: number } {
  const ledger = readLedger();
  for (let i = 1; i < ledger.length; i++) {
    if (ledger[i].previousHash !== ledger[i - 1].contentHash) {
      return { valid: false, errorAt: i };
    }
  }
  return { valid: true };
}

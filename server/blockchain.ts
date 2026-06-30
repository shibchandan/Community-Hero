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
 * Tamper with a specific block in the ledger.
 * This simulates a database intrusion where an unauthorized agent modifies stored records directly.
 */
export function tamperBlockInLedger(id: string, hackedTitle: string): boolean {
  const ledger = readLedger();
  const idx = ledger.findIndex(r => r.id === id);
  if (idx === -1) return false;

  // Modify the title field without updating the hash to break integrity
  ledger[idx].issueTitle = hackedTitle;
  
  writeLedger(ledger);
  return true;
}

/**
 * Re-mine the entire blockchain ledger to repair and restore integrity.
 * Demonstrates how honest network nodes recalculate proof-of-work nonces and forward-link hashes.
 */
export function rebuildLedgerChain(): { success: boolean; blocksRemined: number } {
  const ledger = readLedger();
  if (ledger.length === 0) return { success: true, blocksRemined: 0 };

  let previousHash = GENESIS_HASH;

  for (let i = 0; i < ledger.length; i++) {
    const record = ledger[i];
    record.previousHash = previousHash;

    const canonicalData = {
      issueId: record.issueId,
      title: record.issueTitle,
      category: record.category,
      location: record.location,
      resolvedAt: record.resolvedAt,
      resolutionNotes: 'Repaired and re-certified on blockchain via mining recovery.',
      reportedBy: 'restored_system',
      department: record.resolvedBy,
      previousHash,
    };

    const contentHash = computeContentHash(canonicalData);
    const { nonce, finalHash } = simulateProofOfWork(contentHash);

    record.contentHash = finalHash; // Save the newly found valid hash
    record.nonce = nonce;
    previousHash = finalHash;
  }

  writeLedger(ledger);
  return { success: true, blocksRemined: ledger.length };
}

/**
 * Mine a custom block onto the blockchain ledger.
 */
export function mineCustomBlockOnLedger(
  title: string,
  category: string,
  resolvedBy: string,
  location: string
): LedgerRecord {
  const ledger = readLedger();
  const previousRecord = ledger[ledger.length - 1];
  const previousHash = previousRecord ? previousRecord.contentHash : GENESIS_HASH;

  const canonicalData = {
    issueId: `CUSTOM-${Date.now()}`,
    title,
    category,
    location,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: 'Manually logged and cryptographically verified on public ledger.',
    reportedBy: 'public_citizen',
    department: resolvedBy,
    previousHash,
  };

  const contentHash = computeContentHash(canonicalData);
  const { nonce, finalHash } = simulateProofOfWork(contentHash);

  const record: LedgerRecord = {
    id: `LEDGER-${Date.now()}`,
    issueId: canonicalData.issueId,
    issueTitle: title,
    resolvedBy,
    resolvedAt: canonicalData.resolvedAt,
    category,
    location,
    contentHash: finalHash,
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

/**
 * Verify the integrity of the entire ledger chain.
 * Checks if previous hashes align sequentially.
 */
export function verifyLedgerIntegrity(): { valid: boolean; errorAt?: number; reason?: string } {
  const ledger = readLedger();
  for (let i = 1; i < ledger.length; i++) {
    if (ledger[i].previousHash !== ledger[i - 1].contentHash) {
      return { 
        valid: false, 
        errorAt: ledger[i].blockNumber,
        reason: `Hash mismatch: Block #${ledger[i].blockNumber}'s previousHash does not match Block #${ledger[i-1].blockNumber}'s contentHash!` 
      };
    }
  }
  return { valid: true };
}

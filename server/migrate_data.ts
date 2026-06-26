import path from 'path';
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : '';

if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  console.error("❌ Cannot migrate data. FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid in .env");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrate() {
  console.log("🚀 Starting data migration from local JSON to Firestore...");

  // 1. Migrate Users
  const usersPath = path.join(process.cwd(), 'server', 'data_users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    console.log(`Migrating ${users.length} users...`);
    for (const user of users) {
      await db.collection('users').doc(user.id).set(user);
    }
  }

  // 2. Migrate Issues
  const issuesPath = path.join(process.cwd(), 'server', 'data_issues.json');
  if (fs.existsSync(issuesPath)) {
    const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
    console.log(`Migrating ${issues.length} issues...`);
    for (const issue of issues) {
      await db.collection('issues').doc(issue.id).set(issue);
    }
  }

  // 3. Migrate Credentials
  const credsPath = path.join(process.cwd(), 'server', 'data_credentials.json');
  if (fs.existsSync(credsPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const emails = Object.keys(creds);
    console.log(`Migrating ${emails.length} credentials...`);
    for (const email of emails) {
      await db.collection('credentials').doc(email).set(creds[email]);
    }
  }

  console.log("✅ Migration complete! Your Firestore database is fully populated.");
  process.exit(0);
}

migrate().catch(console.error);

#!/usr/bin/env node
/**
 * Migration script: Add rejectedReason field to all places and dishes
 * 
 * Sets rejectedReason to empty string for all records that don't have it.
 * 
 * Usage:
 *   node scripts/migrateAddRejectedReason.js [--dry-run]
 * 
 * Options:
 *   --dry-run  Preview changes without writing to Firestore
 * 
 * Env:
 *   VITE_FIREBASE_* (same as app)
 *   Optional: VITE_USE_FIREBASE_EMULATORS=true to target emulators
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  initializeApp,
} from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  connectFirestoreEmulator,
} from 'firebase/firestore';

// Prefer .env.local, fall back to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

function assertConfig() {
  Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (!value) {
      console.error(`Missing env for ${key}`);
      process.exit(1);
    }
  });
}
assertConfig();

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (process.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('Using Firestore emulator at localhost:8080');
}

async function migrateCollection(collectionName) {
  console.log(`\n📦 Adding rejectedReason to ${collectionName}...`);
  
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const docId = docSnap.id;
    const name = data.name || docId;
    
    // Skip if already has rejectedReason field
    if (data.rejectedReason !== undefined) {
      console.log(`  ⏭️  ${name} - already has rejectedReason`);
      skippedCount++;
      continue;
    }
    
    if (isDryRun) {
      console.log(`  🔍 ${name} - would add rejectedReason=''`);
      migratedCount++;
    } else {
      try {
        await updateDoc(docSnap.ref, {
          rejectedReason: '',
        });
        console.log(`  ✅ ${name} - added rejectedReason=''`);
        migratedCount++;
      } catch (err) {
        console.error(`  ❌ ${name} - failed: ${err.message}`);
        errorCount++;
      }
    }
  }
  
  return { total: snapshot.size, migrated: migratedCount, skipped: skippedCount, errors: errorCount };
}

async function main() {
  console.log('🚀 Starting rejectedReason migration');
  if (isDryRun) {
    console.log('   (DRY RUN - no changes will be written)');
  }
  console.log(`   Project: ${firebaseConfig.projectId}`);
  
  const placesResult = await migrateCollection('places');
  const dishesResult = await migrateCollection('dishes');
  
  console.log('\n📊 Migration Summary:');
  console.log('   Places:');
  console.log(`     - Total: ${placesResult.total}`);
  console.log(`     - Migrated: ${placesResult.migrated}`);
  console.log(`     - Skipped (already has rejectedReason): ${placesResult.skipped}`);
  console.log(`     - Errors: ${placesResult.errors}`);
  console.log('   Dishes:');
  console.log(`     - Total: ${dishesResult.total}`);
  console.log(`     - Migrated: ${dishesResult.migrated}`);
  console.log(`     - Skipped (already has rejectedReason): ${dishesResult.skipped}`);
  console.log(`     - Errors: ${dishesResult.errors}`);
  
  if (isDryRun) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


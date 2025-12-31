#!/usr/bin/env node
/**
 * Backfill geohash for existing places.
 *
 * Usage:
 *   node scripts/backfillGeohash.js
 *
 * Env:
 *   VITE_FIREBASE_* (same as app)
 *   Optional: VITE_USE_FIREBASE_EMULATORS=true to target emulators
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';

// Prefer .env.local, fall back to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function backfill() {
  console.log('Starting geohash backfill for places...');
  const snap = await getDocs(collection(db, 'places'));

  let updated = 0;
  let skipped = 0;
  let batch = writeBatch(db);
  let batchSize = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const latitude = data.latitude;
    const longitude = data.longitude;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      console.warn(`Skipping ${docSnap.id}: missing coordinates`);
      skipped += 1;
      continue;
    }

    const newHash = geohashForLocation([latitude, longitude]);

    if (data.geohash === newHash) {
      skipped += 1;
      continue;
    }

    batch.update(doc(db, 'places', docSnap.id), { geohash: newHash });
    batchSize += 1;
    updated += 1;

    if (batchSize >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchSize = 0;
      console.log(`Committed batch; total updated so far: ${updated}`);
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  console.log(`Backfill complete. Updated: ${updated}, skipped: ${skipped}, total: ${snap.size}`);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});




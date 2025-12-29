#!/usr/bin/env node
/**
 * Import places/dishes from a CSV into Firestore.
 * - Removes all existing places and dishes first.
 * - Resolves Google Place ID + lat/lng via Places searchText API.
 * - CSV headers expected:
 *   address,description,name,dish_description,glutenFree,vegan,vegetarian,isHero,dish_name
 *
 * Usage:
 *   node scripts/importCsv.js ./to-import.csv [--wipe]
 *
 * Env:
 *   VITE_FIREBASE_* (same as app)
 *   VITE_GOOGLE_PLACES_API_KEY
 *   Optional: VITE_USE_FIREBASE_EMULATORS=true to target emulators
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import {
  initializeApp,
} from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  serverTimestamp,
  connectFirestoreEmulator,
} from 'firebase/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const csvPath = args[0] || path.resolve(__dirname, '../to-import.csv');
const shouldWipe = args.includes('--wipe');

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

const GOOGLE_API_KEY = process.env.VITE_GOOGLE_PLACES_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('Missing VITE_GOOGLE_PLACES_API_KEY in env');
  process.exit(1);
}

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

async function fetchPlace(textQuery) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const place = data.places?.[0];
  if (!place?.id || !place?.displayName?.text || !place?.formattedAddress || !place?.location) {
    throw new Error(`No place found for query: ${textQuery}`);
  }

  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
}

async function clearCollection(colName) {
  const snapshot = await getDocs(collection(db, colName));
  let count = 0;
  for (const doc of snapshot.docs) {
    await deleteDoc(doc.ref);
    count += 1;
  }
  return count;
}

async function main() {
  console.log(`Reading CSV: ${csvPath}`);
  const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (shouldWipe) {
    console.log('Clearing existing dishes and places (wipe enabled)...');
    const deletedDishes = await clearCollection('dishes');
    const deletedPlaces = await clearCollection('places');
    console.log(`Deleted ${deletedPlaces} places, ${deletedDishes} dishes`);
  } else {
    console.log('Wipe disabled; existing data will remain.');
  }

  // Deduplicate places by name+address
  const placeMap = new Map(); // key -> { placeId, docId }

  for (const row of records) {
    const name = row.name?.trim();
    const address = row.address?.trim();
    const key = `${name}|${address}`;

    if (!name || !address) {
      console.warn('Skipping row with missing name/address', row);
      continue;
    }

    let placeEntry = placeMap.get(key);
    if (!placeEntry) {
      try {
        console.log(`Resolving place: ${name} (${address})`);
        const details = await fetchPlace(`${name} ${address}`);

        const placeDoc = await addDoc(collection(db, 'places'), {
          googlePlaceId: details.placeId,
          name: details.name,
          address: details.address,
          latitude: details.latitude,
          longitude: details.longitude,
          description: row.description?.trim() || undefined,
          imageURL: undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: 'import-script',
          isActive: true,
        });

        placeEntry = { placeDocId: placeDoc.id };
        placeMap.set(key, placeEntry);
      } catch (err) {
        console.error(`Failed to resolve place for "${name}" (${address}): ${err instanceof Error ? err.message : err}`);
        continue; // skip dishes for unresolved place
      }
    }

    const dietary = {
      glutenFree: row.glutenFree?.toString().toLowerCase() === 'true',
      vegan: row.vegan?.toString().toLowerCase() === 'true',
      vegetarian: row.vegetarian?.toString().toLowerCase() === 'true',
    };

    const dishName = row.dish_name?.trim();
    if (!dishName) {
      console.warn('Skipping dish with no name for place', name);
      continue;
    }

    await addDoc(collection(db, 'dishes'), {
      placeId: placeEntry.placeDocId,
      name: dishName,
      description: row.dish_description?.trim() || undefined,
      dietary,
      isHero: row.isHero?.toString().toLowerCase() === 'true',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
  }

  console.log(`Imported ${placeMap.size} places and ${records.length} dishes.`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


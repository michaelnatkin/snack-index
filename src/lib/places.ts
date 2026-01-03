import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Place, Dish } from '@/types/models';
import { geohashForLocation } from 'geofire-common';

// ============= Places CRUD =============

/**
 * Get all places
 */
export async function getAllPlaces(): Promise<Place[]> {
  const placesRef = collection(db, 'places');
  const q = query(placesRef, orderBy('name'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Place[];
}

/**
 * Get active places only (status: ACCEPTED)
 */
export async function getActivePlaces(): Promise<Place[]> {
  const placesRef = collection(db, 'places');
  const q = query(placesRef, where('status', '==', 'ACCEPTED'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Place[];
}

/**
 * Get a single place by ID
 */
export async function getPlace(placeId: string): Promise<Place | null> {
  const docRef = doc(db, 'places', placeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as Place;
}

/**
 * Create a new place
 */
export async function createPlace(
  place: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const placesRef = collection(db, 'places');
  const docRef = await addDoc(placesRef, {
    ...place,
    geohash: geohashForLocation([place.latitude, place.longitude]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing place
 */
export async function updatePlace(
  placeId: string,
  updates: Partial<Omit<Place, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'places', placeId);
  let geohash: string | undefined;

  if (updates.latitude !== undefined || updates.longitude !== undefined) {
    const existing = await getDoc(docRef);
    const current = existing.data() as Place | undefined;
    const latitude = updates.latitude ?? current?.latitude;
    const longitude = updates.longitude ?? current?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      geohash = geohashForLocation([latitude, longitude]);
    }
  }

  await updateDoc(docRef, {
    ...updates,
    ...(geohash ? { geohash } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft delete a place (marks as REJECTED)
 */
export async function deletePlace(placeId: string, reason?: string): Promise<void> {
  const docRef = doc(db, 'places', placeId);
  await updateDoc(docRef, {
    status: 'REJECTED',
    rejectedReason: reason || 'Deleted by admin',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update a place's Google Place ID (used when refreshing stale IDs)
 */
export async function updatePlaceGooglePlaceId(
  placeId: string,
  newGooglePlaceId: string
): Promise<void> {
  const docRef = doc(db, 'places', placeId);
  await updateDoc(docRef, {
    googlePlaceId: newGooglePlaceId,
    updatedAt: serverTimestamp(),
  });
}

// ============= Dishes CRUD =============

/**
 * Get all dishes for a place
 */
export async function getDishesForPlace(placeId: string): Promise<Dish[]> {
  const dishesRef = collection(db, 'dishes');
  // Avoid composite index requirement for local/dev by skipping orderBy
  const q = query(dishesRef, where('placeId', '==', placeId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Dish[];
}

/**
 * Get active dishes for a place (status: ACCEPTED)
 */
export async function getActiveDishesForPlace(placeId: string): Promise<Dish[]> {
  const dishesRef = collection(db, 'dishes');
  const q = query(
    dishesRef,
    where('placeId', '==', placeId),
    where('status', '==', 'ACCEPTED')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Dish[];
}

/**
 * Get a single dish by ID
 */
export async function getDish(dishId: string): Promise<Dish | null> {
  const docRef = doc(db, 'dishes', dishId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as Dish;
}

/**
 * Create a new dish
 */
export async function createDish(
  dish: Omit<Dish, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const dishesRef = collection(db, 'dishes');
  const docRef = await addDoc(dishesRef, {
    ...dish,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing dish
 */
export async function updateDish(
  dishId: string,
  updates: Partial<Omit<Dish, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'dishes', dishId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft delete a dish (marks as REJECTED)
 */
export async function deleteDish(dishId: string, reason?: string): Promise<void> {
  const docRef = doc(db, 'dishes', dishId);
  await updateDoc(docRef, {
    status: 'REJECTED',
    rejectedReason: reason || 'Deleted by admin',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get the hero dish for a place (returns first one if multiple exist)
 */
export async function getHeroDishForPlace(placeId: string): Promise<Dish | null> {
  const dishesRef = collection(db, 'dishes');
  const q = query(
    dishesRef,
    where('placeId', '==', placeId),
    where('isHero', '==', true),
    where('status', '==', 'ACCEPTED')
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Dish;
}

/**
 * Check if a place already exists by Google Place ID
 */
export async function getPlaceByGooglePlaceId(googlePlaceId: string): Promise<Place | null> {
  const placesRef = collection(db, 'places');
  const q = query(placesRef, where('googlePlaceId', '==', googlePlaceId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Place;
}

/**
 * Check if a dish already exists for a place by name
 */
export async function getDishByNameForPlace(placeId: string, name: string): Promise<Dish | null> {
  const dishesRef = collection(db, 'dishes');
  const q = query(dishesRef, where('placeId', '==', placeId));
  const snapshot = await getDocs(q);

  // Case-insensitive comparison
  const normalizedName = name.trim().toLowerCase();
  const matchingDoc = snapshot.docs.find(
    (d) => (d.data().name as string).trim().toLowerCase() === normalizedName
  );

  if (!matchingDoc) return null;

  return { id: matchingDoc.id, ...matchingDoc.data() } as Dish;
}


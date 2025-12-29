import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
 * Get active places only
 */
export async function getActivePlaces(): Promise<Place[]> {
  const placesRef = collection(db, 'places');
  const q = query(placesRef, where('isActive', '==', true));
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
 * Delete a place
 */
export async function deletePlace(placeId: string): Promise<void> {
  const docRef = doc(db, 'places', placeId);
  await deleteDoc(docRef);
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
 * Get active dishes for a place
 */
export async function getActiveDishesForPlace(placeId: string): Promise<Dish[]> {
  const dishesRef = collection(db, 'dishes');
  const q = query(
    dishesRef,
    where('placeId', '==', placeId),
    where('isActive', '==', true)
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
  // If this dish is the hero, unset any existing hero for this place
  if (dish.isHero) {
    await unsetHeroDishForPlace(dish.placeId);
  }

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
  // If setting as hero, first unset any existing hero for this place
  if (updates.isHero) {
    const dish = await getDish(dishId);
    if (dish) {
      await unsetHeroDishForPlace(dish.placeId, dishId);
    }
  }

  const docRef = doc(db, 'dishes', dishId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a dish
 */
export async function deleteDish(dishId: string): Promise<void> {
  const docRef = doc(db, 'dishes', dishId);
  await deleteDoc(docRef);
}

/**
 * Unset hero dish for a place (except for the specified dish)
 */
async function unsetHeroDishForPlace(placeId: string, exceptDishId?: string): Promise<void> {
  const dishesRef = collection(db, 'dishes');
  const q = query(
    dishesRef,
    where('placeId', '==', placeId),
    where('isHero', '==', true)
  );
  const snapshot = await getDocs(q);

  const updates = snapshot.docs
    .filter((doc) => doc.id !== exceptDishId)
    .map((doc) =>
      updateDoc(doc.ref, {
        isHero: false,
        updatedAt: serverTimestamp(),
      })
    );

  await Promise.all(updates);
}

/**
 * Get the hero dish for a place
 */
export async function getHeroDishForPlace(placeId: string): Promise<Dish | null> {
  const dishesRef = collection(db, 'dishes');
  const q = query(
    dishesRef,
    where('placeId', '==', placeId),
    where('isHero', '==', true),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Dish;
}


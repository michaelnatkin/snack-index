import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserPlaceInteraction, UserStats } from '@/types/models';

/**
 * Get or create a user-place interaction document
 */
export async function getOrCreateInteraction(
  userId: string,
  placeId: string
): Promise<UserPlaceInteraction> {
  const interactionId = `${userId}_${placeId}`;
  const docRef = doc(db, 'userPlaceInteractions', interactionId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as UserPlaceInteraction;
  }

  // Create new interaction
  const newInteraction: Omit<UserPlaceInteraction, 'id'> = {
    userId,
    placeId,
  };

  await setDoc(docRef, newInteraction);
  return { id: interactionId, ...newInteraction };
}

/**
 * Mark a place as favorited
 */
export async function favoritePlace(userId: string, placeId: string): Promise<void> {
  const interactionId = `${userId}_${placeId}`;
  const docRef = doc(db, 'userPlaceInteractions', interactionId);
  
  await setDoc(docRef, {
    userId,
    placeId,
    favorited: true,
    favoritedAt: serverTimestamp(),
  }, { merge: true });

  // Update user stats
  await incrementUserStat(userId, 'totalFavorites');
}

/**
 * Remove a place from favorites
 */
export async function unfavoritePlace(userId: string, placeId: string): Promise<void> {
  const interactionId = `${userId}_${placeId}`;
  const docRef = doc(db, 'userPlaceInteractions', interactionId);
  
  await updateDoc(docRef, {
    favorited: false,
  });

  // Update user stats
  await decrementUserStat(userId, 'totalFavorites');
}

/**
 * Mark a place as visited
 */
export async function markPlaceVisited(userId: string, placeId: string): Promise<number> {
  const interactionId = `${userId}_${placeId}`;
  const docRef = doc(db, 'userPlaceInteractions', interactionId);
  
  await setDoc(docRef, {
    userId,
    placeId,
    visited: true,
    visitedAt: serverTimestamp(),
  }, { merge: true });

  // Update user stats and return new count
  return await incrementUserStat(userId, 'totalVisits');
}

/**
 * Dismiss a place (never show again)
 */
export async function dismissPlace(userId: string, placeId: string): Promise<void> {
  const interactionId = `${userId}_${placeId}`;
  const docRef = doc(db, 'userPlaceInteractions', interactionId);
  
  await setDoc(docRef, {
    userId,
    placeId,
    dismissed: true,
    dismissedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Get user's favorite places
 */
export async function getFavoritePlaces(userId: string): Promise<UserPlaceInteraction[]> {
  const interactionsRef = collection(db, 'userPlaceInteractions');
  const q = query(
    interactionsRef,
    where('userId', '==', userId),
    where('favorited', '==', true)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserPlaceInteraction[];
}

/**
 * Get user's visited places
 */
export async function getVisitedPlaces(userId: string): Promise<UserPlaceInteraction[]> {
  const interactionsRef = collection(db, 'userPlaceInteractions');
  const q = query(
    interactionsRef,
    where('userId', '==', userId),
    where('visited', '==', true)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserPlaceInteraction[];
}

/**
 * Increment a user stat and return new value
 */
async function incrementUserStat(userId: string, stat: keyof UserStats): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return 1;
  
  const userData = userSnap.data();
  const currentValue = userData.stats?.[stat] || 0;
  const newValue = currentValue + 1;

  await updateDoc(userRef, {
    [`stats.${stat}`]: newValue,
    lastActiveAt: serverTimestamp(),
  });

  return newValue;
}

/**
 * Decrement a user stat
 */
async function decrementUserStat(userId: string, stat: keyof UserStats): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data();
  const currentValue = userData.stats?.[stat] || 0;
  const newValue = Math.max(0, currentValue - 1);

  await updateDoc(userRef, {
    [`stats.${stat}`]: newValue,
    lastActiveAt: serverTimestamp(),
  });
}

/**
 * Check if place is a milestone visit (1st, 10th, 25th, 50th, 100th)
 */
export function isMilestoneVisit(visitCount: number): boolean {
  return [1, 10, 25, 50, 100].includes(visitCount);
}

/**
 * Get celebration message for visit count
 */
export function getCelebrationMessage(visitCount: number): string {
  if (visitCount === 1) return 'Your first snack spot! 🎉';
  if (visitCount === 10) return 'Double digits! 🔟';
  if (visitCount === 25) return 'Quarter century of snacks! 🏆';
  if (visitCount === 50) return 'Halfway to 100! 💪';
  if (visitCount === 100) return 'Century of snacks! 🎊';
  return `That's your ${visitCount}${getOrdinalSuffix(visitCount)} spot!`;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}


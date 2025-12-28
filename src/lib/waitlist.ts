import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { WaitlistEntry } from '@/types/models';

/**
 * Add email to waitlist for location expansion
 */
export async function addToWaitlist(
  email: string,
  location?: { latitude: number; longitude: number; city?: string }
): Promise<void> {
  // Check if email already exists
  const waitlistRef = collection(db, 'waitlistEntries');
  const existingQuery = query(waitlistRef, where('email', '==', email));
  const existing = await getDocs(existingQuery);

  if (!existing.empty) {
    // Already on waitlist
    return;
  }

  // Add to waitlist
  const entry: Omit<WaitlistEntry, 'id'> = {
    email,
    location,
    createdAt: serverTimestamp() as WaitlistEntry['createdAt'],
    notified: false,
  };

  await addDoc(waitlistRef, entry);
}

/**
 * Check if email is already on waitlist
 */
export async function isOnWaitlist(email: string): Promise<boolean> {
  const waitlistRef = collection(db, 'waitlistEntries');
  const q = query(waitlistRef, where('email', '==', email));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}


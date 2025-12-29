import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, AuthProvider } from '@/types/models';
import {
  ADMIN_EMAIL,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_STATS,
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_INTERACTION_TRACKING,
  DEFAULT_USER_PERMISSIONS,
} from '@/types/models';

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return await getOrCreateUserDocument(result.user);
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<User> {
  const result = await signInWithPopup(auth, appleProvider);
  return await getOrCreateUserDocument(result.user);
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return await getOrCreateUserDocument(result.user);
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return await getOrCreateUserDocument(result.user);
}

/**
 * Sign in with the specified provider
 */
export async function signIn(provider: AuthProvider): Promise<User> {
  switch (provider) {
    case 'google':
      return signInWithGoogle();
    case 'apple':
      return signInWithApple();
    case 'email':
      throw new Error('Use signInWithEmail or signUpWithEmail for email authentication');
    default:
      throw new Error(`Unknown auth provider: ${provider}`);
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Get the user document from Firestore, creating it if it doesn't exist
 */
export async function getOrCreateUserDocument(firebaseUser: FirebaseUser): Promise<User> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    // Update last active timestamp
    await updateDoc(userRef, {
      lastActiveAt: serverTimestamp(),
    });
    return { id: userSnap.id, ...userSnap.data() } as User;
  }

  // Create new user document
  const now = Timestamp.now();
  const trialEnd = Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  );

  const newUser: Omit<User, 'id'> = {
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || 'Snacker',
    ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
    createdAt: now,
    lastActiveAt: now,
    permissions: DEFAULT_USER_PERMISSIONS,
    preferences: DEFAULT_USER_PREFERENCES,
    subscription: {
      status: 'trial',
      trialStartDate: now,
      trialEndDate: trialEnd,
    },
    stats: DEFAULT_USER_STATS,
    onboarding: DEFAULT_ONBOARDING_STATE,
    interactions: DEFAULT_INTERACTION_TRACKING,
    isAdmin: firebaseUser.email === ADMIN_EMAIL,
  };

  await setDoc(userRef, newUser);

  return { id: firebaseUser.uid, ...newUser };
}

/**
 * Get the current user document from Firestore
 */
export async function getCurrentUserDocument(): Promise<User | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  return { id: userSnap.id, ...userSnap.data() } as User;
}

/**
 * Update user document in Firestore
 */
export async function updateUserDocument(
  userId: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    lastActiveAt: serverTimestamp(),
  });
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check if the current user is an admin
 */
export function isAdmin(user: User | null): boolean {
  return user?.isAdmin === true;
}


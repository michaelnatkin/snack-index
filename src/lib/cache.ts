/**
 * Two-tier caching service for Google Places API
 * 
 * L1: localStorage (fast, per-device)
 * L2: Firestore (shared across all users)
 */

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// Configurable TTLs (in milliseconds)
export const CACHE_TTL = {
  // Firestore TTLs
  PLACE_HOURS: Number(import.meta.env.VITE_CACHE_TTL_HOURS) || 24 * 60 * 60 * 1000,         // 24 hours
  PLACE_DETAILS: Number(import.meta.env.VITE_CACHE_TTL_DETAILS) || 7 * 24 * 60 * 60 * 1000, // 7 days
  PLACE_PHOTO: Number(import.meta.env.VITE_CACHE_TTL_PHOTO) || 24 * 60 * 60 * 1000,         // 24 hours
  
  // localStorage TTLs (match Firestore for consistency)
  LOCAL_HOURS: Number(import.meta.env.VITE_CACHE_TTL_HOURS) || 24 * 60 * 60 * 1000,          // 24 hours
  LOCAL_DETAILS: Number(import.meta.env.VITE_CACHE_TTL_DETAILS) || 7 * 24 * 60 * 60 * 1000,  // 7 days
  LOCAL_PHOTO: Number(import.meta.env.VITE_CACHE_TTL_PHOTO) || 24 * 60 * 60 * 1000,          // 24 hours
} as const;

const COLLECTION_NAME = 'placesCache';
const LOCAL_CACHE_PREFIX = 'snack-cache:';

export type CacheType = 'hours' | 'details' | 'photo';

interface PlacesCacheEntry<T> {
  type: CacheType;
  googlePlaceId: string;
  data: T;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

interface LocalCacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Generate a cache key for a given type and Google Place ID
 */
export function getCacheKey(type: CacheType, googlePlaceId: string, suffix?: string): string {
  return suffix ? `${type}:${googlePlaceId}:${suffix}` : `${type}:${googlePlaceId}`;
}

/**
 * Get data from localStorage (L1 cache)
 */
function getFromLocalCache<T>(cacheKey: string, maxAgeMs: number): { data: T; hit: true } | { hit: false } {
  try {
    const fullKey = LOCAL_CACHE_PREFIX + cacheKey;
    const stored = localStorage.getItem(fullKey);
    if (!stored) {
      console.debug('[cache] L1 miss (not found):', cacheKey);
      return { hit: false };
    }

    const entry: LocalCacheEntry<T> = JSON.parse(stored);
    const age = Date.now() - entry.timestamp;

    if (age > maxAgeMs) {
      console.debug('[cache] L1 miss (stale):', cacheKey, 'age:', Math.round(age / 1000), 's');
      localStorage.removeItem(fullKey);
      return { hit: false };
    }

    console.debug('[cache] L1 hit:', cacheKey, 'age:', Math.round(age / 1000), 's');
    return { data: entry.data, hit: true };
  } catch (err) {
    console.warn('[cache] L1 error:', cacheKey, err);
    return { hit: false };
  }
}

/**
 * Set data in localStorage (L1 cache)
 */
function setInLocalCache<T>(cacheKey: string, data: T): void {
  try {
    const entry: LocalCacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(LOCAL_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // localStorage might be full or unavailable, ignore
  }
}

/**
 * Get data from Firestore cache (L2 cache)
 */
async function getFromFirestoreCache<T>(cacheKey: string): Promise<{ data: T; fresh: boolean } | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, cacheKey);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const entry = docSnap.data() as PlacesCacheEntry<T>;
    const now = Timestamp.now();
    const fresh = entry.expiresAt.toMillis() > now.toMillis();

    return { data: entry.data, fresh };
  } catch (err) {
    console.warn('Firestore cache read error:', err);
    return null;
  }
}

/**
 * Set data in Firestore cache (L2 cache)
 */
async function setInFirestoreCache<T>(
  cacheKey: string,
  type: CacheType,
  googlePlaceId: string,
  data: T,
  ttlMs: number
): Promise<void> {
  try {
    const now = Date.now();
    const docRef = doc(db, COLLECTION_NAME, cacheKey);

    const entry: PlacesCacheEntry<T> = {
      type,
      googlePlaceId,
      data,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + ttlMs),
    };

    await setDoc(docRef, entry);
  } catch (err) {
    console.warn('Firestore cache write error:', err);
  }
}

/**
 * Get cached data with two-tier read-through caching
 * 
 * 1. Check localStorage (L1) - instant
 * 2. Check Firestore (L2) - shared across users
 * 3. Call fetcher if both miss
 * 4. Populate both caches on fetch
 */
export async function getCached<T>(
  cacheKey: string,
  type: CacheType,
  googlePlaceId: string,
  firestoreTtlMs: number,
  localTtlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // L1: Check localStorage first
  const localResult = getFromLocalCache<T>(cacheKey, localTtlMs);
  if (localResult.hit) {
    return localResult.data;
  }

  // L2: Check Firestore
  const firestoreResult = await getFromFirestoreCache<T>(cacheKey);
  if (firestoreResult !== null) {
    console.debug('[cache] L2 hit:', cacheKey, 'fresh:', firestoreResult.fresh);
    // Populate L1 from L2
    setInLocalCache(cacheKey, firestoreResult.data);

    if (firestoreResult.fresh) {
      return firestoreResult.data;
    }
    // If stale, we still have the data but should refresh in background
    // For simplicity, we'll fetch fresh data synchronously
  } else {
    console.debug('[cache] L2 miss:', cacheKey);
  }

  // Cache miss - fetch from API
  console.debug('[cache] Fetching from API:', cacheKey);
  const freshData = await fetcher();

  // Populate both caches
  setInLocalCache(cacheKey, freshData);
  await setInFirestoreCache(cacheKey, type, googlePlaceId, freshData, firestoreTtlMs);

  return freshData;
}

/**
 * Clear all local cache entries
 */
export function clearLocalCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCAL_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Invalidate all cached data for a specific Google Place ID
 * Used when a place ID becomes stale and needs to be refreshed
 */
export function invalidateCacheForPlace(googlePlaceId: string): void {
  const cacheTypes: CacheType[] = ['hours', 'details', 'photo'];
  
  for (const type of cacheTypes) {
    const cacheKey = getCacheKey(type, googlePlaceId);
    const fullKey = LOCAL_CACHE_PREFIX + cacheKey;
    
    try {
      localStorage.removeItem(fullKey);
      console.debug('[cache] Invalidated L1 cache:', cacheKey);
    } catch {
      // Ignore localStorage errors
    }
  }
  
  // Also invalidate photo cache with common width suffix
  const photoKey = getCacheKey('photo', googlePlaceId, '800');
  try {
    localStorage.removeItem(LOCAL_CACHE_PREFIX + photoKey);
    console.debug('[cache] Invalidated L1 photo cache:', photoKey);
  } catch {
    // Ignore localStorage errors
  }
  
  // Note: Firestore cache entries will naturally expire
  // We don't delete them immediately to avoid extra write costs
  console.log('[cache] Invalidated local cache for place:', googlePlaceId);
}


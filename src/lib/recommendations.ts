import { getActivePlaces, getActiveDishesForPlace, getHeroDishForPlace } from './places';
import { getPlaceHours } from './googlePlaces';
import { isInSeattleArea, calculateDistance, type Coordinates } from './location';
import type { Place, Dish, DietaryFilters, UserPlaceInteraction } from '@/types/models';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  startAt,
  endAt,
} from 'firebase/firestore';
import { db } from './firebase';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

export interface PlaceRecommendation {
  place: Place;
  heroDish: Dish | null;
  dishes: Dish[];
  distance: number;
  isOpen: boolean;
  closeTime?: string;
}

export interface RecommendationResult {
  type: 'recommendation' | 'nothing_open' | 'not_in_area' | 'all_seen';
  recommendation?: PlaceRecommendation;
  nextToOpen?: { place: Place; opensIn: string };
  previewPlaces?: Place[];
}

const DEFAULT_SEARCH_RADIUS_MILES = 20;
const MAX_SEARCH_RADIUS_MILES = 50;
const MILES_TO_METERS = 1609.34;

type PlaceWithDistance = { place: Place; distance: number };

function resolveSearchRadius(maxDistanceMiles: number): number {
  if (!Number.isFinite(maxDistanceMiles)) return DEFAULT_SEARCH_RADIUS_MILES;
  if (maxDistanceMiles <= 0) return DEFAULT_SEARCH_RADIUS_MILES;
  return Math.min(maxDistanceMiles, MAX_SEARCH_RADIUS_MILES);
}

async function getNearbyActivePlaces(
  userLocation: Coordinates,
  maxDistanceMiles: number
): Promise<PlaceWithDistance[]> {
  const radiusMiles = resolveSearchRadius(maxDistanceMiles);
  const center: [number, number] = [userLocation.latitude, userLocation.longitude];
  const bounds = geohashQueryBounds(center, radiusMiles * MILES_TO_METERS);
  const placesRef = collection(db, 'places');

  const queries = bounds.map(([start, end]) =>
    query(
      placesRef,
      where('isActive', '==', true),
      orderBy('geohash'),
      startAt(start),
      endAt(end)
    )
  );

  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  const seen = new Map<string, PlaceWithDistance>();

  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as Omit<Place, 'id'>;
      const { latitude, longitude } = data;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

      const distanceInMeters = distanceBetween(center, [latitude, longitude]) * 1000;
      const distanceInMiles = distanceInMeters / MILES_TO_METERS;

      if (distanceInMiles <= radiusMiles && !seen.has(docSnap.id)) {
        seen.set(docSnap.id, {
          place: { ...data, id: docSnap.id } as Place,
          distance: distanceInMiles,
        });
      }
    });
  });

  return Array.from(seen.values()).sort((a, b) => a.distance - b.distance);
}

/**
 * Get the nearest open place matching user preferences
 */
export async function getNearestOpenPlace(
  userLocation: Coordinates,
  dietaryFilters: DietaryFilters,
  userId: string,
  maxDistanceMiles: number = Infinity,
  currentTimeOverride?: Date
): Promise<RecommendationResult> {
  const functionStart = Date.now();
  const metrics = {
    totalPlaces: 0,
    processedPlaces: 0,
    dismissedCount: 0,
    dishMs: 0,
    hoursMs: 0,
    heroMs: 0,
  };

  // Check if user is in Seattle area
  if (!isInSeattleArea(userLocation)) {
    const previewPlaces = await getActivePlaces();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'recommendations.ts:getNearestOpenPlace',
        message: 'not in area',
        data: {
          totalMs: Date.now() - functionStart,
          totalPlaces: metrics.totalPlaces,
          processedPlaces: metrics.processedPlaces,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return {
      type: 'not_in_area',
      previewPlaces: previewPlaces.slice(0, 6),
    };
  }

  // Get nearby active places using geohash queries
  let nearbyPlaces = await getNearbyActivePlaces(userLocation, maxDistanceMiles);

  if (nearbyPlaces.length === 0) {
    const allPlaces = await getActivePlaces();
    const radiusMiles = resolveSearchRadius(maxDistanceMiles);
    nearbyPlaces = allPlaces
      .map((place) => ({
        place,
        distance: calculateDistance(userLocation, {
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      }))
      .filter(({ distance }) => distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);
  }

  metrics.totalPlaces = nearbyPlaces.length;

  if (nearbyPlaces.length === 0) {
    return { type: 'nothing_open' };
  }

  // Get user's dismissed places
  const dismissedPlaceIds = await getDismissedPlaceIds(userId);
  metrics.dismissedCount = dismissedPlaceIds.size;

  // Filter and score places
  let nextClosedCandidate:
    | {
        place: Place;
        nextOpenInMinutes: number;
        closeTime?: string;
      }
    | null = null;

  for (const { place, distance } of nearbyPlaces) {
    // Skip dismissed places
    if (dismissedPlaceIds.has(place.id)) {
      metrics.dismissedCount += 0; // explicit tracking retained for logs
      continue;
    }

    // Skip places too far away
    if (distance > maxDistanceMiles) {
      continue;
    }

    // Get dishes that match dietary filters
    const dishStart = Date.now();
    const allDishes = await getActiveDishesForPlace(place.id);
    const dishDuration = Date.now() - dishStart;
    metrics.dishMs += dishDuration;
    const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);

    // Skip places with no matching dishes
    if (matchingDishes.length === 0) {
      continue;
    }

    // Check if open
    let isOpen = true;
    let closeTime: string | undefined;
    let nextOpenInMinutes: number | null = null;
    let hoursDuration: number | null = null;
    try {
      const hoursStart = Date.now();
      const hours = await getPlaceHours(place.googlePlaceId, currentTimeOverride);
      hoursDuration = Date.now() - hoursStart;
      metrics.hoursMs += hoursDuration;
      isOpen = hours.isOpen;
      closeTime = hours.closeTime;
      if (!hours.isOpen && hours.periods) {
        nextOpenInMinutes = getMinutesUntilOpenFromPeriods(hours.periods, currentTimeOverride);
      }
    } catch (err) {
      // If we can't get hours, assume open
      console.warn('Failed to get hours for', place.name, err);
    }

    // Get hero dish
    const heroStart = Date.now();
    const heroDish = await getHeroDishForPlace(place.id);
    const heroDuration = Date.now() - heroStart;
    metrics.heroMs += heroDuration;

    metrics.processedPlaces += 1;

    if (metrics.processedPlaces <= 5) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H5',
          location: 'recommendations.ts:getNearestOpenPlace',
          message: 'per-place timings',
          data: {
            placeId: place.id,
            distance,
            dishMs: dishDuration,
            hoursMs: hoursDuration,
            heroMs: heroDuration,
            isOpen,
            matchingDishes: matchingDishes.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }

    if (isOpen) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'recommendations.ts:getNearestOpenPlace',
          message: 'returning open recommendation',
          data: {
            totalMs: Date.now() - functionStart,
            totalPlaces: metrics.totalPlaces,
            processedPlaces: metrics.processedPlaces,
            dismissedCount: metrics.dismissedCount,
            dishMs: metrics.dishMs,
            hoursMs: metrics.hoursMs,
            heroMs: metrics.heroMs,
            openCount: metrics.processedPlaces, // processed until first open
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      return {
        type: 'recommendation',
        recommendation: {
          place,
          heroDish,
          dishes: matchingDishes,
          distance,
          isOpen,
          closeTime,
        },
      };
    }

    // Track earliest next opening only if we still have no open places
    if (nextOpenInMinutes !== null) {
      if (!nextClosedCandidate || nextOpenInMinutes < nextClosedCandidate.nextOpenInMinutes) {
        nextClosedCandidate = {
          place,
          nextOpenInMinutes,
          closeTime,
        };
      }
    }
  }

  // All places are closed - find next to open with countdown
  if (nextClosedCandidate) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'recommendations.ts:getNearestOpenPlace',
        message: 'all closed; next to open',
        data: {
          totalMs: Date.now() - functionStart,
          totalPlaces: metrics.totalPlaces,
          processedPlaces: metrics.processedPlaces,
          dismissedCount: metrics.dismissedCount,
          dishMs: metrics.dishMs,
          hoursMs: metrics.hoursMs,
          heroMs: metrics.heroMs,
          candidate: nextClosedCandidate.place.name,
          opensInMinutes: nextClosedCandidate.nextOpenInMinutes,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return {
      type: 'nothing_open',
      nextToOpen: {
        place: nextClosedCandidate.place,
        opensIn: formatMinutesUntil(nextClosedCandidate.nextOpenInMinutes),
      },
    };
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'H1',
      location: 'recommendations.ts:getNearestOpenPlace',
      message: 'nearestOpen aggregation',
      data: {
        totalMs: Date.now() - functionStart,
        totalPlaces: metrics.totalPlaces,
        processedPlaces: metrics.processedPlaces,
        dismissedCount: metrics.dismissedCount,
        dishMs: metrics.dishMs,
        hoursMs: metrics.hoursMs,
        heroMs: metrics.heroMs,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return { type: 'all_seen' };
}

/**
 * Get queue of recommendations (for swiping through)
 */
export async function getRecommendationQueue(
  userLocation: Coordinates,
  dietaryFilters: DietaryFilters,
  userId: string,
  limit: number = 10,
  maxDistanceMiles: number = Infinity,
  currentTimeOverride?: Date
): Promise<PlaceRecommendation[]> {
  const functionStart = Date.now();
  const metrics = {
    totalPlaces: 0,
    processedPlaces: 0,
    dismissedCount: 0,
    dishMs: 0,
    hoursMs: 0,
    heroMs: 0,
  };

  if (!isInSeattleArea(userLocation)) {
    return [];
  }

  let placesWithDistance = await getNearbyActivePlaces(userLocation, maxDistanceMiles);

  if (placesWithDistance.length === 0) {
    const allPlaces = await getActivePlaces();
    const radiusMiles = resolveSearchRadius(maxDistanceMiles);
    placesWithDistance = allPlaces
      .map((place) => ({
        place,
        distance: calculateDistance(userLocation, {
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      }))
      .filter(({ distance }) => distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);
  }

  metrics.totalPlaces = placesWithDistance.length;
  const dismissedPlaceIds = await getDismissedPlaceIds(userId);
  metrics.dismissedCount = dismissedPlaceIds.size;

  const recommendations: PlaceRecommendation[] = [];

  for (const { place, distance } of placesWithDistance) {
    if (dismissedPlaceIds.has(place.id)) continue;

    const dishStart = Date.now();
    const allDishes = await getActiveDishesForPlace(place.id);
    metrics.dishMs += Date.now() - dishStart;
    const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);

    if (matchingDishes.length === 0) continue;

    let isOpen = true;
    let closeTime: string | undefined;
    try {
      const hoursStart = Date.now();
      const hours = await getPlaceHours(place.googlePlaceId, currentTimeOverride);
      metrics.hoursMs += Date.now() - hoursStart;
      isOpen = hours.isOpen;
      closeTime = hours.closeTime;
    } catch {
      // Assume open if we can't check
    }

    if (!isOpen) continue;

    const heroStart = Date.now();
    const heroDish = await getHeroDishForPlace(place.id);
    metrics.heroMs += Date.now() - heroStart;

    recommendations.push({
      place,
      heroDish,
      dishes: matchingDishes,
      distance,
      isOpen,
      closeTime,
    });
    metrics.processedPlaces += 1;

    if (recommendations.length >= limit) break;
  }

  // Sort by distance
  const sorted = recommendations.sort((a, b) => a.distance - b.distance);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'H2',
      location: 'recommendations.ts:getRecommendationQueue',
      message: 'queue aggregation',
      data: {
        totalMs: Date.now() - functionStart,
        totalPlaces: metrics.totalPlaces,
        processedPlaces: metrics.processedPlaces,
        dismissedCount: metrics.dismissedCount,
        dishMs: metrics.dishMs,
        hoursMs: metrics.hoursMs,
        heroMs: metrics.heroMs,
        returned: sorted.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return sorted;
}

/**
 * Filter dishes by dietary requirements
 */
function filterDishesByDietary(dishes: Dish[], filters: DietaryFilters): Dish[] {
  return dishes.filter((dish) => {
    // If no filters set, return all
    if (!filters.vegetarian && !filters.vegan && !filters.glutenFree) {
      return true;
    }

    // Check each filter
    if (filters.vegetarian && !dish.dietary.vegetarian) return false;
    if (filters.vegan && !dish.dietary.vegan) return false;
    if (filters.glutenFree && !dish.dietary.glutenFree) return false;

    return true;
  });
}

/**
 * Compute minutes until the place opens based on cached hours.
 */
function getMinutesUntilOpenFromPeriods(
  periods: Array<{ open: { day: number; time: string }; close?: { day: number; time: string } }>,
  nowOverride?: Date
): number | null {
  const now = nowOverride ?? new Date();
  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Find next opening period starting today or later
  let bestMinutes: number | null = null;
  for (let i = 0; i < 7; i++) {
    const day = (nowDay + i) % 7;
    const period = periods.find((p) => p.open.day === day);
    if (!period?.open?.time) continue;

    const [openH, openM] = [
      parseInt(period.open.time.slice(0, 2), 10),
      parseInt(period.open.time.slice(2), 10),
    ];
    const openMinutes = openH * 60 + openM + i * 24 * 60;

    const candidate = openMinutes - nowMinutes;
    if (candidate >= 0 && (bestMinutes === null || candidate < bestMinutes)) {
      bestMinutes = candidate;
    }
  }

  return bestMinutes;
}

function formatMinutesUntil(mins: number): string {
  if (mins <= 0) return 'soon';
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (minutes === 0) return `in ${hours} hr${hours === 1 ? '' : 's'}`;
  return `in ${hours} hr ${minutes} min`;
}

/**
 * Get IDs of places the user has dismissed
 */
async function getDismissedPlaceIds(userId: string): Promise<Set<string>> {
  try {
    const interactionsRef = collection(db, 'userPlaceInteractions');
    const q = query(
      interactionsRef,
      where('userId', '==', userId),
      where('dismissed', '==', true)
    );
    const snapshot = await getDocs(q);

    const placeIds = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as UserPlaceInteraction;
      placeIds.add(data.placeId);
    });

    return placeIds;
  } catch (err) {
    console.error('Failed to get dismissed places:', err);
    return new Set();
  }
}


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

export type PlaceWithDistance = { place: Place; distance: number };

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
 * Get all nearby eligible places (not dismissed) sorted by distance.
 * This is the "candidate queue" - places that haven't been processed yet.
 * Does NOT check open status or fetch dishes.
 */
export async function getNearbyEligiblePlaces(
  userLocation: Coordinates,
  userId: string,
  maxDistanceMiles: number = Infinity
): Promise<{ type: 'success'; places: PlaceWithDistance[] } | { type: 'not_in_area'; previewPlaces: Place[] }> {
  // Check if user is in Seattle area
  if (!isInSeattleArea(userLocation)) {
    const previewPlaces = await getActivePlaces();
    return {
      type: 'not_in_area',
      previewPlaces: previewPlaces.slice(0, 6),
    };
  }

  // Fetch places and dismissed IDs in parallel
  const [placesWithDistance, dismissedPlaceIds] = await Promise.all([
    getNearbyActivePlaces(userLocation, maxDistanceMiles).then(async (places) => {
      if (places.length === 0) {
        const allPlaces = await getActivePlaces();
        const radiusMiles = resolveSearchRadius(maxDistanceMiles);
        return allPlaces
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
      return places;
    }),
    getDismissedPlaceIds(userId),
  ]);

  // Filter out dismissed places
  const eligiblePlaces = placesWithDistance.filter(
    ({ place }) => !dismissedPlaceIds.has(place.id)
  );

  return { type: 'success', places: eligiblePlaces };
}

/**
 * Process a batch of candidate places to get ready-to-display recommendations.
 * Checks open status, fetches dishes, and filters by dietary preferences.
 * Returns only places that are open and have matching dishes.
 */
export async function processCandidateBatch(
  candidates: PlaceWithDistance[],
  dietaryFilters: DietaryFilters,
  currentTimeOverride?: Date
): Promise<PlaceRecommendation[]> {
  if (candidates.length === 0) return [];

  const results = await Promise.all(
    candidates.map(({ place, distance }) =>
      processPlaceForRecommendation(place, distance, dietaryFilters, currentTimeOverride)
    )
  );

  // Filter out nulls (closed or no matching dishes) and sort by distance
  return results
    .filter((r): r is PlaceRecommendation => r !== null)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Extended recommendation data including hours info for closed places
 */
interface PlaceRecommendationWithHours extends PlaceRecommendation {
  nextOpenInMinutes?: number | null;
}

/**
 * Process a single place for getNearestOpenPlace
 * Returns extended data including next open time for closed places
 */
async function processPlaceForNearest(
  place: Place,
  distance: number,
  dietaryFilters: DietaryFilters,
  currentTimeOverride?: Date
): Promise<PlaceRecommendationWithHours | null> {
  // Fetch dishes and hours in parallel
  const [allDishes, hours] = await Promise.all([
    getActiveDishesForPlace(place.id),
    getPlaceHours(place.googlePlaceId, currentTimeOverride).catch(() => ({
      isOpen: true,
      closeTime: undefined,
      periods: undefined,
    })),
  ]);

  const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);
  if (matchingDishes.length === 0) return null;

  // Calculate next open time if closed
  let nextOpenInMinutes: number | null = null;
  if (!hours.isOpen && hours.periods) {
    nextOpenInMinutes = getMinutesUntilOpenFromPeriods(hours.periods, currentTimeOverride);
  }

  // Only fetch hero dish if place has matching dishes
  const heroDish = await getHeroDishForPlace(place.id);

  return {
    place,
    heroDish,
    dishes: matchingDishes,
    distance,
    isOpen: hours.isOpen,
    closeTime: hours.closeTime,
    nextOpenInMinutes,
  };
}

/**
 * Get the nearest open place matching user preferences
 * Optimized with parallel processing for faster results
 */
export async function getNearestOpenPlace(
  userLocation: Coordinates,
  dietaryFilters: DietaryFilters,
  userId: string,
  maxDistanceMiles: number = Infinity,
  currentTimeOverride?: Date
): Promise<RecommendationResult> {
  // Check if user is in Seattle area
  if (!isInSeattleArea(userLocation)) {
    const previewPlaces = await getActivePlaces();
    return {
      type: 'not_in_area',
      previewPlaces: previewPlaces.slice(0, 6),
    };
  }

  // Fetch places and dismissed IDs in parallel
  const [nearbyPlaces, dismissedPlaceIds] = await Promise.all([
    getNearbyActivePlaces(userLocation, maxDistanceMiles).then(async (places) => {
      if (places.length === 0) {
        const allPlaces = await getActivePlaces();
        const radiusMiles = resolveSearchRadius(maxDistanceMiles);
        return allPlaces
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
      return places;
    }),
    getDismissedPlaceIds(userId),
  ]);

  if (nearbyPlaces.length === 0) {
    return { type: 'nothing_open' };
  }

  // Filter out dismissed places and those too far
  const eligiblePlaces = nearbyPlaces.filter(
    ({ place, distance }) =>
      !dismissedPlaceIds.has(place.id) && distance <= maxDistanceMiles
  );

  if (eligiblePlaces.length === 0) {
    return { type: 'all_seen' };
  }

  // Process first batch of places in parallel (check closest ones first)
  const batchSize = Math.min(eligiblePlaces.length, 10);
  const batch = eligiblePlaces.slice(0, batchSize);

  const results = await Promise.all(
    batch.map(({ place, distance }) =>
      processPlaceForNearest(place, distance, dietaryFilters, currentTimeOverride)
    )
  );

  // Find first open place (already sorted by distance)
  const openPlace = results.find((r) => r !== null && r.isOpen);
  if (openPlace) {
    return {
      type: 'recommendation',
      recommendation: {
        place: openPlace.place,
        heroDish: openPlace.heroDish,
        dishes: openPlace.dishes,
        distance: openPlace.distance,
        isOpen: openPlace.isOpen,
        closeTime: openPlace.closeTime,
      },
    };
  }

  // No open places - find the one opening soonest
  const closedWithTimes = results.filter(
    (r): r is PlaceRecommendationWithHours =>
      r !== null && !r.isOpen && r.nextOpenInMinutes !== null
  );

  if (closedWithTimes.length > 0) {
    const soonest = closedWithTimes.reduce((a, b) =>
      (a.nextOpenInMinutes ?? Infinity) < (b.nextOpenInMinutes ?? Infinity) ? a : b
    );
    return {
      type: 'nothing_open',
      nextToOpen: {
        place: soonest.place,
        opensIn: formatMinutesUntil(soonest.nextOpenInMinutes ?? 0),
      },
    };
  }

  return { type: 'all_seen' };
}

/**
 * Process a single place to get recommendation data
 * Returns null if place doesn't qualify (no matching dishes, closed, etc.)
 */
async function processPlaceForRecommendation(
  place: Place,
  distance: number,
  dietaryFilters: DietaryFilters,
  currentTimeOverride?: Date
): Promise<PlaceRecommendation | null> {
  // Fetch dishes and hours in parallel
  const [allDishes, hours] = await Promise.all([
    getActiveDishesForPlace(place.id),
    getPlaceHours(place.googlePlaceId, currentTimeOverride).catch(() => ({ isOpen: true, closeTime: undefined })),
  ]);

  const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);
  if (matchingDishes.length === 0) return null;

  const isOpen = hours.isOpen;
  if (!isOpen) return null;

  // Only fetch hero dish if we're going to use this place
  const heroDish = await getHeroDishForPlace(place.id);

  return {
    place,
    heroDish,
    dishes: matchingDishes,
    distance,
    isOpen,
    closeTime: hours.closeTime,
  };
}

/**
 * Get queue of recommendations (for swiping through)
 * Optimized with parallel processing for faster results
 */
export async function getRecommendationQueue(
  userLocation: Coordinates,
  dietaryFilters: DietaryFilters,
  userId: string,
  limit: number = 10,
  maxDistanceMiles: number = Infinity,
  currentTimeOverride?: Date
): Promise<PlaceRecommendation[]> {
  if (!isInSeattleArea(userLocation)) {
    return [];
  }

  // Fetch places and dismissed IDs in parallel
  const [placesWithDistance, dismissedPlaceIds] = await Promise.all([
    getNearbyActivePlaces(userLocation, maxDistanceMiles).then(async (places) => {
      if (places.length === 0) {
        const allPlaces = await getActivePlaces();
        const radiusMiles = resolveSearchRadius(maxDistanceMiles);
        return allPlaces
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
      return places;
    }),
    getDismissedPlaceIds(userId),
  ]);

  // Filter out dismissed places
  const eligiblePlaces = placesWithDistance.filter(
    ({ place }) => !dismissedPlaceIds.has(place.id)
  );

  // Process places in parallel batches for speed
  // Take more than we need since some will be filtered out
  const batchSize = Math.min(eligiblePlaces.length, limit * 2);
  const batch = eligiblePlaces.slice(0, batchSize);

  const results = await Promise.all(
    batch.map(({ place, distance }) =>
      processPlaceForRecommendation(place, distance, dietaryFilters, currentTimeOverride)
    )
  );

  // Filter out nulls and take the limit
  const recommendations = results
    .filter((r): r is PlaceRecommendation => r !== null)
    .slice(0, limit);

  // Sort by distance
  return recommendations.sort((a, b) => a.distance - b.distance);
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


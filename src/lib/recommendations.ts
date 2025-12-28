import { getActivePlaces, getActiveDishesForPlace, getHeroDishForPlace } from './places';
import { getPlaceHours } from './googlePlaces';
import { calculateDistance, isInSeattleArea, type Coordinates } from './location';
import type { Place, Dish, DietaryFilters, UserPlaceInteraction } from '@/types/models';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

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

/**
 * Get the nearest open place matching user preferences
 */
export async function getNearestOpenPlace(
  userLocation: Coordinates,
  dietaryFilters: DietaryFilters,
  userId: string,
  maxDistanceMiles: number = 5,
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

  // Get all active places
  const allPlaces = await getActivePlaces();

  if (allPlaces.length === 0) {
    return { type: 'nothing_open' };
  }

  // Get user's dismissed places
  const dismissedPlaceIds = await getDismissedPlaceIds(userId);

  // Filter and score places
  const placesWithData: Array<{
    place: Place;
    distance: number;
    dishes: Dish[];
    heroDish: Dish | null;
    isOpen: boolean;
    closeTime?: string;
  }> = [];

  for (const place of allPlaces) {
    // Skip dismissed places
    if (dismissedPlaceIds.has(place.id)) {
      continue;
    }

    // Calculate distance
    const distance = calculateDistance(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });

    // Skip places too far away
    if (distance > maxDistanceMiles) {
      continue;
    }

    // Get dishes that match dietary filters
    const allDishes = await getActiveDishesForPlace(place.id);
    const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);

    // Skip places with no matching dishes
    if (matchingDishes.length === 0) {
      continue;
    }

    // Check if open
    let isOpen = true;
    let closeTime: string | undefined;
    try {
      const hours = await getPlaceHours(place.googlePlaceId, currentTimeOverride);
      isOpen = hours.isOpen;
      closeTime = hours.closeTime;
    } catch (err) {
      // If we can't get hours, assume open
      console.warn('Failed to get hours for', place.name, err);
    }

    // Get hero dish
    const heroDish = await getHeroDishForPlace(place.id);

    placesWithData.push({
      place,
      distance,
      dishes: matchingDishes,
      heroDish,
      isOpen,
      closeTime,
    });
  }

  // Find open places sorted by distance
  const openPlaces = placesWithData
    .filter((p) => p.isOpen)
    .sort((a, b) => a.distance - b.distance);

  if (openPlaces.length > 0) {
    const nearest = openPlaces[0];
    return {
      type: 'recommendation',
      recommendation: {
        place: nearest.place,
        heroDish: nearest.heroDish,
        dishes: nearest.dishes,
        distance: nearest.distance,
        isOpen: nearest.isOpen,
        closeTime: nearest.closeTime,
      },
    };
  }

  // All places are closed - find next to open
  // For MVP, just return the closest closed place
  const closestClosed = placesWithData.sort((a, b) => a.distance - b.distance)[0];

  if (closestClosed) {
    return {
      type: 'nothing_open',
      nextToOpen: {
        place: closestClosed.place,
        opensIn: 'later today', // In production, calculate actual time
      },
    };
  }

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
  currentTimeOverride?: Date
): Promise<PlaceRecommendation[]> {
  if (!isInSeattleArea(userLocation)) {
    return [];
  }

  const allPlaces = await getActivePlaces();
  const dismissedPlaceIds = await getDismissedPlaceIds(userId);

  const recommendations: PlaceRecommendation[] = [];

  for (const place of allPlaces) {
    if (dismissedPlaceIds.has(place.id)) continue;

    const distance = calculateDistance(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });

    if (distance > 5) continue;

    const allDishes = await getActiveDishesForPlace(place.id);
    const matchingDishes = filterDishesByDietary(allDishes, dietaryFilters);

    if (matchingDishes.length === 0) continue;

    let isOpen = true;
    let closeTime: string | undefined;
    try {
      const hours = await getPlaceHours(place.googlePlaceId, currentTimeOverride);
      isOpen = hours.isOpen;
      closeTime = hours.closeTime;
    } catch {
      // Assume open if we can't check
    }

    if (!isOpen) continue;

    const heroDish = await getHeroDishForPlace(place.id);

    recommendations.push({
      place,
      heroDish,
      dishes: matchingDishes,
      distance,
      isOpen,
      closeTime,
    });

    if (recommendations.length >= limit) break;
  }

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


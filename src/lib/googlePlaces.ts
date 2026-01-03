/**
 * Google Places API utilities
 * 
 * Uses the Google Places API (New) HTTP endpoints.
 * 
 * Caching: Uses two-tier cache (Firestore + localStorage) for API responses
 * to reduce costs and improve performance across all users.
 * 
 * Place ID Refresh: Google Place IDs can become stale over time. When this
 * happens, we automatically refresh the ID using text search and update
 * our database.
 */

import type { Coordinates } from './location';
import { getCached, getCacheKey, CACHE_TTL, invalidateCacheForPlace } from './cache';
import { updatePlaceGooglePlaceId, getPlace } from './places';

/**
 * Get the Google Places API key, throwing if not configured
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_PLACES_API_KEY is not configured');
  }
  return apiKey;
}

/**
 * Format a 24-hour time string (HHMM) to 12-hour AM/PM format
 */
function formatTimeAmPm(hhmm: string): string {
  const hour24 = parseInt(hhmm.slice(0, 2), 10);
  const minute = hhmm.slice(2);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  
  // Omit minutes if :00
  if (minute === '00') {
    return `${hour12} ${period}`;
  }
  return `${hour12}:${minute} ${period}`;
}

export interface PlaceAutocompleteResult {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PlaceHours {
  isOpen: boolean;
  closeTime?: string;
  /** Full hours range for the day, e.g., "10 AM - 2 PM" or "11 AM - 3 PM, 5 PM - 10 PM" */
  todayHoursRange?: string;
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

const API_BASE = 'https://places.googleapis.com/v1';
const DEFAULT_LOCATION = { latitude: 47.6062, longitude: -122.3321 }; // Seattle
const DEFAULT_RADIUS_METERS = 50_000;

/**
 * Error class for stale Google Place ID errors
 */
export class StaleGooglePlaceIdError extends Error {
  constructor(
    public googlePlaceId: string,
    public originalError: Error
  ) {
    super(`Google Place ID is no longer valid: ${googlePlaceId}`);
    this.name = 'StaleGooglePlaceIdError';
  }
}

/**
 * Check if an error indicates a stale Google Place ID
 */
export function isStaleGooglePlaceIdError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('404') &&
    (message.includes('place id is no longer valid') ||
      message.includes('not_found'))
  );
}

/**
 * Parse error response to check for stale place ID
 */
function parseApiError(status: number, responseText: string): { isStale: boolean } {
  if (status !== 404) return { isStale: false };
  
  try {
    const parsed = JSON.parse(responseText);
    const message = parsed?.error?.message?.toLowerCase() || '';
    return {
      isStale: message.includes('place id is no longer valid') || 
               parsed?.error?.status === 'NOT_FOUND'
    };
  } catch {
    return { isStale: false };
  }
}

/**
 * Search for a place by name and location to get a fresh Google Place ID
 * Uses textSearch which is better for finding existing places
 */
export async function findPlaceByNameAndLocation(
  name: string,
  coords: { latitude: number; longitude: number }
): Promise<string | null> {
  const apiKey = getApiKey();

  const body = {
    textQuery: name,
    locationBias: {
      circle: {
        center: coords,
        radius: 500, // 500 meters radius for nearby search
      },
    },
    maxResultCount: 5,
  };

  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.warn('[refreshPlaceId] Text search failed:', res.status);
    return null;
  }

  const data = await res.json();
  const places = data.places || [];

  if (places.length === 0) {
    console.warn('[refreshPlaceId] No places found for:', name);
    return null;
  }

  // Return the first match - Google orders by relevance
  const match = places[0];
  console.log('[refreshPlaceId] Found new place ID:', match.id, 'for:', name);
  return match.id;
}

/**
 * Attempt to refresh a stale Google Place ID
 * Returns the new place ID if successful, null otherwise
 */
export async function refreshGooglePlaceId(
  firestorePlaceId: string,
  oldGooglePlaceId: string
): Promise<string | null> {
  // Get the place from our database to find its name and coordinates
  const place = await getPlace(firestorePlaceId);
  if (!place) {
    console.warn('[refreshPlaceId] Place not found in database:', firestorePlaceId);
    return null;
  }

  // Search for the place using its name and coordinates
  const newGooglePlaceId = await findPlaceByNameAndLocation(
    place.name,
    { latitude: place.latitude, longitude: place.longitude }
  );

  if (!newGooglePlaceId) {
    console.warn('[refreshPlaceId] Could not find new place ID for:', place.name);
    return null;
  }

  if (newGooglePlaceId === oldGooglePlaceId) {
    console.warn('[refreshPlaceId] New ID is same as old ID:', oldGooglePlaceId);
    return null;
  }

  // Update the place in Firebase with the new Google Place ID
  try {
    await updatePlaceGooglePlaceId(firestorePlaceId, newGooglePlaceId);
    console.log('[refreshPlaceId] Updated place', firestorePlaceId, 'with new Google Place ID:', newGooglePlaceId);
  } catch (err) {
    console.error('[refreshPlaceId] Failed to update place in Firebase:', err);
    return null;
  }

  // Invalidate cached data for the old place ID
  invalidateCacheForPlace(oldGooglePlaceId);

  return newGooglePlaceId;
}

/**
 * Context for place ID refresh operations
 */
interface PlaceContext {
  firestorePlaceId: string;
  googlePlaceId: string;
}

/**
 * Wrapper that handles stale Google Place ID errors with automatic refresh and retry
 * 
 * Usage:
 * ```
 * const hours = await withPlaceIdRefresh(
 *   { firestorePlaceId: 'abc123', googlePlaceId: 'ChIJ...' },
 *   (placeId) => getPlaceHoursInternal(placeId)
 * );
 * ```
 */
export async function withPlaceIdRefresh<T>(
  context: PlaceContext,
  operation: (googlePlaceId: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(context.googlePlaceId);
  } catch (error) {
    if (!isStaleGooglePlaceIdError(error)) {
      throw error;
    }

    console.warn('[withPlaceIdRefresh] Detected stale place ID:', context.googlePlaceId);

    // Attempt to refresh the place ID
    const newGooglePlaceId = await refreshGooglePlaceId(
      context.firestorePlaceId,
      context.googlePlaceId
    );

    if (!newGooglePlaceId) {
      // Couldn't refresh, re-throw original error
      throw new StaleGooglePlaceIdError(context.googlePlaceId, error as Error);
    }

    // Retry with the new place ID
    console.log('[withPlaceIdRefresh] Retrying with new place ID:', newGooglePlaceId);
    return await operation(newGooglePlaceId);
  }
}

/**
 * Search for places by name (autocomplete)
 */
export async function searchPlaces(
  query: string
): Promise<PlaceAutocompleteResult[]> {
  const apiKey = getApiKey();

  const body = {
    input: query,
    locationBias: {
      circle: {
        center: DEFAULT_LOCATION,
        radius: DEFAULT_RADIUS_METERS,
      },
    },
  };

  const res = await fetch(`${API_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places autocomplete failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } }; placeId?: string; text?: { text?: string } }> };
  const suggestions = data.suggestions || [];

  return suggestions.map((s) => ({
    placeId: s.placePrediction?.placeId ?? s.placeId ?? '',
    name: s.placePrediction?.structuredFormat?.mainText?.text ?? s.placePrediction?.text?.text ?? s.text?.text ?? '',
    address:
      s.placePrediction?.structuredFormat?.secondaryText?.text ??
      s.placePrediction?.text?.text ??
      s.text?.text ??
      '',
  })).filter((p: PlaceAutocompleteResult) => p.placeId && p.name);
}

interface CachedDetailsData {
  details: PlaceDetails | null;
}

/**
 * Fetch place details from Google Places API (used by cache)
 */
async function fetchPlaceDetailsFromApi(placeId: string): Promise<CachedDetailsData> {
  const apiKey = getApiKey();

  const fieldMask = 'id,displayName,formattedAddress,location,regularOpeningHours,currentOpeningHours';
  const res = await fetch(`${API_BASE}/places/${placeId}?fields=${encodeURIComponent(fieldMask)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const { isStale } = parseApiError(res.status, text);
    if (isStale) {
      throw new Error(`Place details failed: ${res.status} Place ID is no longer valid ${text}`);
    }
    throw new Error(`Place details failed: ${res.status} ${text}`);
  }

  const place = await res.json();
  if (!place?.id || !place?.displayName?.text || !place?.formattedAddress || !place?.location) {
    return { details: null };
  }

  return {
    details: {
      placeId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress,
      latitude: place.location.latitude ?? DEFAULT_LOCATION.latitude,
      longitude: place.location.longitude ?? DEFAULT_LOCATION.longitude,
    },
  };
}

/**
 * Get detailed place information
 * Uses two-tier cache (Firestore + localStorage) for API responses
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const cacheKey = getCacheKey('details', placeId);

  const cachedData = await getCached<CachedDetailsData>(
    cacheKey,
    'details',
    placeId,
    CACHE_TTL.PLACE_DETAILS,
    CACHE_TTL.LOCAL_DETAILS,
    () => fetchPlaceDetailsFromApi(placeId)
  );

  return cachedData.details;
}

type ParsedPeriod = { open: { day: number; time: string }; close?: { day: number; time: string } };

/**
 * Raw hours data from the API (cached in Firestore)
 */
interface CachedHoursData {
  periods: ParsedPeriod[];
}

/**
 * Fetch raw hours data from Google Places API (used by cache)
 */
async function fetchPlaceHoursFromApi(placeId: string): Promise<CachedHoursData> {
  const apiKey = getApiKey();

  const fieldMask = 'currentOpeningHours';
  const res = await fetch(`${API_BASE}/places/${placeId}?fields=${encodeURIComponent(fieldMask)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const { isStale } = parseApiError(res.status, text);
    if (isStale) {
      throw new Error(`Place hours failed: ${res.status} Place ID is no longer valid ${text}`);
    }
    throw new Error(`Place hours failed: ${res.status} ${text}`);
  }

  const place = await res.json();
  const hoursData = place.currentOpeningHours;

  const periods: ParsedPeriod[] =
    hoursData?.periods?.map((p: { open?: { day?: number; hourMinute?: string; hour?: number; minute?: number }; close?: { day?: number; hourMinute?: string; hour?: number; minute?: number } }) => ({
      open: {
        day: p.open?.day ?? 0,
        time: p.open?.hourMinute ?? (p.open?.hour !== undefined && p.open?.minute !== undefined
          ? `${String(p.open.hour).padStart(2, '0')}${String(p.open.minute).padStart(2, '0')}`
          : '0000'),
      },
      close: p.close
        ? {
            day: p.close.day ?? 0,
            time:
              p.close.hourMinute ??
              (p.close.hour !== undefined && p.close.minute !== undefined
                ? `${String(p.close.hour).padStart(2, '0')}${String(p.close.minute).padStart(2, '0')}`
                : '0000'),
          }
        : undefined,
    })) || [];

  return { periods };
}

/**
 * Format a range of periods for the day, e.g., "10 AM - 2 PM" or "11 AM - 3 PM, 5 PM - 10 PM"
 */
function formatTodayHoursRange(
  todayPeriods: ParsedPeriod[]
): string | undefined {
  if (todayPeriods.length === 0) return undefined;

  // Sort periods by open time
  const sorted = [...todayPeriods].sort((a, b) => {
    const aTime = parseInt(a.open.time, 10);
    const bTime = parseInt(b.open.time, 10);
    return aTime - bTime;
  });

  const ranges = sorted.map((period) => {
    const openFormatted = formatTimeAmPm(period.open.time);
    if (period.close?.time) {
      const closeFormatted = formatTimeAmPm(period.close.time);
      return `${openFormatted} - ${closeFormatted}`;
    }
    return `${openFormatted}+`;
  });

  return ranges.join(', ');
}

/**
 * Compute isOpen and closeTime from cached periods data
 * Always computes isOpen from periods using current time (or override)
 */
function computeHoursFromPeriods(
  cachedData: CachedHoursData,
  currentTimeOverride?: Date
): PlaceHours {
  const { periods } = cachedData;
  const hours: PlaceHours = {
    isOpen: false,
    periods,
  };

  if (periods.length === 0) {
    return hours;
  }

  const now = currentTimeOverride ?? new Date();
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const nowInt = parseInt(hhmm, 10);

  // Find ALL periods for today (handles lunch/dinner split hours)
  const todayPeriods = periods.filter((p) => p.open.day === day);

  // Format the full hours range for today
  hours.todayHoursRange = formatTodayHoursRange(todayPeriods);

  // Check if current time falls within ANY of today's periods
  for (const period of todayPeriods) {
    if (!period.open?.time) continue;
    
    const openTime = period.open.time;
    const closeTime = period.close?.time;
    const openInt = parseInt(openTime, 10);
    const closeInt = closeTime ? parseInt(closeTime, 10) : undefined;

    let isWithinPeriod = false;
    if (closeInt !== undefined) {
      // Handle overnight by allowing close day to differ
      if (period.close?.day !== day && closeInt < openInt) {
        isWithinPeriod = nowInt >= openInt || nowInt < closeInt;
      } else {
        isWithinPeriod = nowInt >= openInt && nowInt < closeInt;
      }
    } else {
      // No close time means open until end of day
      isWithinPeriod = nowInt >= openInt;
    }

    if (isWithinPeriod) {
      hours.isOpen = true;
      if (closeTime) {
        hours.closeTime = formatTimeAmPm(closeTime);
      }
      break;
    }
  }

  // If not currently open but there are periods today, show next close time
  if (!hours.isOpen && todayPeriods.length > 0) {
    // Find the next period that hasn't closed yet
    for (const period of todayPeriods) {
      const closeTime = period.close?.time;
      if (closeTime) {
        const closeInt = parseInt(closeTime, 10);
        if (closeInt > nowInt) {
          hours.closeTime = formatTimeAmPm(closeTime);
          break;
        }
      }
    }
  }

  return hours;
}

/**
 * Check if a place is currently open
 * Uses two-tier cache (Firestore + localStorage) for API responses
 */
export async function getPlaceHours(placeId: string, currentTimeOverride?: Date): Promise<PlaceHours> {
  const cacheKey = getCacheKey('hours', placeId);

  const cachedData = await getCached<CachedHoursData>(
    cacheKey,
    'hours',
    placeId,
    CACHE_TTL.PLACE_HOURS,
    CACHE_TTL.LOCAL_HOURS,
    () => fetchPlaceHoursFromApi(placeId)
  );

  return computeHoursFromPeriods(cachedData, currentTimeOverride);
}

/**
 * Check if a place is currently open with automatic place ID refresh on stale IDs
 * 
 * @param firestorePlaceId - The Firestore document ID for the place
 * @param googlePlaceId - The Google Place ID
 * @param currentTimeOverride - Optional time override for testing
 */
export async function getPlaceHoursWithRefresh(
  firestorePlaceId: string,
  googlePlaceId: string,
  currentTimeOverride?: Date
): Promise<PlaceHours> {
  return withPlaceIdRefresh(
    { firestorePlaceId, googlePlaceId },
    async (placeId) => {
      const cacheKey = getCacheKey('hours', placeId);
      const cachedData = await getCached<CachedHoursData>(
        cacheKey,
        'hours',
        placeId,
        CACHE_TTL.PLACE_HOURS,
        CACHE_TTL.LOCAL_HOURS,
        () => fetchPlaceHoursFromApi(placeId)
      );
      return computeHoursFromPeriods(cachedData, currentTimeOverride);
    }
  );
}

/**
 * Generate Google Maps walking directions URL from origin to a place.
 */
export function getGoogleMapsUrl(
  placeId: string,
  origin?: Coordinates,
  destination?: Coordinates
): string {
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'walking',
    destination_place_id: placeId,
  });

  if (destination) {
    params.set('destination', `${destination.latitude},${destination.longitude}`);
  } else {
    params.set('destination', `place_id:${placeId}`);
  }

  if (origin) {
    params.set('origin', `${origin.latitude},${origin.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface CachedPhotoData {
  photoUrl: string | null;
}

/**
 * Fetch photo URL from Google Places API (used by cache)
 */
async function fetchPlacePhotoFromApi(placeId: string, maxWidthPx: number): Promise<CachedPhotoData> {
  const apiKey = getApiKey();

  const fieldMask = 'photos';
  const res = await fetch(`${API_BASE}/places/${placeId}?fields=${encodeURIComponent(fieldMask)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const { isStale } = parseApiError(res.status, text);
    if (isStale) {
      throw new Error(`Place photos failed: ${res.status} Place ID is no longer valid ${text}`);
    }
    throw new Error(`Place photos failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const photoName: string | undefined = data?.photos?.[0]?.name;
  if (!photoName) return { photoUrl: null };

  const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
  return { photoUrl: mediaUrl };
}

/**
 * Fetch a Google Places photo URL (publicly accessible) for a place.
 * Uses two-tier cache (Firestore + localStorage) for API responses
 */
export async function getGooglePlacePhotoUrl(placeId: string, maxWidthPx = 800): Promise<string | null> {
  // Fail fast on configuration errors
  getApiKey();

  const cacheKey = getCacheKey('photo', placeId, String(maxWidthPx));

  const cachedData = await getCached<CachedPhotoData>(
    cacheKey,
    'photo',
    placeId,
    CACHE_TTL.PLACE_PHOTO,
    CACHE_TTL.LOCAL_PHOTO,
    () => fetchPlacePhotoFromApi(placeId, maxWidthPx)
  );

  return cachedData.photoUrl;
}

/**
 * Fetch a Google Places photo URL with automatic place ID refresh on stale IDs
 * 
 * @param firestorePlaceId - The Firestore document ID for the place
 * @param googlePlaceId - The Google Place ID
 * @param maxWidthPx - Maximum width of the photo
 */
export async function getGooglePlacePhotoUrlWithRefresh(
  firestorePlaceId: string,
  googlePlaceId: string,
  maxWidthPx = 800
): Promise<string | null> {
  // Fail fast on configuration errors
  getApiKey();

  return withPlaceIdRefresh(
    { firestorePlaceId, googlePlaceId },
    async (placeId) => {
      const cacheKey = getCacheKey('photo', placeId, String(maxWidthPx));
      const cachedData = await getCached<CachedPhotoData>(
        cacheKey,
        'photo',
        placeId,
        CACHE_TTL.PLACE_PHOTO,
        CACHE_TTL.LOCAL_PHOTO,
        () => fetchPlacePhotoFromApi(placeId, maxWidthPx)
      );
      return cachedData.photoUrl;
    }
  );
}

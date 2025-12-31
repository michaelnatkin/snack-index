/**
 * Google Places API utilities
 * 
 * Uses the Google Places API (New) HTTP endpoints.
 * 
 * Caching: Uses two-tier cache (Firestore + localStorage) for API responses
 * to reduce costs and improve performance across all users.
 */

import type { Coordinates } from './location';
import { getCached, getCacheKey, CACHE_TTL } from './cache';

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
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

const API_BASE = 'https://places.googleapis.com/v1';
const DEFAULT_LOCATION = { latitude: 47.6062, longitude: -122.3321 }; // Seattle
const DEFAULT_RADIUS_METERS = 50_000;

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

  // Find the period for today
  const todayPeriod = periods.find((p) => p.open.day === day);

  if (todayPeriod?.open?.time) {
    const openTime = todayPeriod.open.time;
    const closeTime = todayPeriod.close?.time;
    const openInt = parseInt(openTime, 10);
    const closeInt = closeTime ? parseInt(closeTime, 10) : undefined;

    if (closeInt !== undefined) {
      // Handle overnight by allowing close day to differ
      if (todayPeriod.close?.day !== day && closeInt < openInt) {
        hours.isOpen = nowInt >= openInt || nowInt < closeInt;
      } else {
        hours.isOpen = nowInt >= openInt && nowInt < closeInt;
      }
    } else {
      // No close time means open until end of day
      hours.isOpen = nowInt >= openInt;
    }

    if (closeTime) {
      hours.closeTime = formatTimeAmPm(closeTime);
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

/**
 * Google Places API utilities
 * 
 * Uses the Google Places API (New) HTTP endpoints.
 * Falls back to mock data when no API key is provided.
 */

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

// Cache for place hours (15 minute TTL)
const hoursCache = new Map<string, { hours: PlaceHours; timestamp: number }>();
const HOURS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const API_BASE = 'https://places.googleapis.com/v1';
const DEFAULT_LOCATION = { latitude: 47.6062, longitude: -122.3321 }; // Seattle
const DEFAULT_RADIUS_METERS = 50_000;

/**
 * Search for places by name (autocomplete)
 */
export async function searchPlaces(
  query: string
): Promise<PlaceAutocompleteResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('VITE_GOOGLE_PLACES_API_KEY is not set; using mock data');
    return getMockAutocompleteResults(query);
  }

  const body = {
    input: query,
    locationBias: {
      circle: {
        center: DEFAULT_LOCATION,
        radius: DEFAULT_RADIUS_METERS,
      },
    },
  };

  try {
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

    const data = await res.json();
    const suggestions = data.suggestions || [];

    return suggestions.map((s: any) => ({
      placeId: s.placePrediction?.placeId ?? s.placeId ?? '',
      name: s.placePrediction?.structuredFormat?.mainText?.text ?? s.placePrediction?.text?.text ?? s.text?.text ?? '',
      address:
        s.placePrediction?.structuredFormat?.secondaryText?.text ??
        s.placePrediction?.text?.text ??
        s.text?.text ??
        '',
    })).filter((p: PlaceAutocompleteResult) => p.placeId && p.name);
  } catch (err) {
    console.error('Places autocomplete error:', err);
    return getMockAutocompleteResults(query);
  }
}

/**
 * Get detailed place information
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('VITE_GOOGLE_PLACES_API_KEY is not set; using mock data');
    return getMockPlaceDetails(placeId);
  }

  try {
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
      return null;
    }

    return {
      placeId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress,
      latitude: place.location.latitude ?? DEFAULT_LOCATION.latitude,
      longitude: place.location.longitude ?? DEFAULT_LOCATION.longitude,
    };
  } catch (err) {
    console.error('Place details error:', err);
    return getMockPlaceDetails(placeId);
  }
}

/**
 * Check if a place is currently open
 */
export async function getPlaceHours(placeId: string, currentTimeOverride?: Date): Promise<PlaceHours> {
  // Check cache first
  const cached = hoursCache.get(placeId);
  if (cached && Date.now() - cached.timestamp < HOURS_CACHE_TTL) {
    return cached.hours;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('VITE_GOOGLE_PLACES_API_KEY is not set; using mock data');
    const mockHours = getMockPlaceHours();
    hoursCache.set(placeId, { hours: mockHours, timestamp: Date.now() });
    return mockHours;
  }

  try {
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

    type ParsedPeriod = { open: { day: number; time: string }; close?: { day: number; time: string } };
    const periods: ParsedPeriod[] =
      hoursData?.periods?.map((p: any) => ({
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

    const hours: PlaceHours = {
      isOpen: hoursData?.openNow ?? true,
      periods,
    };

    // Recompute isOpen if admin provided a fake "now"
    if (currentTimeOverride && periods.length > 0) {
      const now = currentTimeOverride;
      const day = now.getDay();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const todayPeriod = periods.find((p: ParsedPeriod) => p.open.day === day);
      if (todayPeriod?.open?.time) {
        const openTime = todayPeriod.open.time;
        const closeTime = todayPeriod.close?.time;
        const openInt = parseInt(openTime, 10);
        const closeInt = closeTime ? parseInt(closeTime, 10) : undefined;

        if (closeInt !== undefined) {
          // Handle overnight by allowing close day to differ
          if (todayPeriod.close?.day !== day && closeInt < openInt) {
            hours.isOpen = parseInt(hhmm, 10) >= openInt || parseInt(hhmm, 10) < closeInt;
          } else {
            hours.isOpen = parseInt(hhmm, 10) >= openInt && parseInt(hhmm, 10) < closeInt;
          }
        } else {
          hours.isOpen = parseInt(hhmm, 10) >= openInt;
        }

        if (closeTime) {
          hours.closeTime = `${closeTime.slice(0, 2)}:${closeTime.slice(2)}`;
        }
      }
    } else if (hours.isOpen && periods.length > 0) {
      const now = new Date();
      const day = now.getDay();
      const todayPeriod = periods.find((p: ParsedPeriod) => p.open.day === day);
      if (todayPeriod?.close?.time) {
        hours.closeTime = `${todayPeriod.close.time.slice(0, 2)}:${todayPeriod.close.time.slice(2)}`;
      }
    }

    hoursCache.set(placeId, { hours, timestamp: Date.now() });
    return hours;
  } catch (err) {
    console.error('Place hours error:', err);
    const mockHours = getMockPlaceHours();
    hoursCache.set(placeId, { hours: mockHours, timestamp: Date.now() });
    return mockHours;
  }
}

/**
 * Generate Google Maps URL for a place
 */
export function getGoogleMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

// ============= Mock data for development =============

function getMockAutocompleteResults(query: string): PlaceAutocompleteResult[] {
  const mockPlaces = [
    { placeId: 'mock-1', name: 'Marination Station', address: 'Capitol Hill, Seattle, WA' },
    { placeId: 'mock-2', name: 'Off the Rez', address: 'University District, Seattle, WA' },
    { placeId: 'mock-3', name: 'Tacos Chukis', address: 'Capitol Hill, Seattle, WA' },
    { placeId: 'mock-4', name: 'Xian Noodles', address: 'University District, Seattle, WA' },
    { placeId: 'mock-5', name: 'Piroshky Piroshky', address: 'Pike Place Market, Seattle, WA' },
    { placeId: 'mock-temple', name: 'Temple Pastries', address: '2124 S Jackson St, Seattle, WA' },
  ];

  return mockPlaces.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
}

function getMockPlaceDetails(placeId: string): PlaceDetails | null {
  const mockDetails: Record<string, PlaceDetails> = {
    'mock-1': {
      placeId: 'mock-1',
      name: 'Marination Station',
      address: '1412 Harvard Ave, Seattle, WA 98122',
      latitude: 47.6135,
      longitude: -122.3208,
    },
    'mock-2': {
      placeId: 'mock-2',
      name: 'Off the Rez',
      address: '4502 University Way NE, Seattle, WA 98105',
      latitude: 47.6614,
      longitude: -122.3131,
    },
    'mock-3': {
      placeId: 'mock-3',
      name: 'Tacos Chukis',
      address: '219 Broadway E, Seattle, WA 98102',
      latitude: 47.6204,
      longitude: -122.3213,
    },
    'mock-temple': {
      placeId: 'mock-temple',
      name: 'Temple Pastries',
      address: '2124 S Jackson St, Seattle, WA 98144',
      latitude: 47.5993,
      longitude: -122.3031,
    },
  };

  return mockDetails[placeId] || null;
}

function getMockPlaceHours(): PlaceHours {
  // Randomly return open or closed for testing
  return {
    isOpen: true,
    closeTime: '21:00',
    periods: [
      {
        open: { day: 1, time: '0800' },
        close: { day: 1, time: '2100' },
      },
    ],
  };
}


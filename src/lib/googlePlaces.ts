/**
 * Google Places API utilities
 * 
 * Note: For MVP, this uses the Google Maps JavaScript API.
 * The API key should be set in environment variables.
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

/**
 * Initialize Google Places service
 * Must be called after Google Maps API is loaded
 */
let placesService: google.maps.places.PlacesService | null = null;
let autocompleteService: google.maps.places.AutocompleteService | null = null;

export function initGooglePlaces(): void {
  if (typeof google === 'undefined' || !google.maps) {
    console.warn('Google Maps API not loaded');
    return;
  }

  // Create a hidden map element for PlacesService
  const mapDiv = document.createElement('div');
  mapDiv.style.display = 'none';
  document.body.appendChild(mapDiv);

  const map = new google.maps.Map(mapDiv, {
    center: { lat: 47.6062, lng: -122.3321 }, // Seattle
    zoom: 12,
  });

  placesService = new google.maps.places.PlacesService(map);
  autocompleteService = new google.maps.places.AutocompleteService();
}

/**
 * Search for places by name (autocomplete)
 */
export async function searchPlaces(
  query: string
): Promise<PlaceAutocompleteResult[]> {
  if (!autocompleteService) {
    // Return mock data for development without API key
    console.warn('Google Places not initialized, using mock data');
    return getMockAutocompleteResults(query);
  }

  return new Promise((resolve, reject) => {
    autocompleteService!.getPlacePredictions(
      {
        input: query,
        types: ['establishment'],
        locationBias: {
          center: { lat: 47.6062, lng: -122.3321 }, // Seattle
          radius: 50000, // 50km
        } as google.maps.places.LocationBias,
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Places autocomplete failed: ${status}`));
          }
          return;
        }

        resolve(
          predictions.map((p) => ({
            placeId: p.place_id!,
            name: p.structured_formatting?.main_text || p.description,
            address: p.structured_formatting?.secondary_text || '',
          }))
        );
      }
    );
  });
}

/**
 * Get detailed place information
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placesService) {
    // Return mock data for development without API key
    console.warn('Google Places not initialized, using mock data');
    return getMockPlaceDetails(placeId);
  }

  return new Promise((resolve, reject) => {
    placesService!.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          reject(new Error(`Place details failed: ${status}`));
          return;
        }

        resolve({
          placeId: place.place_id!,
          name: place.name!,
          address: place.formatted_address!,
          latitude: place.geometry!.location!.lat(),
          longitude: place.geometry!.location!.lng(),
        });
      }
    );
  });
}

/**
 * Check if a place is currently open
 */
export async function getPlaceHours(placeId: string): Promise<PlaceHours> {
  // Check cache first
  const cached = hoursCache.get(placeId);
  if (cached && Date.now() - cached.timestamp < HOURS_CACHE_TTL) {
    return cached.hours;
  }

  if (!placesService) {
    // Return mock data for development without API key
    console.warn('Google Places not initialized, using mock data');
    const mockHours = getMockPlaceHours();
    hoursCache.set(placeId, { hours: mockHours, timestamp: Date.now() });
    return mockHours;
  }

  return new Promise((resolve, reject) => {
    placesService!.getDetails(
      {
        placeId,
        fields: ['opening_hours', 'current_opening_hours', 'business_status'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          reject(new Error(`Place hours failed: ${status}`));
          return;
        }

        const hours: PlaceHours = {
          isOpen: place.opening_hours?.isOpen?.() ?? true,
          periods: place.opening_hours?.periods?.map((p) => ({
            open: { day: p.open?.day ?? 0, time: p.open?.time ?? '0000' },
            close: p.close ? { day: p.close.day ?? 0, time: p.close.time ?? '0000' } : undefined,
          })),
        };

        // Calculate close time for today if open
        if (hours.isOpen && hours.periods) {
          const now = new Date();
          const day = now.getDay();
          const todayPeriod = hours.periods.find((p) => p.open.day === day);
          if (todayPeriod?.close) {
            const closeTime = todayPeriod.close.time;
            hours.closeTime = `${closeTime.slice(0, 2)}:${closeTime.slice(2)}`;
          }
        }

        // Cache the result
        hoursCache.set(placeId, { hours, timestamp: Date.now() });
        resolve(hours);
      }
    );
  });
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
  };

  return mockDetails[placeId] || null;
}

function getMockPlaceHours(): PlaceHours {
  // Randomly return open or closed for testing
  return {
    isOpen: Math.random() > 0.3,
    closeTime: '21:00',
  };
}


/**
 * Location utilities for Snack Index
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
  permissionState?: PermissionState;
}

/**
 * Check if geolocation is supported
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Get the current permission state for geolocation
 */
export async function getLocationPermissionState(): Promise<PermissionState | 'unsupported'> {
  if (!isGeolocationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    // Some browsers don't support permissions API for geolocation
    return 'prompt';
  }
}

/**
 * Request the current location from the user
 */
export async function requestLocation(): Promise<LocationResult> {
  if (!isGeolocationSupported()) {
    return {
      success: false,
      error: 'Geolocation is not supported by your browser',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        let errorMessage: string;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission was denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        resolve({
          success: false,
          error: errorMessage,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000, // 1 minute cache
      }
    );
  });
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return 'nearby';
  }
  if (miles < 1) {
    return `${(miles * 10).toFixed(0)}00 ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Seattle metro area bounds for checking if user is in coverage area
 */
export const SEATTLE_BOUNDS = {
  north: 47.8,
  south: 47.3,
  east: -122.0,
  west: -122.5,
};

/**
 * Check if coordinates are within Seattle metro area
 */
export function isInSeattleArea(coords: Coordinates): boolean {
  return (
    coords.latitude <= SEATTLE_BOUNDS.north &&
    coords.latitude >= SEATTLE_BOUNDS.south &&
    coords.longitude <= SEATTLE_BOUNDS.east &&
    coords.longitude >= SEATTLE_BOUNDS.west
  );
}


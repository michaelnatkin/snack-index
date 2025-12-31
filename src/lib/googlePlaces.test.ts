import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { getGoogleMapsUrl, getGooglePlacePhotoUrl } from './googlePlaces';

// Mock the cache module
vi.mock('./cache', () => ({
  getCached: vi.fn(),
  getCacheKey: vi.fn((type: string, id: string, suffix?: string) => 
    suffix ? `${type}:${id}:${suffix}` : `${type}:${id}`
  ),
  CACHE_TTL: {
    PLACE_HOURS: 24 * 60 * 60 * 1000,
    PLACE_DETAILS: 7 * 24 * 60 * 60 * 1000,
    PLACE_PHOTO: 24 * 60 * 60 * 1000,
    LOCAL_HOURS: 24 * 60 * 60 * 1000,
    LOCAL_DETAILS: 7 * 24 * 60 * 60 * 1000,
    LOCAL_PHOTO: 24 * 60 * 60 * 1000,
  },
}));

import { getCached } from './cache';

const originalEnv = { ...import.meta.env };

describe('getGoogleMapsUrl', () => {
  it('builds walking directions with destination place id', () => {
    const url = getGoogleMapsUrl('abc123');

    expect(url).toContain('https://www.google.com/maps/dir/?');
    expect(url).toContain('destination_place_id=abc123');
    expect(url).toContain('destination=place_id%3Aabc123');
    expect(url).toContain('travelmode=walking');
    expect(url).not.toContain('origin=');
  });

  it('uses provided origin and destination coordinates when available', () => {
    const url = getGoogleMapsUrl(
      'abc123',
      { latitude: 47.6, longitude: -122.3 },
      { latitude: 47.61, longitude: -122.31 }
    );

    expect(url).toContain('origin=47.6%2C-122.3');
    expect(url).toContain('destination=47.61%2C-122.31');
    expect(url).toContain('destination_place_id=abc123');
    expect(url).toContain('travelmode=walking');
  });
});

describe('getGooglePlacePhotoUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(import.meta.env, originalEnv);
  });

  it('returns null when API key is missing and cache returns null', async () => {
    // Mock cache to call the fetcher (simulating cache miss)
    (getCached as unknown as Mock).mockImplementation(
      async (_key: string, _type: string, _id: string, _ttl1: number, _ttl2: number, fetcher: () => Promise<unknown>) => {
        return fetcher();
      }
    );

    Object.assign(import.meta.env, { VITE_GOOGLE_PLACES_API_KEY: undefined });
    const url = await getGooglePlacePhotoUrl('abc123');
    expect(url).toBeNull();
  });

  it('returns cached photo url from cache layer', async () => {
    const cachedPhotoUrl = 'https://places.googleapis.com/v1/places/abc123/photos/photo-1/media?maxWidthPx=600&key=test-key';
    
    // Mock cache to return cached data
    (getCached as unknown as Mock).mockResolvedValue({ photoUrl: cachedPhotoUrl });

    const url = await getGooglePlacePhotoUrl('abc123', 600);
    expect(url).toBe(cachedPhotoUrl);
    expect(getCached).toHaveBeenCalledTimes(1);
    expect(getCached).toHaveBeenCalledWith(
      'photo:abc123:600',
      'photo',
      'abc123',
      expect.any(Number),
      expect.any(Number),
      expect.any(Function)
    );
  });

  it('fetches photo url when cache misses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ name: 'places/abc123/photos/photo-1' }] }),
      text: async () => '',
    } as unknown as Response);

    vi.stubGlobal('fetch', fetchMock);
    Object.assign(import.meta.env, { VITE_GOOGLE_PLACES_API_KEY: 'test-key' });

    // Mock cache to call the fetcher (simulating cache miss)
    (getCached as unknown as Mock).mockImplementation(
      async (_key: string, _type: string, _id: string, _ttl1: number, _ttl2: number, fetcher: () => Promise<unknown>) => {
        return fetcher();
      }
    );

    const url = await getGooglePlacePhotoUrl('abc123', 600);
    expect(url).toBe(
      'https://places.googleapis.com/v1/places/abc123/photos/photo-1/media?maxWidthPx=600&key=test-key'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

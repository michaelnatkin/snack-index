import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { getGoogleMapsUrl, getGooglePlacePhotoUrl, getPlaceHours } from './googlePlaces';

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

  it('throws when API key is missing', async () => {
    // Clear the API key by deleting it from the env object
    const savedKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    delete (import.meta.env as Record<string, unknown>).VITE_GOOGLE_PLACES_API_KEY;

    try {
      await expect(getGooglePlacePhotoUrl('abc123')).rejects.toThrow('VITE_GOOGLE_PLACES_API_KEY is not configured');
    } finally {
      // Restore the API key
      if (savedKey !== undefined) {
        (import.meta.env as Record<string, unknown>).VITE_GOOGLE_PLACES_API_KEY = savedKey;
      }
    }
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

describe('getPlaceHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(import.meta.env, originalEnv);
  });

  it('shows place as closed before opening time', async () => {
    const cachedData = {
      periods: [
        // Opens at 11:00, closes at 21:00 on Wednesday (day 3)
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '2100' } },
      ],
    };

    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // It's 8am on Wednesday - before opening time
    const wednesdayAt8am = new Date('2025-01-01T08:00:00'); // Jan 1, 2025 is a Wednesday
    const hours = await getPlaceHours('abc123', wednesdayAt8am);

    // Should be closed because 8am < 11am opening time
    expect(hours.isOpen).toBe(false);
    expect(hours.closeTime).toBe('9 PM');
  });

  it('shows place as open during opening hours', async () => {
    const cachedData = {
      periods: [
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '2100' } },
      ],
    };

    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // It's 2pm on Wednesday - during open hours
    const wednesdayAt2pm = new Date('2025-01-01T14:00:00');
    const hours = await getPlaceHours('abc123', wednesdayAt2pm);

    expect(hours.isOpen).toBe(true);
    expect(hours.closeTime).toBe('9 PM');
  });

  it('shows place as closed when no period exists for current day', async () => {
    const cachedData = {
      periods: [
        // Only open on Wednesday (day 3)
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '2100' } },
      ],
    };

    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // It's 2pm on Thursday (day 4) - no period for this day
    const thursdayAt2pm = new Date('2025-01-02T14:00:00');
    const hours = await getPlaceHours('abc123', thursdayAt2pm);

    expect(hours.isOpen).toBe(false);
  });

  it('shows place as closed after closing time', async () => {
    const cachedData = {
      periods: [
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '2100' } },
      ],
    };

    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // It's 10pm on Wednesday - after closing time
    const wednesdayAt10pm = new Date('2025-01-01T22:00:00');
    const hours = await getPlaceHours('abc123', wednesdayAt10pm);

    expect(hours.isOpen).toBe(false);
  });

  it('handles overnight hours correctly', async () => {
    const cachedData = {
      periods: [
        // Opens Friday at 6pm, closes Saturday at 2am
        { open: { day: 5, time: '1800' }, close: { day: 6, time: '0200' } },
      ],
    };

    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // It's 11pm on Friday - should be open (after open, before midnight)
    const fridayAt11pm = new Date('2025-01-03T23:00:00'); // Jan 3, 2025 is Friday
    const hours = await getPlaceHours('abc123', fridayAt11pm);

    expect(hours.isOpen).toBe(true);
    expect(hours.closeTime).toBe('2 AM');
  });

  it('formats noon and midnight correctly in AM/PM', async () => {
    // Test noon (12 PM)
    const noonData = {
      periods: [
        { open: { day: 3, time: '0900' }, close: { day: 3, time: '1200' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(noonData);
    const noonHours = await getPlaceHours('abc123', new Date('2025-01-01T10:00:00'));
    expect(noonHours.closeTime).toBe('12 PM');

    // Test midnight (12 AM)
    const midnightData = {
      periods: [
        { open: { day: 3, time: '1800' }, close: { day: 4, time: '0000' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(midnightData);
    const midnightHours = await getPlaceHours('abc123', new Date('2025-01-01T19:00:00'));
    expect(midnightHours.closeTime).toBe('12 AM');
  });

  it('includes minutes when not on the hour', async () => {
    const cachedData = {
      periods: [
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '2130' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);
    const hours = await getPlaceHours('abc123', new Date('2025-01-01T14:00:00'));
    expect(hours.closeTime).toBe('9:30 PM');
  });
});

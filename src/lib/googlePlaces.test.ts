import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { getGoogleMapsUrl, getGooglePlacePhotoUrl, getPlaceHours, isStaleGooglePlaceIdError, StaleGooglePlaceIdError } from './googlePlaces';

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

  it('handles multiple periods per day (lunch and dinner split)', async () => {
    const cachedData = {
      periods: [
        // Lunch: 11am-3pm on Wednesday
        { open: { day: 3, time: '1100' }, close: { day: 3, time: '1500' } },
        // Dinner: 5pm-9pm on Wednesday
        { open: { day: 3, time: '1700' }, close: { day: 3, time: '2100' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // During lunch (1pm) - should be open
    const lunchTime = new Date('2025-01-01T13:00:00');
    const lunchHours = await getPlaceHours('abc123', lunchTime);
    expect(lunchHours.isOpen).toBe(true);
    expect(lunchHours.closeTime).toBe('3 PM');

    // Between lunch and dinner (4pm) - should be closed
    const gapTime = new Date('2025-01-01T16:00:00');
    const gapHours = await getPlaceHours('abc123', gapTime);
    expect(gapHours.isOpen).toBe(false);

    // During dinner (6pm) - should be open
    const dinnerTime = new Date('2025-01-01T18:00:00');
    const dinnerHours = await getPlaceHours('abc123', dinnerTime);
    expect(dinnerHours.isOpen).toBe(true);
    expect(dinnerHours.closeTime).toBe('9 PM');
  });

  it('handles multiple periods - returns correct close time during second period', async () => {
    const cachedData = {
      periods: [
        // Tuesday periods (like Aviv Hummus Bar)
        { open: { day: 2, time: '1100' }, close: { day: 2, time: '1500' } },
        { open: { day: 2, time: '1700' }, close: { day: 2, time: '2100' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // 5:58pm on Tuesday - should be open with 9 PM close time
    const tuesdayEvening = new Date('2025-01-07T17:58:00'); // Jan 7, 2025 is a Tuesday
    const hours = await getPlaceHours('abc123', tuesdayEvening);

    expect(hours.isOpen).toBe(true);
    expect(hours.closeTime).toBe('9 PM');
  });

  it('returns todayHoursRange for single period', async () => {
    const cachedData = {
      periods: [
        { open: { day: 1, time: '1000' }, close: { day: 1, time: '1400' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // Monday at 11am
    const mondayMorning = new Date('2025-01-06T11:00:00');
    const hours = await getPlaceHours('abc123', mondayMorning);

    expect(hours.todayHoursRange).toBe('10 AM - 2 PM');
  });

  it('returns todayHoursRange for split hours (lunch/dinner)', async () => {
    const cachedData = {
      periods: [
        { open: { day: 2, time: '1100' }, close: { day: 2, time: '1500' } },
        { open: { day: 2, time: '1700' }, close: { day: 2, time: '2100' } },
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // Tuesday at noon
    const tuesdayNoon = new Date('2025-01-07T12:00:00');
    const hours = await getPlaceHours('abc123', tuesdayNoon);

    expect(hours.todayHoursRange).toBe('11 AM - 3 PM, 5 PM - 9 PM');
  });

  it('returns undefined todayHoursRange when no periods for that day', async () => {
    const cachedData = {
      periods: [
        { open: { day: 1, time: '1000' }, close: { day: 1, time: '1400' } }, // Monday only
      ],
    };
    (getCached as unknown as Mock).mockResolvedValue(cachedData);

    // Tuesday at noon
    const tuesdayNoon = new Date('2025-01-07T12:00:00');
    const hours = await getPlaceHours('abc123', tuesdayNoon);

    expect(hours.todayHoursRange).toBeUndefined();
  });
});

describe('isStaleGooglePlaceIdError', () => {
  it('returns true for 404 errors with "place id is no longer valid"', () => {
    const error = new Error('Place details failed: 404 Place ID is no longer valid {"error":{"status":"NOT_FOUND"}}');
    expect(isStaleGooglePlaceIdError(error)).toBe(true);
  });

  it('returns true for 404 errors with NOT_FOUND status', () => {
    const error = new Error('Place photos failed: 404 {"error":{"code":404,"status":"NOT_FOUND"}}');
    expect(isStaleGooglePlaceIdError(error)).toBe(true);
  });

  it('returns false for non-404 errors', () => {
    const error = new Error('Place details failed: 500 Internal Server Error');
    expect(isStaleGooglePlaceIdError(error)).toBe(false);
  });

  it('returns false for 404 without stale place ID message', () => {
    const error = new Error('Resource not found: 404');
    expect(isStaleGooglePlaceIdError(error)).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isStaleGooglePlaceIdError('some string')).toBe(false);
    expect(isStaleGooglePlaceIdError(null)).toBe(false);
    expect(isStaleGooglePlaceIdError(undefined)).toBe(false);
    expect(isStaleGooglePlaceIdError(123)).toBe(false);
  });
});

describe('StaleGooglePlaceIdError', () => {
  it('creates error with correct properties', () => {
    const originalError = new Error('API failed');
    const error = new StaleGooglePlaceIdError('ChIJ123abc', originalError);

    expect(error.name).toBe('StaleGooglePlaceIdError');
    expect(error.googlePlaceId).toBe('ChIJ123abc');
    expect(error.originalError).toBe(originalError);
    expect(error.message).toContain('ChIJ123abc');
  });

  it('is instanceof Error', () => {
    const error = new StaleGooglePlaceIdError('test', new Error('test'));
    expect(error instanceof Error).toBe(true);
  });
});

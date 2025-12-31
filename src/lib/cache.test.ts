import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: vi.fn((ms: number) => ({ toMillis: () => ms })),
  },
}));

vi.mock('./firebase', () => ({
  db: {},
}));

// Import after mocks are set up
import {
  getCached,
  getCacheKey,
  clearLocalCache,
  CACHE_TTL,
} from './cache';

describe('Cache Service', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      key: vi.fn((index: number) => Object.keys(mockLocalStorage)[index] || null),
      get length() {
        return Object.keys(mockLocalStorage).length;
      },
    });

    // Clear mock storage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getCacheKey', () => {
    it('generates key without suffix', () => {
      expect(getCacheKey('hours', 'place-123')).toBe('hours:place-123');
    });

    it('generates key with suffix', () => {
      expect(getCacheKey('photo', 'place-123', '800')).toBe('photo:place-123:800');
    });
  });

  describe('getCached', () => {
    it('returns data from localStorage when available and fresh', async () => {
      const cacheKey = 'hours:test-place';
      const cachedData = { openNow: true, periods: [] };
      const fetcher = vi.fn();

      // Pre-populate localStorage
      mockLocalStorage['snack-cache:' + cacheKey] = JSON.stringify({
        data: cachedData,
        timestamp: Date.now(),
      });

      const result = await getCached(
        cacheKey,
        'hours',
        'test-place',
        CACHE_TTL.PLACE_HOURS,
        CACHE_TTL.LOCAL_HOURS,
        fetcher
      );

      expect(result).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('falls back to Firestore when localStorage is stale', async () => {
      const cacheKey = 'hours:test-place';
      const cachedData = { openNow: true, periods: [] };
      const fetcher = vi.fn();

      // Pre-populate localStorage with stale data
      mockLocalStorage['snack-cache:' + cacheKey] = JSON.stringify({
        data: cachedData,
        timestamp: Date.now() - CACHE_TTL.LOCAL_HOURS - 1000,
      });

      // Mock Firestore response with fresh data
      const freshData = { openNow: false, periods: [] };
      (doc as unknown as Mock).mockReturnValue('doc-ref');
      (getDoc as unknown as Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'hours',
          googlePlaceId: 'test-place',
          data: freshData,
          createdAt: { toMillis: () => Date.now() },
          expiresAt: { toMillis: () => Date.now() + CACHE_TTL.PLACE_HOURS },
        }),
      });

      const result = await getCached(
        cacheKey,
        'hours',
        'test-place',
        CACHE_TTL.PLACE_HOURS,
        CACHE_TTL.LOCAL_HOURS,
        fetcher
      );

      expect(result).toEqual(freshData);
      expect(fetcher).not.toHaveBeenCalled();
      expect(getDoc).toHaveBeenCalled();
    });

    it('calls fetcher when both caches miss', async () => {
      const cacheKey = 'hours:test-place';
      const freshData = { openNow: true, periods: [] };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      // Mock Firestore cache miss
      (doc as unknown as Mock).mockReturnValue('doc-ref');
      (getDoc as unknown as Mock).mockResolvedValue({
        exists: () => false,
      });
      (setDoc as unknown as Mock).mockResolvedValue(undefined);

      const result = await getCached(
        cacheKey,
        'hours',
        'test-place',
        CACHE_TTL.PLACE_HOURS,
        CACHE_TTL.LOCAL_HOURS,
        fetcher
      );

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(setDoc).toHaveBeenCalled();
    });

    it('populates localStorage after fetching from Firestore', async () => {
      const cacheKey = 'hours:test-place';
      const cachedData = { openNow: true, periods: [] };
      const fetcher = vi.fn();

      // Mock Firestore response
      (doc as unknown as Mock).mockReturnValue('doc-ref');
      (getDoc as unknown as Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          type: 'hours',
          googlePlaceId: 'test-place',
          data: cachedData,
          createdAt: { toMillis: () => Date.now() },
          expiresAt: { toMillis: () => Date.now() + CACHE_TTL.PLACE_HOURS },
        }),
      });

      await getCached(
        cacheKey,
        'hours',
        'test-place',
        CACHE_TTL.PLACE_HOURS,
        CACHE_TTL.LOCAL_HOURS,
        fetcher
      );

      // Check that localStorage was populated
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'snack-cache:' + cacheKey,
        expect.any(String)
      );
    });
  });

  describe('clearLocalCache', () => {
    it('removes all cache entries from localStorage', () => {
      // Pre-populate with cache entries
      mockLocalStorage['snack-cache:hours:place-1'] = JSON.stringify({ data: {}, timestamp: Date.now() });
      mockLocalStorage['snack-cache:photo:place-2:800'] = JSON.stringify({ data: {}, timestamp: Date.now() });
      mockLocalStorage['other-key'] = 'should-not-be-removed';

      clearLocalCache();

      expect(localStorage.removeItem).toHaveBeenCalledWith('snack-cache:hours:place-1');
      expect(localStorage.removeItem).toHaveBeenCalledWith('snack-cache:photo:place-2:800');
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('other-key');
    });
  });

  describe('CACHE_TTL', () => {
    it('has reasonable default TTL values', () => {
      expect(CACHE_TTL.PLACE_HOURS).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(CACHE_TTL.PLACE_DETAILS).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
      expect(CACHE_TTL.PLACE_PHOTO).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(CACHE_TTL.LOCAL_HOURS).toBe(24 * 60 * 60 * 1000); // 24 hours (matches Firestore)
    });
  });
});


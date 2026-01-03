import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Place, Dish, DietaryFilters } from '@/types/models';

// Mock firebase
vi.mock('./firebase', () => ({
  db: {},
}));

// Mock firestore
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  orderBy: vi.fn(),
  startAt: vi.fn(),
  endAt: vi.fn(),
}));

// Mock places
const mockGetActivePlaces = vi.fn();
const mockGetActiveDishesForPlace = vi.fn();
vi.mock('./places', () => ({
  getActivePlaces: (...args: unknown[]) => mockGetActivePlaces(...args),
  getActiveDishesForPlace: (...args: unknown[]) => mockGetActiveDishesForPlace(...args),
}));

// Mock googlePlaces
const mockGetPlaceHoursWithRefresh = vi.fn();
vi.mock('./googlePlaces', () => ({
  getPlaceHoursWithRefresh: (...args: unknown[]) => mockGetPlaceHoursWithRefresh(...args),
}));

// Mock location
const mockIsInSeattleArea = vi.fn();
const mockCalculateDistance = vi.fn();
vi.mock('./location', () => ({
  isInSeattleArea: (...args: unknown[]) => mockIsInSeattleArea(...args),
  calculateDistance: (...args: unknown[]) => mockCalculateDistance(...args),
}));

// Mock geofire-common
vi.mock('geofire-common', () => ({
  geohashQueryBounds: vi.fn().mockReturnValue([['abc', 'def']]),
  distanceBetween: vi.fn().mockReturnValue(1), // 1km
}));

// Import the ACTUAL functions to test
import {
  processCandidateBatch,
  getNearbyEligiblePlaces,
  getNearestOpenPlace,
  getRecommendationQueue,
  type PlaceWithDistance,
} from './recommendations';

// Test fixtures
const createMockPlace = (id: string, name: string, lat = 47.6, lng = -122.3): Place => ({
  id,
  name,
  googlePlaceId: `google-${id}`,
  address: '123 Test St',
  latitude: lat,
  longitude: lng,
  geohash: 'abc123',
  status: 'ACCEPTED',
} as Place);

const createMockDish = (
  id: string,
  name: string,
  dietary: { vegetarian: boolean; vegan: boolean; glutenFree: boolean }
): Dish => ({
  id,
  placeId: 'place-1',
  name,
  description: 'A test dish',
  price: 10,
  dietary,
  status: 'ACCEPTED',
  isHero: false,
} as unknown as Dish);

describe('Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockIsInSeattleArea.mockReturnValue(true);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockGetActivePlaces.mockResolvedValue([]);
    mockGetActiveDishesForPlace.mockResolvedValue([]);
    mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true, closeTime: undefined });
  });

  describe('processCandidateBatch', () => {
    it('returns empty array for empty input', async () => {
      const result = await processCandidateBatch([], { vegetarian: false, vegan: false, glutenFree: false });
      expect(result).toEqual([]);
    });

    it('processes candidates and returns only open places with matching dishes', async () => {
      const place1 = createMockPlace('1', 'Open Place');
      const place2 = createMockPlace('2', 'Closed Place');
      const dish1 = createMockDish('d1', 'Taco', { vegetarian: true, vegan: false, glutenFree: false });

      const candidates: PlaceWithDistance[] = [
        { place: place1, distance: 0.5 },
        { place: place2, distance: 1.0 },
      ];

      // place1 is open with dishes, place2 is closed
      mockGetActiveDishesForPlace.mockImplementation((placeId: string) => {
        if (placeId === '1') return Promise.resolve([dish1]);
        return Promise.resolve([dish1]);
      });
      mockGetPlaceHoursWithRefresh.mockImplementation((firestorePlaceId: string, googlePlaceId: string) => {
        if (googlePlaceId === 'google-1') return Promise.resolve({ isOpen: true, closeTime: '22:00' });
        return Promise.resolve({ isOpen: false, closeTime: undefined });
      });

      const filters: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: false };
      const result = await processCandidateBatch(candidates, filters);

      expect(result).toHaveLength(1);
      expect(result[0].place.id).toBe('1');
      expect(result[0].isOpen).toBe(true);
    });

    it('filters out places with no matching dishes for dietary filters', async () => {
      const place = createMockPlace('1', 'Non-Vegan Place');
      const nonVeganDish = createMockDish('d1', 'Burger', { vegetarian: false, vegan: false, glutenFree: false });

      const candidates: PlaceWithDistance[] = [{ place, distance: 0.5 }];

      mockGetActiveDishesForPlace.mockResolvedValue([nonVeganDish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const veganFilters: DietaryFilters = { vegetarian: false, vegan: true, glutenFree: false };
      const result = await processCandidateBatch(candidates, veganFilters);

      expect(result).toHaveLength(0);
    });

    it('includes places with matching dietary dishes', async () => {
      const place = createMockPlace('1', 'Vegan Place');
      const veganDish = createMockDish('d1', 'Tofu Bowl', { vegetarian: true, vegan: true, glutenFree: true });

      const candidates: PlaceWithDistance[] = [{ place, distance: 0.5 }];

      mockGetActiveDishesForPlace.mockResolvedValue([veganDish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const veganFilters: DietaryFilters = { vegetarian: false, vegan: true, glutenFree: false };
      const result = await processCandidateBatch(candidates, veganFilters);

      expect(result).toHaveLength(1);
      expect(result[0].place.name).toBe('Vegan Place');
      expect(result[0].dishes).toHaveLength(1);
    });

    it('vegan dishes pass vegetarian filter (vegan implies vegetarian)', async () => {
      const place = createMockPlace('1', 'Vegan Place');
      // This dish is vegan but NOT marked as vegetarian - should still pass vegetarian filter
      const veganOnlyDish = createMockDish('d1', 'Vegan Salad', { vegetarian: false, vegan: true, glutenFree: false });

      const candidates: PlaceWithDistance[] = [{ place, distance: 0.5 }];

      mockGetActiveDishesForPlace.mockResolvedValue([veganOnlyDish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const vegetarianFilters: DietaryFilters = { vegetarian: true, vegan: false, glutenFree: false };
      const result = await processCandidateBatch(candidates, vegetarianFilters);

      expect(result).toHaveLength(1);
      expect(result[0].dishes).toHaveLength(1);
      expect(result[0].dishes[0].name).toBe('Vegan Salad');
    });

    it('selects hero dish from matching dishes when available', async () => {
      const place = createMockPlace('1', 'Hero Place');
      const regularDish = createMockDish('d1', 'Regular Dish', { vegetarian: false, vegan: false, glutenFree: false });
      const heroDish = { ...createMockDish('d2', 'Hero Dish', { vegetarian: false, vegan: false, glutenFree: false }), isHero: true };

      const candidates: PlaceWithDistance[] = [{ place, distance: 0.5 }];

      mockGetActiveDishesForPlace.mockResolvedValue([regularDish, heroDish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const filters: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: false };
      const result = await processCandidateBatch(candidates, filters);

      expect(result).toHaveLength(1);
      // Hero dish should be selected
      expect(result[0].heroDish?.name).toBe('Hero Dish');
    });

    it('filters hero dish by dietary restrictions', async () => {
      const place = createMockPlace('1', 'Place With Heroes');
      const nonVeganHero = { ...createMockDish('d1', 'Meat Hero', { vegetarian: false, vegan: false, glutenFree: false }), isHero: true };
      const veganDish = createMockDish('d2', 'Vegan Side', { vegetarian: true, vegan: true, glutenFree: false });

      const candidates: PlaceWithDistance[] = [{ place, distance: 0.5 }];

      mockGetActiveDishesForPlace.mockResolvedValue([nonVeganHero, veganDish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const veganFilters: DietaryFilters = { vegetarian: false, vegan: true, glutenFree: false };
      const result = await processCandidateBatch(candidates, veganFilters);

      expect(result).toHaveLength(1);
      // Non-vegan hero should be filtered out, vegan dish should be selected
      expect(result[0].heroDish?.name).toBe('Vegan Side');
      expect(result[0].dishes).toHaveLength(1);
    });

    it('sorts results by distance', async () => {
      const place1 = createMockPlace('1', 'Far Place');
      const place2 = createMockPlace('2', 'Close Place');
      const dish = createMockDish('d1', 'Dish', { vegetarian: false, vegan: false, glutenFree: false });

      // Note: passing in order far, close
      const candidates: PlaceWithDistance[] = [
        { place: place1, distance: 2.0 },
        { place: place2, distance: 0.5 },
      ];

      mockGetActiveDishesForPlace.mockResolvedValue([dish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const filters: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: false };
      const result = await processCandidateBatch(candidates, filters);

      expect(result).toHaveLength(2);
      // Should be sorted by distance (close first)
      expect(result[0].place.name).toBe('Close Place');
      expect(result[1].place.name).toBe('Far Place');
    });
  });

  describe('getNearbyEligiblePlaces', () => {
    it('returns not_in_area when user is outside Seattle', async () => {
      mockIsInSeattleArea.mockReturnValue(false);
      const previewPlaces = [createMockPlace('1', 'Preview Place')];
      mockGetActivePlaces.mockResolvedValue(previewPlaces);

      const result = await getNearbyEligiblePlaces(
        { latitude: 40.7, longitude: -74.0 }, // NYC
        'user-123'
      );

      expect(result.type).toBe('not_in_area');
      if (result.type === 'not_in_area') {
        expect(result.previewPlaces).toHaveLength(1);
      }
    });

    it('returns success with places when user is in Seattle area', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      
      // Mock geohash query returning places
      mockGetDocs.mockResolvedValue({
        docs: [{
          id: '1',
          data: () => ({
            name: 'Seattle Place',
            googlePlaceId: 'google-1',
            address: '123 Test St',
            latitude: 47.6,
            longitude: -122.3,
            geohash: 'abc123',
            status: 'ACCEPTED',
          }),
        }],
      });

      const result = await getNearbyEligiblePlaces(
        { latitude: 47.6, longitude: -122.3 },
        'user-123'
      );

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.places).toHaveLength(1);
        expect(result.places[0].place.name).toBe('Seattle Place');
      }
    });

    it('filters out dismissed places', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      
      // Two places in database
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: '1',
              data: () => ({
                name: 'Place 1',
                googlePlaceId: 'google-1',
                latitude: 47.6,
                longitude: -122.3,
                status: 'ACCEPTED',
              }),
            },
            {
              id: '2',
              data: () => ({
                name: 'Place 2',
                googlePlaceId: 'google-2',
                latitude: 47.61,
                longitude: -122.31,
                status: 'ACCEPTED',
              }),
            },
          ],
        })
        // Dismissed places query
        .mockResolvedValueOnce({
          docs: [{
            data: () => ({ placeId: '1', userId: 'user-123', dismissed: true }),
          }],
        });

      const result = await getNearbyEligiblePlaces(
        { latitude: 47.6, longitude: -122.3 },
        'user-123'
      );

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.places).toHaveLength(1);
        expect(result.places[0].place.id).toBe('2');
      }
    });
  });

  describe('getNearestOpenPlace', () => {
    it('returns not_in_area when user is outside Seattle', async () => {
      mockIsInSeattleArea.mockReturnValue(false);
      mockGetActivePlaces.mockResolvedValue([createMockPlace('1', 'Preview')]);

      const result = await getNearestOpenPlace(
        { latitude: 40.7, longitude: -74.0 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123'
      );

      expect(result.type).toBe('not_in_area');
    });

    it('returns nothing_open when no places are nearby', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetActivePlaces.mockResolvedValue([]);

      const result = await getNearestOpenPlace(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123'
      );

      expect(result.type).toBe('nothing_open');
    });

    it('returns recommendation when open place exists', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      const dish = createMockDish('d1', 'Taco', { vegetarian: false, vegan: false, glutenFree: false });
      
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{
            id: '1',
            data: () => ({
              name: 'Open Place',
              googlePlaceId: 'google-1',
              latitude: 47.6,
              longitude: -122.3,
              status: 'ACCEPTED',
            }),
          }],
        })
        .mockResolvedValueOnce({ docs: [] }); // no dismissed places

      mockGetActiveDishesForPlace.mockResolvedValue([dish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true, closeTime: '22:00' });

      const result = await getNearestOpenPlace(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123'
      );

      expect(result.type).toBe('recommendation');
      if (result.type === 'recommendation') {
        expect(result.recommendation?.place.name).toBe('Open Place');
        expect(result.recommendation?.isOpen).toBe(true);
      }
    });

    it('returns all_seen when user has dismissed all places', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{
            id: '1',
            data: () => ({
              name: 'Dismissed Place',
              googlePlaceId: 'google-1',
              latitude: 47.6,
              longitude: -122.3,
              status: 'ACCEPTED',
            }),
          }],
        })
        .mockResolvedValueOnce({
          docs: [{
            data: () => ({ placeId: '1', userId: 'user-123', dismissed: true }),
          }],
        });

      const result = await getNearestOpenPlace(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123'
      );

      expect(result.type).toBe('all_seen');
    });
  });

  describe('getRecommendationQueue', () => {
    it('returns empty array when user is outside Seattle', async () => {
      mockIsInSeattleArea.mockReturnValue(false);

      const result = await getRecommendationQueue(
        { latitude: 40.7, longitude: -74.0 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123',
        10
      );

      expect(result).toEqual([]);
    });

    it('returns recommendations sorted by distance', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      const dish = createMockDish('d1', 'Dish', { vegetarian: false, vegan: false, glutenFree: false });

      // Return two places
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: '1',
              data: () => ({
                name: 'Far Place',
                googlePlaceId: 'google-1',
                latitude: 47.7,
                longitude: -122.3,
                status: 'ACCEPTED',
              }),
            },
            {
              id: '2',
              data: () => ({
                name: 'Close Place',
                googlePlaceId: 'google-2',
                latitude: 47.6,
                longitude: -122.3,
                status: 'ACCEPTED',
              }),
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [] }); // no dismissed

      mockGetActiveDishesForPlace.mockResolvedValue([dish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const result = await getRecommendationQueue(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123',
        10
      );

      expect(result).toHaveLength(2);
      // Should be sorted by distance
      expect(result[0].distance).toBeLessThanOrEqual(result[1].distance);
    });

    it('respects the limit parameter', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      const dish = createMockDish('d1', 'Dish', { vegetarian: false, vegan: false, glutenFree: false });

      // Return 5 places
      mockGetDocs
        .mockResolvedValueOnce({
          docs: Array.from({ length: 5 }, (_, i) => ({
            id: String(i),
            data: () => ({
              name: `Place ${i}`,
              googlePlaceId: `google-${i}`,
              latitude: 47.6 + i * 0.01,
              longitude: -122.3,
              status: 'ACCEPTED',
            }),
          })),
        })
        .mockResolvedValueOnce({ docs: [] });

      mockGetActiveDishesForPlace.mockResolvedValue([dish]);
      mockGetPlaceHoursWithRefresh.mockResolvedValue({ isOpen: true });

      const result = await getRecommendationQueue(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123',
        2 // Only want 2
      );

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('filters out closed places', async () => {
      mockIsInSeattleArea.mockReturnValue(true);
      const dish = createMockDish('d1', 'Dish', { vegetarian: false, vegan: false, glutenFree: false });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: '1',
              data: () => ({
                name: 'Open Place',
                googlePlaceId: 'google-1',
                latitude: 47.6,
                longitude: -122.3,
                status: 'ACCEPTED',
              }),
            },
            {
              id: '2',
              data: () => ({
                name: 'Closed Place',
                googlePlaceId: 'google-2',
                latitude: 47.61,
                longitude: -122.3,
                status: 'ACCEPTED',
              }),
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [] });

      mockGetActiveDishesForPlace.mockResolvedValue([dish]);
      mockGetPlaceHoursWithRefresh.mockImplementation((firestorePlaceId: string, googlePlaceId: string) => {
        if (googlePlaceId === 'google-1') return Promise.resolve({ isOpen: true });
        return Promise.resolve({ isOpen: false });
      });

      const result = await getRecommendationQueue(
        { latitude: 47.6, longitude: -122.3 },
        { vegetarian: false, vegan: false, glutenFree: false },
        'user-123',
        10
      );

      expect(result).toHaveLength(1);
      expect(result[0].place.name).toBe('Open Place');
    });
  });
});

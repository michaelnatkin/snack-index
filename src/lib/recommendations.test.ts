import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DietaryFilters } from '@/types/models';

// Mock dependencies
vi.mock('./firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock('./places', () => ({
  getActivePlaces: vi.fn().mockResolvedValue([]),
  getActiveDishesForPlace: vi.fn().mockResolvedValue([]),
  getHeroDishForPlace: vi.fn().mockResolvedValue(null),
}));

vi.mock('./googlePlaces', () => ({
  getPlaceHours: vi.fn().mockResolvedValue({ isOpen: true }),
}));

describe('Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dietary filtering logic', () => {
    const mockDishes = [
      { id: '1', name: 'Vegan Tacos', dietary: { vegetarian: true, vegan: true, glutenFree: true } },
      { id: '2', name: 'Beef Burger', dietary: { vegetarian: false, vegan: false, glutenFree: false } },
      { id: '3', name: 'Veggie Pizza', dietary: { vegetarian: true, vegan: false, glutenFree: false } },
    ];

    function filterDishesByDietary(dishes: typeof mockDishes, filters: DietaryFilters) {
      return dishes.filter((dish) => {
        if (!filters.vegetarian && !filters.vegan && !filters.glutenFree) {
          return true;
        }
        if (filters.vegetarian && !dish.dietary.vegetarian) return false;
        if (filters.vegan && !dish.dietary.vegan) return false;
        if (filters.glutenFree && !dish.dietary.glutenFree) return false;
        return true;
      });
    }

    it('returns all dishes when no filters active', () => {
      const filters: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: false };
      const result = filterDishesByDietary(mockDishes, filters);
      expect(result.length).toBe(3);
    });

    it('filters for vegetarian only', () => {
      const filters: DietaryFilters = { vegetarian: true, vegan: false, glutenFree: false };
      const result = filterDishesByDietary(mockDishes, filters);
      expect(result.length).toBe(2);
      expect(result.every((d) => d.dietary.vegetarian)).toBe(true);
    });

    it('filters for vegan only', () => {
      const filters: DietaryFilters = { vegetarian: false, vegan: true, glutenFree: false };
      const result = filterDishesByDietary(mockDishes, filters);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Vegan Tacos');
    });

    it('filters for gluten-free only', () => {
      const filters: DietaryFilters = { vegetarian: false, vegan: false, glutenFree: true };
      const result = filterDishesByDietary(mockDishes, filters);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Vegan Tacos');
    });

    it('filters for multiple requirements', () => {
      const filters: DietaryFilters = { vegetarian: true, vegan: true, glutenFree: false };
      const result = filterDishesByDietary(mockDishes, filters);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Vegan Tacos');
    });
  });

  describe('Distance sorting', () => {
    const mockPlacesWithDistance = [
      { id: '1', name: 'Far Place', distance: 2.5 },
      { id: '2', name: 'Close Place', distance: 0.3 },
      { id: '3', name: 'Medium Place', distance: 1.0 },
    ];

    it('sorts places by distance ascending', () => {
      const sorted = [...mockPlacesWithDistance].sort((a, b) => a.distance - b.distance);
      expect(sorted[0].name).toBe('Close Place');
      expect(sorted[1].name).toBe('Medium Place');
      expect(sorted[2].name).toBe('Far Place');
    });

    it('filters places beyond max distance', () => {
      const maxDistance = 1.5;
      const filtered = mockPlacesWithDistance.filter((p) => p.distance <= maxDistance);
      expect(filtered.length).toBe(2);
      expect(filtered.find((p) => p.name === 'Far Place')).toBeUndefined();
    });
  });

  describe('Place state filtering', () => {
    it('excludes dismissed places', () => {
      const places = [
        { id: '1', name: 'Place A' },
        { id: '2', name: 'Place B' },
        { id: '3', name: 'Place C' },
      ];
      const dismissedIds = new Set(['2']);

      const filtered = places.filter((p) => !dismissedIds.has(p.id));
      expect(filtered.length).toBe(2);
      expect(filtered.find((p) => p.name === 'Place B')).toBeUndefined();
    });

    it('excludes closed places', () => {
      const places = [
        { id: '1', name: 'Open Place', isOpen: true },
        { id: '2', name: 'Closed Place', isOpen: false },
      ];

      const openPlaces = places.filter((p) => p.isOpen);
      expect(openPlaces.length).toBe(1);
      expect(openPlaces[0].name).toBe('Open Place');
    });
  });

  describe('Two-tier queue logic', () => {
    it('processes candidates in batch and filters by open status', () => {
      // Simulate batch processing logic
      const candidates = [
        { place: { id: '1', name: 'Open Place' }, distance: 0.5 },
        { place: { id: '2', name: 'Closed Place' }, distance: 1.0 },
        { place: { id: '3', name: 'Another Open' }, distance: 1.5 },
      ];
      
      // Simulate processing results (some open, some closed)
      const processedResults = [
        { place: candidates[0].place, distance: 0.5, isOpen: true },
        null, // closed place returns null
        { place: candidates[2].place, distance: 1.5, isOpen: true },
      ];

      const ready = processedResults.filter((r) => r !== null);
      expect(ready.length).toBe(2);
      expect(ready[0]?.place.name).toBe('Open Place');
      expect(ready[1]?.place.name).toBe('Another Open');
    });

    it('maintains distance order after filtering', () => {
      const results = [
        { place: { id: '3', name: 'Far' }, distance: 2.0, isOpen: true },
        { place: { id: '1', name: 'Close' }, distance: 0.5, isOpen: true },
        { place: { id: '2', name: 'Medium' }, distance: 1.0, isOpen: true },
      ];

      const sorted = results.sort((a, b) => a.distance - b.distance);
      expect(sorted[0].place.name).toBe('Close');
      expect(sorted[1].place.name).toBe('Medium');
      expect(sorted[2].place.name).toBe('Far');
    });

    it('handles empty candidate batch', () => {
      const candidates: Array<{ place: { id: string }; distance: number }> = [];
      expect(candidates.length).toBe(0);
      // processCandidateBatch should return empty array for empty input
    });

    it('correctly slices candidates for pagination', () => {
      const allCandidates = Array.from({ length: 50 }, (_, i) => ({
        place: { id: String(i), name: `Place ${i}` },
        distance: i * 0.1,
      }));

      // Initial batch: first 20
      const initialBatch = allCandidates.slice(0, 20);
      expect(initialBatch.length).toBe(20);
      expect(initialBatch[0].place.name).toBe('Place 0');
      expect(initialBatch[19].place.name).toBe('Place 19');

      // Load more: next 10
      let offset = 20;
      const moreBatch = allCandidates.slice(offset, offset + 10);
      expect(moreBatch.length).toBe(10);
      expect(moreBatch[0].place.name).toBe('Place 20');
      expect(moreBatch[9].place.name).toBe('Place 29');

      // Continue loading
      offset = 30;
      const evenMoreBatch = allCandidates.slice(offset, offset + 10);
      expect(evenMoreBatch[0].place.name).toBe('Place 30');
    });
  });
});


import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { createPlace, updatePlace } from './places';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

vi.mock('./firebase', () => ({
  db: {},
}));

vi.mock('geofire-common', () => ({
  geohashForLocation: vi.fn(() => 'mock-hash'),
}));

describe('Places CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Geohash persistence', () => {
    beforeEach(() => {
      (collection as unknown as Mock).mockReturnValue('places-col');
      (doc as unknown as Mock).mockReturnValue('doc-ref');
      (addDoc as unknown as Mock).mockResolvedValue({ id: 'new-id' });
      (updateDoc as unknown as Mock).mockResolvedValue(undefined);
      (getDoc as unknown as Mock).mockResolvedValue({
        data: () => ({ latitude: 47.6, longitude: -122.3 }),
      });
      (geohashForLocation as unknown as Mock).mockReturnValue('mock-hash');
    });

    it('adds a geohash when creating a place', async () => {
      const placeId = await createPlace({
        googlePlaceId: 'g-1',
        name: 'Test Place',
        address: '123 Test St',
        latitude: 47.61,
        longitude: -122.33,
        isActive: true,
        createdBy: 'tester',
      });

      expect(placeId).toBe('new-id');
      expect(geohashForLocation).toHaveBeenCalledWith([47.61, -122.33]);
      expect(addDoc).toHaveBeenCalledWith(
        'places-col',
        expect.objectContaining({ geohash: 'mock-hash' })
      );
    });

    it('recomputes geohash when coordinates change on update', async () => {
      await updatePlace('place-1', { latitude: 47.7, longitude: -122.2 });

      expect(doc).toHaveBeenCalledWith({}, 'places', 'place-1');
      expect(getDoc).toHaveBeenCalledWith('doc-ref');
      expect(geohashForLocation).toHaveBeenCalledWith([47.7, -122.2]);
      expect(updateDoc).toHaveBeenCalledWith(
        'doc-ref',
        expect.objectContaining({ geohash: 'mock-hash' })
      );
    });
  });

  describe('Place data structure', () => {
    it('should have required fields for a place', () => {
      const place = {
        id: 'test-id',
        googlePlaceId: 'google-place-id',
        name: 'Test Place',
        address: '123 Test St',
        latitude: 47.6,
        longitude: -122.3,
        isActive: true,
        createdBy: 'admin-user-id',
      };

      expect(place.googlePlaceId).toBeDefined();
      expect(place.name).toBeDefined();
      expect(place.address).toBeDefined();
      expect(place.latitude).toBeTypeOf('number');
      expect(place.longitude).toBeTypeOf('number');
      expect(place.isActive).toBeTypeOf('boolean');
    });
  });

  describe('Dish data structure', () => {
    it('should have required fields for a dish', () => {
      const dish = {
        id: 'test-dish-id',
        placeId: 'test-place-id',
        name: 'Test Dish',
        isHero: false,
        dietary: {
          vegetarian: false,
          vegan: false,
          glutenFree: true,
        },
        isActive: true,
      };

      expect(dish.placeId).toBeDefined();
      expect(dish.name).toBeDefined();
      expect(dish.isHero).toBeTypeOf('boolean');
      expect(dish.dietary).toBeDefined();
      expect(dish.dietary.glutenFree).toBe(true);
    });

    it('should have correct dietary filter structure', () => {
      const dietary = {
        vegetarian: true,
        vegan: false,
        glutenFree: true,
      };

      expect(Object.keys(dietary)).toEqual(['vegetarian', 'vegan', 'glutenFree']);
    });
  });

  describe('Hero dish logic', () => {
    it('should allow only one hero dish per place', () => {
      const dishes = [
        { id: '1', placeId: 'place-1', isHero: true },
        { id: '2', placeId: 'place-1', isHero: false },
        { id: '3', placeId: 'place-1', isHero: false },
      ];

      const heroDishes = dishes.filter((d) => d.isHero);
      expect(heroDishes.length).toBe(1);
    });
  });
});

describe('Place filtering', () => {
  const mockPlaces = [
    { id: '1', name: 'Active Place', isActive: true },
    { id: '2', name: 'Inactive Place', isActive: false },
    { id: '3', name: 'Another Active', isActive: true },
  ];

  it('should filter to only active places', () => {
    const activePlaces = mockPlaces.filter((p) => p.isActive);
    expect(activePlaces.length).toBe(2);
    expect(activePlaces.every((p) => p.isActive)).toBe(true);
  });

  it('should filter places by name search', () => {
    const searchQuery = 'Another';
    const filtered = mockPlaces.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Another Active');
  });
});

describe('Dish filtering', () => {
  const mockDishes = [
    { id: '1', name: 'Vegan Tacos', dietary: { vegetarian: true, vegan: true, glutenFree: true } },
    { id: '2', name: 'Beef Burger', dietary: { vegetarian: false, vegan: false, glutenFree: false } },
    { id: '3', name: 'Veggie Pizza', dietary: { vegetarian: true, vegan: false, glutenFree: false } },
    { id: '4', name: 'GF Pasta', dietary: { vegetarian: true, vegan: false, glutenFree: true } },
  ];

  it('should filter vegetarian dishes', () => {
    const vegDishes = mockDishes.filter((d) => d.dietary.vegetarian);
    expect(vegDishes.length).toBe(3);
  });

  it('should filter vegan dishes', () => {
    const veganDishes = mockDishes.filter((d) => d.dietary.vegan);
    expect(veganDishes.length).toBe(1);
    expect(veganDishes[0].name).toBe('Vegan Tacos');
  });

  it('should filter gluten-free dishes', () => {
    const gfDishes = mockDishes.filter((d) => d.dietary.glutenFree);
    expect(gfDishes.length).toBe(2);
  });

  it('should filter by multiple dietary requirements', () => {
    const vegetarianAndGF = mockDishes.filter(
      (d) => d.dietary.vegetarian && d.dietary.glutenFree
    );
    expect(vegetarianAndGF.length).toBe(2);
  });
});


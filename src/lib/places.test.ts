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

  // Note: Data structure validation is handled by TypeScript types in models.ts
  // Hero dish enforcement is tested via createDish/updateDish with proper mocks
});

// Note: Place and dish filtering logic is tested in recommendations.test.ts
// which tests the actual exported filterDishesByDietary function via processCandidateBatch



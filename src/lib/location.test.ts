import { describe, it, expect } from 'vitest';
import { 
  calculateDistance, 
  formatDistance, 
  isInSeattleArea,
  SEATTLE_BOUNDS 
} from './location';

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    const point = { latitude: 47.6062, longitude: -122.3321 };
    const distance = calculateDistance(point, point);
    expect(distance).toBe(0);
  });

  it('calculates distance between Seattle and Bellevue correctly', () => {
    const seattle = { latitude: 47.6062, longitude: -122.3321 };
    const bellevue = { latitude: 47.6101, longitude: -122.2015 };
    const distance = calculateDistance(seattle, bellevue);
    // Should be approximately 6-7 miles
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(8);
  });

  it('calculates distance between Capitol Hill and Pike Place', () => {
    const capitolHill = { latitude: 47.6253, longitude: -122.3222 };
    const pikePlace = { latitude: 47.6097, longitude: -122.3422 };
    const distance = calculateDistance(capitolHill, pikePlace);
    // Should be approximately 1-2 miles
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(2);
  });

  it('handles different hemispheres', () => {
    const northWest = { latitude: 47.0, longitude: -122.0 };
    const southEast = { latitude: -33.0, longitude: 151.0 };
    const distance = calculateDistance(northWest, southEast);
    // Should be a very large distance (approximately 8000+ miles)
    expect(distance).toBeGreaterThan(7000);
  });
});

describe('formatDistance', () => {
  it('returns "nearby" for very short distances', () => {
    expect(formatDistance(0.05)).toBe('nearby');
    expect(formatDistance(0.09)).toBe('nearby');
  });

  it('formats distances under a quarter mile in feet', () => {
    expect(formatDistance(0.1)).toBe('528 ft');
    expect(formatDistance(0.2)).toBe('1056 ft');
    expect(formatDistance(0.24)).toBe('1267 ft');
  });

  it('formats distances over a mile with one decimal', () => {
    expect(formatDistance(0.25)).toBe('0.3 mi');
    expect(formatDistance(0.9)).toBe('0.9 mi');
    expect(formatDistance(1.0)).toBe('1.0 mi');
    expect(formatDistance(1.5)).toBe('1.5 mi');
    expect(formatDistance(2.3)).toBe('2.3 mi');
  });
});

describe('isInSeattleArea', () => {
  it('returns true for downtown Seattle', () => {
    const downtown = { latitude: 47.6062, longitude: -122.3321 };
    expect(isInSeattleArea(downtown)).toBe(true);
  });

  it('returns true for Capitol Hill', () => {
    const capitolHill = { latitude: 47.6253, longitude: -122.3222 };
    expect(isInSeattleArea(capitolHill)).toBe(true);
  });

  it('returns true for University District', () => {
    const uDistrict = { latitude: 47.6614, longitude: -122.3131 };
    expect(isInSeattleArea(uDistrict)).toBe(true);
  });

  it('returns false for Portland', () => {
    const portland = { latitude: 45.5152, longitude: -122.6784 };
    expect(isInSeattleArea(portland)).toBe(false);
  });

  it('returns false for Vancouver BC', () => {
    const vancouver = { latitude: 49.2827, longitude: -123.1207 };
    expect(isInSeattleArea(vancouver)).toBe(false);
  });

  it('returns false for locations east of Seattle', () => {
    const spokane = { latitude: 47.6588, longitude: -117.4260 };
    expect(isInSeattleArea(spokane)).toBe(false);
  });
});

describe('SEATTLE_BOUNDS', () => {
  it('has correct bounds', () => {
    expect(SEATTLE_BOUNDS.north).toBe(47.8);
    expect(SEATTLE_BOUNDS.south).toBe(47.3);
    expect(SEATTLE_BOUNDS.east).toBe(-122.0);
    expect(SEATTLE_BOUNDS.west).toBe(-122.5);
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isShareSupported,
  getPlaceShareUrl,
  getDishShareUrl,
} from './share';

describe('isShareSupported', () => {
  it('returns true when navigator.share exists', () => {
    Object.defineProperty(global.navigator, 'share', {
      value: vi.fn(),
      writable: true,
    });
    expect(isShareSupported()).toBe(true);
  });
});

describe('getPlaceShareUrl', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://snackindex.com' },
      writable: true,
    });
  });

  it('generates correct share URL for a place', () => {
    const url = getPlaceShareUrl('place-123');
    expect(url).toBe('https://snackindex.com/s/place-123');
  });

  it('handles special characters in place ID', () => {
    const url = getPlaceShareUrl('place_123-abc');
    expect(url).toBe('https://snackindex.com/s/place_123-abc');
  });
});

describe('getDishShareUrl', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://snackindex.com' },
      writable: true,
    });
  });

  it('generates correct share URL for a dish', () => {
    const url = getDishShareUrl('place-123', 'dish-456');
    expect(url).toBe('https://snackindex.com/s/place-123/dish/dish-456');
  });
});

describe('Share URL structure', () => {
  it('place URLs use /s/ prefix for short sharing', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://snackindex.com' },
      writable: true,
    });
    
    const url = getPlaceShareUrl('test');
    expect(url).toContain('/s/');
    expect(url).not.toContain('/place/');
  });
});


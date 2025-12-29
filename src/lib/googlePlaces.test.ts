import { describe, expect, it, vi, afterEach } from 'vitest';
import { getGoogleMapsUrl, getGooglePlacePhotoUrl } from './googlePlaces';

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
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(import.meta.env, originalEnv);
  });

  it('returns null when API key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(import.meta.env, { VITE_GOOGLE_PLACES_API_KEY: undefined });
    const url = await getGooglePlacePhotoUrl('abc123');
    expect(url).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches photo url and caches by place + width', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ name: 'places/abc123/photos/photo-1' }] }),
      text: async () => '',
    } as unknown as Response);

    vi.stubGlobal('fetch', fetchMock);
    Object.assign(import.meta.env, { VITE_GOOGLE_PLACES_API_KEY: 'test-key' });

    const url1 = await getGooglePlacePhotoUrl('abc123', 600);
    expect(url1).toBe(
      'https://places.googleapis.com/v1/places/abc123/photos/photo-1/media?maxWidthPx=600&key=test-key'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url2 = await getGooglePlacePhotoUrl('abc123', 600);
    expect(url2).toBe(url1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


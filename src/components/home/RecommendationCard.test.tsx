import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationCard } from './RecommendationCard';
import type { PlaceRecommendation } from '@/lib/recommendations';
import { Timestamp } from 'firebase/firestore';

// Mock google places
vi.mock('@/lib/googlePlaces', () => ({
  getGoogleMapsUrl: vi.fn().mockReturnValue('https://maps.google.com'),
  getGooglePlacePhotoUrl: vi.fn().mockResolvedValue(null),
  getGooglePlacePhotoUrlWithRefresh: vi.fn().mockResolvedValue(null),
}));

// Mock planning store
const mockHasOverrides = vi.fn();
vi.mock('@/stores/planningStore', () => ({
  usePlanningStore: () => ({
    hasOverrides: mockHasOverrides,
  }),
}));

const mockRecommendation: PlaceRecommendation = {
  place: {
    id: 'test-place-1',
    googlePlaceId: 'google-123',
    name: 'Test Taco Shop',
    address: '123 Test St',
    latitude: 47.6,
    longitude: -122.3,
    status: 'ACCEPTED',
    createdBy: 'admin',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  heroDish: {
    id: 'dish-1',
    placeId: 'test-place-1',
    name: 'Al Pastor Tacos',
    isHero: true,
    dietary: { vegetarian: false, vegan: false, glutenFree: true },
    status: 'ACCEPTED',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  dishes: [
    {
      id: 'dish-1',
      placeId: 'test-place-1',
      name: 'Al Pastor Tacos',
      isHero: true,
      dietary: { vegetarian: false, vegan: false, glutenFree: true },
      status: 'ACCEPTED',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ],
  distance: 0.3,
  isOpen: true,
  closeTime: '9 PM',
};

describe('RecommendationCard', () => {
  const mockHandlers = {
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
    onSwipeUp: vi.fn(),
    onClick: vi.fn(),
  };

  beforeEach(() => {
    mockHasOverrides.mockReturnValue(false);
  });

  it('renders place name', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    expect(screen.getByText('Test Taco Shop')).toBeInTheDocument();
  });

  it('renders hero dish with fire emoji', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    expect(screen.getByText(/Al Pastor Tacos/)).toBeInTheDocument();
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });

  it('displays distance and open status', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    // Distance 0.3 miles formats as "0.3 mi"
    expect(screen.getByText(/0\.3 mi/)).toBeInTheDocument();
    expect(screen.getByText(/Open until 9 PM/)).toBeInTheDocument();
  });

  it('displays hours range when planning ahead', () => {
    mockHasOverrides.mockReturnValue(true);
    const recommendation: PlaceRecommendation = {
      ...mockRecommendation,
      todayHoursRange: '10 AM - 2 PM',
    };
    render(<RecommendationCard recommendation={recommendation} {...mockHandlers} />);
    expect(screen.getByText(/10 AM - 2 PM/)).toBeInTheDocument();
    expect(screen.queryByText(/Open until/)).not.toBeInTheDocument();
  });

  it('displays split hours range when planning ahead', () => {
    mockHasOverrides.mockReturnValue(true);
    const recommendation: PlaceRecommendation = {
      ...mockRecommendation,
      todayHoursRange: '11 AM - 3 PM, 5 PM - 9 PM',
    };
    render(<RecommendationCard recommendation={recommendation} {...mockHandlers} />);
    expect(screen.getByText(/11 AM - 3 PM, 5 PM - 9 PM/)).toBeInTheDocument();
  });

  it('falls back to Open until when no hours range available', () => {
    mockHasOverrides.mockReturnValue(true);
    const recommendation: PlaceRecommendation = {
      ...mockRecommendation,
      todayHoursRange: undefined,
    };
    render(<RecommendationCard recommendation={recommendation} {...mockHandlers} />);
    expect(screen.getByText(/Open until 9 PM/)).toBeInTheDocument();
  });
});


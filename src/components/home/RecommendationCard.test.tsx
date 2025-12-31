import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationCard } from './RecommendationCard';
import type { PlaceRecommendation } from '@/lib/recommendations';
import { Timestamp } from 'firebase/firestore';

// Mock google places
vi.mock('@/lib/googlePlaces', () => ({
  getGoogleMapsUrl: vi.fn().mockReturnValue('https://maps.google.com'),
  getGooglePlacePhotoUrl: vi.fn().mockResolvedValue(null),
}));

const mockRecommendation: PlaceRecommendation = {
  place: {
    id: 'test-place-1',
    googlePlaceId: 'google-123',
    name: 'Test Taco Shop',
    address: '123 Test St',
    latitude: 47.6,
    longitude: -122.3,
    isActive: true,
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
    isActive: true,
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
      isActive: true,
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
  };

  it('renders place name', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    expect(screen.getByText('Test Taco Shop')).toBeInTheDocument();
  });

  it('renders hero dish with Top Pick pill', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    expect(screen.getByText(/Top Pick: Al Pastor Tacos/)).toBeInTheDocument();
  });

  it('displays distance and open status', () => {
    render(<RecommendationCard recommendation={mockRecommendation} {...mockHandlers} />);
    // Distance 0.3 miles formats as "0.3 mi"
    expect(screen.getByText(/0\.3 mi/)).toBeInTheDocument();
    expect(screen.getByText(/Open/)).toBeInTheDocument();
  });
});


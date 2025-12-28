import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PermissionsScreen } from './PermissionsScreen';

// Mock the stores and libs
vi.mock('@/stores/userStore', () => ({
  useUserStore: () => ({
    updateLocation: vi.fn(),
    updateOnboarding: vi.fn(),
  }),
}));

vi.mock('@/lib/location', () => ({
  requestLocation: vi.fn().mockResolvedValue({
    success: true,
    coordinates: { latitude: 47.6, longitude: -122.3 },
  }),
}));

vi.mock('@/lib/notifications', () => ({
  requestNotificationPermission: vi.fn().mockResolvedValue({
    success: true,
    permissionState: 'granted',
  }),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('PermissionsScreen', () => {
  it('renders the main heading', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(
      screen.getByText(/To find snacks near you, we need a couple things/i)
    ).toBeInTheDocument();
  });

  it('displays location permission card', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(screen.getByText('Your location')).toBeInTheDocument();
    expect(screen.getByText(/So we know what's nearby/i)).toBeInTheDocument();
  });

  it('displays notification permission card', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText(/So we can tell you when you're close/i)).toBeInTheDocument();
  });

  it('has a Let\'s Go button', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(screen.getByRole('button', { name: /Let's Go/i })).toBeInTheDocument();
  });

  it('shows location emoji', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(screen.getByLabelText('location')).toBeInTheDocument();
  });

  it('shows notifications emoji', () => {
    renderWithRouter(<PermissionsScreen />);
    expect(screen.getByLabelText('notifications')).toBeInTheDocument();
  });
});


import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsScreen } from './SettingsScreen';

// Mock hooks and stores
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    isAdmin: false,
  }),
}));

vi.mock('@/stores/userStore', () => ({
  useUserStore: () => ({
    user: {
      displayName: 'Test User',
      email: 'test@example.com',
      preferences: {
        notificationDistance: 0.5,
        dietaryFilters: {
          vegetarian: false,
          vegan: false,
          glutenFree: false,
        },
        emailUpdates: true,
      },
    },
    updatePreferences: vi.fn(),
    updateDietaryFilters: vi.fn(),
  }),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('SettingsScreen', () => {
  it('renders Settings title', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument();
  });

  it('displays user email', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('displays user name', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders distance options', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByText('¼ mile')).toBeInTheDocument();
    expect(screen.getByText('½ mile')).toBeInTheDocument();
    expect(screen.getByText('1 mile')).toBeInTheDocument();
    expect(screen.getByText('2 miles')).toBeInTheDocument();
  });

  it('renders dietary preferences', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByText('Vegetarian only')).toBeInTheDocument();
    expect(screen.getByText('Vegan only')).toBeInTheDocument();
    expect(screen.getByText('Gluten-free only')).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });

  it('renders version number', () => {
    renderWithRouter(<SettingsScreen />);
    expect(screen.getByText(/v0.1.0/i)).toBeInTheDocument();
  });
});


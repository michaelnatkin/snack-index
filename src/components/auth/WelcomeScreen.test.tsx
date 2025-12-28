import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WelcomeScreen } from './WelcomeScreen';

// Mock useAuth hook
const mockSignIn = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    user: null,
    loading: false,
    isAuthenticated: false,
  }),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(screen.getByText('Snack Index')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(screen.getByText('Find your next snack')).toBeInTheDocument();
  });

  it('renders Google sign-in button', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders Apple sign-in button', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument();
  });

  it('renders terms and privacy text', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(
      screen.getByText(/Terms of Service and Privacy Policy/)
    ).toBeInTheDocument();
  });

  it('renders the snack emoji icon', () => {
    renderWithRouter(<WelcomeScreen />);
    expect(screen.getByLabelText('snack')).toBeInTheDocument();
  });
});


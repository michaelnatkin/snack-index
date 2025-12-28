import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminHome } from './AdminHome';

// Mock the places module
vi.mock('@/lib/places', () => ({
  getAllPlaces: vi.fn().mockResolvedValue([]),
  getDishesForPlace: vi.fn().mockResolvedValue([]),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('AdminHome', () => {
  it('renders the Admin title', () => {
    renderWithRouter(<AdminHome />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders the Add Place button', () => {
    renderWithRouter(<AdminHome />);
    expect(screen.getByText('+ Add Place')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderWithRouter(<AdminHome />);
    expect(screen.getByPlaceholderText('Search places...')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithRouter(<AdminHome />);
    // Loading spinner should be present initially
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});


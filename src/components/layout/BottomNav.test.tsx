import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';

function renderWithRouter(component: React.ReactElement, route = '/') {
  window.history.pushState({}, 'Test page', route);
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('BottomNav', () => {
  it('renders Home link', () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders My Snacks link', () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText('My Snacks')).toBeInTheDocument();
  });

  it('renders Settings link', () => {
    renderWithRouter(<BottomNav />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('has correct link destinations', () => {
    renderWithRouter(<BottomNav />);
    
    const homeLink = screen.getByRole('link', { name: /Home/i });
    const snacksLink = screen.getByRole('link', { name: /My Snacks/i });
    const settingsLink = screen.getByRole('link', { name: /Settings/i });

    expect(homeLink).toHaveAttribute('href', '/');
    expect(snacksLink).toHaveAttribute('href', '/my-snacks');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });
});


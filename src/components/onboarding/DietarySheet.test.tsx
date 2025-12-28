import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DietarySheet } from './DietarySheet';

// Mock the user store
vi.mock('@/stores/userStore', () => ({
  useUserStore: () => ({
    user: {
      preferences: {
        dietaryFilters: {
          vegetarian: false,
          vegan: false,
          glutenFree: false,
        },
      },
    },
    updateDietaryFilters: vi.fn(),
    updateOnboarding: vi.fn(),
  }),
}));

describe('DietarySheet', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<DietarySheet onDismiss={mockOnDismiss} />);
    expect(screen.getByText('What can you eat?')).toBeInTheDocument();
  });

  it('renders all dietary filter options', () => {
    render(<DietarySheet onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Vegetarian only')).toBeInTheDocument();
    expect(screen.getByText('Vegan only')).toBeInTheDocument();
    expect(screen.getByText('Gluten-free only')).toBeInTheDocument();
  });

  it('renders the Got It button', () => {
    render(<DietarySheet onDismiss={mockOnDismiss} />);
    expect(screen.getByRole('button', { name: /Got It/i })).toBeInTheDocument();
  });

  it('shows helper text about leaving unchecked', () => {
    render(<DietarySheet onDismiss={mockOnDismiss} />);
    expect(screen.getByText(/Leave unchecked to see everything/i)).toBeInTheDocument();
  });

  it('has checkboxes that can be toggled', () => {
    render(<DietarySheet onDismiss={mockOnDismiss} />);
    const vegetarianCheckbox = screen.getByRole('checkbox', { name: /Vegetarian only/i });
    
    expect(vegetarianCheckbox).not.toBeChecked();
    fireEvent.click(vegetarianCheckbox);
    expect(vegetarianCheckbox).toBeChecked();
  });
});


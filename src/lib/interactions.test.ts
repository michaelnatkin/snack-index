import { describe, it, expect, vi } from 'vitest';
import { isMilestoneVisit, getCelebrationMessage } from './interactions';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  serverTimestamp: vi.fn(),
}));

vi.mock('./firebase', () => ({
  db: {},
}));

describe('isMilestoneVisit', () => {
  it('returns true for 1st visit', () => {
    expect(isMilestoneVisit(1)).toBe(true);
  });

  it('returns true for 10th visit', () => {
    expect(isMilestoneVisit(10)).toBe(true);
  });

  it('returns true for 25th visit', () => {
    expect(isMilestoneVisit(25)).toBe(true);
  });

  it('returns true for 50th visit', () => {
    expect(isMilestoneVisit(50)).toBe(true);
  });

  it('returns true for 100th visit', () => {
    expect(isMilestoneVisit(100)).toBe(true);
  });

  it('returns false for non-milestone visits', () => {
    expect(isMilestoneVisit(2)).toBe(false);
    expect(isMilestoneVisit(5)).toBe(false);
    expect(isMilestoneVisit(15)).toBe(false);
    expect(isMilestoneVisit(99)).toBe(false);
  });
});

describe('getCelebrationMessage', () => {
  it('returns special message for 1st visit', () => {
    const message = getCelebrationMessage(1);
    expect(message).toContain('first');
    expect(message).toContain('🎉');
  });

  it('returns special message for 10th visit', () => {
    const message = getCelebrationMessage(10);
    expect(message).toContain('Double digits');
  });

  it('returns special message for 25th visit', () => {
    const message = getCelebrationMessage(25);
    expect(message).toContain('Quarter century');
  });

  it('returns special message for 50th visit', () => {
    const message = getCelebrationMessage(50);
    expect(message).toContain('Halfway');
  });

  it('returns special message for 100th visit', () => {
    const message = getCelebrationMessage(100);
    expect(message).toContain('Century');
  });

  it('returns ordinal message for regular visits', () => {
    expect(getCelebrationMessage(3)).toContain('3rd');
    expect(getCelebrationMessage(7)).toContain('7th');
    expect(getCelebrationMessage(42)).toContain('42nd');
  });
});

describe('Interaction types', () => {
  it('defines favorited interaction correctly', () => {
    const interaction = {
      userId: 'user-1',
      placeId: 'place-1',
      favorited: true,
      favoritedAt: new Date(),
    };

    expect(interaction.favorited).toBe(true);
    expect(interaction.favoritedAt).toBeInstanceOf(Date);
  });

  it('defines visited interaction correctly', () => {
    const interaction = {
      userId: 'user-1',
      placeId: 'place-1',
      visited: true,
      visitedAt: new Date(),
    };

    expect(interaction.visited).toBe(true);
    expect(interaction.visitedAt).toBeInstanceOf(Date);
  });

  it('defines dismissed interaction correctly', () => {
    const interaction = {
      userId: 'user-1',
      placeId: 'place-1',
      dismissed: true,
      dismissedAt: new Date(),
    };

    expect(interaction.dismissed).toBe(true);
    expect(interaction.dismissedAt).toBeInstanceOf(Date);
  });
});


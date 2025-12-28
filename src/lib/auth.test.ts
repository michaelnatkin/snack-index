import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ADMIN_EMAIL,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_STATS,
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_INTERACTION_TRACKING,
} from '@/types/models';

// Mock Firebase modules
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: vi.fn((date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
  },
}));

vi.mock('./firebase', () => ({
  auth: {},
  db: {},
}));

describe('Auth Models and Defaults', () => {
  describe('ADMIN_EMAIL', () => {
    it('should be set to the correct admin email', () => {
      expect(ADMIN_EMAIL).toBe('michaelnatkin@gmail.com');
    });
  });

  describe('DEFAULT_USER_PREFERENCES', () => {
    it('should have correct default notification distance', () => {
      expect(DEFAULT_USER_PREFERENCES.notificationDistance).toBe(0.5);
    });

    it('should have all dietary filters set to false by default', () => {
      expect(DEFAULT_USER_PREFERENCES.dietaryFilters).toEqual({
        vegetarian: false,
        vegan: false,
        glutenFree: false,
      });
    });

    it('should have email updates enabled by default', () => {
      expect(DEFAULT_USER_PREFERENCES.emailUpdates).toBe(true);
    });
  });

  describe('DEFAULT_USER_STATS', () => {
    it('should have zero visits and favorites', () => {
      expect(DEFAULT_USER_STATS).toEqual({
        totalVisits: 0,
        totalFavorites: 0,
      });
    });
  });

  describe('DEFAULT_ONBOARDING_STATE', () => {
    it('should have all onboarding flags set to false', () => {
      expect(DEFAULT_ONBOARDING_STATE).toEqual({
        completed: false,
        hasSeenDietarySheet: false,
        hasSeenSwipeTutorial: false,
        hasSeenSwipeNudge: false,
      });
    });
  });

  describe('DEFAULT_INTERACTION_TRACKING', () => {
    it('should have zero swipes and button taps', () => {
      expect(DEFAULT_INTERACTION_TRACKING).toEqual({
        totalSwipes: 0,
        totalButtonTaps: 0,
      });
    });
  });
});

describe('Auth Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdmin', () => {
    // Import dynamically after mocks are set up
    it('should return true for admin user', async () => {
      const { isAdmin } = await import('./auth');
      const adminUser = { isAdmin: true } as Parameters<typeof isAdmin>[0];
      expect(isAdmin(adminUser)).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const { isAdmin } = await import('./auth');
      const regularUser = { isAdmin: false } as Parameters<typeof isAdmin>[0];
      expect(isAdmin(regularUser)).toBe(false);
    });

    it('should return false for null user', async () => {
      const { isAdmin } = await import('./auth');
      expect(isAdmin(null)).toBe(false);
    });
  });
});


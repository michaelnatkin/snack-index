import type { Timestamp } from 'firebase/firestore';

/**
 * User profile stored in Firestore
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;

  preferences: UserPreferences;
  subscription: SubscriptionInfo;
  lastKnownLocation?: LocationData;
  stats: UserStats;
  onboarding: OnboardingState;
  interactions: InteractionTracking;
  isAdmin: boolean;
}

export interface UserPreferences {
  notificationDistance: number; // In miles, default 0.5
  dietaryFilters: DietaryFilters;
  emailUpdates: boolean;
}

export interface DietaryFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

export interface SubscriptionInfo {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  subscriptionEndDate?: Timestamp;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  updatedAt: Timestamp;
}

export interface UserStats {
  totalVisits: number;
  totalFavorites: number;
}

export interface OnboardingState {
  completed: boolean;
  hasSeenDietarySheet: boolean;
  hasSeenSwipeTutorial: boolean;
  hasSeenSwipeNudge: boolean;
}

export interface InteractionTracking {
  totalSwipes: number;
  totalButtonTaps: number;
}

/**
 * Place stored in Firestore
 */
export interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  imageURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  isActive: boolean;
}

/**
 * Dish stored in Firestore
 */
export interface Dish {
  id: string;
  placeId: string;
  name: string;
  description?: string;
  imageURL?: string;
  dietary: DietaryFilters;
  isHero: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

/**
 * User-Place interaction stored in Firestore
 */
export interface UserPlaceInteraction {
  id: string; // `${userId}_${placeId}`
  userId: string;
  placeId: string;
  favorited?: boolean;
  favoritedAt?: Timestamp;
  dismissed?: boolean;
  dismissedAt?: Timestamp;
  visited?: boolean;
  visitedAt?: Timestamp;
  lastNotifiedAt?: Timestamp;
  lastShownInAppAt?: Timestamp;
}

/**
 * Waitlist entry for users outside Seattle
 */
export interface WaitlistEntry {
  id: string;
  email: string;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
  };
  createdAt: Timestamp;
  notified: boolean;
}

/**
 * Notification log for analytics
 */
export interface NotificationLog {
  id: string;
  userId: string;
  placeId: string;
  sentAt: Timestamp;
  opened: boolean;
  openedAt?: Timestamp;
  distanceAtSend: number;
  userLatitude: number;
  userLongitude: number;
}

/**
 * Auth provider types
 */
export type AuthProvider = 'google' | 'apple' | 'email';

/**
 * Default values for new users
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notificationDistance: 0.5,
  dietaryFilters: {
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  },
  emailUpdates: true,
};

export const DEFAULT_USER_STATS: UserStats = {
  totalVisits: 0,
  totalFavorites: 0,
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  hasSeenDietarySheet: false,
  hasSeenSwipeTutorial: false,
  hasSeenSwipeNudge: false,
};

export const DEFAULT_INTERACTION_TRACKING: InteractionTracking = {
  totalSwipes: 0,
  totalButtonTaps: 0,
};

/**
 * Admin email for access control
 */
export const ADMIN_EMAIL = 'michaelnatkin@gmail.com';


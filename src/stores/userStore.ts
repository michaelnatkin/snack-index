import { create } from 'zustand';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, DietaryFilters, LocationData, OnboardingState } from '@/types/models';

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  updatePreferences: (updates: Partial<User['preferences']>) => Promise<void>;
  updateOnboarding: (updates: Partial<OnboardingState>) => Promise<void>;
  updateLocation: (coords: { latitude: number; longitude: number }) => Promise<void>;
  updateDietaryFilters: (filters: DietaryFilters) => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,

  setUser: (user) => set({ user }),

  updatePreferences: async (updates) => {
    const user = get().user;
    if (!user) return;

    const newPreferences = { ...user.preferences, ...updates };
    
    await updateDoc(doc(db, 'users', user.id), {
      preferences: newPreferences,
      lastActiveAt: serverTimestamp(),
    });

    set({ user: { ...user, preferences: newPreferences } });
  },

  updateOnboarding: async (updates) => {
    const user = get().user;
    if (!user) return;

    const newOnboarding = { ...user.onboarding, ...updates };
    
    await updateDoc(doc(db, 'users', user.id), {
      onboarding: newOnboarding,
      lastActiveAt: serverTimestamp(),
    });

    set({ user: { ...user, onboarding: newOnboarding } });
  },

  updateLocation: async (coords) => {
    const user = get().user;
    if (!user) return;

    const locationData: LocationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(doc(db, 'users', user.id), {
      lastKnownLocation: locationData,
      lastActiveAt: serverTimestamp(),
    });

    set({ user: { ...user, lastKnownLocation: locationData } });
  },

  updateDietaryFilters: async (filters) => {
    const user = get().user;
    if (!user) return;

    const newPreferences = { ...user.preferences, dietaryFilters: filters };
    
    await updateDoc(doc(db, 'users', user.id), {
      preferences: newPreferences,
      lastActiveAt: serverTimestamp(),
    });

    set({ user: { ...user, preferences: newPreferences } });
  },
}));

export default useUserStore;


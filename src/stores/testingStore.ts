import { create } from 'zustand';

export interface TestingOverrides {
  overrideLocation?: { latitude: number; longitude: number; label?: string };
  overrideTimeIso?: string;
}

interface TestingStore extends TestingOverrides {
  setOverrideLocation: (location?: { latitude: number; longitude: number; label?: string }) => void;
  setOverrideTimeIso: (iso?: string) => void;
  clearOverrides: () => void;
}

const STORAGE_KEY = 'snack-testing-overrides';

function loadInitial(): TestingOverrides {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      overrideLocation: parsed.overrideLocation,
      overrideTimeIso: parsed.overrideTimeIso,
    };
  } catch {
    return {};
  }
}

function persist(state: TestingOverrides) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export const useTestingStore = create<TestingStore>((set, get) => ({
  ...loadInitial(),

  setOverrideLocation: (location) => {
    const next: TestingOverrides = {
      overrideLocation: location,
      overrideTimeIso: get().overrideTimeIso,
    };
    persist(next);
    set(next);
  },

  setOverrideTimeIso: (iso) => {
    const next: TestingOverrides = {
      overrideLocation: get().overrideLocation,
      overrideTimeIso: iso,
    };
    persist(next);
    set(next);
  },

  clearOverrides: () => {
    const next: TestingOverrides = {};
    persist(next);
    set(next);
  },
}));

export default useTestingStore;


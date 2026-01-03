import { create } from 'zustand';

export interface PlanningOverrides {
  overrideLocation?: { latitude: number; longitude: number; label?: string };
  overrideTimeIso?: string;
}

interface PlanningStore extends PlanningOverrides {
  setOverrideLocation: (location?: { latitude: number; longitude: number; label?: string }) => void;
  setOverrideTimeIso: (iso?: string) => void;
  clearOverrides: () => void;
  hasOverrides: () => boolean;
}

const STORAGE_KEY = 'snack-planning-overrides';

function loadInitial(): PlanningOverrides {
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

function persist(state: PlanningOverrides) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export const usePlanningStore = create<PlanningStore>((set, get) => ({
  ...loadInitial(),

  setOverrideLocation: (location) => {
    const next: PlanningOverrides = {
      overrideLocation: location,
      overrideTimeIso: get().overrideTimeIso,
    };
    persist(next);
    set(next);
  },

  setOverrideTimeIso: (iso) => {
    const next: PlanningOverrides = {
      overrideLocation: get().overrideLocation,
      overrideTimeIso: iso,
    };
    persist(next);
    set(next);
  },

  clearOverrides: () => {
    const next: PlanningOverrides = {};
    persist(next);
    set(next);
  },

  hasOverrides: () => {
    const state = get();
    return !!(state.overrideLocation || state.overrideTimeIso);
  },
}));

export default usePlanningStore;


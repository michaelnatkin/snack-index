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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1',location:'testingStore.ts:loadInitial',message:'Loaded testing overrides from storage',data:{hasRaw:Boolean(raw),overrideLocation:parsed.overrideLocation,overrideTimeIso:parsed.overrideTimeIso},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2',location:'testingStore.ts:persist',message:'Persist testing overrides',data:{overrideLocation:state.overrideLocation,overrideTimeIso:state.overrideTimeIso},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export const useTestingStore = create<TestingStore>((set, get) => ({
  ...loadInitial(),

  setOverrideLocation: (location) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3',location:'testingStore.ts:setOverrideLocation',message:'Set override location called',data:{input:location},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const next: TestingOverrides = {
      overrideLocation: location,
      overrideTimeIso: get().overrideTimeIso,
    };
    persist(next);
    set(next);
  },

  setOverrideTimeIso: (iso) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4',location:'testingStore.ts:setOverrideTimeIso',message:'Set override time called',data:{input:iso},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const next: TestingOverrides = {
      overrideLocation: get().overrideLocation,
      overrideTimeIso: iso,
    };
    persist(next);
    set(next);
  },

  clearOverrides: () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1d3bc91-56c5-4ff8-9c4b-0c1b5cabaab5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5',location:'testingStore.ts:clearOverrides',message:'Clear overrides called',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const next: TestingOverrides = {};
    persist(next);
    set(next);
  },
}));

export default useTestingStore;


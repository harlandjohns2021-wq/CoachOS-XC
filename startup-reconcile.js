import { normalizePractice, normalizeState, practiceKey } from './sync-core.js';

const STORAGE_KEY = 'coachos_xc_v2';
const PRACTICE_KEY = 'xccommand_practice_details_v1';
const TEAM_KEY = 'xccommand_team_assignments_v1';
const RELOAD_GUARD = 'xccommand_startup_reconciled_v1';

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const currentRaw = safeParse(localStorage.getItem(STORAGE_KEY), {});
const state = normalizeState(currentRaw);
const original = JSON.stringify(state);
const details = safeParse(localStorage.getItem(PRACTICE_KEY), {});
const assignments = safeParse(localStorage.getItem(TEAM_KEY), {});
const practices = new Map(
  state.practices.map((practice) => [practiceKey(practice), normalizePractice(practice)])
);

Object.values(details || {}).forEach((practice) => {
  const normalized = normalizePractice(practice);
  const key = practiceKey(normalized);
  const existing = practices.get(key);
  if (!existing || normalized.updatedAtMs >= existing.updatedAtMs) {
    practices.set(key, normalized);
  }
});

state.practices = [...practices.values()];
state.rosterAssignments = {
  ...state.rosterAssignments,
  ...(assignments && typeof assignments === 'object' ? assignments : {})
};

const changed = JSON.stringify(state) !== original;
if (changed) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!sessionStorage.getItem(RELOAD_GUARD)) {
    sessionStorage.setItem(RELOAD_GUARD, '1');
    window.XC_STARTUP_RELOAD_PENDING = true;
    window.location.reload();
  }
} else {
  sessionStorage.removeItem(RELOAD_GUARD);
}

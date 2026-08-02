import { normalizeState } from './sync-core.js';

const STORAGE_KEY = 'coachos_xc_v2';
const TEAM_KEY = 'xccommand_team_assignments_v1';
const ATTENDANCE_DATE = '2026-08-01';
const RELOAD_GUARD = 'xccommand_roster_profile_reload_v1';
const STALE_ANALYSIS_KEYS = [
  'xccommand_ai_coach_cache_v1',
  'xccommand_ai_coach_cache_v2',
  'xccommand_ai_feedback_v1'
];

const ASSIGNMENTS = {
  jh_cynthia_hernandez: ['Female', 'jh-girls'],
  jh_nicole_hernandez: ['Female', 'jh-girls'],
  jh_lia_ayala: ['Female', 'jh-girls'],
  jh_abel_green: ['Male', 'jh-boys'],
  jh_aiden_green: ['Male', 'jh-boys'],
  jh_isaac_ates: ['Male', 'jh-boys'],
  jh_conner_shumate: ['Male', 'jh-boys'],
  jh_julian_wario: ['Male', 'jh-boys'],
  jh_mckaelah_segura: ['Female', 'jh-girls'],
  jh_miranda_lierra: ['Female', 'jh-girls'],
  jh_aj_green: ['Female', 'jh-girls'],
  jh_tess_scoggins: ['Female', 'jh-girls'],
  jh_kynlee_cheek: ['Female', 'jh-girls'],
  jh_jaelle_rocha: ['Female', 'jh-girls'],
  jh_sumaya_romero: ['Female', 'jh-girls'],
  jh_aliyah_torres: ['Female', 'jh-girls'],
  jh_emmett_thomas: ['Male', 'jh-boys'],
  jh_zachary_dunn: ['Male', 'jh-boys'],
  jh_martin_williams: ['Male', 'jh-boys'],
  jh_roan_clark: ['Male', 'jh-boys'],
  jh_jameson_nichols: ['Male', 'jh-boys'],

  hs_tony_hernandez: ['Male', 'varsity-boys'],
  hs_chris_jimnez: ['Male', 'varsity-boys'],
  hs_yaretzi_prado: ['Female', 'varsity-girls'],
  hs_claire_scoggins: ['Female', 'varsity-girls'],
  hs_julian_garcia: ['Male', 'varsity-boys'],
  hs_molly_bloomer: ['Female', 'varsity-girls'],
  hs_paisley_bloomer: ['Female', 'varsity-girls'],
  hs_daena_salazar: ['Female', 'varsity-girls'],
  hs_delainy_torres: ['Female', 'varsity-girls'],
  hs_ivan_olvera: ['Male', 'varsity-boys'],
  hs_lukas_marshall: ['Male', 'varsity-boys'],
  hs_bianca_aguilar: ['Female', 'varsity-girls'],
  hs_aaron_klump: ['Male', 'varsity-boys'],
  hs_gerardo_hernandez: ['Male', 'varsity-boys'],
  hs_katherine_orsorto: ['Female', 'varsity-girls'],
  hs_jackie_arellano: ['Female', 'varsity-girls'],
  hs_jesus_cordova: ['Male', 'varsity-boys']
};

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const state = normalizeState(safeParse(localStorage.getItem(STORAGE_KEY), {}));
const teamAssignments = safeParse(localStorage.getItem(TEAM_KEY), {});
let changed = false;
const now = Date.now();

state.athletes.forEach((athlete) => {
  const assignment = ASSIGNMENTS[athlete.id];
  if (!assignment) return;

  const [sex, teamId] = assignment;
  if (athlete.sex !== sex || athlete.teamId !== teamId) {
    athlete.sex = sex;
    athlete.teamId = teamId;
    athlete.updatedAtMs = now;
    changed = true;
  }

  if (teamAssignments[athlete.id] !== teamId) {
    teamAssignments[athlete.id] = teamId;
    changed = true;
  }

  if (state.rosterAssignments[athlete.id] !== teamId) {
    state.rosterAssignments[athlete.id] = teamId;
    changed = true;
  }
});

if (!state.attendance[ATTENDANCE_DATE]) {
  const timedAthleteIds = new Set(
    state.results
      .filter((result) => (
        result.date === ATTENDANCE_DATE
        && result.distance === '1 Mile'
        && Number(result.seconds) > 0
      ))
      .map((result) => result.athleteId)
  );

  if (timedAthleteIds.size) {
    state.attendance[ATTENDANCE_DATE] = {};
    state.athletes.forEach((athlete) => {
      state.attendance[ATTENDANCE_DATE][athlete.id] = timedAthleteIds.has(athlete.id)
        ? 'Present'
        : 'Absent';
    });
    changed = true;
  }
}

if (changed) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(TEAM_KEY, JSON.stringify(teamAssignments));
  STALE_ANALYSIS_KEYS.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));

  if (!sessionStorage.getItem(RELOAD_GUARD)) {
    sessionStorage.setItem(RELOAD_GUARD, '1');
    window.XC_STARTUP_RELOAD_PENDING = true;
    window.location.reload();
  }
} else {
  sessionStorage.removeItem(RELOAD_GUARD);
}

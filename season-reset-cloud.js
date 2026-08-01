import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const STORAGE_KEY = 'coachos_xc_v2';
const TEAM_KEY = 'xccommand_team_assignments_v1';
const RESET_KEY = 'xccommand_season_reset_2026_08_01_v1';
const CLOUD_RESET_KEY = 'xccommand_season_reset_2026_08_01_cloud_v1';
const CACHE_RESET_KEY = 'xccommand_season_reset_2026_08_01_cache_v1';
const ATTENDANCE_MIGRATION_KEY = 'xccommand_attendance_2026_08_01_v1';
const ROSTER_ASSIGNMENT_KEY = 'xccommand_roster_assignments_2026_08_01_v1';
const ROSTER_ASSIGNMENT_CLOUD_KEY = 'xccommand_roster_assignments_2026_08_01_cloud_v1';
const ATTENDANCE_DATE = '2026-08-01';
const CLOUD_META_KEY = 'xccommand_cloud_meta_v1';
const STALE_ANALYSIS_KEYS = [
  'xccommand_ai_coach_cache_v1',
  'xccommand_ai_coach_cache_v2',
  'xccommand_ai_feedback_v1'
];

const ROSTER_ASSIGNMENTS = {
  jh_cynthia_hernandez: { sex: 'Female', teamId: 'jh-girls' },
  jh_nicole_hernandez: { sex: 'Female', teamId: 'jh-girls' },
  jh_lia_ayala: { sex: 'Female', teamId: 'jh-girls' },
  jh_abel_green: { sex: 'Male', teamId: 'jh-boys' },
  jh_aiden_green: { sex: 'Male', teamId: 'jh-boys' },
  jh_isaac_ates: { sex: 'Male', teamId: 'jh-boys' },
  jh_conner_shumate: { sex: 'Male', teamId: 'jh-boys' },
  jh_julian_wario: { sex: 'Male', teamId: 'jh-boys' },
  jh_mckaelah_segura: { sex: 'Female', teamId: 'jh-girls' },
  jh_miranda_lierra: { sex: 'Female', teamId: 'jh-girls' },
  jh_aj_green: { sex: 'Female', teamId: 'jh-girls' },
  jh_tess_scoggins: { sex: 'Female', teamId: 'jh-girls' },
  jh_kynlee_cheek: { sex: 'Female', teamId: 'jh-girls' },
  jh_jaelle_rocha: { sex: 'Female', teamId: 'jh-girls' },
  jh_sumaya_romero: { sex: 'Female', teamId: 'jh-girls' },
  jh_aliyah_torres: { sex: 'Female', teamId: 'jh-girls' },
  jh_emmett_thomas: { sex: 'Male', teamId: 'jh-boys' },
  jh_zachary_dunn: { sex: 'Male', teamId: 'jh-boys' },
  jh_martin_williams: { sex: 'Male', teamId: 'jh-boys' },
  jh_roan_clark: { sex: 'Male', teamId: 'jh-boys' },
  jh_jameson_nichols: { sex: 'Male', teamId: 'jh-boys' },

  hs_tony_hernandez: { sex: 'Male', teamId: 'varsity-boys' },
  hs_chris_jimnez: { sex: 'Male', teamId: 'varsity-boys' },
  hs_yaretzi_prado: { sex: 'Female', teamId: 'varsity-girls' },
  hs_claire_scoggins: { sex: 'Female', teamId: 'varsity-girls' },
  hs_julian_garcia: { sex: 'Male', teamId: 'varsity-boys' },
  hs_molly_bloomer: { sex: 'Female', teamId: 'varsity-girls' },
  hs_paisley_bloomer: { sex: 'Female', teamId: 'varsity-girls' },
  hs_daena_salazar: { sex: 'Female', teamId: 'varsity-girls' },
  hs_delainy_torres: { sex: 'Female', teamId: 'varsity-girls' },
  hs_ivan_olvera: { sex: 'Male', teamId: 'varsity-boys' },
  hs_lukas_marshall: { sex: 'Male', teamId: 'varsity-boys' },
  hs_bianca_aguilar: { sex: 'Female', teamId: 'varsity-girls' },
  hs_aaron_klump: { sex: 'Male', teamId: 'varsity-boys' },
  hs_gerardo_hernandez: { sex: 'Male', teamId: 'varsity-boys' },
  hs_katherine_orsorto: { sex: 'Female', teamId: 'varsity-girls' },
  hs_jackie_arellano: { sex: 'Female', teamId: 'varsity-girls' },
  hs_jesus_cordova: { sex: 'Male', teamId: 'varsity-boys' }
};

const firebaseConfig = {
  apiKey: 'AIzaSyAnWcn0k7Y2ihT4asmYn551THciMNKbCIc',
  authDomain: 'xc-command.firebaseapp.com',
  projectId: 'xc-command',
  storageBucket: 'xc-command.firebasestorage.app',
  messagingSenderId: '576848049086',
  appId: '1:576848049086:web:2b360e66ffeb1a3be53fef',
  measurementId: 'G-GPFG3XZM09'
};

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clearStaleAnalysisOnce() {
  if (!localStorage.getItem(RESET_KEY) || localStorage.getItem(CACHE_RESET_KEY)) return;
  STALE_ANALYSIS_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(CACHE_RESET_KEY, JSON.stringify({ appliedAt: new Date().toISOString() }));
}

function applyAug1AttendanceOnce() {
  if (localStorage.getItem(ATTENDANCE_MIGRATION_KEY)) return false;

  const state = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (!state || !Array.isArray(state.athletes) || !state.athletes.length) return false;

  const timedAthleteIds = new Set(
    (Array.isArray(state.results) ? state.results : [])
      .filter((result) => (
        result?.date === ATTENDANCE_DATE &&
        result?.distance === '1 Mile' &&
        Number(result?.seconds) > 0
      ))
      .map((result) => result.athleteId)
  );

  if (!timedAthleteIds.size) return false;

  state.attendance = state.attendance && typeof state.attendance === 'object'
    ? state.attendance
    : {};
  state.attendance[ATTENDANCE_DATE] = {};

  state.athletes.forEach((athlete) => {
    state.attendance[ATTENDANCE_DATE][athlete.id] = timedAthleteIds.has(athlete.id)
      ? 'Present'
      : 'Absent';
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(ATTENDANCE_MIGRATION_KEY, JSON.stringify({
    appliedAt: new Date().toISOString(),
    date: ATTENDANCE_DATE,
    present: timedAthleteIds.size,
    absent: Math.max(0, state.athletes.length - timedAthleteIds.size)
  }));
  window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));
  return true;
}

function applyRosterAssignmentsOnce() {
  if (localStorage.getItem(ROSTER_ASSIGNMENT_KEY)) return false;

  const state = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (!state || !Array.isArray(state.athletes) || !state.athletes.length) return false;

  const teamAssignments = safeJson(localStorage.getItem(TEAM_KEY), {});
  let assigned = 0;
  let female = 0;
  let male = 0;

  state.athletes.forEach((athlete) => {
    const assignment = ROSTER_ASSIGNMENTS[athlete.id];
    if (!assignment) return;

    athlete.sex = assignment.sex;
    athlete.teamId = assignment.teamId;
    teamAssignments[athlete.id] = assignment.teamId;
    assigned += 1;
    if (assignment.sex === 'Female') female += 1;
    if (assignment.sex === 'Male') male += 1;
  });

  if (!assigned) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(TEAM_KEY, JSON.stringify(teamAssignments));
  STALE_ANALYSIS_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(ROSTER_ASSIGNMENT_KEY, JSON.stringify({
    appliedAt: new Date().toISOString(),
    assigned,
    female,
    male
  }));
  window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));
  return true;
}

function currentUserOnce(auth) {
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user || null);
      },
      () => {
        unsubscribe();
        resolve(null);
      }
    );
  });
}

export async function prepareSeasonResetCloud() {
  clearStaleAnalysisOnce();
  applyAug1AttendanceOnce();
  applyRosterAssignmentsOnce();

  const needsInitialCloudReset = Boolean(
    localStorage.getItem(RESET_KEY) && !localStorage.getItem(CLOUD_RESET_KEY)
  );
  const needsRosterCloudUpdate = Boolean(
    localStorage.getItem(ROSTER_ASSIGNMENT_KEY) && !localStorage.getItem(ROSTER_ASSIGNMENT_CLOUD_KEY)
  );

  if (!needsInitialCloudReset && !needsRosterCloudUpdate) {
    return { allowCloudSync: true, resetNeeded: false };
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const user = await currentUserOnce(auth);

  if (!user) {
    return {
      allowCloudSync: true,
      resetNeeded: needsInitialCloudReset,
      rosterUpdateNeeded: needsRosterCloudUpdate,
      signedOut: true
    };
  }

  const state = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (!state) {
    return {
      allowCloudSync: false,
      resetNeeded: needsInitialCloudReset,
      rosterUpdateNeeded: needsRosterCloudUpdate,
      error: 'The updated local state could not be read.'
    };
  }

  try {
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const userSnapshot = await getDoc(userRef);
    const teamId = userSnapshot.exists() && userSnapshot.data().defaultTeamId
      ? userSnapshot.data().defaultTeamId
      : user.uid;
    const now = Date.now();

    await setDoc(doc(db, 'teams', teamId, 'state', 'current'), {
      state,
      updatedAtMs: now,
      updatedBy: user.uid
    });

    await setDoc(doc(db, 'teams', teamId), {
      name: state.settings?.teamName || 'Harts Bluff XC',
      ownerUid: user.uid,
      memberUids: [user.uid],
      updatedAtMs: now
    }, { merge: true });

    localStorage.setItem(CLOUD_META_KEY, JSON.stringify({
      ...safeJson(localStorage.getItem(CLOUD_META_KEY), {}),
      teamId,
      lastSyncedAtMs: now
    }));

    if (needsInitialCloudReset) {
      localStorage.setItem(CLOUD_RESET_KEY, JSON.stringify({
        appliedAt: new Date().toISOString(),
        teamId
      }));
    }

    if (needsRosterCloudUpdate) {
      localStorage.setItem(ROSTER_ASSIGNMENT_CLOUD_KEY, JSON.stringify({
        appliedAt: new Date().toISOString(),
        teamId
      }));
    }

    return {
      allowCloudSync: true,
      resetNeeded: false,
      rosterUpdateNeeded: false,
      cloudUpdated: true
    };
  } catch (error) {
    console.error('XC Command could not update the cloud roster data.', error);
    return {
      allowCloudSync: false,
      resetNeeded: needsInitialCloudReset,
      rosterUpdateNeeded: needsRosterCloudUpdate,
      error: error?.message || String(error)
    };
  }
}

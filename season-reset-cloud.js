import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const STORAGE_KEY = 'coachos_xc_v2';
const RESET_KEY = 'xccommand_season_reset_2026_08_01_v1';
const CLOUD_RESET_KEY = 'xccommand_season_reset_2026_08_01_cloud_v1';
const CACHE_RESET_KEY = 'xccommand_season_reset_2026_08_01_cache_v1';
const CLOUD_META_KEY = 'xccommand_cloud_meta_v1';
const STALE_ANALYSIS_KEYS = [
  'xccommand_ai_coach_cache_v1',
  'xccommand_ai_coach_cache_v2',
  'xccommand_ai_feedback_v1'
];

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

  if (!localStorage.getItem(RESET_KEY) || localStorage.getItem(CLOUD_RESET_KEY)) {
    return { allowCloudSync: true, resetNeeded: false };
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const user = await currentUserOnce(auth);

  if (!user) {
    return { allowCloudSync: true, resetNeeded: true, signedOut: true };
  }

  const state = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (!state) {
    return {
      allowCloudSync: false,
      resetNeeded: true,
      error: 'The newly seeded local state could not be read.'
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
    localStorage.setItem(CLOUD_RESET_KEY, JSON.stringify({
      appliedAt: new Date().toISOString(),
      teamId
    }));

    return { allowCloudSync: true, resetNeeded: false, cloudUpdated: true };
  } catch (error) {
    console.error('XC Command could not replace the cloud season data.', error);
    return {
      allowCloudSync: false,
      resetNeeded: true,
      error: error?.message || String(error)
    };
  }
}

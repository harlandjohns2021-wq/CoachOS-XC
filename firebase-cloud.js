import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const STORAGE_KEY = 'coachos_xc_v2';
const CLOUD_META_KEY = 'xccommand_cloud_meta_v1';

const firebaseConfig = {
  apiKey: 'AIzaSyAnWcn0k7Y2ihT4asmYn551THciMNKbCIc',
  authDomain: 'xc-command.firebaseapp.com',
  projectId: 'xc-command',
  storageBucket: 'xc-command.firebasestorage.app',
  messagingSenderId: '576848049086',
  appId: '1:576848049086:web:2b360e66ffeb1a3be53fef',
  measurementId: 'G-GPFG3XZM09'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const nativeSetItem = Storage.prototype.setItem;

let currentUser = null;
let currentTeamId = null;
let unsubscribeSnapshot = null;
let syncTimer = null;
let suppressLocalSignal = false;
let reconciliationInProgress = false;
let authModal = null;

function defaultState() {
  return {
    version: 3,
    settings: { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '' },
    athletes: [],
    results: [],
    attendance: {},
    practices: [],
    rosterAssignments: {},
    customDistances: []
  };
}

function timestampOf(record) {
  return Number(record?.updatedAtMs) || Date.parse(record?.updatedAt || record?.createdAt || 0) || 0;
}

function normalizePractice(practice) {
  const rosterId = practice?.rosterId || 'all';
  const date = practice?.date || '';
  return {
    ...practice,
    id: practice?.id || `${date}|${rosterId}`,
    rosterId,
    updatedAtMs: timestampOf(practice) || Date.now()
  };
}

function normalizeState(input) {
  const base = defaultState();
  const value = input && typeof input === 'object' ? input : {};
  return {
    ...base,
    ...value,
    version: 3,
    settings: { ...base.settings, ...(value.settings || {}) },
    athletes: Array.isArray(value.athletes) ? value.athletes : [],
    results: Array.isArray(value.results) ? value.results : [],
    attendance: value.attendance && typeof value.attendance === 'object' ? value.attendance : {},
    practices: Array.isArray(value.practices) ? value.practices.map(normalizePractice) : [],
    rosterAssignments: value.rosterAssignments && typeof value.rosterAssignments === 'object' ? value.rosterAssignments : {},
    customDistances: Array.isArray(value.customDistances) ? value.customDistances : []
  };
}

function readLocalState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch {
    return defaultState();
  }
}

function writeLocalState(state) {
  suppressLocalSignal = true;
  nativeSetItem.call(localStorage, STORAGE_KEY, JSON.stringify(normalizeState(state)));
  suppressLocalSignal = false;
}

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function chooseNewest(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return timestampOf(b) >= timestampOf(a) ? { ...b } : { ...a };
}

function mergeStates(remoteInput, localInput) {
  const remote = normalizeState(remoteInput);
  const local = normalizeState(localInput);
  const athleteMap = new Map();
  const idRemap = new Map();

  const addAthlete = (athlete) => {
    const key = athlete.id || normalizeName(athlete.name);
    const nameKey = normalizeName(athlete.name);
    const existingEntry = [...athleteMap.values()].find((row) => row.id === athlete.id || (nameKey && normalizeName(row.name) === nameKey));
    if (existingEntry) {
      const winner = chooseNewest(existingEntry, athlete);
      athleteMap.set(existingEntry.id, { ...winner, id: existingEntry.id });
      if (athlete.id) idRemap.set(athlete.id, existingEntry.id);
      return;
    }
    const copy = { ...athlete, id: athlete.id || key };
    athleteMap.set(copy.id, copy);
    if (athlete.id) idRemap.set(athlete.id, copy.id);
  };

  remote.athletes.forEach(addAthlete);
  local.athletes.forEach(addAthlete);
  const remapId = (id) => idRemap.get(id) || id;

  const results = new Map();
  [...remote.results, ...local.results].forEach((result) => {
    const copy = { ...result, athleteId: remapId(result.athleteId) };
    const key = copy.id || [copy.athleteId, copy.date, copy.distance, Number(copy.seconds), copy.source || '', copy.meetName || ''].join('|');
    results.set(key, chooseNewest(results.get(key), copy));
  });

  const attendance = {};
  const mergeAttendance = (source) => {
    Object.entries(source || {}).forEach(([date, day]) => {
      attendance[date] ||= {};
      Object.entries(day || {}).forEach(([athleteId, status]) => {
        const mapped = remapId(athleteId);
        if (status && typeof status === 'object') {
          attendance[date][mapped] = chooseNewest(attendance[date][mapped], status);
        } else {
          attendance[date][mapped] = status;
        }
      });
    });
  };
  mergeAttendance(remote.attendance);
  mergeAttendance(local.attendance);

  const practices = new Map();
  [...remote.practices, ...local.practices].map(normalizePractice).forEach((practice) => {
    practices.set(practice.id, chooseNewest(practices.get(practice.id), practice));
  });

  const rosterAssignments = { ...remote.rosterAssignments, ...local.rosterAssignments };
  const customDistances = [...new Set([...remote.customDistances, ...local.customDistances].map((value) => String(value).trim()).filter(Boolean))];

  return normalizeState({
    ...remote,
    ...local,
    settings: { ...remote.settings, ...local.settings },
    athletes: [...athleteMap.values()],
    results: [...results.values()],
    attendance,
    practices: [...practices.values()],
    rosterAssignments,
    customDistances
  });
}

function getCloudMeta() {
  try { return JSON.parse(localStorage.getItem(CLOUD_META_KEY)) || {}; } catch { return {}; }
}

function setCloudMeta(patch) {
  nativeSetItem.call(localStorage, CLOUD_META_KEY, JSON.stringify({ ...getCloudMeta(), ...patch }));
  window.dispatchEvent(new CustomEvent('xccommand:cloud-meta', { detail: getCloudMeta() }));
}

function setStatus(text, tone = '') {
  const topChip = document.getElementById('cloudStatusChip');
  const settingsPill = document.getElementById('cloudSettingsPill');
  if (topChip) text && (topChip.textContent = text);
  if (settingsPill) {
    settingsPill.textContent = text;
    settingsPill.className = `pill ${tone}`.trim();
  }
  window.dispatchEvent(new CustomEvent('xccommand:cloud-status', { detail: { text, tone } }));
}

function friendlyAuthError(error) {
  const map = {
    'auth/email-already-in-use': 'That email already has an XC Command account.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait and try again.',
    'auth/network-request-failed': 'XC Command could not reach Firebase.'
  };
  return map[error?.code] || error?.message || 'XC Command could not complete that action.';
}

function setAuthMessage(message, isError = false) {
  const el = document.getElementById('xcAuthMessage');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b42318' : '';
}

function injectCloudUI() {
  if (document.getElementById('cloudAccountButton')) return;
  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const deviceChip = [...topActions.querySelectorAll('.chip')].find((chip) => chip.textContent.includes('Auto-saved'));
    if (deviceChip) { deviceChip.id = 'cloudStatusChip'; deviceChip.textContent = 'Device only'; }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'cloudAccountButton';
    button.className = 'secondary';
    button.textContent = 'Sign in';
    button.addEventListener('click', openAuthModal);
    topActions.appendChild(button);
  }

  const securityCard = [...document.querySelectorAll('#settings .card')].find((card) => card.querySelector('h3')?.textContent.trim() === 'Account security');
  if (securityCard) {
    securityCard.innerHTML = `<div class="card-head"><div><h3>XC Command account</h3><div class="sub">Firebase authentication and protected synchronization</div></div><span class="pill warn" id="cloudSettingsPill">Signed out</span></div><div class="insight" id="cloudSettingsBody"><strong>Your data is stored on this device.</strong><p>Sign in to synchronize this team.</p></div><div class="toolbar" style="margin-top:14px"><button class="primary" id="cloudSettingsButton">Sign in or create account</button></div>`;
    document.getElementById('cloudSettingsButton')?.addEventListener('click', openAuthModal);
  }

  authModal = document.createElement('div');
  authModal.className = 'modal-backdrop';
  authModal.id = 'xcAuthModal';
  authModal.innerHTML = `<div class="modal"><div class="modal-head"><div><strong>XC Command account</strong><div class="sub">Sign in to sync your team safely across devices.</div></div><button class="icon-btn" id="xcAuthClose">×</button></div><div class="modal-body"><div class="form-grid"><div class="field span-4"><label>Email</label><input id="xcAuthEmail" type="email" autocomplete="email" data-no-speech="true"></div><div class="field span-4"><label>Password</label><input id="xcAuthPassword" type="password" autocomplete="current-password" data-no-speech="true"></div></div><div id="xcAuthMessage" class="insight" style="margin-top:16px">Existing device data will be merged with cloud data.</div></div><div class="modal-foot" style="flex-wrap:wrap"><button class="ghost" id="xcResetPassword">Reset password</button><button class="secondary" id="xcCreateAccount">Create account</button><button class="primary" id="xcSignIn">Sign in</button><button class="danger hide" id="xcSignOut">Sign out</button></div></div>`;
  document.body.appendChild(authModal);
  document.getElementById('xcAuthClose')?.addEventListener('click', () => authModal.classList.remove('open'));
  document.getElementById('xcSignIn')?.addEventListener('click', async () => {
    const email = document.getElementById('xcAuthEmail').value.trim();
    const password = document.getElementById('xcAuthPassword').value;
    try { await signInWithEmailAndPassword(auth, email, password); authModal.classList.remove('open'); } catch (error) { setAuthMessage(friendlyAuthError(error), true); }
  });
  document.getElementById('xcCreateAccount')?.addEventListener('click', async () => {
    const email = document.getElementById('xcAuthEmail').value.trim();
    const password = document.getElementById('xcAuthPassword').value;
    try { await createUserWithEmailAndPassword(auth, email, password); authModal.classList.remove('open'); } catch (error) { setAuthMessage(friendlyAuthError(error), true); }
  });
  document.getElementById('xcSignOut')?.addEventListener('click', async () => { await signOut(auth); authModal.classList.remove('open'); });
  document.getElementById('xcResetPassword')?.addEventListener('click', async () => {
    const email = document.getElementById('xcAuthEmail').value.trim();
    if (!email) return setAuthMessage('Enter your email first.', true);
    try { await sendPasswordResetEmail(auth, email); setAuthMessage('Password reset email sent.'); } catch (error) { setAuthMessage(friendlyAuthError(error), true); }
  });
}

function openAuthModal() {
  if (!authModal) return;
  const signedIn = Boolean(currentUser);
  document.getElementById('xcAuthEmail').disabled = signedIn;
  if (signedIn) document.getElementById('xcAuthEmail').value = currentUser.email || '';
  document.getElementById('xcSignIn').classList.toggle('hide', signedIn);
  document.getElementById('xcCreateAccount').classList.toggle('hide', signedIn);
  document.getElementById('xcResetPassword').classList.toggle('hide', signedIn);
  document.getElementById('xcSignOut').classList.toggle('hide', !signedIn);
  setAuthMessage(signedIn ? `Signed in as ${currentUser.email}.` : 'Existing device data will be merged with cloud data.');
  authModal.classList.add('open');
}

async function ensureTeam(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);
  const teamId = userSnapshot.exists() && userSnapshot.data().defaultTeamId ? userSnapshot.data().defaultTeamId : user.uid;
  const local = readLocalState();
  await setDoc(doc(db, 'teams', teamId), { name: local.settings.teamName || 'My XC Team', ownerUid: user.uid, memberUids: [user.uid], updatedAtMs: Date.now() }, { merge: true });
  await setDoc(userRef, { email: user.email || '', defaultTeamId: teamId, updatedAtMs: Date.now() }, { merge: true });
  return teamId;
}

function stateRef() { return doc(db, 'teams', currentTeamId, 'state', 'current'); }

async function pushLocalState() {
  if (!currentUser || !currentTeamId || reconciliationInProgress) return;
  clearTimeout(syncTimer);
  reconciliationInProgress = true;
  setStatus('Syncing…', 'warn');
  try {
    const local = readLocalState();
    let committed = local;
    const now = Date.now();
    await runTransaction(db, async (transaction) => {
      const ref = stateRef();
      const snapshot = await transaction.get(ref);
      const remote = snapshot.exists() ? normalizeState(snapshot.data().state || {}) : defaultState();
      committed = snapshot.exists() ? mergeStates(remote, local) : local;
      transaction.set(ref, { state: committed, updatedAtMs: now, updatedBy: currentUser.uid });
    });
    if (JSON.stringify(committed) !== JSON.stringify(readLocalState())) writeLocalState(committed);
    await setDoc(doc(db, 'teams', currentTeamId), { name: committed.settings.teamName || 'My XC Team', updatedAtMs: now }, { merge: true });
    setCloudMeta({ teamId: currentTeamId, lastSyncedAtMs: now, pending: false, lastError: '' });
    setStatus('Cloud synced', 'good');
  } catch (error) {
    console.error('XC Command cloud sync failed.', error);
    setCloudMeta({ pending: true, lastError: error?.message || 'Sync failed' });
    setStatus('Sync error', 'warn');
  } finally {
    reconciliationInProgress = false;
  }
}

function schedulePush() {
  if (!currentUser || !currentTeamId || suppressLocalSignal) return;
  setCloudMeta({ pending: true });
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushLocalState, 650);
}

async function hydrateFromCloud() {
  const local = readLocalState();
  const snapshot = await getDoc(stateRef());
  if (!snapshot.exists()) { await pushLocalState(); return; }
  const remote = normalizeState(snapshot.data().state || {});
  const merged = mergeStates(remote, local);
  writeLocalState(merged);
  if (JSON.stringify(merged) !== JSON.stringify(remote)) await pushLocalState();
}

function startRealtimeSync() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = onSnapshot(stateRef(), async (snapshot) => {
    if (!snapshot.exists() || snapshot.metadata.hasPendingWrites || reconciliationInProgress) return;
    const remote = normalizeState(snapshot.data().state || {});
    const local = readLocalState();
    if (JSON.stringify(remote) === JSON.stringify(local)) return setStatus('Cloud synced', 'good');
    reconciliationInProgress = true;
    try {
      const merged = mergeStates(remote, local);
      writeLocalState(merged);
      setCloudMeta({ teamId: currentTeamId, lastSyncedAtMs: snapshot.data().updatedAtMs || Date.now(), pending: JSON.stringify(merged) !== JSON.stringify(remote) });
      reconciliationInProgress = false;
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await pushLocalState();
      else {
        setStatus('Updated from cloud', 'good');
        window.dispatchEvent(new CustomEvent('xccommand:remote-state-applied'));
      }
    } catch (error) {
      console.error('XC Command reconciliation failed.', error);
      setStatus('Sync error', 'warn');
    } finally {
      reconciliationInProgress = false;
    }
  }, (error) => {
    console.error('XC Command real-time sync failed.', error);
    setStatus('Sync error', 'warn');
  });
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  nativeSetItem.call(this, key, value);
  if (this === localStorage && key === STORAGE_KEY && !suppressLocalSignal) window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));
};
window.addEventListener('xccommand:local-state-changed', schedulePush);
window.addEventListener('online', () => { if (currentUser) pushLocalState(); });

injectCloudUI();
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  const accountButton = document.getElementById('cloudAccountButton');
  const body = document.getElementById('cloudSettingsBody');
  const settingsButton = document.getElementById('cloudSettingsButton');
  if (!user) {
    currentTeamId = null;
    if (accountButton) accountButton.textContent = 'Sign in';
    if (body) body.innerHTML = '<strong>Your data is stored on this device.</strong><p>Sign in to synchronize it.</p>';
    if (settingsButton) settingsButton.textContent = 'Sign in or create account';
    setStatus('Device only', 'warn');
    return;
  }
  if (accountButton) accountButton.textContent = user.email || 'Account';
  if (body) body.innerHTML = `<strong>Signed in as ${String(user.email || 'coach').replace(/[&<>"']/g, '')}.</strong><p>Data is merged transactionally across devices.</p>`;
  if (settingsButton) settingsButton.textContent = 'Manage account';
  try {
    currentTeamId = await ensureTeam(user);
    await hydrateFromCloud();
    startRealtimeSync();
    setStatus('Cloud synced', 'good');
  } catch (error) {
    console.error('XC Command Firebase setup failed.', error);
    setStatus('Cloud error', 'warn');
  }
});

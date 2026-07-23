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
  onSnapshot
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
let authModal = null;

function defaultState() {
  return {
    version: 2,
    settings: { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '' },
    athletes: [],
    results: [],
    attendance: {},
    practices: []
  };
}

function normalizeState(input) {
  const base = defaultState();
  const value = input && typeof input === 'object' ? input : {};
  return {
    ...base,
    ...value,
    version: 2,
    settings: { ...base.settings, ...(value.settings || {}) },
    athletes: Array.isArray(value.athletes) ? value.athletes : [],
    results: Array.isArray(value.results) ? value.results : [],
    attendance: value.attendance && typeof value.attendance === 'object' ? value.attendance : {},
    practices: Array.isArray(value.practices) ? value.practices : []
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

function meaningfulState(state) {
  return Boolean(
    state.athletes.length ||
    state.results.length ||
    state.practices.length ||
    Object.keys(state.attendance || {}).length
  );
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeStates(remoteInput, localInput) {
  const remote = normalizeState(remoteInput);
  const local = normalizeState(localInput);
  const athletes = [];
  const athleteByName = new Map();
  const idMap = new Map();

  const addAthlete = (athlete, preferExisting = true) => {
    const key = normalizeName(athlete.name);
    const existing = athleteByName.get(key);
    if (existing && key) {
      idMap.set(athlete.id, existing.id);
      if (!preferExisting) Object.assign(existing, athlete, { id: existing.id });
      return existing;
    }
    const copy = { ...athlete };
    athletes.push(copy);
    if (key) athleteByName.set(key, copy);
    idMap.set(athlete.id, copy.id);
    return copy;
  };

  remote.athletes.forEach((athlete) => addAthlete(athlete, true));
  local.athletes.forEach((athlete) => addAthlete(athlete, true));

  const remapAthleteId = (id) => idMap.get(id) || id;
  const results = [];
  const resultKeys = new Set();
  const addResult = (result) => {
    const copy = { ...result, athleteId: remapAthleteId(result.athleteId) };
    const key = [copy.athleteId, copy.date, copy.distance, Number(copy.seconds), copy.source || '', copy.meetName || ''].join('|');
    if (resultKeys.has(key)) return;
    resultKeys.add(key);
    results.push(copy);
  };
  remote.results.forEach(addResult);
  local.results.forEach(addResult);

  const attendance = {};
  const mergeAttendance = (source) => {
    Object.entries(source || {}).forEach(([date, day]) => {
      attendance[date] ||= {};
      Object.entries(day || {}).forEach(([athleteId, status]) => {
        attendance[date][remapAthleteId(athleteId)] = status;
      });
    });
  };
  mergeAttendance(remote.attendance);
  mergeAttendance(local.attendance);

  const practicesByDate = new Map();
  [...remote.practices, ...local.practices].forEach((practice) => {
    const key = practice.date || practice.id;
    const existing = practicesByDate.get(key);
    if (!existing) {
      practicesByDate.set(key, { ...practice });
      return;
    }
    const existingStamp = Date.parse(existing.updatedAt || existing.date || 0) || 0;
    const incomingStamp = Date.parse(practice.updatedAt || practice.date || 0) || 0;
    if (incomingStamp >= existingStamp) practicesByDate.set(key, { ...practice });
  });

  return normalizeState({
    ...remote,
    ...local,
    settings: {
      ...remote.settings,
      ...Object.fromEntries(Object.entries(local.settings || {}).filter(([, value]) => String(value || '').trim()))
    },
    athletes,
    results,
    attendance,
    practices: [...practicesByDate.values()]
  });
}

function getCloudMeta() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_META_KEY)) || {};
  } catch {
    return {};
  }
}

function setCloudMeta(patch) {
  nativeSetItem.call(localStorage, CLOUD_META_KEY, JSON.stringify({ ...getCloudMeta(), ...patch }));
}

function setStatus(text, tone = '') {
  const topChip = document.getElementById('cloudStatusChip');
  const settingsPill = document.getElementById('cloudSettingsPill');
  if (topChip) topChip.textContent = text;
  if (settingsPill) {
    settingsPill.textContent = text;
    settingsPill.className = `pill ${tone}`.trim();
  }
}

function setAuthMessage(message, isError = false) {
  const el = document.getElementById('xcAuthMessage');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b42318' : '';
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'That email already has an XC Command account.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use a stronger password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'XC Command could not reach Firebase. Check your connection.'
  };
  return map[code] || error?.message || 'XC Command could not complete that account action.';
}

function injectCloudUI() {
  if (document.getElementById('cloudAccountButton')) return;

  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const deviceChip = [...topActions.querySelectorAll('.chip')].find((chip) => chip.textContent.includes('Auto-saved'));
    if (deviceChip) {
      deviceChip.id = 'cloudStatusChip';
      deviceChip.textContent = 'Device only';
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'cloudAccountButton';
    button.className = 'secondary';
    button.textContent = 'Sign in';
    button.addEventListener('click', openAuthModal);
    const settingsButton = document.getElementById('openSettings');
    if (settingsButton) topActions.insertBefore(button, settingsButton);
    else topActions.appendChild(button);
  }

  const securityCard = [...document.querySelectorAll('#settings .card')].find((card) => card.querySelector('h3')?.textContent.trim() === 'Account security');
  if (securityCard) {
    securityCard.innerHTML = `
      <div class="card-head">
        <div><h3>XC Command account</h3><div class="sub">Firebase authentication and cloud synchronization</div></div>
        <span class="pill warn" id="cloudSettingsPill">Signed out</span>
      </div>
      <div class="insight" id="cloudSettingsBody"><strong>Your data is currently stored on this device.</strong><p>Sign in to sync this team's XC Command data through Firebase.</p></div>
      <div class="toolbar" style="margin-top:14px"><button class="primary" id="cloudSettingsButton">Sign in or create account</button></div>
    `;
    document.getElementById('cloudSettingsButton')?.addEventListener('click', openAuthModal);
  }

  authModal = document.createElement('div');
  authModal.className = 'modal-backdrop';
  authModal.id = 'xcAuthModal';
  authModal.setAttribute('role', 'dialog');
  authModal.setAttribute('aria-modal', 'true');
  authModal.innerHTML = `
    <div class="modal">
      <div class="modal-head"><div><strong>XC Command account</strong><div class="sub">Sign in to keep your team data synced across devices.</div></div><button class="icon-btn" id="xcAuthClose">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-4"><label>Email</label><input id="xcAuthEmail" type="email" autocomplete="email" data-no-speech="true"></div>
          <div class="field span-4"><label>Password</label><input id="xcAuthPassword" type="password" autocomplete="current-password" data-no-speech="true"></div>
        </div>
        <div id="xcAuthMessage" class="insight" style="margin-top:16px">Your existing device data will be preserved and uploaded when you create or sign into your account.</div>
      </div>
      <div class="modal-foot" style="flex-wrap:wrap">
        <button class="ghost" id="xcResetPassword">Reset password</button>
        <button class="secondary" id="xcCreateAccount">Create account</button>
        <button class="primary" id="xcSignIn">Sign in</button>
        <button class="danger hide" id="xcSignOut">Sign out</button>
      </div>
    </div>
  `;
  document.body.appendChild(authModal);

  document.getElementById('xcAuthClose')?.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (event) => { if (event.target === authModal) closeAuthModal(); });
  document.getElementById('xcSignIn')?.addEventListener('click', handleSignIn);
  document.getElementById('xcCreateAccount')?.addEventListener('click', handleCreateAccount);
  document.getElementById('xcSignOut')?.addEventListener('click', handleSignOut);
  document.getElementById('xcResetPassword')?.addEventListener('click', handlePasswordReset);
}

function openAuthModal() {
  if (!authModal) return;
  const email = document.getElementById('xcAuthEmail');
  const password = document.getElementById('xcAuthPassword');
  if (currentUser) {
    email.value = currentUser.email || '';
    email.disabled = true;
    password.closest('.field').classList.add('hide');
    document.getElementById('xcSignIn').classList.add('hide');
    document.getElementById('xcCreateAccount').classList.add('hide');
    document.getElementById('xcResetPassword').classList.add('hide');
    document.getElementById('xcSignOut').classList.remove('hide');
    setAuthMessage(`Signed in as ${currentUser.email}. Your XC Command data is synced to Firebase.`);
  } else {
    email.disabled = false;
    password.closest('.field').classList.remove('hide');
    document.getElementById('xcSignIn').classList.remove('hide');
    document.getElementById('xcCreateAccount').classList.remove('hide');
    document.getElementById('xcResetPassword').classList.remove('hide');
    document.getElementById('xcSignOut').classList.add('hide');
    setAuthMessage('Your existing device data will be preserved and uploaded when you create or sign into your account.');
  }
  authModal.classList.add('open');
  setTimeout(() => email.focus(), 50);
}

function closeAuthModal() {
  authModal?.classList.remove('open');
}

function authCredentials() {
  return {
    email: document.getElementById('xcAuthEmail')?.value.trim() || '',
    password: document.getElementById('xcAuthPassword')?.value || ''
  };
}

async function handleSignIn() {
  const { email, password } = authCredentials();
  if (!email || !password) return setAuthMessage('Enter your email and password.', true);
  setAuthMessage('Signing in…');
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (error) {
    setAuthMessage(friendlyAuthError(error), true);
  }
}

async function handleCreateAccount() {
  const { email, password } = authCredentials();
  if (!email || !password) return setAuthMessage('Enter an email and password.', true);
  setAuthMessage('Creating your XC Command account…');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (error) {
    setAuthMessage(friendlyAuthError(error), true);
  }
}

async function handleSignOut() {
  await signOut(auth);
  closeAuthModal();
}

async function handlePasswordReset() {
  const email = document.getElementById('xcAuthEmail')?.value.trim() || '';
  if (!email) return setAuthMessage('Enter your email address first.', true);
  try {
    await sendPasswordResetEmail(auth, email);
    setAuthMessage('Password reset email sent.');
  } catch (error) {
    setAuthMessage(friendlyAuthError(error), true);
  }
}

async function ensureTeam(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);
  let teamId = userSnapshot.exists() ? userSnapshot.data().defaultTeamId : null;
  if (!teamId) teamId = user.uid;

  const teamRef = doc(db, 'teams', teamId);
  const teamSnapshot = await getDoc(teamRef);
  const localState = readLocalState();

  if (!teamSnapshot.exists()) {
    await setDoc(teamRef, {
      name: localState.settings.teamName || 'My XC Team',
      ownerUid: user.uid,
      memberUids: [user.uid],
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    });
  }

  await setDoc(userRef, {
    email: user.email || '',
    defaultTeamId: teamId,
    updatedAtMs: Date.now()
  }, { merge: true });

  return teamId;
}

function stateRef() {
  return doc(db, 'teams', currentTeamId, 'state', 'current');
}

async function pushLocalState() {
  if (!currentUser || !currentTeamId) return;
  clearTimeout(syncTimer);
  setStatus('Syncing…', 'warn');
  const state = readLocalState();
  const now = Date.now();
  try {
    await setDoc(stateRef(), {
      state,
      updatedAtMs: now,
      updatedBy: currentUser.uid
    });
    await setDoc(doc(db, 'teams', currentTeamId), {
      name: state.settings.teamName || 'My XC Team',
      updatedAtMs: now
    }, { merge: true });
    setCloudMeta({ teamId: currentTeamId, lastSyncedAtMs: now });
    setStatus('Cloud synced', 'good');
  } catch (error) {
    console.error('XC Command cloud sync failed.', error);
    setStatus(error?.code === 'permission-denied' ? 'Rules needed' : 'Sync error', 'warn');
  }
}

function schedulePush() {
  if (!currentUser || !currentTeamId || suppressLocalSignal) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushLocalState, 650);
}

async function hydrateFromCloud() {
  const local = readLocalState();
  const snapshot = await getDoc(stateRef());

  if (!snapshot.exists()) {
    await pushLocalState();
    return false;
  }

  const remote = normalizeState(snapshot.data().state || {});
  const merged = meaningfulState(local) ? mergeStates(remote, local) : remote;
  const localJson = JSON.stringify(local);
  const mergedJson = JSON.stringify(merged);
  const remoteJson = JSON.stringify(remote);

  if (mergedJson !== remoteJson) {
    writeLocalState(merged);
    await pushLocalState();
  } else if (mergedJson !== localJson) {
    writeLocalState(merged);
    setCloudMeta({ teamId: currentTeamId, lastSyncedAtMs: snapshot.data().updatedAtMs || Date.now() });
    return true;
  }

  setStatus('Cloud synced', 'good');
  return false;
}

function startRealtimeSync() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(stateRef(), (snapshot) => {
    if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
    const remote = normalizeState(snapshot.data().state || {});
    const local = readLocalState();
    if (JSON.stringify(remote) === JSON.stringify(local)) {
      setStatus('Cloud synced', 'good');
      return;
    }
    writeLocalState(remote);
    setCloudMeta({ teamId: currentTeamId, lastSyncedAtMs: snapshot.data().updatedAtMs || Date.now() });
    setStatus('Updated from cloud', 'good');
    window.location.reload();
  }, (error) => {
    console.error('XC Command real-time sync failed.', error);
    setStatus(error?.code === 'permission-denied' ? 'Rules needed' : 'Sync error', 'warn');
  });
}

function updateSignedInUI(user) {
  const accountButton = document.getElementById('cloudAccountButton');
  if (accountButton) accountButton.textContent = user.email || 'Account';
  const body = document.getElementById('cloudSettingsBody');
  if (body) body.innerHTML = `<strong>Signed in as ${escapeHtml(user.email || 'coach')}.</strong><p>Roster, attendance, practices, timing results, and imported meet data are backed up to Firebase and synchronized with this account.</p>`;
  const settingsButton = document.getElementById('cloudSettingsButton');
  if (settingsButton) settingsButton.textContent = 'Manage account';
  setStatus('Syncing…', 'warn');
}

function updateSignedOutUI() {
  const accountButton = document.getElementById('cloudAccountButton');
  if (accountButton) accountButton.textContent = 'Sign in';
  const body = document.getElementById('cloudSettingsBody');
  if (body) body.innerHTML = '<strong>Your data is stored on this device.</strong><p>Sign in to back up this team and keep XC Command synchronized across your authorized devices.</p>';
  const settingsButton = document.getElementById('cloudSettingsButton');
  if (settingsButton) settingsButton.textContent = 'Sign in or create account';
  setStatus('Device only', 'warn');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  nativeSetItem.call(this, key, value);
  if (this === localStorage && key === STORAGE_KEY && !suppressLocalSignal) {
    window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));
  }
};

window.addEventListener('xccommand:local-state-changed', schedulePush);

injectCloudUI();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (!user) {
    currentTeamId = null;
    updateSignedOutUI();
    return;
  }

  updateSignedInUI(user);
  try {
    currentTeamId = await ensureTeam(user);
    const needsReload = await hydrateFromCloud();
    if (needsReload) {
      window.location.reload();
      return;
    }
    startRealtimeSync();
    setStatus('Cloud synced', 'good');
  } catch (error) {
    console.error('XC Command Firebase setup failed.', error);
    setStatus(error?.code === 'permission-denied' ? 'Rules needed' : 'Cloud error', 'warn');
  }
});

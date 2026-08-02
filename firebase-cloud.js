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
import {
  defaultState,
  mergeStates,
  normalizeState
} from './sync-core.js';

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
let reloadScheduled = false;

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

function localStateJson() {
  return JSON.stringify(readLocalState());
}

function getCloudMeta() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_META_KEY)) || {};
  } catch {
    return {};
  }
}

function setCloudMeta(patch) {
  const next = { ...getCloudMeta(), ...patch };
  nativeSetItem.call(localStorage, CLOUD_META_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('xccommand:cloud-meta', { detail: next }));
}

function setStatus(text, tone = '') {
  const topChip = document.getElementById('cloudStatusChip');
  const settingsPill = document.getElementById('cloudSettingsPill');
  if (topChip) topChip.textContent = text;
  if (settingsPill) {
    settingsPill.textContent = text;
    settingsPill.className = `pill ${tone}`.trim();
  }
  window.dispatchEvent(new CustomEvent('xccommand:cloud-status', {
    detail: { text, tone }
  }));
}

function setAuthMessage(message, isError = false) {
  const element = document.getElementById('xcAuthMessage');
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? '#b42318' : '';
}

function friendlyAuthError(error) {
  const map = {
    'auth/email-already-in-use': 'That email already has an XC Command account.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'XC Command could not reach Firebase. Check your connection.'
  };
  return map[error?.code] || error?.message || 'XC Command could not complete that account action.';
}

function friendlySyncError(error) {
  if (error?.code === 'permission-denied') {
    return 'Cloud access is blocked by Firebase rules. Device data is still saved.';
  }
  if (!navigator.onLine) return 'Offline. Changes remain on this device until connection returns.';
  return error?.message || 'Cloud synchronization failed.';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function injectCloudUI() {
  if (document.getElementById('cloudAccountButton')) return;

  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const deviceChip = [...topActions.querySelectorAll('.chip')]
      .find((chip) => chip.textContent.includes('Auto-saved'));
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

  const securityCard = [...document.querySelectorAll('#settings .card')]
    .find((card) => card.querySelector('h3')?.textContent.trim() === 'Account security');

  if (securityCard) {
    securityCard.innerHTML = `
      <div class="card-head">
        <div>
          <h3>XC Command account</h3>
          <div class="sub">Firebase authentication and protected cloud synchronization</div>
        </div>
        <span class="pill warn" id="cloudSettingsPill">Signed out</span>
      </div>
      <div class="insight" id="cloudSettingsBody">
        <strong>Your data is stored on this device.</strong>
        <p>Sign in to back it up and synchronize authorized devices.</p>
      </div>
      <div class="toolbar" style="margin-top:14px">
        <button class="primary" id="cloudSettingsButton">Sign in or create account</button>
      </div>
    `;
    document.getElementById('cloudSettingsButton')?.addEventListener('click', openAuthModal);
  }

  authModal = document.createElement('div');
  authModal.className = 'modal-backdrop';
  authModal.id = 'xcAuthModal';
  authModal.setAttribute('role', 'dialog');
  authModal.setAttribute('aria-modal', 'true');
  authModal.setAttribute('aria-labelledby', 'xcAuthTitle');
  authModal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <div>
          <strong id="xcAuthTitle">XC Command account</strong>
          <div class="sub">Sign in to keep team data synchronized.</div>
        </div>
        <button class="icon-btn" id="xcAuthClose" aria-label="Close account window">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-4">
            <label for="xcAuthEmail">Email</label>
            <input id="xcAuthEmail" type="email" autocomplete="email">
          </div>
          <div class="field span-4" id="xcPasswordField">
            <label for="xcAuthPassword">Password</label>
            <input id="xcAuthPassword" type="password" autocomplete="current-password">
          </div>
        </div>
        <div id="xcAuthMessage" class="insight" style="margin-top:16px">
          Existing device data will be merged with cloud data rather than replaced.
        </div>
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
  authModal.addEventListener('click', (event) => {
    if (event.target === authModal) closeAuthModal();
  });
  document.getElementById('xcSignIn')?.addEventListener('click', handleSignIn);
  document.getElementById('xcCreateAccount')?.addEventListener('click', handleCreateAccount);
  document.getElementById('xcSignOut')?.addEventListener('click', handleSignOut);
  document.getElementById('xcResetPassword')?.addEventListener('click', handlePasswordReset);
}

function openAuthModal() {
  if (!authModal) return;
  const email = document.getElementById('xcAuthEmail');
  const passwordField = document.getElementById('xcPasswordField');
  const signedIn = Boolean(currentUser);

  if (signedIn) email.value = currentUser.email || '';
  email.disabled = signedIn;
  passwordField?.classList.toggle('hide', signedIn);
  document.getElementById('xcSignIn')?.classList.toggle('hide', signedIn);
  document.getElementById('xcCreateAccount')?.classList.toggle('hide', signedIn);
  document.getElementById('xcResetPassword')?.classList.toggle('hide', signedIn);
  document.getElementById('xcSignOut')?.classList.toggle('hide', !signedIn);

  setAuthMessage(
    signedIn
      ? `Signed in as ${currentUser.email || 'coach'}.`
      : 'Existing device data will be merged with cloud data rather than replaced.'
  );
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
  const teamId = userSnapshot.exists() && userSnapshot.data().defaultTeamId
    ? userSnapshot.data().defaultTeamId
    : user.uid;

  const local = readLocalState();
  const teamRef = doc(db, 'teams', teamId);
  const teamSnapshot = await getDoc(teamRef);

  if (!teamSnapshot.exists()) {
    await setDoc(teamRef, {
      name: local.settings.teamName || 'My XC Team',
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
  if (!currentUser || !currentTeamId || reconciliationInProgress) return false;

  clearTimeout(syncTimer);
  reconciliationInProgress = true;
  setStatus('Syncing…', 'warn');

  try {
    const local = readLocalState();
    let committed = local;
    const now = Date.now();

    await runTransaction(db, async (transaction) => {
      const reference = stateRef();
      const snapshot = await transaction.get(reference);
      const remote = snapshot.exists()
        ? normalizeState(snapshot.data().state || {})
        : defaultState();

      committed = snapshot.exists() ? mergeStates(remote, local) : local;
      transaction.set(reference, {
        state: committed,
        updatedAtMs: now,
        updatedBy: currentUser.uid
      });
    });

    if (JSON.stringify(committed) !== localStateJson()) writeLocalState(committed);

    await setDoc(doc(db, 'teams', currentTeamId), {
      name: committed.settings.teamName || 'My XC Team',
      updatedAtMs: now
    }, { merge: true });

    setCloudMeta({
      teamId: currentTeamId,
      lastSyncedAtMs: now,
      pending: false,
      lastError: ''
    });
    setStatus('Cloud synced', 'good');
    return true;
  } catch (error) {
    console.error('XC Command cloud sync failed.', error);
    const message = friendlySyncError(error);
    setCloudMeta({ pending: true, lastError: message });
    setStatus(error?.code === 'permission-denied' ? 'Cloud setup needed' : 'Sync error', 'warn');
    return false;
  } finally {
    reconciliationInProgress = false;
  }
}

function schedulePush() {
  if (!currentUser || !currentTeamId || suppressLocalSignal) return;
  setCloudMeta({ pending: true });
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushLocalState, 700);
}

async function hydrateFromCloud() {
  const local = readLocalState();
  const snapshot = await getDoc(stateRef());

  if (!snapshot.exists()) {
    await pushLocalState();
    return false;
  }

  const remote = normalizeState(snapshot.data().state || {});
  const merged = mergeStates(remote, local);
  const remoteJson = JSON.stringify(remote);
  const localJson = JSON.stringify(local);
  const mergedJson = JSON.stringify(merged);

  if (mergedJson !== localJson) writeLocalState(merged);
  if (mergedJson !== remoteJson) await pushLocalState();

  setCloudMeta({
    teamId: currentTeamId,
    lastSyncedAtMs: snapshot.data().updatedAtMs || Date.now(),
    pending: false,
    lastError: ''
  });
  setStatus('Cloud synced', 'good');
  return mergedJson !== localJson;
}

function scheduleReload() {
  if (reloadScheduled) return;
  reloadScheduled = true;
  setTimeout(() => window.location.reload(), 80);
}

function startRealtimeSync() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = onSnapshot(stateRef(), async (snapshot) => {
    if (!snapshot.exists() || snapshot.metadata.hasPendingWrites || reconciliationInProgress) return;

    const remote = normalizeState(snapshot.data().state || {});
    const local = readLocalState();
    if (JSON.stringify(remote) === JSON.stringify(local)) {
      setStatus('Cloud synced', 'good');
      return;
    }

    reconciliationInProgress = true;
    try {
      const merged = mergeStates(remote, local);
      const mergedJson = JSON.stringify(merged);
      const localJson = JSON.stringify(local);
      const remoteJson = JSON.stringify(remote);

      if (mergedJson !== localJson) {
        writeLocalState(merged);
        setCloudMeta({
          teamId: currentTeamId,
          lastSyncedAtMs: snapshot.data().updatedAtMs || Date.now(),
          pending: mergedJson !== remoteJson,
          lastError: ''
        });
        scheduleReload();
      }

      reconciliationInProgress = false;
      if (mergedJson !== remoteJson) await pushLocalState();
      else setStatus('Updated from cloud', 'good');
    } catch (error) {
      console.error('XC Command reconciliation failed.', error);
      const message = friendlySyncError(error);
      setCloudMeta({ pending: true, lastError: message });
      setStatus('Sync error', 'warn');
    } finally {
      reconciliationInProgress = false;
    }
  }, (error) => {
    console.error('XC Command real-time sync failed.', error);
    const message = friendlySyncError(error);
    setCloudMeta({ pending: true, lastError: message });
    setStatus(error?.code === 'permission-denied' ? 'Cloud setup needed' : 'Sync error', 'warn');
  });
}

function updateSignedInUI(user) {
  const accountButton = document.getElementById('cloudAccountButton');
  if (accountButton) accountButton.textContent = user.email || 'Account';

  const body = document.getElementById('cloudSettingsBody');
  if (body) {
    body.innerHTML = `
      <strong>Signed in as ${escapeHtml(user.email || 'coach')}.</strong>
      <p>Roster, attendance, practices and results are merged transactionally across authorized devices.</p>
    `;
  }

  const settingsButton = document.getElementById('cloudSettingsButton');
  if (settingsButton) settingsButton.textContent = 'Manage account';
  setStatus('Syncing…', 'warn');
}

function updateSignedOutUI() {
  const accountButton = document.getElementById('cloudAccountButton');
  if (accountButton) accountButton.textContent = 'Sign in';

  const body = document.getElementById('cloudSettingsBody');
  if (body) {
    body.innerHTML = `
      <strong>Your data is stored on this device.</strong>
      <p>Sign in to back it up and synchronize authorized devices.</p>
    `;
  }

  const settingsButton = document.getElementById('cloudSettingsButton');
  if (settingsButton) settingsButton.textContent = 'Sign in or create account';
  setStatus('Device only', 'warn');
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  nativeSetItem.call(this, key, value);
  if (this === localStorage && key === STORAGE_KEY && !suppressLocalSignal) {
    window.dispatchEvent(new CustomEvent('xccommand:local-state-changed'));
  }
};

window.addEventListener('xccommand:local-state-changed', schedulePush);
window.addEventListener('online', () => {
  if (currentUser) pushLocalState();
});
window.addEventListener('offline', () => {
  setCloudMeta({ pending: Boolean(currentUser) });
  setStatus(currentUser ? 'Offline changes saved' : 'Device only', 'warn');
});

injectCloudUI();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;

  if (!user) {
    currentTeamId = null;
    updateSignedOutUI();
    return;
  }

  updateSignedInUI(user);
  try {
    currentTeamId = await ensureTeam(user);
    const changedLocally = await hydrateFromCloud();
    startRealtimeSync();
    if (changedLocally) scheduleReload();
  } catch (error) {
    console.error('XC Command Firebase setup failed.', error);
    const message = friendlySyncError(error);
    setCloudMeta({ pending: true, lastError: message });
    setStatus(error?.code === 'permission-denied' ? 'Cloud setup needed' : 'Cloud error', 'warn');
  }
});

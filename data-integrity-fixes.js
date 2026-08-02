import {
  normalizeName,
  normalizePractice,
  normalizeState,
  practiceKey,
  resultKey
} from './sync-core.js';

const STORAGE_KEY = 'coachos_xc_v2';
const PRACTICE_KEY = 'xccommand_practice_details_v1';
const TEAM_KEY = 'xccommand_team_assignments_v1';
const SELECTED_TEAM_KEY = 'xccommand_selected_practice_team_v1';
const CLOUD_META_KEY = 'xccommand_cloud_meta_v1';
const RESET_SEED_PREFIX = 'xccommand_season_reset_';
const PRE_RESET_BACKUP_PREFIX = 'xccommand_backup_before_';
const $ = (id) => document.getElementById(id);

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readState() {
  return normalizeState(safeParse(localStorage.getItem(STORAGE_KEY), {}));
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function auxiliaryKeys() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith('xccommand_'))
    .filter((key) => key !== STORAGE_KEY);
}

function migrateAuxiliaryData() {
  const state = readState();
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

  if (JSON.stringify(state) !== original) writeState(state);
  return state;
}

function mirrorEnhancedPractice() {
  setTimeout(() => {
    const date = $('practiceDate')?.value;
    const rosterId = $('practiceRoster')?.value
      || localStorage.getItem(SELECTED_TEAM_KEY)
      || 'all';
    if (!date) return;

    const details = safeParse(localStorage.getItem(PRACTICE_KEY), {});
    const record = details[`${date}|${rosterId}`];
    if (!record) return;

    const state = readState();
    const normalized = normalizePractice({
      ...record,
      id: `${date}|${rosterId}`,
      rosterId,
      updatedAtMs: Date.parse(record.updatedAt || '') || Date.now()
    });
    const key = practiceKey(normalized);
    state.practices = state.practices
      .filter((practice) => practiceKey(practice) !== key);
    state.practices.push(normalized);
    writeState(state);
  }, 80);
}

function mirrorAssignments(event) {
  const select = event.target.closest?.('[data-team-assignment]');
  if (!select) return;
  const state = readState();
  state.rosterAssignments[select.dataset.teamAssignment] = select.value;
  writeState(state);
}

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildBackup(emergency = false) {
  const state = migrateAuxiliaryData();
  const auxiliary = {};
  auxiliaryKeys().forEach((key) => {
    auxiliary[key] = localStorage.getItem(key);
  });
  return {
    format: 'xc-command-complete-backup',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    emergency,
    state,
    auxiliary
  };
}

function exportCompleteBackup(event) {
  const button = event.target.closest?.('#exportBackup');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const payload = buildBackup(false);
  download(
    `xc-command-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2)
  );
}

function validateBackup(parsed) {
  const state = normalizeState(parsed?.state || parsed);
  if (!Array.isArray(state.athletes)) throw new Error('Athlete list is missing.');
  if (!Array.isArray(state.results)) throw new Error('Results list is missing.');
  if (!Array.isArray(state.practices)) throw new Error('Practice list is missing.');
  if (!state.attendance || typeof state.attendance !== 'object') {
    throw new Error('Attendance data is missing.');
  }
  return state;
}

function importCompleteBackup(event) {
  const input = event.target.closest?.('#importBackup');
  if (!input || !input.files?.[0]) return;
  event.stopImmediatePropagation();

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const state = validateBackup(parsed);
      writeState(state);

      if (parsed.auxiliary && typeof parsed.auxiliary === 'object') {
        Object.entries(parsed.auxiliary).forEach(([key, value]) => {
          if (!key.startsWith('xccommand_') || value == null) return;
          localStorage.setItem(key, String(value));
        });
      }

      localStorage.setItem(
        TEAM_KEY,
        JSON.stringify(state.rosterAssignments || {})
      );
      const details = {};
      state.practices.forEach((practice) => {
        details[practiceKey(practice)] = practice;
      });
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(details));
      alert('Complete backup imported successfully.');
      window.location.reload();
    } catch (error) {
      alert(`That file is not a valid XC Command backup. ${error.message || ''}`.trim());
    }
  };
  reader.readAsText(input.files[0]);
}

function resetDevice(event) {
  const button = event.target.closest?.('#resetApp');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const confirmed = confirm(
    'Reset XC Command on this device? This removes local roster, attendance, practices, results, assignments and cached analysis. Cloud data is not deleted.'
  );
  if (!confirmed) return;

  const preserved = {};
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(RESET_SEED_PREFIX) || key.startsWith(PRE_RESET_BACKUP_PREFIX)) {
      preserved[key] = localStorage.getItem(key);
    }
  });

  Object.keys(localStorage).forEach((key) => {
    if (key === STORAGE_KEY || key.startsWith('xccommand_')) localStorage.removeItem(key);
  });

  Object.entries(preserved).forEach(([key, value]) => {
    if (value != null) localStorage.setItem(key, value);
  });

  writeState({
    settings: {
      teamName: 'Harts Bluff XC',
      season: '2026 XC',
      coachName: ''
    },
    athletes: [],
    results: [],
    attendance: {},
    practices: [],
    rosterAssignments: {},
    customDistances: []
  });
  window.location.reload();
}

function parseRosterLine(line, defaultSex, defaultGrade) {
  const raw = line.trim();
  if (!raw) return null;

  const parts = raw.includes('\t')
    ? raw.split('\t').map((value) => value.trim()).filter(Boolean)
    : raw.split(',').map((value) => value.trim()).filter(Boolean);

  if (!parts.length) return null;
  const joined = parts.join(' ').toLowerCase();
  if (joined.includes('name') && (
    joined.includes('grade')
    || joined.includes('sex')
    || joined.includes('gender')
  )) return null;

  const normalizeSex = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (['f', 'female', 'girl', 'girls', 'w', 'women'].includes(normalized)) return 'Female';
    if (['m', 'male', 'boy', 'boys', 'men'].includes(normalized)) return 'Male';
    return '';
  };

  const normalizeGrade = (value) => (
    String(value || '').match(/\b(7|8|9|10|11|12)\b/)?.[1] || ''
  );

  let sex = defaultSex;
  let grade = defaultGrade;
  parts.slice(1).forEach((part) => {
    sex = normalizeSex(part) || sex;
    grade = normalizeGrade(part) || grade;
  });

  let name;
  if (
    parts.length >= 2
    && !normalizeSex(parts[1])
    && !normalizeGrade(parts[1])
  ) {
    name = `${parts[1]} ${parts[0]}`.trim();
  } else {
    name = parts[0];
  }

  name = name.replace(/^\d+[.)-]?\s*/, '').trim();
  return name ? { name, sex, grade } : null;
}

function installRosterPreviewFix() {
  const textarea = $('rosterPaste');
  const preview = $('rosterPreview');
  const button = $('importRosterBtn');
  if (!textarea || !preview || !button) return;

  const parse = () => textarea.value
    .split(/\r?\n/)
    .map((line) => parseRosterLine(
      line,
      $('rosterDefaultSex')?.value || 'Female',
      $('rosterDefaultGrade')?.value || '9'
    ))
    .filter(Boolean);

  const render = () => {
    const rows = parse();
    const state = readState();
    const existing = new Set(
      state.athletes.map((athlete) => normalizeName(athlete.name))
    );
    const duplicates = rows
      .filter((row) => existing.has(normalizeName(row.name)))
      .length;
    preview.textContent = rows.length
      ? `${rows.length} athlete${rows.length === 1 ? '' : 's'} ready • ${duplicates} duplicate${duplicates === 1 ? '' : 's'} will be skipped`
      : 'Paste your roster to preview the import.';
  };

  textarea.addEventListener('input', render, true);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const rows = parse();
    if (!rows.length) {
      preview.textContent = 'No valid athletes were found.';
      return;
    }

    const state = readState();
    const existing = new Set(
      state.athletes.map((athlete) => normalizeName(athlete.name))
    );
    let added = 0;

    rows.forEach((row, index) => {
      const key = normalizeName(row.name);
      if (!key || existing.has(key)) return;
      existing.add(key);
      const now = Date.now();
      state.athletes.push({
        id: `athlete_${now.toString(36)}_${index.toString(36)}`,
        ...row,
        active: true,
        createdAt: new Date(now).toISOString(),
        updatedAtMs: now
      });
      added += 1;
    });

    writeState(state);
    alert(`${added} athlete${added === 1 ? '' : 's'} imported.`);
    window.location.reload();
  }, true);
}

function selfCheck() {
  const state = migrateAuxiliaryData();
  const issues = [];

  const athleteIds = new Set();
  const athleteNames = new Set();
  state.athletes.forEach((athlete) => {
    if (!athlete.id) issues.push(`Athlete without ID: ${athlete.name || 'Unnamed'}`);
    if (athleteIds.has(athlete.id)) issues.push(`Duplicate athlete ID: ${athlete.id}`);
    athleteIds.add(athlete.id);

    const nameKey = normalizeName(athlete.name);
    if (!nameKey) issues.push(`Athlete with blank name: ${athlete.id || 'Unknown ID'}`);
    if (nameKey && athleteNames.has(nameKey)) issues.push(`Duplicate athlete name: ${athlete.name}`);
    if (nameKey) athleteNames.add(nameKey);
  });

  const resultKeys = new Set();
  state.results.forEach((result) => {
    if (!athleteIds.has(result.athleteId)) issues.push(`Result has missing athlete: ${result.id || resultKey(result)}`);
    if (!Number.isFinite(Number(result.seconds)) || Number(result.seconds) <= 0) {
      issues.push(`Invalid result time: ${result.id || resultKey(result)}`);
    }
    const key = resultKey(result);
    if (resultKeys.has(key)) issues.push(`Duplicate result: ${key}`);
    resultKeys.add(key);
  });

  const practiceKeys = new Set();
  state.practices.forEach((practice) => {
    const key = practiceKey(practice);
    if (practiceKeys.has(key)) issues.push(`Duplicate practice: ${key}`);
    practiceKeys.add(key);
  });

  return {
    issues,
    summary: {
      athletes: state.athletes.length,
      results: state.results.length,
      practices: state.practices.length,
      attendanceDays: Object.keys(state.attendance).length
    }
  };
}

function installSyncDiagnostics() {
  const settingsTitle = document.querySelector('#settings .section-title');
  if (!settingsTitle || $('xcSyncDiagnostics')) return;

  const box = document.createElement('div');
  box.id = 'xcSyncDiagnostics';
  box.className = 'insight';
  box.style.marginBottom = '18px';
  box.innerHTML = `
    <strong>Data safety and synchronization</strong>
    <p id="xcSyncDiagnosticText">Checking device and cloud status…</p>
    <p id="xcSelfCheckText" class="muted"></p>
    <div class="toolbar" style="margin-top:12px">
      <button type="button" class="secondary" id="xcRunSelfCheck">Run data self-check</button>
      <button type="button" class="secondary" id="xcEmergencyBackup">Download emergency backup</button>
    </div>
  `;
  settingsTitle.insertAdjacentElement('afterend', box);

  const refresh = () => {
    const meta = safeParse(localStorage.getItem(CLOUD_META_KEY), {});
    const last = meta.lastSyncedAtMs
      ? new Date(meta.lastSyncedAtMs).toLocaleString()
      : 'Never';
    const parts = [
      navigator.onLine ? 'Online' : 'Offline',
      `Last successful cloud sync: ${last}`
    ];
    if (meta.pending) parts.push('Changes pending');
    if (meta.lastError) parts.push(meta.lastError);
    $('xcSyncDiagnosticText').textContent = parts.join(' • ');
  };

  $('xcEmergencyBackup')?.addEventListener('click', () => {
    const payload = buildBackup(true);
    download(
      `xc-command-emergency-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2)
    );
  });

  $('xcRunSelfCheck')?.addEventListener('click', () => {
    const report = selfCheck();
    const summary = report.summary;
    $('xcSelfCheckText').textContent = report.issues.length
      ? `${report.issues.length} issue${report.issues.length === 1 ? '' : 's'} found. First issue: ${report.issues[0]}`
      : `Passed: ${summary.athletes} athletes, ${summary.results} results, ${summary.practices} practices and ${summary.attendanceDays} attendance days checked.`;
  });

  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  window.addEventListener('xccommand:cloud-meta', refresh);
  window.addEventListener('xccommand:cloud-status', refresh);
  refresh();
}

migrateAuxiliaryData();
document.addEventListener('click', exportCompleteBackup, true);
document.addEventListener('click', resetDevice, true);
document.addEventListener('click', mirrorEnhancedPractice, true);
document.addEventListener('change', importCompleteBackup, true);
document.addEventListener('change', mirrorAssignments, true);
installRosterPreviewFix();
installSyncDiagnostics();

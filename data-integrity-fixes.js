(() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const TEAM_KEY = 'xccommand_team_assignments_v1';
  const SELECTED_TEAM_KEY = 'xccommand_selected_practice_team_v1';
  const OWNED_KEYS = [STORAGE_KEY, PRACTICE_KEY, TEAM_KEY, SELECTED_TEAM_KEY, 'xccommand_cloud_meta_v1', 'xccommand_ai_cache_v1'];
  const $ = (id) => document.getElementById(id);

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }

  function normalizeState(input) {
    const value = input && typeof input === 'object' ? input : {};
    return {
      ...value,
      version: 3,
      settings: { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '', ...(value.settings || {}) },
      athletes: Array.isArray(value.athletes) ? value.athletes : [],
      results: Array.isArray(value.results) ? value.results : [],
      attendance: value.attendance && typeof value.attendance === 'object' ? value.attendance : {},
      practices: Array.isArray(value.practices) ? value.practices : [],
      rosterAssignments: value.rosterAssignments && typeof value.rosterAssignments === 'object' ? value.rosterAssignments : {},
      customDistances: Array.isArray(value.customDistances) ? value.customDistances : []
    };
  }

  function readState() { return normalizeState(safeParse(localStorage.getItem(STORAGE_KEY), {})); }
  function writeState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); }

  function migrateAuxiliaryData() {
    const state = readState();
    const details = safeParse(localStorage.getItem(PRACTICE_KEY), {});
    const assignments = safeParse(localStorage.getItem(TEAM_KEY), {});
    const practices = new Map((state.practices || []).map((practice) => [practice.id || `${practice.date}|${practice.rosterId || 'all'}`, practice]));

    Object.values(details).forEach((practice) => {
      const id = practice.id || `${practice.date}|${practice.rosterId || 'all'}`;
      const updatedAtMs = Number(practice.updatedAtMs) || Date.parse(practice.updatedAt || 0) || Date.now();
      const existing = practices.get(id);
      const existingStamp = Number(existing?.updatedAtMs) || Date.parse(existing?.updatedAt || 0) || 0;
      if (!existing || updatedAtMs >= existingStamp) practices.set(id, { ...practice, id, rosterId: practice.rosterId || 'all', updatedAtMs });
    });

    state.practices = [...practices.values()];
    state.rosterAssignments = { ...state.rosterAssignments, ...assignments };
    writeState(state);
  }

  function mirrorEnhancedPractice() {
    setTimeout(() => {
      const date = $('practiceDate')?.value;
      const rosterId = $('practiceRoster')?.value || localStorage.getItem(SELECTED_TEAM_KEY) || 'all';
      if (!date) return;
      const details = safeParse(localStorage.getItem(PRACTICE_KEY), {});
      const record = details[`${date}|${rosterId}`];
      if (!record) return;
      const state = readState();
      const id = `${date}|${rosterId}`;
      const normalized = { ...record, id, rosterId, updatedAtMs: Date.parse(record.updatedAt || 0) || Date.now() };
      state.practices = state.practices.filter((practice) => (practice.id || `${practice.date}|${practice.rosterId || 'all'}`) !== id);
      state.practices.push(normalized);
      writeState(state);
    }, 40);
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

  function exportCompleteBackup(event) {
    const button = event.target.closest?.('#exportBackup');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    migrateAuxiliaryData();
    const state = readState();
    const payload = { schemaVersion: 3, exportedAt: new Date().toISOString(), state };
    download(`xc-command-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
  }

  function importCompleteBackup(event) {
    const input = event.target.closest?.('#importBackup');
    if (!input || !input.files?.[0]) return;
    event.stopImmediatePropagation();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const state = normalizeState(parsed.state || parsed);
        if (!Array.isArray(state.athletes) || !Array.isArray(state.results) || !Array.isArray(state.practices)) throw new Error('Invalid backup schema');
        writeState(state);
        localStorage.setItem(TEAM_KEY, JSON.stringify(state.rosterAssignments || {}));
        const details = {};
        state.practices.forEach((practice) => { details[practice.id || `${practice.date}|${practice.rosterId || 'all'}`] = practice; });
        localStorage.setItem(PRACTICE_KEY, JSON.stringify(details));
        alert('Backup imported successfully.');
        window.location.reload();
      } catch {
        alert('That file is not a valid XC Command backup.');
      }
    };
    reader.readAsText(input.files[0]);
  }

  function resetDevice(event) {
    const button = event.target.closest?.('#resetApp');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm('Reset XC Command on this device? This removes local roster, attendance, practices, results, assignments, and cached analysis. Cloud data is not deleted.')) return;
    OWNED_KEYS.forEach((key) => localStorage.removeItem(key));
    writeState({ version: 3, settings: { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '' }, athletes: [], results: [], attendance: {}, practices: [], rosterAssignments: {}, customDistances: [] });
    window.location.reload();
  }

  function parseRosterLine(line, defaultSex, defaultGrade) {
    const raw = line.trim();
    if (!raw) return null;
    const parts = raw.includes('\t') ? raw.split('\t').map((value) => value.trim()).filter(Boolean) : raw.split(',').map((value) => value.trim()).filter(Boolean);
    if (!parts.length) return null;
    const joined = parts.join(' ').toLowerCase();
    if (joined.includes('name') && (joined.includes('grade') || joined.includes('sex') || joined.includes('gender'))) return null;
    const normalizeSex = (value) => {
      const v = String(value || '').toLowerCase();
      if (['f', 'female', 'girl', 'girls', 'w', 'women'].includes(v)) return 'Female';
      if (['m', 'male', 'boy', 'boys', 'men'].includes(v)) return 'Male';
      return '';
    };
    const normalizeGrade = (value) => String(value || '').match(/\b(7|8|9|10|11|12)\b/)?.[1] || '';
    let sex = defaultSex;
    let grade = defaultGrade;
    parts.slice(1).forEach((part) => { sex = normalizeSex(part) || sex; grade = normalizeGrade(part) || grade; });
    let name;
    if (parts.length >= 2 && !normalizeSex(parts[1]) && !normalizeGrade(parts[1])) name = `${parts[1]} ${parts[0]}`.trim();
    else name = parts[0];
    name = name.replace(/^\d+[.)-]?\s*/, '').trim();
    return name ? { name, sex, grade } : null;
  }

  function installRosterPreviewFix() {
    const textarea = $('rosterPaste');
    const preview = $('rosterPreview');
    const button = $('importRosterBtn');
    if (!textarea || !preview || !button) return;
    const parse = () => textarea.value.split(/\r?\n/).map((line) => parseRosterLine(line, $('rosterDefaultSex')?.value || 'Female', $('rosterDefaultGrade')?.value || '9')).filter(Boolean);
    const render = () => {
      const rows = parse();
      const state = readState();
      const existing = new Set(state.athletes.map((athlete) => String(athlete.name || '').trim().toLowerCase()));
      const duplicates = rows.filter((row) => existing.has(row.name.toLowerCase())).length;
      preview.textContent = rows.length ? `${rows.length} athlete${rows.length === 1 ? '' : 's'} ready • ${duplicates} duplicate${duplicates === 1 ? '' : 's'} will be skipped` : 'Paste your roster to preview the import.';
    };
    textarea.addEventListener('input', render, true);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const rows = parse();
      if (!rows.length) return preview.textContent = 'No valid athletes were found.';
      const state = readState();
      const existing = new Set(state.athletes.map((athlete) => String(athlete.name || '').trim().toLowerCase()));
      let added = 0;
      rows.forEach((row) => {
        const key = row.name.toLowerCase();
        if (existing.has(key)) return;
        existing.add(key);
        state.athletes.push({ id: `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`, ...row, active: true, createdAt: new Date().toISOString(), updatedAtMs: Date.now() });
        added += 1;
      });
      writeState(state);
      alert(`${added} athlete${added === 1 ? '' : 's'} imported.`);
      window.location.reload();
    }, true);
  }

  function installSyncDiagnostics() {
    const settings = document.querySelector('#settings .section-title') || document.querySelector('#settings');
    if (!settings || $('xcSyncDiagnostics')) return;
    const box = document.createElement('div');
    box.id = 'xcSyncDiagnostics';
    box.className = 'insight';
    box.style.marginBottom = '16px';
    box.innerHTML = '<strong>Synchronization status</strong><p id="xcSyncDiagnosticText">Checking…</p><div class="toolbar"><button type="button" class="secondary" id="xcEmergencyBackup">Download emergency backup</button></div>';
    settings.insertAdjacentElement('afterend', box);
    const refresh = () => {
      const meta = safeParse(localStorage.getItem('xccommand_cloud_meta_v1'), {});
      const last = meta.lastSyncedAtMs ? new Date(meta.lastSyncedAtMs).toLocaleString() : 'Never';
      $('xcSyncDiagnosticText').textContent = `${navigator.onLine ? 'Online' : 'Offline'} • Last successful sync: ${last}${meta.pending ? ' • Pending changes' : ''}${meta.lastError ? ` • ${meta.lastError}` : ''}`;
    };
    $('xcEmergencyBackup')?.addEventListener('click', () => {
      migrateAuxiliaryData();
      const payload = { schemaVersion: 3, exportedAt: new Date().toISOString(), emergency: true, state: readState() };
      download(`xc-command-emergency-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
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
})();

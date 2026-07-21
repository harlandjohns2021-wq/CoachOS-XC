(() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const modal = document.getElementById('rosterImportModal');
  const openButton = document.getElementById('pasteRosterBtn');
  const textarea = document.getElementById('rosterPaste');
  const defaultSex = document.getElementById('rosterDefaultSex');
  const defaultGrade = document.getElementById('rosterDefaultGrade');
  const preview = document.getElementById('rosterPreview');
  const importButton = document.getElementById('importRosterBtn');

  if (!modal || !openButton || !textarea || !importButton) return;

  const close = () => modal.classList.remove('open');
  const open = () => {
    textarea.value = '';
    preview.textContent = 'Paste your roster to preview the import.';
    modal.classList.add('open');
    setTimeout(() => textarea.focus(), 50);
  };

  function uid() {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  function normalizeSex(value, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    if (['f', 'female', 'girl', 'girls', 'w', 'women'].includes(raw)) return 'Female';
    if (['m', 'male', 'boy', 'boys', 'men'].includes(raw)) return 'Male';
    return fallback;
  }

  function normalizeGrade(value, fallback) {
    const match = String(value || '').match(/\b(7|8|9|10|11|12)\b/);
    return match ? match[1] : fallback;
  }

  function looksLikeHeader(parts) {
    const joined = parts.join(' ').toLowerCase();
    return joined.includes('name') && (joined.includes('grade') || joined.includes('sex') || joined.includes('gender'));
  }

  function parseLine(line) {
    const fallbackSex = defaultSex.value;
    const fallbackGrade = defaultGrade.value;
    const parts = line.includes('\t')
      ? line.split('\t').map((part) => part.trim()).filter(Boolean)
      : line.split(',').map((part) => part.trim()).filter(Boolean);

    if (!parts.length || looksLikeHeader(parts)) return null;

    let name = parts[0];
    let sex = fallbackSex;
    let grade = fallbackGrade;

    for (const part of parts.slice(1)) {
      const detectedSex = normalizeSex(part, '');
      const detectedGrade = normalizeGrade(part, '');
      if (detectedSex) sex = detectedSex;
      if (detectedGrade) grade = detectedGrade;
    }

    // Support common "Last, First, Grade, Sex" spreadsheet exports.
    if (parts.length >= 2 && !normalizeSex(parts[1], '') && !normalizeGrade(parts[1], '')) {
      const laterHasMetadata = parts.slice(2).some((part) => normalizeSex(part, '') || normalizeGrade(part, ''));
      if (laterHasMetadata) name = `${parts[1]} ${parts[0]}`.trim();
    }

    name = name.replace(/^\d+[.)-]?\s*/, '').trim();
    if (!name) return null;
    return { name, sex, grade };
  }

  function parseRoster() {
    return textarea.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseLine)
      .filter(Boolean);
  }

  function updatePreview() {
    const rows = parseRoster();
    if (!rows.length) {
      preview.textContent = 'Paste your roster to preview the import.';
      return;
    }
    const girls = rows.filter((row) => row.sex === 'Female').length;
    const boys = rows.filter((row) => row.sex === 'Male').length;
    preview.textContent = `${rows.length} athlete${rows.length === 1 ? '' : 's'} ready to import • ${girls} girls • ${boys} boys`;
  }

  function importRoster() {
    const rows = parseRoster();
    if (!rows.length) {
      preview.textContent = 'No valid athletes were found. Use one athlete per line.';
      return;
    }

    let state;
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      state = {};
    }
    state.version = 2;
    state.settings ||= { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '' };
    state.athletes = Array.isArray(state.athletes) ? state.athletes : [];
    state.results = Array.isArray(state.results) ? state.results : [];
    state.attendance ||= {};
    state.practices = Array.isArray(state.practices) ? state.practices : [];

    const existing = new Set(state.athletes.map((athlete) => String(athlete.name || '').trim().toLowerCase()));
    let added = 0;
    let skipped = 0;

    rows.forEach((row) => {
      const key = row.name.toLowerCase();
      if (existing.has(key)) {
        skipped += 1;
        return;
      }
      existing.add(key);
      state.athletes.push({
        id: uid(),
        name: row.name,
        sex: row.sex,
        grade: row.grade,
        active: true,
        createdAt: new Date().toISOString()
      });
      added += 1;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    close();
    alert(`${added} athlete${added === 1 ? '' : 's'} imported${skipped ? ` • ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`);
    window.location.reload();
  }

  openButton.addEventListener('click', open);
  textarea.addEventListener('input', updatePreview);
  defaultSex.addEventListener('change', updatePreview);
  defaultGrade.addEventListener('change', updatePreview);
  importButton.addEventListener('click', importRoster);
  modal.querySelectorAll('[data-close-roster-import]').forEach((button) => button.addEventListener('click', close));
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
})();

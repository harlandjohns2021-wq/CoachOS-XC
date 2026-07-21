(() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const modal = document.getElementById('resultsImportModal');
  const openButton = document.getElementById('importResultsBtn');
  const closeButtons = modal?.querySelectorAll('[data-close-results-import]') || [];
  const sourceSelect = document.getElementById('resultsImportSource');
  const meetInput = document.getElementById('resultsImportMeet');
  const dateInput = document.getElementById('resultsImportDate');
  const distanceSelect = document.getElementById('resultsImportDistance');
  const pasteInput = document.getElementById('resultsImportPaste');
  const fileInput = document.getElementById('resultsImportFile');
  const preview = document.getElementById('resultsImportPreview');
  const importButton = document.getElementById('confirmResultsImport');

  if (!modal || !openButton || !sourceSelect || !dateInput || !distanceSelect || !pasteInput || !preview || !importButton) return;

  function loadState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      state.version = 2;
      state.settings ||= { teamName: 'Harts Bluff XC', season: '2026 XC', coachName: '' };
      state.athletes = Array.isArray(state.athletes) ? state.athletes : [];
      state.results = Array.isArray(state.results) ? state.results : [];
      state.attendance ||= {};
      state.practices = Array.isArray(state.practices) ? state.practices : [];
      return state;
    } catch {
      return { version: 2, settings: {}, athletes: [], results: [], attendance: {}, practices: [] };
    }
  }

  function uid() {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  function localDateString(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function parseTime(value) {
    const raw = String(value || '').trim().replace(/\s+/g, '').replace(/[*#]+$/, '');
    if (!raw) return null;
    const parts = raw.split(':').map(Number);
    if (parts.some(Number.isNaN) || parts.some((n) => n < 0)) return null;
    if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
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

  function firstLastKey(value) {
    const parts = normalizeName(value).split(' ').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]} ${parts.at(-1)}` : parts.join(' ');
  }

  function parseCsvLine(line) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function splitRow(line) {
    if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim());
    if (line.includes(',')) return parseCsvLine(line);
    return line.trim().split(/\s{2,}/).map((cell) => cell.trim());
  }

  function headerMap(parts) {
    const lower = parts.map((part) => String(part).trim().toLowerCase());
    const find = (words) => lower.findIndex((cell) => words.some((word) => cell === word || cell.includes(word)));
    const name = find(['athlete', 'runner', 'name']);
    const time = find(['time', 'mark', 'result', 'finish']);
    if (name < 0 || time < 0) return null;
    return {
      name,
      time,
      date: find(['date']),
      distance: find(['distance', 'event', 'race'])
    };
  }

  function normalizeDistance(value, fallback) {
    const raw = String(value || '').toLowerCase();
    if (/5\s*k|5000/.test(raw)) return '5K';
    if (/2\s*mile|3200/.test(raw)) return '2 Mile';
    if (/1\s*mile|1600/.test(raw)) return '1 Mile';
    return fallback;
  }

  function normalizeDate(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (!match) return fallback;
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  }

  function parseRows() {
    const lines = pasteInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];

    const rows = lines.map(splitRow).filter((parts) => parts.length);
    const map = headerMap(rows[0]);
    const dataRows = map ? rows.slice(1) : rows;
    const fallbackDate = dateInput.value || localDateString();
    const fallbackDistance = distanceSelect.value;

    return dataRows.map((parts) => {
      let name = '';
      let rawTime = '';
      let date = fallbackDate;
      let distance = fallbackDistance;

      if (map) {
        name = parts[map.name] || '';
        rawTime = parts[map.time] || '';
        if (map.date >= 0) date = normalizeDate(parts[map.date], fallbackDate);
        if (map.distance >= 0) distance = normalizeDistance(parts[map.distance], fallbackDistance);
      } else {
        const timeIndex = parts.findIndex((part) => parseTime(part) != null);
        if (timeIndex < 0) return null;
        rawTime = parts[timeIndex];
        const possibleName = parts.slice(0, timeIndex).filter((part) => !/^\d+$/.test(part));

        if (possibleName.length === 2 && parts.length > 2 && lineLooksLikeLastFirst(parts, timeIndex)) {
          name = `${possibleName[1]} ${possibleName[0]}`;
        } else {
          name = possibleName.join(' ');
        }
      }

      name = name.replace(/^\d+[.)-]?\s*/, '').trim();
      const seconds = parseTime(rawTime);
      if (!name || seconds == null || seconds <= 0) return null;
      return { name, seconds, rawTime, date, distance };
    }).filter(Boolean);
  }

  function lineLooksLikeLastFirst(parts, timeIndex) {
    return timeIndex === 2 && parts.length >= 3 && !/^\d+$/.test(parts[0]) && !/^\d+$/.test(parts[1]);
  }

  function buildMatcher(athletes) {
    const exact = new Map();
    const firstLast = new Map();

    athletes.forEach((athlete) => {
      const key = normalizeName(athlete.name);
      exact.set(key, athlete);
      const tokens = key.split(' ').filter(Boolean);
      if (tokens.length >= 2) exact.set(`${tokens.at(-1)} ${tokens[0]}`, athlete);

      const shortKey = firstLastKey(athlete.name);
      if (!firstLast.has(shortKey)) firstLast.set(shortKey, athlete);
      else firstLast.set(shortKey, null);
    });

    return (name) => exact.get(normalizeName(name)) || firstLast.get(firstLastKey(name)) || null;
  }

  function analyze() {
    const state = loadState();
    const rows = parseRows();
    const match = buildMatcher(state.athletes);
    const matched = [];
    const unmatched = [];

    rows.forEach((row) => {
      const athlete = match(row.name);
      if (athlete) matched.push({ ...row, athlete });
      else unmatched.push(row);
    });

    return { state, rows, matched, unmatched };
  }

  function updatePreview() {
    const { rows, matched, unmatched } = analyze();
    if (!rows.length) {
      preview.innerHTML = 'Paste results or choose a CSV/text file to preview the import.';
      return;
    }

    const unmatchedText = unmatched.length
      ? `<div style="margin-top:8px"><strong>Needs review:</strong> ${unmatched.slice(0, 5).map((row) => escapeHtml(row.name)).join(', ')}${unmatched.length > 5 ? ` +${unmatched.length - 5} more` : ''}</div>`
      : '<div style="margin-top:8px">All names matched your roster.</div>';

    preview.innerHTML = `<strong>${matched.length} matched</strong> • ${unmatched.length} unmatched • ${rows.length} parsed${unmatchedText}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function open() {
    const timingDate = document.getElementById('resultDate')?.value;
    const timingDistance = document.getElementById('resultDistance')?.value;
    dateInput.value = timingDate || localDateString();
    distanceSelect.value = timingDistance || '2 Mile';
    pasteInput.value = '';
    fileInput.value = '';
    meetInput.value = '';
    preview.textContent = 'Paste results or choose a CSV/text file to preview the import.';
    modal.classList.add('open');
    setTimeout(() => pasteInput.focus(), 50);
  }

  function close() {
    modal.classList.remove('open');
  }

  function importResults() {
    const { state, matched, unmatched } = analyze();
    if (!matched.length) {
      preview.innerHTML = unmatched.length
        ? '<strong>No roster matches found.</strong> Check athlete spelling or import the roster first.'
        : 'No valid results were found.';
      return;
    }

    const source = sourceSelect.value;
    const meetName = meetInput.value.trim();
    let imported = 0;
    let duplicates = 0;
    let prs = 0;

    matched.forEach(({ athlete, seconds, date, distance }) => {
      const duplicate = state.results.some((result) =>
        result.athleteId === athlete.id &&
        result.date === date &&
        result.distance === distance &&
        Number(result.seconds) === Number(seconds)
      );
      if (duplicate) {
        duplicates += 1;
        return;
      }

      const prior = state.results.filter((result) => result.athleteId === athlete.id && result.distance === distance);
      const priorBest = prior.length ? Math.min(...prior.map((result) => Number(result.seconds))) : null;
      const isPR = priorBest == null || seconds < priorBest;

      state.results.push({
        id: uid(),
        athleteId: athlete.id,
        distance,
        seconds,
        date,
        isPR,
        source,
        meetName,
        importedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      imported += 1;
      if (isPR) prs += 1;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    close();
    const summary = [
      `${imported} result${imported === 1 ? '' : 's'} imported`,
      prs ? `${prs} PR${prs === 1 ? '' : 's'}` : '',
      duplicates ? `${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : '',
      unmatched.length ? `${unmatched.length} unmatched skipped` : ''
    ].filter(Boolean).join(' • ');
    alert(summary);
    window.location.reload();
  }

  function decorateSources() {
    const state = loadState();
    const resultMap = new Map(state.results.map((result) => [result.id, result]));
    document.querySelectorAll('#resultsHistory [data-delete-result]').forEach((button) => {
      const result = resultMap.get(button.dataset.deleteResult);
      const card = button.closest('.result-card');
      const meta = card?.querySelector('.meta');
      if (!meta || !result || meta.dataset.sourceDecorated === 'true') return;
      const source = result.source || 'Manual';
      const label = [source, result.meetName].filter(Boolean).join(' • ');
      if (label && source !== 'Manual') meta.textContent += ` • ${label}`;
      meta.dataset.sourceDecorated = 'true';
    });
  }

  openButton.addEventListener('click', open);
  closeButtons.forEach((button) => button.addEventListener('click', close));
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  pasteInput.addEventListener('input', updatePreview);
  sourceSelect.addEventListener('change', updatePreview);
  dateInput.addEventListener('change', updatePreview);
  distanceSelect.addEventListener('change', updatePreview);
  importButton.addEventListener('click', importResults);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pasteInput.value = String(reader.result || '');
      updatePreview();
    };
    reader.readAsText(file);
  });

  decorateSources();
  const observer = new MutationObserver(decorateSources);
  const history = document.getElementById('resultsHistory');
  if (history) observer.observe(history, { childList: true, subtree: true });
})();
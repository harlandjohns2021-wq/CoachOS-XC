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

  function timeToSeconds(value) {
    const [minutes, seconds] = String(value).split(':').map(Number);
    return minutes * 60 + seconds;
  }

  function buildDemoState() {
    const athletes = [
      { id: 'demo_f_1', name: 'Avery Johnson', sex: 'Female', grade: '9' },
      { id: 'demo_f_2', name: 'Mia Rodriguez', sex: 'Female', grade: '10' },
      { id: 'demo_f_3', name: 'Sofia Martinez', sex: 'Female', grade: '8' },
      { id: 'demo_f_4', name: 'Emma Davis', sex: 'Female', grade: '11' },
      { id: 'demo_f_5', name: 'Chloe Wilson', sex: 'Female', grade: '7' },
      { id: 'demo_f_6', name: 'Natalie Brooks', sex: 'Female', grade: '12' },
      { id: 'demo_m_1', name: 'Jordan Smith', sex: 'Male', grade: '11' },
      { id: 'demo_m_2', name: 'Eli Carter', sex: 'Male', grade: '9' },
      { id: 'demo_m_3', name: 'Noah Brown', sex: 'Male', grade: '12' },
      { id: 'demo_m_4', name: 'Lucas Hernandez', sex: 'Male', grade: '10' },
      { id: 'demo_m_5', name: 'Caleb Thompson', sex: 'Male', grade: '8' },
      { id: 'demo_m_6', name: 'Mason Lee', sex: 'Male', grade: '7' }
    ].map((athlete) => ({ ...athlete, active: true, createdAt: '2026-07-01T12:00:00.000Z' }));

    const performance = {
      demo_f_1: { mile: ['7:22', '7:05'], two: ['15:26', '14:58'], five: '24:31' },
      demo_f_2: { mile: ['6:58', '6:43'], two: ['14:38', '14:09'], five: '23:08' },
      demo_f_3: { mile: ['8:12', '7:54'], two: ['17:04', '16:32'], five: '26:41' },
      demo_f_4: { mile: ['6:41', '6:29'], two: ['13:56', '13:31'], five: '22:19' },
      demo_f_5: { mile: ['8:36', '8:21'], two: ['17:48', '17:15'], five: '27:58' },
      demo_f_6: { mile: ['7:11', '6:55'], two: ['14:52', '14:24'], five: '23:49' },
      demo_m_1: { mile: ['5:54', '5:39'], two: ['12:18', '11:56'], five: '19:22' },
      demo_m_2: { mile: ['6:31', '6:17'], two: ['13:34', '13:08'], five: '21:17' },
      demo_m_3: { mile: ['5:42', '5:28'], two: ['11:56', '11:31'], five: '18:47' },
      demo_m_4: { mile: ['6:08', '5:56'], two: ['12:44', '12:21'], five: '20:03' },
      demo_m_5: { mile: ['7:03', '6:47'], two: ['14:39', '14:10'], five: '22:55' },
      demo_m_6: { mile: ['7:31', '7:14'], two: ['15:38', '15:02'], five: '24:18' }
    };

    const results = [];
    const addResult = (athleteId, distance, time, date, isPR, index) => {
      results.push({
        id: `demo_${athleteId}_${distance.replace(/\s+/g, '_')}_${index}`,
        athleteId,
        distance,
        seconds: timeToSeconds(time),
        date,
        isPR,
        createdAt: `${date}T12:00:00.000Z`
      });
    };

    Object.entries(performance).forEach(([athleteId, marks]) => {
      addResult(athleteId, '1 Mile', marks.mile[0], '2026-07-08', true, 1);
      addResult(athleteId, '1 Mile', marks.mile[1], '2026-07-15', true, 2);
      addResult(athleteId, '2 Mile', marks.two[0], '2026-07-10', true, 1);
      addResult(athleteId, '2 Mile', marks.two[1], '2026-07-18', true, 2);
      addResult(athleteId, '5K', marks.five, '2026-07-20', true, 1);
    });

    const attendanceDates = ['2026-07-08', '2026-07-10', '2026-07-11', '2026-07-13', '2026-07-15', '2026-07-17', '2026-07-18', '2026-07-20', '2026-07-21'];
    const attendance = {};
    attendanceDates.forEach((date, dayIndex) => {
      attendance[date] = {};
      athletes.forEach((athlete, athleteIndex) => {
        const absent = (dayIndex + athleteIndex * 2) % 11 === 0 || (dayIndex === 4 && athlete.id === 'demo_f_5');
        attendance[date][athlete.id] = absent ? 'Absent' : 'Present';
      });
    });

    const practices = [
      { id: 'demo_p_1', date: '2026-07-08', title: 'Baseline mile assessment', type: 'Other', distance: '1 mile', notes: 'Controlled benchmark effort. Focused on even pacing and relaxed form.' },
      { id: 'demo_p_2', date: '2026-07-10', title: 'Aerobic benchmark', type: 'Tempo', distance: '2 miles', notes: 'Steady controlled effort to establish early-season training groups.' },
      { id: 'demo_p_3', date: '2026-07-13', title: 'Easy aerobic run', type: 'Easy Run', distance: '3 miles', notes: 'Conversational pace with 4 relaxed strides after the run.' },
      { id: 'demo_p_4', date: '2026-07-15', title: 'Mile progression check', type: 'Intervals', distance: '1 mile + strides', notes: 'Second benchmark. Most athletes improved while staying controlled.' },
      { id: 'demo_p_5', date: '2026-07-17', title: 'Hill strength session', type: 'Hills', distance: '2.5 miles', notes: 'Easy warm-up, 6 x 30-second hills, easy cool-down.' },
      { id: 'demo_p_6', date: '2026-07-18', title: 'Two-mile progression check', type: 'Tempo', distance: '2 miles', notes: 'Used to update training groups and check pacing development.' },
      { id: 'demo_p_7', date: '2026-07-20', title: '5K practice race', type: 'Race', distance: '5K', notes: 'Practice race effort. Emphasis on controlled first mile and strong finish.' },
      { id: 'demo_p_8', date: '2026-07-21', title: 'Recovery run and mobility', type: 'Recovery', distance: '2 miles', notes: 'Very easy recovery pace followed by mobility and light drills.' }
    ].map((practice) => ({ ...practice, updatedAt: `${practice.date}T12:00:00.000Z` }));

    return {
      version: 2,
      settings: { teamName: 'XC Command Demo Team', season: '2026 XC', coachName: 'Coach' },
      athletes,
      results,
      attendance,
      practices,
      demoData: true
    };
  }

  function loadDemoData() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && !confirm('Loading demo data will replace the current data saved on this device. Continue?')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildDemoState()));
    alert('Demo season loaded: 12 athletes, attendance, practices, and 60 timed results.');
    window.location.reload();
  }

  function installDemoButton() {
    const toolbar = document.querySelector('#athletes .section-title .toolbar');
    if (!toolbar || document.getElementById('loadDemoDataBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'loadDemoDataBtn';
    button.className = 'ghost';
    button.textContent = 'Load demo data';
    button.addEventListener('click', loadDemoData);
    toolbar.appendChild(button);
  }

  openButton.addEventListener('click', open);
  textarea.addEventListener('input', updatePreview);
  defaultSex.addEventListener('change', updatePreview);
  defaultGrade.addEventListener('change', updatePreview);
  importButton.addEventListener('click', importRoster);
  modal.querySelectorAll('[data-close-roster-import]').forEach((button) => button.addEventListener('click', close));
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  installDemoButton();
})();

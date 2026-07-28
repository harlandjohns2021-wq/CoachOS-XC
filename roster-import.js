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

  function defaultCompetitionTeam(sex, grade) {
    const isFemale = sex === 'Female';
    if (Number(grade) <= 8) return isFemale ? 'Junior High Girls' : 'Junior High Boys';
    return isFemale ? 'Junior Varsity Girls' : 'Junior Varsity Boys';
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
        competitionTeam: defaultCompetitionTeam(row.sex, row.grade),
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

  function secondsToTime(value) {
    const total = Math.max(0, Math.round(Number(value) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function buildDemoState() {
    const femaleNames = [
      'Avery Johnson', 'Mia Rodriguez', 'Sofia Martinez', 'Emma Davis', 'Chloe Wilson',
      'Natalie Brooks', 'Harper Anderson', 'Layla Garcia', 'Ella Thomas', 'Grace Moore',
      'Lily White', 'Zoe Hall', 'Aria Allen', 'Nora Young', 'Stella King'
    ];
    const maleNames = [
      'Jordan Smith', 'Eli Carter', 'Noah Brown', 'Lucas Hernandez', 'Caleb Thompson',
      'Mason Lee', 'Owen Scott', 'Logan Adams', 'Jack Nelson', 'Wyatt Baker',
      'Henry Rivera', 'Levi Campbell', 'Asher Mitchell', 'Dylan Perez', 'Ryan Roberts'
    ];
    const grades = ['7', '8', '9', '10', '11', '12'];
    const athletes = [
      ...femaleNames.map((name, index) => ({ id: `demo_f_${index + 1}`, name, sex: 'Female', grade: grades[index % grades.length] })),
      ...maleNames.map((name, index) => ({ id: `demo_m_${index + 1}`, name, sex: 'Male', grade: grades[(index + 2) % grades.length] }))
    ].map((athlete) => ({
      ...athlete,
      competitionTeam: defaultCompetitionTeam(athlete.sex, athlete.grade),
      active: true,
      createdAt: '2026-08-01T12:00:00.000Z'
    }));

    const performance = {};
    athletes.forEach((athlete) => {
      const sexIndex = Number(athlete.id.split('_').at(-1)) - 1;
      const isFemale = athlete.sex === 'Female';
      const mileBase = isFemale ? 410 + sexIndex * 10 : 332 + sexIndex * 9;
      const mileImproved = mileBase - (isFemale ? 10 + (sexIndex % 4) : 9 + (sexIndex % 4));
      const twoBase = mileBase * 2 + (isFemale ? 55 : 45);
      const twoImproved = twoBase - (isFemale ? 18 + (sexIndex % 5) * 2 : 20 + (sexIndex % 5) * 2);
      const meetOne = Math.round(twoImproved * (isFemale ? 1.62 : 1.6) + (isFemale ? 95 : 80));
      const meetTwo = meetOne - (isFemale ? 15 + (sexIndex % 4) * 3 : 18 + (sexIndex % 4) * 3);
      performance[athlete.id] = {
        mile: [secondsToTime(mileBase), secondsToTime(mileImproved)],
        two: [secondsToTime(twoBase), secondsToTime(twoImproved)],
        meet: [secondsToTime(meetOne), secondsToTime(meetTwo)]
      };
    });

    const results = [];
    const addResult = (athleteId, distance, time, date, isPR, index, source = '', meetName = '') => {
      results.push({
        id: `demo_${athleteId}_${distance.replace(/\s+/g, '_')}_${index}`,
        athleteId,
        distance,
        seconds: timeToSeconds(time),
        date,
        isPR,
        source,
        meetName,
        createdAt: `${date}T12:00:00.000Z`
      });
    };

    Object.entries(performance).forEach(([athleteId, marks]) => {
      addResult(athleteId, '1 Mile', marks.mile[0], '2026-08-03', true, 1);
      addResult(athleteId, '1 Mile', marks.mile[1], '2026-08-10', true, 2);
      addResult(athleteId, '2 Mile', marks.two[0], '2026-08-06', true, 1);
      addResult(athleteId, '2 Mile', marks.two[1], '2026-08-13', true, 2);
      addResult(athleteId, '5K', marks.meet[0], '2026-08-09', true, 1, 'Meet CSV', 'Pine Valley Invitational');
      addResult(athleteId, '5K', marks.meet[1], '2026-08-16', true, 2, 'Meet CSV', 'River City Classic');
    });

    const attendanceDates = [
      '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09',
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'
    ];
    const attendance = {};
    attendanceDates.forEach((date, dayIndex) => {
      attendance[date] = {};
      athletes.forEach((athlete, athleteIndex) => {
        const absent = (dayIndex + athleteIndex * 2) % 17 === 0 || (dayIndex === 10 && athlete.id === 'demo_f_5');
        attendance[date][athlete.id] = absent ? 'Absent' : 'Present';
      });
    });

    const practices = [
      { id: 'demo_p_1', date: '2026-08-03', title: 'Baseline mile benchmark', type: 'Other', distance: '1 mile', notes: 'Controlled baseline effort for all groups.' },
      { id: 'demo_p_2', date: '2026-08-04', title: 'Aerobic endurance run', type: 'Easy Run', distance: '3 miles', notes: 'Conversational pace with strides.' },
      { id: 'demo_p_3', date: '2026-08-05', title: 'Hill mechanics', type: 'Hills', distance: '2.5 miles', notes: 'Short hill reps and form focus.' },
      { id: 'demo_p_4', date: '2026-08-06', title: 'Two-mile threshold check', type: 'Tempo', distance: '2 miles', notes: 'Steady benchmark for training groups.' },
      { id: 'demo_p_5', date: '2026-08-07', title: 'Recovery + mobility', type: 'Recovery', distance: '2 miles', notes: 'Low-intensity run and mobility circuit.' },
      { id: 'demo_p_6', date: '2026-08-08', title: 'Pre-meet sharpening', type: 'Intervals', distance: '1.5 miles', notes: 'Short turnover session before meet one.' },
      { id: 'demo_p_7', date: '2026-08-09', title: 'Pine Valley Invitational', type: 'Race', distance: '5K', notes: 'Meet #1 results logged for full roster.' },
      { id: 'demo_p_8', date: '2026-08-10', title: 'Post-meet mile progression', type: 'Other', distance: '1 mile', notes: 'Controlled progression to compare to baseline.' },
      { id: 'demo_p_9', date: '2026-08-11', title: 'Aerobic support day', type: 'Easy Run', distance: '3 miles', notes: 'Steady aerobic support and light drills.' },
      { id: 'demo_p_10', date: '2026-08-12', title: 'Interval economy set', type: 'Intervals', distance: '2 miles', notes: 'Economy-focused intervals by group.' },
      { id: 'demo_p_11', date: '2026-08-13', title: 'Two-mile progression check', type: 'Tempo', distance: '2 miles', notes: 'Second threshold checkpoint for all athletes.' },
      { id: 'demo_p_12', date: '2026-08-14', title: 'Recovery + drills', type: 'Recovery', distance: '2 miles', notes: 'Low-load day to absorb work.' },
      { id: 'demo_p_13', date: '2026-08-15', title: 'Pre-race prep', type: 'Easy Run', distance: '1.5 miles', notes: 'Short prep and race strategy review.' },
      { id: 'demo_p_14', date: '2026-08-16', title: 'River City Classic', type: 'Race', distance: '5K', notes: 'Meet #2 results logged and compared to meet one.' }
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
    alert('Demo season loaded: 30 athletes (15 girls, 15 boys), 14 days of practice data, 2 meets, and 180 timed results.');
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

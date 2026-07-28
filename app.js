(() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const LEGACY_KEY = 'coachos_xc_v1';
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const TEAM_OPTIONS = [
    'Varsity Girls',
    'Varsity Boys',
    'Junior Varsity Girls',
    'Junior Varsity Boys',
    'Junior High Girls',
    'Junior High Boys'
  ];

  const defaultState = () => ({
    version: 2,
    settings: {
      teamName: 'Harts Bluff XC',
      season: '2026 XC',
      coachName: '',
      aiRole: 'head_coach',
      aiAthleteDetail: 'team_only',
      aiScope: {
        teamTrends: true,
        athleteTrends: true,
        workloadBalance: true,
        raceReadiness: true,
        coachQueries: true
      }
    },
    athletes: [],
    results: [],
    attendance: {},
    practices: []
  });

  let state = loadState();
  let activeView = 'dashboard';

  function localDateString(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current) return normalizeState(current);
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (legacy) {
        const migrated = normalizeState({
          ...defaultState(),
          athletes: legacy.athletes || [],
          results: legacy.results || [],
          attendance: legacy.attendance || {}
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) {
      console.warn('CoachOS could not load saved data.', error);
    }
    return defaultState();
  }

  function normalizeState(input) {
    const base = defaultState();
    return {
      ...base,
      ...input,
      version: 2,
      settings: {
        ...base.settings,
        ...(input.settings || {}),
        aiScope: { ...base.settings.aiScope, ...((input.settings || {}).aiScope || {}) }
      },
      athletes: (Array.isArray(input.athletes) ? input.athletes : []).map((athlete) => ({
        ...athlete,
        sex: athlete?.sex === 'Male' ? 'Male' : 'Female',
        grade: String(athlete?.grade || '9'),
        competitionTeam: normalizeCompetitionTeam(athlete?.competitionTeam, athlete?.sex === 'Male' ? 'Male' : 'Female', String(athlete?.grade || '9'))
      })),
      results: Array.isArray(input.results) ? input.results : [],
      attendance: input.attendance && typeof input.attendance === 'object' ? input.attendance : {},
      practices: Array.isArray(input.practices) ? input.practices : []
    };
  }

  function saveState(message) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) showToast(message);
  }

  function uid() {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  function parseTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parts = raw.split(':').map(Number);
    if (parts.some(Number.isNaN) || parts.some((n) => n < 0)) return null;
    if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function formatTime(seconds) {
    if (seconds == null || Number.isNaN(Number(seconds))) return '—';
    const total = Math.round(Number(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }

  function defaultCompetitionTeam(sex, grade) {
    const isFemale = sex === 'Female';
    if (Number(grade) <= 8) return isFemale ? 'Junior High Girls' : 'Junior High Boys';
    return isFemale ? 'Junior Varsity Girls' : 'Junior Varsity Boys';
  }

  function normalizeCompetitionTeam(team, sex, grade) {
    return TEAM_OPTIONS.includes(team) ? team : defaultCompetitionTeam(sex, grade);
  }

  function teamMeta(team) {
    const isGirls = String(team).includes('Girls');
    const sex = isGirls ? 'Female' : 'Male';
    let level = 'Junior High';
    if (String(team).startsWith('Varsity')) level = 'Varsity';
    if (String(team).startsWith('Junior Varsity')) level = 'Junior Varsity';
    return { sex, level, poolKey: `${level}-${sex}` };
  }

  function athleteById(id) {
    return state.athletes.find((athlete) => athlete.id === id);
  }

  function resultsFor(athleteId, distance) {
    return state.results.filter((result) => result.athleteId === athleteId && (!distance || result.distance === distance));
  }

  function bestTime(athleteId, distance) {
    const rows = resultsFor(athleteId, distance);
    return rows.length ? Math.min(...rows.map((row) => Number(row.seconds))) : null;
  }

  function latestTime(athleteId, distance) {
    const rows = resultsFor(athleteId, distance).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return rows.length ? Number(rows.at(-1).seconds) : null;
  }

  function attendanceRate(athleteId) {
    let present = 0;
    let marked = 0;
    Object.values(state.attendance).forEach((day) => {
      const status = day?.[athleteId];
      if (status === 'Present' || status === 'Absent') {
        marked += 1;
        if (status === 'Present') present += 1;
      }
    });
    return marked ? Math.round((present / marked) * 100) : null;
  }

  function currentBestBefore(athleteId, distance, seconds) {
    const prior = resultsFor(athleteId, distance);
    if (!prior.length) return null;
    return Math.min(...prior.map((row) => Number(row.seconds)));
  }

  function isBestResult(result) {
    return Number(result.seconds) === bestTime(result.athleteId, result.distance);
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function navigate(view) {
    activeView = view;
    $$('.view').forEach((el) => el.classList.toggle('active', el.id === view));
    $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    const labels = { dashboard: 'Dashboard', athletes: 'Athletes', practice: 'Practice', timing: 'Timing & Results', insights: 'Team Insights', education: 'Coach Education', settings: 'Settings' };
    $('pageTitle').textContent = labels[view] || 'CoachOS XC';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderAll();
  }

  function openAthleteModal() {
    $('modalAthleteName').value = '';
    $('modalAthleteSex').value = 'Female';
    $('modalAthleteGrade').value = '9';
    $('modalAthleteTeam').value = defaultCompetitionTeam('Female', '9');
    $('athleteModal').classList.add('open');
    setTimeout(() => $('modalAthleteName').focus(), 50);
  }

  function syncModalAthleteTeam() {
    $('modalAthleteTeam').value = defaultCompetitionTeam($('modalAthleteSex').value, $('modalAthleteGrade').value);
  }

  function closeAthleteModal() {
    $('athleteModal').classList.remove('open');
  }

  function addAthlete() {
    const name = $('modalAthleteName').value.trim();
    if (!name) return showToast('Enter the athlete’s name.');
    state.athletes.push({
      id: uid(),
      name,
      sex: $('modalAthleteSex').value,
      grade: $('modalAthleteGrade').value,
      competitionTeam: normalizeCompetitionTeam($('modalAthleteTeam').value, $('modalAthleteSex').value, $('modalAthleteGrade').value),
      active: true,
      createdAt: new Date().toISOString()
    });
    closeAthleteModal();
    saveState(`${name} added to the roster.`);
  }

  function removeAthlete(id) {
    const athlete = athleteById(id);
    if (!athlete) return;
    if (!confirm(`Remove ${athlete.name} and all associated results?`)) return;
    state.athletes = state.athletes.filter((row) => row.id !== id);
    state.results = state.results.filter((row) => row.athleteId !== id);
    Object.values(state.attendance).forEach((day) => { if (day) delete day[id]; });
    saveState(`${athlete.name} removed.`);
  }

  function moveAthleteTeam(id, team) {
    const athlete = athleteById(id);
    if (!athlete) return;
    const nextTeam = normalizeCompetitionTeam(team, athlete.sex, athlete.grade);
    if (athlete.competitionTeam === nextTeam) return;
    athlete.competitionTeam = nextTeam;
    saveState(`${athlete.name} moved to ${nextTeam}.`);
  }

  function setAttendance(athleteId, status) {
    const date = $('practiceDate').value || localDateString();
    state.attendance[date] ||= {};
    state.attendance[date][athleteId] = status;
    saveState();
  }

  function markAllPresent() {
    const date = $('practiceDate').value || localDateString();
    state.attendance[date] ||= {};
    state.athletes.forEach((athlete) => { state.attendance[date][athlete.id] = 'Present'; });
    saveState('Everyone marked present.');
  }

  function savePractice() {
    const date = $('practiceDate').value || localDateString();
    const title = $('practiceTitle').value.trim();
    if (!title) return showToast('Add a session title before saving.');
    const entry = {
      id: state.practices.find((item) => item.date === date)?.id || uid(),
      date,
      title,
      type: $('practiceType').value,
      distance: $('practiceDistance').value.trim(),
      notes: $('practiceNotes').value.trim(),
      updatedAt: new Date().toISOString()
    };
    state.practices = state.practices.filter((item) => item.date !== date);
    state.practices.push(entry);
    saveState('Practice saved.');
  }

  function loadPracticeForm(date) {
    const practice = state.practices.find((item) => item.date === date);
    $('practiceTitle').value = practice?.title || '';
    $('practiceType').value = practice?.type || 'Easy Run';
    $('practiceDistance').value = practice?.distance || '';
    $('practiceNotes').value = practice?.notes || '';
  }

  function saveBatchTimes() {
    if (!state.athletes.length) return showToast('Add athletes before recording times.');
    const date = $('resultDate').value || localDateString();
    const distance = $('resultDistance').value;
    const inputs = $$('[data-time-athlete]');
    let saved = 0;
    let prs = 0;

    for (const input of inputs) {
      const raw = input.value.trim();
      if (!raw) continue;
      const seconds = parseTime(raw);
      if (seconds == null || seconds <= 0) {
        input.focus();
        return showToast(`Check the time entered for ${athleteById(input.dataset.timeAthlete)?.name || 'an athlete'}.`);
      }
      const athleteId = input.dataset.timeAthlete;
      const priorBest = currentBestBefore(athleteId, distance, seconds);
      const isPR = priorBest == null || seconds < priorBest;
      state.results.push({ id: uid(), athleteId, distance, seconds, date, isPR, createdAt: new Date().toISOString() });
      saved += 1;
      if (isPR) prs += 1;
    }

    if (!saved) return showToast('Enter at least one time to save.');
    saveState(`${saved} time${saved === 1 ? '' : 's'} saved${prs ? `, ${prs} PR${prs === 1 ? '' : 's'}` : ''}.`);
  }

  function deleteResult(id) {
    if (!confirm('Delete this recorded performance?')) return;
    state.results = state.results.filter((row) => row.id !== id);
    saveState('Result deleted.');
  }

  function saveSettings() {
    state.settings.teamName = $('settingTeam').value.trim() || 'My XC Team';
    state.settings.season = $('settingSeason').value.trim() || 'XC Season';
    state.settings.coachName = $('settingCoach').value.trim();
    state.settings.aiRole = $('settingAiRole')?.value === 'assistant_coach' ? 'assistant_coach' : 'head_coach';
    state.settings.aiAthleteDetail = $('settingAiAthleteDetail')?.value === 'anonymized' ? 'anonymized' : 'team_only';
    state.settings.aiScope = {
      teamTrends: Boolean($('scopeTeamTrends')?.checked),
      athleteTrends: Boolean($('scopeAthleteTrends')?.checked),
      workloadBalance: Boolean($('scopeWorkloadBalance')?.checked),
      raceReadiness: Boolean($('scopeRaceReadiness')?.checked),
      coachQueries: Boolean($('scopeCoachQueries')?.checked)
    };
    if (!Object.values(state.settings.aiScope).some(Boolean)) state.settings.aiScope.teamTrends = true;
    saveState('Team settings saved.');
  }

  function exportBackup() {
    downloadFile(`coachos-xc-backup-${localDateString()}.json`, JSON.stringify(state, null, 2), 'application/json');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = normalizeState(parsed);
        saveState('Backup imported successfully.');
      } catch {
        showToast('That file is not a valid CoachOS backup.');
      }
    };
    reader.readAsText(file);
  }

  function exportCsv() {
    const rows = [['Date', 'Athlete', 'Sex', 'Grade', 'Team', 'Distance', 'Time']];
    [...state.results].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((result) => {
      const athlete = athleteById(result.athleteId) || {};
      rows.push([result.date, athlete.name || '', athlete.sex || '', athlete.grade || '', normalizeCompetitionTeam(athlete.competitionTeam, athlete.sex, athlete.grade), result.distance, formatTime(result.seconds)]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`coachos-xc-results-${localDateString()}.csv`, csv, 'text/csv');
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function resetApp() {
    if (!confirm('Reset CoachOS XC on this device? This removes all roster, attendance, practice, and timing data.')) return;
    state = defaultState();
    localStorage.removeItem(STORAGE_KEY);
    saveState('CoachOS XC reset.');
  }

  function trainingGroupData() {
    const ranked = state.athletes.map((athlete) => {
      let score = latestTime(athlete.id, '2 Mile');
      let source = '2 Mile';
      if (score == null) {
        const mile = latestTime(athlete.id, '1 Mile');
        if (mile != null) {
          score = mile * 2.12;
          source = '1 Mile estimate';
        }
      }
      return { ...athlete, score, source };
    }).filter((athlete) => athlete.score != null).sort((a, b) => a.score - b.score);

    if (!ranked.length) return [];
    const groupCount = ranked.length < 6 ? 2 : 3;
    const size = Math.ceil(ranked.length / groupCount);
    const labels = ['Performance', 'Development', 'Foundation'];
    return Array.from({ length: groupCount }, (_, index) => ({
      name: labels[index],
      athletes: ranked.slice(index * size, (index + 1) * size)
    })).filter((group) => group.athletes.length);
  }

  function topImproverData() {
    const improvements = [];
    state.athletes.forEach((athlete) => {
      ['1 Mile', '2 Mile', '5K'].forEach((distance) => {
        const rows = resultsFor(athlete.id, distance).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (rows.length < 2) return;
        const first = Number(rows[0].seconds);
        const best = Math.min(...rows.map((row) => Number(row.seconds)));
        if (best < first) improvements.push({ athlete, distance, seconds: first - best, percent: ((first - best) / first) * 100 });
      });
    });
    return improvements.sort((a, b) => b.percent - a.percent).slice(0, 6);
  }

  function overallAttendance() {
    let present = 0;
    let marked = 0;
    Object.values(state.attendance).forEach((day) => Object.values(day || {}).forEach((status) => {
      if (status === 'Present' || status === 'Absent') {
        marked += 1;
        if (status === 'Present') present += 1;
      }
    }));
    return marked ? Math.round((present / marked) * 100) : null;
  }

  function raceEntriesFor(date, distance) {
    const rows = state.results.filter((result) => result.date === date && result.distance === distance);
    const bestByAthlete = new Map();
    rows.forEach((result) => {
      const prior = bestByAthlete.get(result.athleteId);
      if (!prior || Number(result.seconds) < Number(prior.seconds)) bestByAthlete.set(result.athleteId, result);
    });
    return [...bestByAthlete.values()].map((result) => {
      const athlete = athleteById(result.athleteId);
      if (!athlete) return null;
      const team = normalizeCompetitionTeam(athlete.competitionTeam, athlete.sex, athlete.grade);
      return { athlete, team, seconds: Number(result.seconds), date: result.date, distance: result.distance };
    }).filter(Boolean);
  }

  function teamScoreData(date, distance) {
    const entries = raceEntriesFor(date, distance);
    if (!entries.length) return [];
    const byPool = new Map();
    entries.forEach((entry) => {
      const meta = teamMeta(entry.team);
      if (!byPool.has(meta.poolKey)) byPool.set(meta.poolKey, []);
      byPool.get(meta.poolKey).push({ ...entry, meta });
    });

    const rows = [];
    byPool.forEach((poolEntries) => {
      poolEntries.sort((a, b) => a.seconds - b.seconds);
      const teams = new Map();
      poolEntries.forEach((entry, index) => {
        const place = index + 1;
        if (!teams.has(entry.team)) teams.set(entry.team, []);
        teams.get(entry.team).push({ ...entry, place });
      });

      const scoringTeams = [...teams.values()].filter((teamEntries) => teamEntries.length >= 5).length;
      teams.forEach((teamEntries, teamName) => {
        teamEntries.sort((a, b) => a.place - b.place);
        const scoring = teamEntries.slice(0, 5);
        const teamPoints = scoring.length === 5 ? scoring.reduce((total, item) => total + item.place, 0) : null;
        const varsityAverage = teamMeta(teamName).level === 'Varsity' && teamEntries.length >= 7
          ? teamEntries.slice(0, 7).reduce((total, item) => total + item.seconds, 0) / 7
          : null;
        rows.push({
          teamName,
          finishers: teamEntries.length,
          teamPoints,
          varsityAverage,
          countsForScore: scoring.length === 5,
          officialField: scoringTeams >= 2,
          topFivePlaces: scoring.map((item) => item.place).join(', ') || '—',
          displacers: teamEntries.slice(5, 7).map((item) => item.place).join(', ') || '—'
        });
      });
    });
    return rows.sort((a, b) => (a.teamPoints ?? Number.POSITIVE_INFINITY) - (b.teamPoints ?? Number.POSITIVE_INFINITY) || a.teamName.localeCompare(b.teamName));
  }

  function renderHeader() {
    const now = new Date();
    $('todayChip').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
    $('teamEyebrow').textContent = state.settings.teamName || 'Cross Country';
    $('seasonLabel').textContent = state.settings.season || 'XC Season';
    $('seasonTeam').textContent = state.settings.teamName || 'Your Team';
    $('heroTitle').textContent = state.settings.coachName ? `${state.settings.coachName}, your team at a glance.` : 'Build a faster, healthier team.';
  }

  function renderDashboard() {
    const today = localDateString();
    const todayAttendance = state.attendance[today] || {};
    const present = Object.values(todayAttendance).filter((status) => status === 'Present').length;
    const marked = Object.values(todayAttendance).filter((status) => status === 'Present' || status === 'Absent').length;
    $('statAthletes').textContent = state.athletes.length;
    $('statPresent').textContent = present;
    $('statResults').textContent = state.results.length;
    $('statPRs').textContent = state.results.filter((result) => result.isPR).length;
    $('athleteDelta').textContent = state.athletes.length ? `${state.athletes.filter((a) => a.sex === 'Female').length} girls • ${state.athletes.filter((a) => a.sex === 'Male').length} boys` : 'Ready to build';
    $('attendanceDelta').textContent = marked ? `${Math.round((present / marked) * 100)}% of marked athletes` : 'No attendance yet';
    $('resultDelta').textContent = state.results.length ? `${new Set(state.results.map((r) => r.athleteId)).size} athletes timed` : 'Timed performances';
    $('prDelta').textContent = state.results.some((r) => r.isPR) ? 'Season breakthroughs' : 'No PR data yet';
    $('practiceDateLabel').textContent = formatDate(today);

    const recent = [...state.results].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6);
    $('recentResults').innerHTML = recent.length ? recent.map((result) => {
      const athlete = athleteById(result.athleteId);
      return `<div class="list-item"><div class="person"><div class="avatar">${initials(athlete?.name)}</div><div><div class="name">${esc(athlete?.name || 'Unknown athlete')}</div><div class="meta">${esc(result.distance)} • ${formatDate(result.date)}</div></div></div><div style="text-align:right"><div class="time">${formatTime(result.seconds)}</div>${isBestResult(result) ? '<span class="pill good">Current PR</span>' : ''}</div></div>`;
    }).join('') : '<div class="empty">Record your first timed effort and performance history will appear here.</div>';

    const practice = state.practices.find((item) => item.date === today);
    $('todayPractice').innerHTML = practice
      ? `<div><div class="name">${esc(practice.title)}</div><div class="meta">${esc(practice.type)}${practice.distance ? ` • ${esc(practice.distance)}` : ''}</div>${practice.notes ? `<p class="meta" style="line-height:1.5">${esc(practice.notes)}</p>` : ''}</div>`
      : '<div class="empty">No session plan saved for today.</div>';

    const insight = buildDashboardInsight();
    $('dashboardInsight').innerHTML = `<strong>${esc(insight.title)}</strong><p>${esc(insight.body)}</p>`;
  }

  function buildDashboardInsight() {
    if (!state.athletes.length) return { title: 'Start with the roster', body: 'Add your athletes first. CoachOS can then track attendance, PRs, training groups, and progress across the season.' };
    if (state.results.length < Math.max(3, Math.ceil(state.athletes.length / 2))) return { title: 'Build your baseline', body: 'Record a 1-mile or 2-mile benchmark for more athletes. That gives the app enough data to build useful training groups and identify performance gaps.' };
    const attendance = overallAttendance();
    if (attendance != null && attendance < 85) return { title: 'Attendance may be limiting consistency', body: `Team attendance is currently ${attendance}%. Before adding more intensity, make sure the athletes who need development are consistently getting the planned training dose.` };
    const improvers = topImproverData();
    if (improvers.length) return { title: `${improvers[0].athlete.name} is trending up`, body: `${improvers[0].athlete.name} has improved ${improvers[0].percent.toFixed(1)}% in the ${improvers[0].distance}. Keep the progression controlled and look for similar patterns across that training group.` };
    return { title: 'The team data is taking shape', body: 'Keep logging consistent benchmark efforts and attendance. More repeated measurements will make the performance trends far more useful.' };
  }

  function teamSelectOptions(current) {
    return TEAM_OPTIONS.map((team) => `<option value="${esc(team)}"${current === team ? ' selected' : ''}>${esc(team)}</option>`).join('');
  }

  function renderAthletes() {
    const filter = $('athleteFilter').value;
    const athletes = [...state.athletes].filter((athlete) => filter === 'all' || athlete.sex === filter).sort((a, b) => a.name.localeCompare(b.name));
    $('athleteEmpty').classList.toggle('hide', athletes.length > 0);
    $('athleteTable').innerHTML = athletes.map((athlete) => {
      const rate = attendanceRate(athlete.id);
      const team = normalizeCompetitionTeam(athlete.competitionTeam, athlete.sex, athlete.grade);
      return `<tr><td><div class="person"><div class="avatar">${initials(athlete.name)}</div><div><div class="name">${esc(athlete.name)}</div><div class="meta">${esc(athlete.sex)}</div></div></div></td><td>${esc(athlete.grade)}</td><td><select data-athlete-team="${esc(athlete.id)}" aria-label="Move ${esc(athlete.name)} to team">${teamSelectOptions(team)}</select></td><td>${formatTime(bestTime(athlete.id, '1 Mile'))}</td><td>${formatTime(bestTime(athlete.id, '2 Mile'))}</td><td>${formatTime(bestTime(athlete.id, '5K'))}</td><td>${rate == null ? '—' : `${rate}%`}</td><td class="right"><button class="danger" data-remove-athlete="${esc(athlete.id)}">Remove</button></td></tr>`;
    }).join('');
  }

  function renderPractice() {
    const date = $('practiceDate').value || localDateString();
    const day = state.attendance[date] || {};
    const present = Object.values(day).filter((status) => status === 'Present').length;
    $('attendanceSummary').textContent = `${present} present`;
    $('attendanceGrid').innerHTML = state.athletes.length ? [...state.athletes].sort((a, b) => a.name.localeCompare(b.name)).map((athlete) => {
      const status = day[athlete.id];
      return `<div class="attendance-row"><div class="person"><div class="avatar">${initials(athlete.name)}</div><div><div class="name">${esc(athlete.name)}</div><div class="meta">Grade ${esc(athlete.grade)}</div></div></div><div class="seg"><button class="${status === 'Present' ? 'on present' : ''}" data-attendance-id="${athlete.id}" data-attendance-status="Present">Present</button><button class="${status === 'Absent' ? 'on absent' : ''}" data-attendance-id="${athlete.id}" data-attendance-status="Absent">Absent</button></div></div>`;
    }).join('') : '<div class="empty" style="grid-column:1/-1">Add athletes before taking attendance.</div>';

    const history = [...state.practices].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
    $('practiceHistory').innerHTML = history.length ? history.map((practice) => `<div class="list-item"><div><div class="name">${esc(practice.title)}</div><div class="meta">${formatDate(practice.date)} • ${esc(practice.type)}${practice.distance ? ` • ${esc(practice.distance)}` : ''}</div></div><span class="pill">${esc(practice.type)}</span></div>`).join('') : '<div class="empty">Saved practices will appear here.</div>';
  }

  function renderTiming() {
    const athletes = [...state.athletes].sort((a, b) => a.name.localeCompare(b.name));
    $('batchTiming').innerHTML = athletes.length ? athletes.map((athlete) => `<div class="quick-entry"><div class="person wide"><div class="avatar">${esc(initials(athlete.name))}</div><div><div class="name">${esc(athlete.name)}</div><div class="meta">Grade ${esc(athlete.grade)} • ${esc(athlete.sex)} • ${esc(normalizeCompetitionTeam(athlete.competitionTeam, athlete.sex, athlete.grade))}</div></div></div><div><div class="meta">Current PR</div><div class="time">${formatTime(bestTime(athlete.id, $('resultDistance').value))}</div></div><div class="field"><label>Time</label><input inputmode="numeric" placeholder="12:34" data-time-athlete="${esc(athlete.id)}"></div><div><span class="pill">${esc($('resultDistance').value)}</span></div></div>`).join('') : '<div class="empty">Add athletes before entering team times.</div>';

    const scoreRows = teamScoreData($('resultDate').value || localDateString(), $('resultDistance').value);
    $('teamScores').innerHTML = scoreRows.length ? scoreRows.map((row) => {
      const pointsLabel = row.teamPoints == null
        ? 'Need 5 finishers to score'
        : `${row.teamPoints} pts${row.officialField ? '' : ' (single-team field)'}`;
      const averageLabel = row.varsityAverage == null ? '—' : formatTime(row.varsityAverage);
      return `<div class="list-item"><div><div class="name">${esc(row.teamName)}</div><div class="meta">Finishers: ${row.finishers} • Top-5 places: ${esc(row.topFivePlaces)} • Runners 6-7: ${esc(row.displacers)}</div></div><div style="text-align:right"><div class="time">${esc(pointsLabel)}</div><span class="pill">${esc(`Varsity 7 avg: ${averageLabel}`)}</span></div></div>`;
    }).join('') : '<div class="empty">Record results for the selected date and distance to calculate team scores and varsity averages.</div>';

    const history = [...state.results].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    $('resultsHistory').innerHTML = history.length ? history.slice(0, 100).map((result) => {
      const athlete = athleteById(result.athleteId);
      return `<div class="result-card"><div class="person"><div class="avatar">${initials(athlete?.name)}</div><div><div class="name">${esc(athlete?.name || 'Unknown athlete')}</div><div class="meta">${esc(result.distance)} • ${formatDate(result.date)}</div></div></div><div style="display:flex;align-items:center;gap:10px"><div style="text-align:right"><div class="time">${formatTime(result.seconds)}</div>${isBestResult(result) ? '<span class="pill good">PR</span>' : ''}</div><button class="danger" data-delete-result="${result.id}">Delete</button></div></div>`;
    }).join('') : '<div class="empty">No performances recorded yet.</div>';
  }

  function renderInsights() {
    const attendance = overallAttendance();
    const groups = trainingGroupData();
    const improvers = topImproverData();
    const athletesWithData = new Set(state.results.map((result) => result.athleteId)).size;
    const coverage = state.athletes.length ? Math.round((athletesWithData / state.athletes.length) * 100) : 0;

    $('insightKpis').innerHTML = `
      <div class="kpi"><div class="label">Team attendance</div><div class="value">${attendance == null ? '—' : `${attendance}%`}</div><div class="progress"><span style="width:${attendance || 0}%"></span></div></div>
      <div class="kpi"><div class="label">Athletes with timing data</div><div class="value">${coverage}%</div><div class="progress"><span style="width:${coverage}%"></span></div></div>
      <div class="kpi"><div class="label">Current training groups</div><div class="value">${groups.length || '—'}</div><div class="meta">Generated from available benchmark data</div></div>`;

    $('trainingGroups').innerHTML = groups.length ? groups.map((group, index) => `<div class="group-card"><h4>${group.name}</h4><div class="meta">${index === 0 ? 'Faster benchmark group' : index === groups.length - 1 ? 'Build aerobic consistency and durability' : 'Developing benchmark group'}</div><div class="group-members">${group.athletes.map((athlete) => `<span class="member">${esc(athlete.name)} • ${formatTime(athlete.score)}</span>`).join('')}</div></div>`).join('') : '<div class="empty">Record 1-mile or 2-mile times to generate training groups.</div>';

    const recommendations = buildRecommendations(attendance, coverage, groups);
    $('coachRecommendations').innerHTML = recommendations.map((item) => `<div class="insight"><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></div>`).join('');

    $('topImprovers').innerHTML = improvers.length ? improvers.map((item) => `<div class="list-item"><div class="person"><div class="avatar">${initials(item.athlete.name)}</div><div><div class="name">${esc(item.athlete.name)}</div><div class="meta">${esc(item.distance)}</div></div></div><div style="text-align:right"><div class="time">${item.percent.toFixed(1)}%</div><span class="pill good">${formatTime(item.seconds)} faster</span></div></div>`).join('') : '<div class="empty">Two or more comparable results per athlete are needed to calculate improvement.</div>';
  }

  function buildRecommendations(attendance, coverage, groups) {
    const items = [];
    if (!state.athletes.length) return [{ title: 'Build the roster', body: 'Add your athletes so CoachOS can start measuring attendance and performance coverage.' }];
    if (coverage < 70) items.push({ title: 'Establish more baselines', body: `Only ${coverage}% of the roster has timing data. Get a controlled 1-mile or 2-mile benchmark on the remaining athletes before making aggressive training-group decisions.` });
    if (attendance != null && attendance < 85) items.push({ title: 'Protect consistency first', body: `Overall attendance is ${attendance}%. A sophisticated workout plan cannot compensate for athletes missing the training dose. Identify the attendance barriers before adding volume or intensity.` });
    if (groups.length) {
      const fastest = groups[0].athletes.map((a) => a.score);
      const slowest = groups.at(-1).athletes.map((a) => a.score);
      const spread = fastest.length && slowest.length ? Math.max(...slowest) - Math.min(...fastest) : 0;
      if (spread > 180) items.push({ title: 'Use separate pace targets', body: 'Your available benchmark data shows a wide performance spread. Avoid one-size-fits-all interval paces. Keep the same workout purpose while assigning group-specific targets.' });
      else items.push({ title: 'Keep group movement fluid', body: 'Your benchmark groups are reasonably close. Recheck them every 2–3 weeks and move athletes based on repeated evidence, not one unusually good or bad day.' });
    }
    if (state.results.length >= state.athletes.length * 2) items.push({ title: 'Start looking for response patterns', body: 'You now have enough repeated efforts to compare who improves after specific training blocks. Continue logging practice type so future versions can link workouts to performance response.' });
    if (!items.length) items.push({ title: 'Keep collecting clean data', body: 'The foundation is good. Consistent attendance and repeated benchmark efforts will make every recommendation more reliable.' });
    return items.slice(0, 4);
  }

  function renderSettings() {
    $('settingTeam').value = state.settings.teamName || '';
    $('settingSeason').value = state.settings.season || '';
    $('settingCoach').value = state.settings.coachName || '';
    $('settingAiRole').value = state.settings.aiRole === 'assistant_coach' ? 'assistant_coach' : 'head_coach';
    $('settingAiAthleteDetail').value = state.settings.aiAthleteDetail === 'anonymized' ? 'anonymized' : 'team_only';
    $('scopeTeamTrends').checked = state.settings.aiScope?.teamTrends !== false;
    $('scopeAthleteTrends').checked = state.settings.aiScope?.athleteTrends !== false;
    $('scopeWorkloadBalance').checked = state.settings.aiScope?.workloadBalance !== false;
    $('scopeRaceReadiness').checked = state.settings.aiScope?.raceReadiness !== false;
    $('scopeCoachQueries').checked = state.settings.aiScope?.coachQueries !== false;
  }

  function calibrationTone(ok) {
    return ok ? 'good' : 'warn';
  }

  function calibrationLabel(ok) {
    return ok ? 'Calibrated' : 'Needs attention';
  }

  function renderCalibrationResults(items, overallOk) {
    const list = $('connectionCalibrationResults');
    const pill = $('connectionCalibrationPill');
    if (pill) {
      pill.textContent = overallOk ? 'Calibrated' : 'Attention needed';
      pill.className = `pill ${overallOk ? 'good' : 'warn'}`;
    }
    if (!list) return;
    list.innerHTML = items.map((item) => `
      <div class="list-item">
        <div>
          <div class="name">${esc(item.label)}</div>
          <div class="meta">${esc(item.detail)}</div>
        </div>
        <span class="pill ${calibrationTone(item.ok)}">${calibrationLabel(item.ok)}</span>
      </div>
    `).join('');
  }

  async function runConnectionCalibration() {
    const button = $('runConnectionCalibration');
    if (button) {
      button.disabled = true;
      button.textContent = 'Calibrating...';
    }

    const checks = [];
    let health = null;

    try {
      const response = await fetch('/api/connection-health', { cache: 'no-store' });
      if (!response.ok) throw new Error('Vercel calibration endpoint unavailable.');
      health = await response.json();
      checks.push({
        label: 'Browser → Vercel',
        ok: true,
        detail: `Connected (${health.vercel?.environment || 'unknown'} env, ${health.vercel?.region || 'unknown'} region)`
      });
    } catch (error) {
      checks.push({
        label: 'Browser → Vercel',
        ok: false,
        detail: error.message || 'Could not reach Vercel API.'
      });
    }

    checks.push({
      label: 'Vercel → ChatGPT (OpenAI)',
      ok: Boolean(health?.openai?.configured),
      detail: health?.openai?.configured
        ? `OPENAI_API_KEY configured (model ${health.openai.model || 'gpt-5-mini'})`
        : 'OPENAI_API_KEY missing in Vercel environment variables.'
    });

    checks.push({
      label: 'GitHub ↔ Vercel',
      ok: Boolean(health?.github?.linked),
      detail: health?.github?.linked
        ? `Linked via ${health.github.repo} @ ${String(health.github.commit || '').slice(0, 7)}`
        : 'Vercel Git metadata missing. Reconnect the GitHub repository in Vercel.'
    });

    const cloud = window.__xcCloudCalibration || {};
    const firestoreLoaded = Boolean(cloud.firebaseModuleLoaded);
    const firestoreSynced = firestoreLoaded && (cloud.authState === 'signed_in' || cloud.lastSyncTone === 'good');

    checks.push({
      label: 'Browser → Firestore module',
      ok: firestoreLoaded,
      detail: firestoreLoaded ? 'Firebase cloud module loaded.' : 'Firebase cloud module did not load.'
    });

    checks.push({
      label: 'Firestore auth/sync',
      ok: firestoreSynced,
      detail: firestoreSynced
        ? `State: ${cloud.lastSyncStatus || 'Cloud synced'}`
        : `State: ${cloud.lastSyncStatus || 'Sign in required or sync not ready.'}`
    });

    const overallOk = checks.every((item) => item.ok);
    renderCalibrationResults(checks, overallOk);
    showToast(overallOk ? 'All core connections are calibrated.' : 'Calibration found items to fix.');

    if (button) {
      button.disabled = false;
      button.textContent = 'Run calibration';
    }
  }

  function renderAll() {
    renderHeader();
    renderDashboard();
    renderAthletes();
    renderPractice();
    renderTiming();
    renderInsights();
    renderSettings();
  }

  function bindEvents() {
    $$('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
    $('quickAdd').addEventListener('click', openAthleteModal);
    $('addAthleteBtn').addEventListener('click', openAthleteModal);
    $('openSettings').addEventListener('click', () => navigate('settings'));
    $('saveAthlete').addEventListener('click', addAthlete);
    $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeAthleteModal));
    $('athleteModal').addEventListener('click', (event) => { if (event.target === $('athleteModal')) closeAthleteModal(); });
    $('modalAthleteName').addEventListener('keydown', (event) => { if (event.key === 'Enter') addAthlete(); });
    $('modalAthleteSex').addEventListener('change', syncModalAthleteTeam);
    $('modalAthleteGrade').addEventListener('change', syncModalAthleteTeam);
    $('athleteFilter').addEventListener('change', renderAthletes);
    $('practiceDate').addEventListener('change', () => { loadPracticeForm($('practiceDate').value); renderPractice(); });
    $('markAllPresent').addEventListener('click', markAllPresent);
    $('savePractice').addEventListener('click', savePractice);
    $('resultDate').addEventListener('change', renderTiming);
    $('resultDistance').addEventListener('change', renderTiming);
    $('saveBatchTimes').addEventListener('click', saveBatchTimes);
    $('exportCsv').addEventListener('click', exportCsv);
    $('saveSettings').addEventListener('click', saveSettings);
    $('exportBackup').addEventListener('click', exportBackup);
    $('importBackup').addEventListener('change', (event) => importBackup(event.target.files?.[0]));
    $('resetApp').addEventListener('click', resetApp);
    $('runConnectionCalibration')?.addEventListener('click', runConnectionCalibration);

    document.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-athlete]');
      if (remove) removeAthlete(remove.dataset.removeAthlete);
      const attendance = event.target.closest('[data-attendance-id]');
      if (attendance) setAttendance(attendance.dataset.attendanceId, attendance.dataset.attendanceStatus);
      const deleteButton = event.target.closest('[data-delete-result]');
      if (deleteButton) deleteResult(deleteButton.dataset.deleteResult);
    });
    document.addEventListener('change', (event) => {
      const teamMove = event.target.closest('[data-athlete-team]');
      if (teamMove) moveAthleteTeam(teamMove.dataset.athleteTeam, teamMove.value);
    });
  }

  function init() {
    const today = localDateString();
    $('practiceDate').value = today;
    $('resultDate').value = today;
    loadPracticeForm(today);
    bindEvents();
    renderAll();
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=2026-07-28-v2').catch(() => {}));
  }

  init();
})();

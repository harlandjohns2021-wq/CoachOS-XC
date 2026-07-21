(() => {
  'use strict';

  const APP_KEY = 'coachos_xc_v2';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const TEAM_KEY = 'xccommand_team_assignments_v1';
  const SELECTED_TEAM_KEY = 'xccommand_selected_practice_team_v1';

  const TEAMS = [
    { id: 'all', name: 'All Rosters' },
    { id: 'varsity-girls', name: 'Harts Bluff Varsity Girls' },
    { id: 'varsity-boys', name: 'Harts Bluff Varsity Boys' },
    { id: 'jv-girls', name: 'Harts Bluff Junior Varsity Girls' },
    { id: 'jv-boys', name: 'Harts Bluff Junior Varsity Boys' },
    { id: 'jh-girls', name: 'Harts Bluff JH Girls' },
    { id: 'jh-boys', name: 'Harts Bluff JH Boys' }
  ];

  const $ = (id) => document.getElementById(id);
  let intervalBlocks = [];
  let renderingHistory = false;

  function safeJsonParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadAppState() {
    return safeJsonParse(localStorage.getItem(APP_KEY), { athletes: [], attendance: {}, practices: [] });
  }

  function loadAssignments() {
    return safeJsonParse(localStorage.getItem(TEAM_KEY), {});
  }

  function saveAssignments(assignments) {
    localStorage.setItem(TEAM_KEY, JSON.stringify(assignments));
  }

  function loadPracticeDetails() {
    return safeJsonParse(localStorage.getItem(PRACTICE_KEY), {});
  }

  function savePracticeDetails(details) {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(details));
  }

  function inferTeam(athlete) {
    const grade = Number(athlete?.grade || 0);
    const isGirl = athlete?.sex === 'Female';
    if (grade > 0 && grade <= 8) return isGirl ? 'jh-girls' : 'jh-boys';
    return isGirl ? 'varsity-girls' : 'varsity-boys';
  }

  function athleteTeam(athlete) {
    const assignments = loadAssignments();
    return assignments[athlete.id] || athlete.teamId || inferTeam(athlete);
  }

  function selectedTeamId() {
    return $('practiceRoster')?.value || localStorage.getItem(SELECTED_TEAM_KEY) || 'all';
  }

  function teamName(id) {
    return TEAMS.find((team) => team.id === id)?.name || 'All Rosters';
  }

  function practiceRecordKey(date, rosterId) {
    return `${date}|${rosterId}`;
  }

  function mileageOptions() {
    const options = ['<option value="">Select mileage</option>'];
    for (let value = 0; value <= 30; value += 0.5) {
      const label = value === 0 ? '0 miles' : `${Number.isInteger(value) ? value : value.toFixed(1)} mile${value === 1 ? '' : 's'}`;
      options.push(`<option value="${value}">${label}</option>`);
    }
    return options.join('');
  }

  function repOptions() {
    return Array.from({ length: 30 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('');
  }

  function installPracticeControls() {
    const form = document.querySelector('#practice .form-grid');
    if (!form || $('practiceRoster')) return;

    const oldDistance = $('practiceDistance');
    const oldDistanceField = oldDistance?.closest('.field');
    if (oldDistanceField) oldDistanceField.style.display = 'none';

    const notesField = $('practiceNotes')?.closest('.field');
    const wrapper = document.createElement('div');
    wrapper.className = 'field span-4';
    wrapper.id = 'xcCommandWorkoutBuilder';
    wrapper.innerHTML = `
      <div class="form-grid">
        <div class="field span-2">
          <label for="practiceRoster">Roster</label>
          <select id="practiceRoster">${TEAMS.map((team) => `<option value="${team.id}">${team.name}</option>`).join('')}</select>
        </div>
        <div class="field span-2">
          <label for="practiceMileage">Total mileage</label>
          <select id="practiceMileage">${mileageOptions()}</select>
        </div>
        <div class="field">
          <label for="practiceIntervalDistance">Interval distance</label>
          <select id="practiceIntervalDistance">
            <option value="400m">400m</option>
            <option value="800m">800m</option>
            <option value="1200m">1200m</option>
            <option value="1600m">1600m</option>
          </select>
        </div>
        <div class="field">
          <label for="practiceIntervalReps">Reps</label>
          <select id="practiceIntervalReps">${repOptions()}</select>
        </div>
        <div class="field span-2" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <button type="button" class="secondary" id="addIntervalBlock">+ Add interval block</button>
        </div>
        <div class="field span-4">
          <label>Workout intervals</label>
          <div id="intervalBlockList" style="display:flex;flex-wrap:wrap;gap:8px;min-height:42px;align-items:center"></div>
          <div class="sub" style="margin-top:6px">Add multiple blocks, such as 6 × 400m and 3 × 800m.</div>
        </div>
      </div>`;

    if (notesField) form.insertBefore(wrapper, notesField);
    else form.appendChild(wrapper);

    const savedTeam = localStorage.getItem(SELECTED_TEAM_KEY) || 'all';
    $('practiceRoster').value = TEAMS.some((team) => team.id === savedTeam) ? savedTeam : 'all';

    $('practiceRoster').addEventListener('change', () => {
      localStorage.setItem(SELECTED_TEAM_KEY, $('practiceRoster').value);
      loadSelectedPractice();
      filterAttendanceRows();
    });

    $('addIntervalBlock').addEventListener('click', () => {
      const distance = $('practiceIntervalDistance').value;
      const reps = Number($('practiceIntervalReps').value);
      if (!distance || !reps) return;
      intervalBlocks.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, distance, reps });
      renderIntervalBlocks();
      syncCoreDistance();
    });

    $('intervalBlockList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-interval]');
      if (!button) return;
      intervalBlocks = intervalBlocks.filter((block) => block.id !== button.dataset.removeInterval);
      renderIntervalBlocks();
      syncCoreDistance();
    });

    $('practiceMileage').addEventListener('change', syncCoreDistance);
    loadSelectedPractice();
  }

  function renderIntervalBlocks() {
    const container = $('intervalBlockList');
    if (!container) return;
    if (!intervalBlocks.length) {
      container.innerHTML = '<span class="pill">No interval blocks added</span>';
      return;
    }
    container.innerHTML = intervalBlocks.map((block) => `
      <span class="pill good" style="display:inline-flex;gap:8px;align-items:center">
        ${block.reps} × ${block.distance}
        <button type="button" data-remove-interval="${block.id}" aria-label="Remove ${block.reps} by ${block.distance}" style="border:0;background:transparent;cursor:pointer;font:inherit;padding:0 2px">×</button>
      </span>`).join('');
  }

  function buildDistanceSummary() {
    const mileage = $('practiceMileage')?.value;
    const pieces = [];
    if (mileage !== '') pieces.push(`${Number(mileage)} mile${Number(mileage) === 1 ? '' : 's'}`);
    if (intervalBlocks.length) pieces.push(intervalBlocks.map((block) => `${block.reps}x${block.distance}`).join(' + '));
    return pieces.join(' • ');
  }

  function syncCoreDistance() {
    const coreDistance = $('practiceDistance');
    if (coreDistance) coreDistance.value = buildDistanceSummary();
  }

  function saveEnhancedPractice() {
    const date = $('practiceDate')?.value;
    const rosterId = selectedTeamId();
    if (!date) return;

    const details = loadPracticeDetails();
    details[practiceRecordKey(date, rosterId)] = {
      id: practiceRecordKey(date, rosterId),
      date,
      rosterId,
      rosterName: teamName(rosterId),
      title: $('practiceTitle')?.value.trim() || 'Practice',
      type: $('practiceType')?.value || 'Other',
      mileage: $('practiceMileage')?.value === '' ? null : Number($('practiceMileage').value),
      intervalBlocks: intervalBlocks.map((block) => ({ distance: block.distance, reps: block.reps })),
      notes: $('practiceNotes')?.value.trim() || '',
      updatedAt: new Date().toISOString()
    };
    savePracticeDetails(details);
    renderEnhancedHistory();
  }

  function loadSelectedPractice() {
    if (!$('practiceRoster')) return;
    const date = $('practiceDate')?.value;
    const rosterId = selectedTeamId();
    const details = loadPracticeDetails();
    const record = details[practiceRecordKey(date, rosterId)];

    if (record) {
      $('practiceTitle').value = record.title || '';
      $('practiceType').value = record.type || 'Easy Run';
      $('practiceMileage').value = record.mileage == null ? '' : String(record.mileage);
      $('practiceNotes').value = record.notes || '';
      intervalBlocks = (record.intervalBlocks || []).map((block) => ({ ...block, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` }));
    } else {
      $('practiceMileage').value = '';
      intervalBlocks = [];
    }
    renderIntervalBlocks();
    syncCoreDistance();
    renderEnhancedHistory();
  }

  function selectedAthletes() {
    const state = loadAppState();
    const rosterId = selectedTeamId();
    return (state.athletes || []).filter((athlete) => rosterId === 'all' || athleteTeam(athlete) === rosterId);
  }

  function filterAttendanceRows() {
    const grid = $('attendanceGrid');
    if (!grid || !$('practiceRoster')) return;
    const allowed = new Set(selectedAthletes().map((athlete) => athlete.id));
    const rosterId = selectedTeamId();

    grid.querySelectorAll('.attendance-row').forEach((row) => {
      const button = row.querySelector('[data-attendance-id]');
      if (!button) return;
      row.style.display = rosterId === 'all' || allowed.has(button.dataset.attendanceId) ? '' : 'none';
    });

    const state = loadAppState();
    const date = $('practiceDate')?.value;
    const day = state.attendance?.[date] || {};
    const present = [...allowed].filter((id) => day[id] === 'Present').length;
    const summary = $('attendanceSummary');
    if (summary) summary.textContent = `${present} present • ${allowed.size} on roster`;
  }

  function markSelectedRosterPresent() {
    const ids = selectedAthletes().map((athlete) => athlete.id);
    if (!ids.length) return;
    ids.forEach((id) => {
      const button = document.querySelector(`[data-attendance-id="${CSS.escape(id)}"][data-attendance-status="Present"]`);
      if (button) button.click();
    });
    filterAttendanceRows();
  }

  function installTeamAssignmentSelectors() {
    const table = $('athleteTable');
    if (!table) return;
    const state = loadAppState();
    const athleteMap = new Map((state.athletes || []).map((athlete) => [athlete.id, athlete]));
    const assignments = loadAssignments();

    table.querySelectorAll('tr').forEach((row) => {
      const remove = row.querySelector('[data-remove-athlete]');
      const meta = row.querySelector('.person .meta');
      if (!remove || !meta || row.querySelector('[data-team-assignment]')) return;
      const athlete = athleteMap.get(remove.dataset.removeAthlete);
      if (!athlete) return;

      const select = document.createElement('select');
      select.setAttribute('data-team-assignment', athlete.id);
      select.setAttribute('aria-label', `Team for ${athlete.name}`);
      select.style.marginTop = '6px';
      select.style.maxWidth = '210px';
      select.style.fontSize = '12px';
      select.innerHTML = TEAMS.filter((team) => team.id !== 'all').map((team) => `<option value="${team.id}">${team.name.replace('Harts Bluff ', '')}</option>`).join('');
      select.value = assignments[athlete.id] || athlete.teamId || inferTeam(athlete);
      select.addEventListener('change', () => {
        const next = loadAssignments();
        next[athlete.id] = select.value;
        saveAssignments(next);
        filterAttendanceRows();
      });
      meta.appendChild(document.createElement('br'));
      meta.appendChild(select);
    });
  }

  function renderEnhancedHistory() {
    if (renderingHistory) return;
    const history = $('practiceHistory');
    if (!history) return;
    const records = Object.values(loadPracticeDetails())
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 12);
    if (!records.length) return;

    renderingHistory = true;
    history.innerHTML = records.map((record) => {
      const workout = [];
      if (record.mileage != null) workout.push(`${record.mileage} mi`);
      if (record.intervalBlocks?.length) workout.push(record.intervalBlocks.map((block) => `${block.reps} × ${block.distance}`).join(' + '));
      return `<div class="list-item"><div><div class="name">${escapeHtml(record.title || 'Practice')}</div><div class="meta">${formatDate(record.date)} • ${escapeHtml(record.rosterName || 'Roster')} • ${escapeHtml(record.type || 'Other')}${workout.length ? ` • ${escapeHtml(workout.join(' • '))}` : ''}</div></div><span class="pill">${escapeHtml(record.type || 'Practice')}</span></div>`;
    }).join('');
    renderingHistory = false;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  function observeRenders() {
    const attendanceGrid = $('attendanceGrid');
    if (attendanceGrid) {
      new MutationObserver(() => filterAttendanceRows()).observe(attendanceGrid, { childList: true });
    }
    const athleteTable = $('athleteTable');
    if (athleteTable) {
      new MutationObserver(() => installTeamAssignmentSelectors()).observe(athleteTable, { childList: true, subtree: true });
    }
    const practiceHistory = $('practiceHistory');
    if (practiceHistory) {
      new MutationObserver(() => {
        if (!renderingHistory) renderEnhancedHistory();
      }).observe(practiceHistory, { childList: true });
    }
  }

  function bindEnhancementEvents() {
    document.addEventListener('click', (event) => {
      const markAll = event.target.closest('#markAllPresent');
      if (!markAll || selectedTeamId() === 'all') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      markSelectedRosterPresent();
    }, true);

    $('savePractice')?.addEventListener('click', () => {
      syncCoreDistance();
      setTimeout(saveEnhancedPractice, 0);
    });

    $('practiceDate')?.addEventListener('change', () => {
      setTimeout(() => {
        loadSelectedPractice();
        filterAttendanceRows();
      }, 0);
    });
  }

  function init() {
    installPracticeControls();
    bindEnhancementEvents();
    observeRenders();
    installTeamAssignmentSelectors();
    renderIntervalBlocks();
    filterAttendanceRows();
    renderEnhancedHistory();
  }

  init();
})();
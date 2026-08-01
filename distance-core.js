(() => {
  'use strict';

  const APP_KEY = 'coachos_xc_v2';
  const TEAM_KEY = 'xccommand_team_assignments_v1';
  const STANDARD_DISTANCES = [
    { label: '1 Mile', meters: 1609.344 },
    { label: '2 Mile', meters: 3218.688 },
    { label: '3 Mile', meters: 4828.032 },
    { label: '3K', meters: 3000 },
    { label: '3200m', meters: 3200 },
    { label: '5K', meters: 5000 }
  ];
  const CLOSE_TOLERANCE = 0.05;
  const RIEGEL_EXPONENT = 1.06;
  let raceGroupRenderQueued = false;

  function safeJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function parseDistance(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const compact = raw.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();

    const exact = STANDARD_DISTANCES.find((item) => item.label.toLowerCase() === compact);
    if (exact) return { label: exact.label, meters: exact.meters };

    const match = compact.match(/^(\d+(?:\.\d+)?)\s*(km|k|kilometers?|kilometres?|mi|mile|miles|m|meters?|metres?)$/);
    if (!match) return { label: raw, meters: null };

    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    let meters = amount;
    if (['km', 'k', 'kilometer', 'kilometers', 'kilometre', 'kilometres'].includes(unit)) meters = amount * 1000;
    if (['mi', 'mile', 'miles'].includes(unit)) meters = amount * 1609.344;

    let label;
    if (meters >= 1000 && ['km', 'k', 'kilometer', 'kilometers', 'kilometre', 'kilometres'].includes(unit)) {
      label = `${Number(amount.toFixed(3))}K`;
    } else if (['mi', 'mile', 'miles'].includes(unit)) {
      label = `${Number(amount.toFixed(3))} Mile${Math.abs(amount - 1) < 0.0001 ? '' : 's'}`;
    } else {
      label = `${Math.round(meters)}m`;
    }

    return { label, meters };
  }

  function closestStandard(meters) {
    if (!Number.isFinite(meters)) return null;
    const ranked = STANDARD_DISTANCES
      .map((item) => ({ ...item, difference: Math.abs(meters - item.meters) / item.meters }))
      .sort((a, b) => a.difference - b.difference);
    return ranked[0] || null;
  }

  function ensureOption(select, value) {
    let option = [...select.options].find((row) => row.value === value);
    if (!option) {
      option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.dataset.customDistance = 'true';
      select.appendChild(option);
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function installCustomDistance(selectId, inputId, labelText) {
    const select = document.getElementById(selectId);
    if (!select || document.getElementById(inputId)) return;

    STANDARD_DISTANCES.forEach((item) => {
      if (![...select.options].some((option) => option.value === item.label)) {
        const option = document.createElement('option');
        option.value = item.label;
        option.textContent = item.label;
        select.appendChild(option);
      }
    });

    const field = select.closest('.field');
    if (!field?.parentElement) return;

    const customField = document.createElement('div');
    customField.className = 'field';
    customField.innerHTML = `
      <label for="${inputId}">${labelText}</label>
      <input id="${inputId}" inputmode="decimal" autocomplete="off" data-no-speech="true" placeholder="Examples: 2.9K, 3 miles, 4.8K, 4900m">
      <div class="sub" id="${inputId}Help">Exact course distance is saved. Courses within 5% of a standard race are marked as close.</div>
    `;
    field.insertAdjacentElement('afterend', customField);

    const input = customField.querySelector('input');
    const helper = customField.querySelector('.sub');

    const apply = () => {
      const parsed = parseDistance(input.value);
      if (!parsed) {
        helper.textContent = 'Enter a positive distance with a unit, such as 2.9K, 4900m, or 3 miles.';
        return;
      }
      ensureOption(select, parsed.label);
      const closest = closestStandard(parsed.meters);
      if (closest && closest.difference <= CLOSE_TOLERANCE) {
        const percent = (closest.difference * 100).toFixed(1);
        helper.textContent = `${parsed.label} saved as the exact distance. It is ${percent}% from ${closest.label}, so it is close enough for comparison context.`;
      } else if (parsed.meters) {
        helper.textContent = `${parsed.label} saved as a custom distance. Pace and results remain tied to that exact course length.`;
      } else {
        helper.textContent = `${parsed.label} saved as entered. Add meters, kilometers, or miles for automatic comparison context.`;
      }
    };

    input.addEventListener('change', apply);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        apply();
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(Number(seconds))) return '—';
    const rounded = Math.round(Number(seconds));
    const minutes = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function athleteDivision(athlete, assignments) {
    const teamId = String(assignments[athlete.id] || athlete.teamId || '').toLowerCase();
    const gradeText = String(athlete.grade || '').trim().toLowerCase();
    const gradeNumber = Number(gradeText);
    const isJH = teamId.startsWith('jh-') || gradeText === 'jh' || (Number.isFinite(gradeNumber) && gradeNumber > 0 && gradeNumber <= 8);

    let sex = String(athlete.sex || '').toLowerCase();
    if (teamId.includes('girls')) sex = 'female';
    if (teamId.includes('boys')) sex = 'male';

    if (isJH) return 'jh';
    if (sex === 'male') return 'hs-boys';
    if (sex === 'female') return 'hs-girls';
    return 'hs-unassigned';
  }

  function latestExactResult(results, athleteId, distance) {
    return results
      .filter((result) => result.athleteId === athleteId && result.distance === distance && Number(result.seconds) > 0)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  }

  function performanceFor(athlete, targetDistance, results) {
    const target = STANDARD_DISTANCES.find((item) => item.label === targetDistance);
    if (!target) return null;

    const exact = latestExactResult(results, athlete.id, targetDistance);
    if (exact) {
      return { seconds: Number(exact.seconds), source: targetDistance, estimated: false };
    }

    const candidates = results
      .filter((result) => result.athleteId === athlete.id && Number(result.seconds) > 0)
      .map((result) => {
        const parsed = parseDistance(result.distance);
        if (!parsed?.meters) return null;
        const ratio = target.meters / parsed.meters;
        return {
          seconds: Number(result.seconds) * Math.pow(ratio, RIEGEL_EXPONENT),
          source: `${result.distance} estimate`,
          estimated: true,
          closeness: Math.abs(Math.log(ratio)),
          date: String(result.date || '')
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.closeness - b.closeness || b.date.localeCompare(a.date));

    return candidates[0] || null;
  }

  function raceGroupSignature(state, assignments) {
    return JSON.stringify({
      athletes: (state.athletes || []).map((athlete) => [athlete.id, athlete.sex, athlete.grade, athlete.teamId, assignments[athlete.id]]),
      results: (state.results || []).map((result) => [result.id, result.athleteId, result.distance, result.seconds, result.date])
    });
  }

  function raceGroupSection(definition, athletes, results) {
    const rows = athletes.map((athlete) => ({ athlete, performance: performanceFor(athlete, definition.distance, results) }));
    const timed = rows.filter((row) => row.performance).sort((a, b) => a.performance.seconds - b.performance.seconds);
    const needsBaseline = rows.filter((row) => !row.performance).sort((a, b) => String(a.athlete.name).localeCompare(String(b.athlete.name)));

    const timedRows = timed.map((row, index) => `
      <div class="list-item">
        <div class="person">
          <div class="avatar">${escapeHtml(initials(row.athlete.name))}</div>
          <div>
            <div class="name">${index + 1}. ${escapeHtml(row.athlete.name)}</div>
            <div class="meta">${escapeHtml(row.performance.source)}${row.performance.estimated ? ' • projected' : ' • recorded'}</div>
          </div>
        </div>
        <div style="text-align:right"><div class="time">${formatTime(row.performance.seconds)}</div></div>
      </div>
    `).join('');

    const baselineRows = needsBaseline.length
      ? `<div class="insight" style="margin-top:10px"><strong>Needs a ${escapeHtml(definition.distance)} baseline</strong><p>${needsBaseline.map((row) => escapeHtml(row.athlete.name)).join(' • ')}</p></div>`
      : '';

    return `
      <section class="xc-race-group" data-race-group="${definition.id}" style="margin-bottom:18px">
        <div class="card-head" style="margin-bottom:8px">
          <div><h3 style="margin:0">${escapeHtml(definition.label)}</h3><div class="sub">Ranked by latest ${escapeHtml(definition.distance)} result, with a distance-adjusted estimate only when needed</div></div>
          <span class="pill">${athletes.length} athlete${athletes.length === 1 ? '' : 's'}</span>
        </div>
        ${timedRows || '<div class="empty">No recorded or projectable times yet.</div>'}
        ${baselineRows}
      </section>
    `;
  }

  function renderRaceTrainingGroups() {
    const container = document.getElementById('trainingGroups');
    if (!container) return;

    const state = safeJson(localStorage.getItem(APP_KEY), { athletes: [], results: [] });
    const assignments = safeJson(localStorage.getItem(TEAM_KEY), {});
    const signature = raceGroupSignature(state, assignments);
    if (container.dataset.raceGroupSignature === signature && container.querySelector('.xc-race-group')) return;

    const athletes = Array.isArray(state.athletes) ? state.athletes.filter((athlete) => athlete.active !== false) : [];
    const results = Array.isArray(state.results) ? state.results : [];
    const definitions = [
      { id: 'jh', label: 'Junior High • 2 Mile', distance: '2 Mile' },
      { id: 'hs-boys', label: 'High School Boys • 3 Mile', distance: '3 Mile' },
      { id: 'hs-girls', label: 'High School Girls • 2 Mile', distance: '2 Mile' }
    ];

    const byDivision = Object.fromEntries(definitions.map((definition) => [definition.id, []]));
    const unassigned = [];
    athletes.forEach((athlete) => {
      const division = athleteDivision(athlete, assignments);
      if (byDivision[division]) byDivision[division].push(athlete);
      else if (division === 'hs-unassigned') unassigned.push(athlete);
    });

    const card = container.closest('.card');
    const subtitle = card?.querySelector('.card-head .sub');
    if (subtitle) subtitle.textContent = 'JH uses 2 miles, HS boys use 3 miles, and HS girls use 2 miles.';

    container.dataset.raceGroupSignature = signature;
    container.innerHTML = definitions.map((definition) => raceGroupSection(definition, byDivision[definition.id], results)).join('');

    if (unassigned.length) {
      container.insertAdjacentHTML('beforeend', `
        <div class="insight xc-race-group" data-race-group="unassigned">
          <strong>High-school roster assignment needed</strong>
          <p>Assign these athletes to a boys or girls roster before they can enter the correct race group: ${unassigned.map((athlete) => escapeHtml(athlete.name)).join(' • ')}</p>
        </div>
      `);
    }
  }

  function scheduleRaceTrainingGroups() {
    if (raceGroupRenderQueued) return;
    raceGroupRenderQueued = true;
    requestAnimationFrame(() => {
      raceGroupRenderQueued = false;
      renderRaceTrainingGroups();
    });
  }

  function installRaceTrainingGroups() {
    const container = document.getElementById('trainingGroups');
    if (!container || container.dataset.raceGroupObserver === 'true') return;
    container.dataset.raceGroupObserver = 'true';

    const observer = new MutationObserver(scheduleRaceTrainingGroups);
    observer.observe(container, { childList: true });
    window.addEventListener('storage', scheduleRaceTrainingGroups);
    window.addEventListener('xccommand:local-state-changed', scheduleRaceTrainingGroups);
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-view="insights"], [data-go="insights"]')) {
        setTimeout(scheduleRaceTrainingGroups, 0);
      }
    });
    scheduleRaceTrainingGroups();
  }

  function install() {
    installCustomDistance('resultDistance', 'resultCustomDistance', 'Type a custom distance');
    installCustomDistance('resultsImportDistance', 'resultsImportCustomDistance', 'Type imported course distance');
    installRaceTrainingGroups();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

import { normalizeState } from './sync-core.js';

const STORAGE_KEY = 'coachos_xc_v2';
const TEAM_ORDER = ['varsity-girls', 'varsity-boys', 'jh-girls', 'jh-boys', 'unassigned'];
const TEAM_LABELS = {
  'varsity-girls': 'High School Girls',
  'varsity-boys': 'High School Boys',
  'jh-girls': 'Junior High Girls',
  'jh-boys': 'Junior High Boys',
  unassigned: 'Unassigned'
};

const draftTimes = new Map();
let historyExpanded = false;
let timingRenderQueued = false;
let insightRenderQueued = false;

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

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const total = Math.round(Number(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function selectedDistance() {
  return document.getElementById('resultDistance')?.value || '1 Mile';
}

function athleteTeam(athlete, state) {
  return athlete.teamId
    || state.rosterAssignments?.[athlete.id]
    || (athlete.grade === 'HS'
      ? (athlete.sex === 'Female' ? 'varsity-girls' : athlete.sex === 'Male' ? 'varsity-boys' : 'unassigned')
      : (athlete.sex === 'Female' ? 'jh-girls' : athlete.sex === 'Male' ? 'jh-boys' : 'unassigned'));
}

function latestResult(state, athleteId, distance) {
  return state.results
    .filter((result) => result.athleteId === athleteId && result.distance === distance)
    .sort((left, right) => (
      String(left.date).localeCompare(String(right.date))
      || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
    ))
    .at(-1) || null;
}

function bestResult(state, athleteId, distance) {
  const values = state.results
    .filter((result) => result.athleteId === athleteId && result.distance === distance)
    .map((result) => Number(result.seconds))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function rememberVisibleDrafts() {
  document.querySelectorAll('#batchTiming [data-time-athlete]').forEach((input) => {
    draftTimes.set(input.dataset.timeAthlete, input.value);
  });
}

function ensureStyles() {
  if (document.getElementById('xcWorkflowStyles')) return;
  const style = document.createElement('style');
  style.id = 'xcWorkflowStyles';
  style.textContent = `
    .xc-timing-controls{display:grid;grid-template-columns:minmax(170px,.75fr) minmax(220px,1.25fr) auto;gap:12px;align-items:end;margin:0 0 16px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface-2)}
    .xc-timing-count{font-size:.88rem;font-weight:800;color:var(--muted);padding:11px 0;white-space:nowrap}
    .xc-timing-list{display:grid;gap:18px}
    .xc-timing-section{display:grid;gap:8px}
    .xc-timing-heading{display:flex;justify-content:space-between;align-items:center;margin:0;padding:0 2px;font-size:1rem}
    .xc-timing-rows{display:grid;gap:7px}
    .xc-timing-row{display:grid;grid-template-columns:minmax(190px,1fr) 100px minmax(125px,165px);gap:14px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff}
    .xc-timing-row .avatar{width:34px;height:34px;border-radius:10px}
    .xc-timing-row .meta{font-size:.82rem}
    .xc-timing-pr{display:grid;gap:2px;text-align:right}
    .xc-timing-pr span{font-size:.72rem;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}
    .xc-timing-pr strong{font-size:1rem}
    .xc-timing-input label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .xc-timing-input input{width:100%;min-height:42px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:1rem;font-weight:750}
    .xc-benchmark-note{margin-bottom:12px}
    .xc-honest-groups{display:grid;gap:12px}
    .xc-group-source{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
    .xc-group-source .member{display:inline-flex;gap:5px;align-items:center}
    .xc-member-division{color:var(--muted);font-size:.72rem}
    #resultsHistory.xc-history-collapsed>.result-card:nth-child(n+13){display:none}
    .xc-history-toggle{margin-top:12px;width:100%}
    @media(max-width:780px){
      .xc-timing-controls{grid-template-columns:1fr}.xc-timing-count{padding:0}
      .xc-timing-row{grid-template-columns:minmax(0,1fr) 72px 104px;gap:8px;padding:9px}
      .xc-timing-row .person{gap:8px}.xc-timing-row .avatar{display:none}
      .xc-timing-row .name{font-size:.9rem}.xc-timing-row .meta{font-size:.72rem}
      .xc-timing-pr strong{font-size:.92rem}.xc-timing-input input{min-height:44px;padding:8px}
    }
    @media(max-width:480px){
      .xc-timing-row{grid-template-columns:minmax(0,1fr) 66px 92px}
      .xc-timing-pr span{display:none}
    }
  `;
  document.head.appendChild(style);
}

function ensureTimingControls() {
  const batch = document.getElementById('batchTiming');
  if (!batch || document.getElementById('xcTimingControls')) return;

  const controls = document.createElement('div');
  controls.id = 'xcTimingControls';
  controls.className = 'xc-timing-controls';
  controls.innerHTML = `
    <div class="field">
      <label for="xcTimingTeamFilter">Roster group</label>
      <select id="xcTimingTeamFilter">
        <option value="all">All roster groups</option>
        <option value="varsity-girls">High School Girls</option>
        <option value="varsity-boys">High School Boys</option>
        <option value="jh-girls">Junior High Girls</option>
        <option value="jh-boys">Junior High Boys</option>
        <option value="missing">Missing selected-distance time</option>
      </select>
    </div>
    <div class="field">
      <label for="xcTimingSearch">Find athlete</label>
      <input id="xcTimingSearch" type="search" placeholder="Search by athlete name">
    </div>
    <div class="xc-timing-count" id="xcTimingCount"></div>
  `;
  batch.insertAdjacentElement('beforebegin', controls);

  document.getElementById('xcTimingTeamFilter')?.addEventListener('change', renderCompactTiming);
  document.getElementById('xcTimingSearch')?.addEventListener('input', renderCompactTiming);
}

function renderCompactTiming() {
  const batch = document.getElementById('batchTiming');
  if (!batch) return;

  rememberVisibleDrafts();
  ensureTimingControls();

  const state = readState();
  const distance = selectedDistance();
  const teamFilter = document.getElementById('xcTimingTeamFilter')?.value || 'all';
  const search = document.getElementById('xcTimingSearch')?.value.trim().toLowerCase() || '';

  const athletes = state.athletes
    .map((athlete) => ({ ...athlete, resolvedTeam: athleteTeam(athlete, state) }))
    .filter((athlete) => {
      const hasResult = bestResult(state, athlete.id, distance) != null;
      if (teamFilter === 'missing' && hasResult) return false;
      if (teamFilter !== 'all' && teamFilter !== 'missing' && athlete.resolvedTeam !== teamFilter) return false;
      return !search || athlete.name.toLowerCase().includes(search);
    })
    .sort((left, right) => (
      TEAM_ORDER.indexOf(left.resolvedTeam) - TEAM_ORDER.indexOf(right.resolvedTeam)
      || left.name.localeCompare(right.name)
    ));

  const grouped = new Map();
  athletes.forEach((athlete) => {
    if (!grouped.has(athlete.resolvedTeam)) grouped.set(athlete.resolvedTeam, []);
    grouped.get(athlete.resolvedTeam).push(athlete);
  });

  batch.innerHTML = athletes.length
    ? `<div class="xc-timing-list">${TEAM_ORDER
      .filter((teamId) => grouped.has(teamId))
      .map((teamId) => {
        const rows = grouped.get(teamId);
        return `
          <section class="xc-timing-section">
            <h4 class="xc-timing-heading"><span>${TEAM_LABELS[teamId]}</span><span class="pill">${rows.length}</span></h4>
            <div class="xc-timing-rows">
              ${rows.map((athlete) => `
                <div class="xc-timing-row">
                  <div class="person">
                    <div class="avatar">${initials(athlete.name)}</div>
                    <div>
                      <div class="name">${esc(athlete.name)}</div>
                      <div class="meta">${esc(TEAM_LABELS[athlete.resolvedTeam])}</div>
                    </div>
                  </div>
                  <div class="xc-timing-pr">
                    <span>Current PR</span>
                    <strong>${formatTime(bestResult(state, athlete.id, distance))}</strong>
                  </div>
                  <div class="xc-timing-input">
                    <label for="xcTime_${esc(athlete.id)}">${esc(athlete.name)} time</label>
                    <input id="xcTime_${esc(athlete.id)}" inputmode="numeric" autocomplete="off" placeholder="M:SS" data-time-athlete="${esc(athlete.id)}" value="${esc(draftTimes.get(athlete.id) || '')}">
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        `;
      }).join('')}</div>`
    : '<div class="empty">No athletes match this timing filter.</div>';

  const count = document.getElementById('xcTimingCount');
  if (count) count.textContent = `${athletes.length} athlete${athletes.length === 1 ? '' : 's'} shown • ${distance}`;
}

function scheduleTimingRender() {
  if (timingRenderQueued) return;
  timingRenderQueued = true;
  requestAnimationFrame(() => {
    timingRenderQueued = false;
    const batch = document.getElementById('batchTiming');
    if (batch && !batch.querySelector('.xc-timing-list') && !batch.querySelector('.empty')) {
      renderCompactTiming();
    }
  });
}

function trainingGroups(state) {
  const ranked = state.athletes
    .map((athlete) => {
      const actualTwoMile = latestResult(state, athlete.id, '2 Mile');
      const oneMile = latestResult(state, athlete.id, '1 Mile');
      if (!actualTwoMile && !oneMile) return { ...athlete, score: null, source: null };
      return {
        ...athlete,
        score: actualTwoMile ? Number(actualTwoMile.seconds) : Number(oneMile.seconds) * 2.12,
        source: actualTwoMile
          ? { label: '2 Mile', seconds: Number(actualTwoMile.seconds), actual: true }
          : { label: '1 Mile', seconds: Number(oneMile.seconds), actual: true }
      };
    })
    .sort((left, right) => (left.score ?? Infinity) - (right.score ?? Infinity));

  const timed = ranked.filter((athlete) => athlete.score != null);
  const missing = ranked.filter((athlete) => athlete.score == null);
  if (!timed.length) return { groups: [], missing };

  const groupCount = timed.length < 6 ? 2 : 3;
  const size = Math.ceil(timed.length / groupCount);
  const labels = ['Performance', 'Development', 'Foundation'];
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    name: labels[index],
    athletes: timed.slice(index * size, (index + 1) * size)
  })).filter((group) => group.athletes.length);

  return { groups, missing };
}

function renderHonestInsights() {
  const container = document.getElementById('trainingGroups');
  if (!container) return;

  const state = readState();
  const { groups, missing } = trainingGroups(state);
  const descriptions = {
    Performance: 'Faster benchmark group',
    Development: 'Developing benchmark group',
    Foundation: 'Build aerobic consistency and durability'
  };

  container.innerHTML = `
    <div class="xc-honest-groups">
      <div class="insight xc-benchmark-note">
        <strong>Benchmark labels now show actual recorded distances.</strong>
        <p>One-mile performances may be used to rank training groups, but estimated two-mile equivalents are no longer displayed as if they were race results.</p>
      </div>
      ${groups.length ? groups.map((group) => `
        <div class="group-card">
          <h4>${group.name}</h4>
          <div class="meta">${descriptions[group.name] || 'Benchmark training group'}</div>
          <div class="xc-group-source">
            ${group.athletes.map((athlete) => {
              const teamId = athleteTeam(athlete, state);
              return `<span class="member"><strong>${esc(athlete.name)}</strong> • ${athlete.source.label} ${formatTime(athlete.source.seconds)} <span class="xc-member-division">${esc(TEAM_LABELS[teamId])}</span></span>`;
            }).join('')}
          </div>
        </div>
      `).join('') : '<div class="empty">Record a one-mile or two-mile benchmark to create training groups.</div>'}
      ${missing.length ? `
        <div class="group-card">
          <h4>Baseline Needed</h4>
          <div class="meta">Keep these athletes in controlled evaluation work until a benchmark is recorded.</div>
          <div class="xc-group-source">
            ${missing.map((athlete) => `<span class="member">${esc(athlete.name)} <span class="xc-member-division">${esc(TEAM_LABELS[athleteTeam(athlete, state)])}</span></span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function scheduleInsightRender() {
  if (insightRenderQueued) return;
  insightRenderQueued = true;
  requestAnimationFrame(() => {
    insightRenderQueued = false;
    const container = document.getElementById('trainingGroups');
    if (container && !container.querySelector('.xc-honest-groups')) renderHonestInsights();
  });
}

function enhanceHistory() {
  const history = document.getElementById('resultsHistory');
  if (!history) return;
  const cards = history.querySelectorAll('.result-card');
  history.classList.toggle('xc-history-collapsed', !historyExpanded && cards.length > 12);

  let button = document.getElementById('xcHistoryToggle');
  if (cards.length <= 12) {
    button?.remove();
    return;
  }

  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'xcHistoryToggle';
    button.className = 'secondary xc-history-toggle';
    history.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      historyExpanded = !historyExpanded;
      enhanceHistory();
    });
  }

  button.textContent = historyExpanded
    ? 'Show fewer results'
    : `Show all ${cards.length} results`;
}

function installObservers() {
  const batch = document.getElementById('batchTiming');
  if (batch) {
    new MutationObserver(scheduleTimingRender).observe(batch, { childList: true });
  }

  const groups = document.getElementById('trainingGroups');
  if (groups) {
    new MutationObserver(scheduleInsightRender).observe(groups, { childList: true });
  }

  const history = document.getElementById('resultsHistory');
  if (history) {
    new MutationObserver(() => requestAnimationFrame(enhanceHistory))
      .observe(history, { childList: true });
  }
}

function bindWorkflowEvents() {
  document.getElementById('batchTiming')?.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-time-athlete]');
    if (input) draftTimes.set(input.dataset.timeAthlete, input.value);
  });

  document.getElementById('resultDistance')?.addEventListener('change', () => {
    draftTimes.clear();
    setTimeout(renderCompactTiming, 0);
  });

  document.getElementById('saveBatchTimes')?.addEventListener('click', () => {
    const before = readState().results.length;
    setTimeout(() => {
      const after = readState().results.length;
      if (after > before) draftTimes.clear();
      renderCompactTiming();
      enhanceHistory();
      renderHonestInsights();
    }, 180);
  });

  window.addEventListener('xccommand:remote-state-applied', () => {
    draftTimes.clear();
    renderCompactTiming();
    renderHonestInsights();
    enhanceHistory();
  });
}

ensureStyles();
ensureTimingControls();
renderCompactTiming();
renderHonestInsights();
enhanceHistory();
installObservers();
bindWorkflowEvents();

(() => {
  'use strict';

  const APP_KEY = 'coachos_xc_v2';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const CACHE_KEY = 'xccommand_ai_coach_cache_v1';
  const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function anonymizedSnapshot() {
    const state = readJson(APP_KEY, { athletes: [], results: [], attendance: {}, practices: [], settings: {} });
    const enhancedPractices = readJson(PRACTICE_KEY, {});
    const athleteIds = new Map((state.athletes || []).map((athlete, index) => [athlete.id, `Runner ${index + 1}`]));

    return {
      team: {
        season: state.settings?.season || '',
        athleteCount: (state.athletes || []).length,
        athletes: (state.athletes || []).map((athlete, index) => ({
          id: `Runner ${index + 1}`,
          sex: athlete.sex || '',
          grade: athlete.grade || '',
          active: athlete.active !== false
        }))
      },
      results: (state.results || []).slice(-500).map((result) => ({
        athlete: athleteIds.get(result.athleteId) || 'Unknown runner',
        date: result.date,
        distance: result.distance,
        seconds: Number(result.seconds),
        source: result.source || 'manual',
        meetName: result.meetName || '',
        isPR: Boolean(result.isPR)
      })),
      attendance: Object.entries(state.attendance || {}).slice(-120).map(([date, day]) => ({
        date,
        statuses: Object.entries(day || {}).map(([athleteId, status]) => ({ athlete: athleteIds.get(athleteId) || 'Unknown runner', status }))
      })),
      practices: [
        ...(state.practices || []).slice(-80),
        ...Object.values(enhancedPractices || {}).slice(-80)
      ].map((practice) => ({
        date: practice.date,
        roster: practice.rosterName || practice.rosterId || 'all',
        title: practice.title,
        type: practice.type,
        distance: practice.distance || practice.mileage,
        intervalBlocks: practice.intervalBlocks || [],
        notes: practice.notes || ''
      }))
    };
  }

  function addStyles() {
    if (document.getElementById('xcAiCoachStyles')) return;
    const style = document.createElement('style');
    style.id = 'xcAiCoachStyles';
    style.textContent = `
      .xc-ai-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .xc-ai-metric{border:1px solid #d8deea;border-radius:12px;padding:12px;background:#fff}
      .xc-ai-metric strong{display:block;font-size:24px;color:#0b1739;margin-top:3px}
      .xc-ai-priority{border-top:1px solid #e5e9f2;padding:14px 0}
      .xc-ai-priority:first-child{border-top:0;padding-top:0}
      .xc-ai-priority h4{margin:0 0 7px;color:#0b1739}
      .xc-ai-priority p{margin:5px 0;line-height:1.5}
      .xc-ai-label{font-weight:700;color:#344054}
      .xc-ai-sources{margin-top:14px;padding-top:12px;border-top:1px solid #e5e9f2}
      .xc-ai-sources a{display:block;margin:6px 0;overflow-wrap:anywhere}
      @media(max-width:640px){.xc-ai-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installCard() {
    if (document.getElementById('xcAiCoachCard')) return;
    const recommendations = document.getElementById('coachRecommendations');
    const hostCard = recommendations?.closest('.card');
    if (!hostCard?.parentElement) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'xcAiCoachCard';
    card.innerHTML = `
      <div class="card-head">
        <div>
          <h3>AI science coach</h3>
          <div class="sub">Anonymized team data plus current peer-reviewed endurance research</div>
        </div>
        <button type="button" class="primary" id="refreshAiCoach">Refresh research</button>
      </div>
      <div class="insight" style="margin-bottom:14px"><strong>Privacy first.</strong><p>Athlete names are removed before analysis. Recommendations are coaching support, not medical diagnosis.</p></div>
      <div id="xcAiCoachStatus" class="sub" aria-live="polite">No AI analysis yet.</div>
      <div id="xcAiCoachOutput" style="margin-top:14px"></div>
    `;
    hostCard.parentElement.insertBefore(card, hostCard);
    document.getElementById('refreshAiCoach')?.addEventListener('click', () => refresh(true));
  }

  function render(data, cachedAt) {
    const output = document.getElementById('xcAiCoachOutput');
    const status = document.getElementById('xcAiCoachStatus');
    if (!output || !status) return;

    if (!data || typeof data !== 'object') {
      output.textContent = '';
      status.textContent = 'AI analysis was not available.';
      return;
    }

    const score = Number.isFinite(Number(data.winningScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.winningScore)))) : null;
    const priorities = Array.isArray(data.priorities) ? data.priorities : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];

    output.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'xc-ai-summary';
    summary.innerHTML = `
      <div class="xc-ai-metric"><span class="sub">Winning trajectory</span><strong>${score == null ? '—' : `${score}/100`}</strong></div>
      <div class="xc-ai-metric"><span class="sub">Priority actions</span><strong>${priorities.length}</strong></div>
      <div class="xc-ai-metric"><span class="sub">Research sources</span><strong>${sources.length}</strong></div>
    `;
    output.appendChild(summary);

    if (data.summary) {
      const callout = document.createElement('div');
      callout.className = 'insight';
      const strong = document.createElement('strong');
      strong.textContent = data.headline || 'Program outlook';
      const paragraph = document.createElement('p');
      paragraph.textContent = data.summary;
      callout.append(strong, paragraph);
      output.appendChild(callout);
    }

    priorities.forEach((priority, index) => {
      const section = document.createElement('section');
      section.className = 'xc-ai-priority';
      const heading = document.createElement('h4');
      heading.textContent = `${index + 1}. ${priority.title || 'Coaching priority'}`;
      section.appendChild(heading);
      [['Finding', priority.finding], ['Why it matters', priority.why], ['Action', priority.action], ['Measure', priority.measure], ['Evidence', priority.evidence]].forEach(([label, value]) => {
        if (!value) return;
        const paragraph = document.createElement('p');
        const prefix = document.createElement('span');
        prefix.className = 'xc-ai-label';
        prefix.textContent = `${label}: `;
        paragraph.append(prefix, document.createTextNode(String(value)));
        section.appendChild(paragraph);
      });
      output.appendChild(section);
    });

    if (sources.length) {
      const sourceBox = document.createElement('div');
      sourceBox.className = 'xc-ai-sources';
      const title = document.createElement('strong');
      title.textContent = 'Research used';
      sourceBox.appendChild(title);
      sources.forEach((source) => {
        if (!source?.url) return;
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title || source.url;
        sourceBox.appendChild(link);
      });
      output.appendChild(sourceBox);
    }

    status.textContent = cachedAt ? `Updated ${new Date(cachedAt).toLocaleString()}. Automatically refreshes weekly when the app is opened.` : 'Analysis complete.';
  }

  async function refresh(force = false) {
    const status = document.getElementById('xcAiCoachStatus');
    const button = document.getElementById('refreshAiCoach');
    const cache = readJson(CACHE_KEY, null);

    if (!force && cache?.createdAt && Date.now() - new Date(cache.createdAt).getTime() < REFRESH_INTERVAL_MS) {
      render(cache.data, cache.createdAt);
      return;
    }

    const snapshot = anonymizedSnapshot();
    if (!snapshot.team.athleteCount) {
      if (status) status.textContent = 'Add athletes before requesting AI coaching analysis.';
      return;
    }

    if (status) status.textContent = 'Reviewing team trends and current endurance research…';
    if (button) button.disabled = true;

    try {
      const response = await fetch('/api/coach-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'AI coaching request failed.');
      const createdAt = new Date().toISOString();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ createdAt, data: payload }));
      render(payload, createdAt);
    } catch (error) {
      if (status) status.textContent = error.message || 'AI coaching analysis could not be loaded.';
      if (cache?.data) render(cache.data, cache.createdAt);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function install() {
    addStyles();
    installCard();
    const cache = readJson(CACHE_KEY, null);
    if (cache?.data) render(cache.data, cache.createdAt);
    refresh(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

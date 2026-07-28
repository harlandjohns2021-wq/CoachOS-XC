(() => {
  'use strict';

  const APP_KEY = 'coachos_xc_v2';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const CACHE_KEY = 'xccommand_ai_coach_cache_v2';
  const FEEDBACK_KEY = 'xccommand_ai_feedback_v1';
  const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_RETRIES = 2;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readState() {
    return readJson(APP_KEY, { athletes: [], results: [], attendance: {}, practices: [], settings: {} });
  }

  function aiSettings() {
    const settings = readState().settings || {};
    const aiScope = {
      teamTrends: settings.aiScope?.teamTrends !== false,
      athleteTrends: settings.aiScope?.athleteTrends !== false,
      workloadBalance: settings.aiScope?.workloadBalance !== false,
      raceReadiness: settings.aiScope?.raceReadiness !== false,
      coachQueries: settings.aiScope?.coachQueries !== false
    };
    if (!Object.values(aiScope).some(Boolean)) aiScope.teamTrends = true;
    return {
      role: settings.aiRole === 'assistant_coach' ? 'assistant_coach' : 'head_coach',
      athleteDetail: settings.aiAthleteDetail === 'anonymized' ? 'anonymized' : 'team_only',
      scope: aiScope
    };
  }

  function anonymizedSnapshot() {
    const state = readState();
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

  function dataSufficiency(snapshot) {
    const insufficiencies = [];
    if ((snapshot.team?.athleteCount || 0) < 5) insufficiencies.push('At least 5 active athletes are recommended for reliable team-level AI analysis.');
    if ((snapshot.results || []).length < Math.max(8, Math.ceil((snapshot.team?.athleteCount || 0) * 1.2))) insufficiencies.push('Record more timed efforts to strengthen trend and readiness confidence.');
    if ((snapshot.practices || []).length < 4) insufficiencies.push('Log at least 4 recent practices to improve workload and progression analysis.');
    if ((snapshot.attendance || []).length < 3) insufficiencies.push('Mark attendance on multiple days to support consistency insights.');
    return insufficiencies;
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
      .xc-ai-inline-list{margin-top:10px;padding:10px;border-radius:10px;background:#f7f9fc}
      .xc-ai-feedback{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
      .xc-ai-feedback button{border:1px solid #d8deea;background:#fff;border-radius:999px;padding:5px 10px;cursor:pointer}
      .xc-ai-feedback .active{border-color:#0b1739;background:#eef2ff}
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
          <div class="sub">Role-aware, anonymized decision support with evidence links</div>
        </div>
        <button type="button" class="primary" id="refreshAiCoach">Refresh research</button>
      </div>
      <div class="insight" style="margin-bottom:14px"><strong>Privacy first.</strong><p>Athlete names are removed before analysis. AI output supports decisions and never replaces coach judgment.</p></div>
      <div id="xcAiCoachStatus" class="sub" aria-live="polite">No AI analysis yet.</div>
      <div id="xcAiCoachOutput" style="margin-top:14px"></div>
    `;
    hostCard.parentElement.insertBefore(card, hostCard);
    document.getElementById('refreshAiCoach')?.addEventListener('click', () => refresh(true));
    card.addEventListener('click', handleFeedbackClick);
  }

  function feedbackStore() {
    return readJson(FEEDBACK_KEY, { byKey: {} });
  }

  function feedbackSummary() {
    const byKey = feedbackStore().byKey || {};
    const values = Object.values(byKey);
    return {
      accepted: values.reduce((sum, item) => sum + Number(item.accepted || 0), 0),
      rejected: values.reduce((sum, item) => sum + Number(item.rejected || 0), 0),
      trackedRecommendations: values.length
    };
  }

  function feedbackKey(priority) {
    return `${priority?.title || 'priority'}|${priority?.action || ''}`.slice(0, 240);
  }

  function setFeedback(key, value) {
    const store = feedbackStore();
    const current = store.byKey[key] || { accepted: 0, rejected: 0, last: null, updatedAt: null };
    if (current.last === value) return;
    if (value === 'accepted') current.accepted += 1;
    if (value === 'rejected') current.rejected += 1;
    current.last = value;
    current.updatedAt = new Date().toISOString();
    store.byKey[key] = current;
    writeJson(FEEDBACK_KEY, store);
  }

  function handleFeedbackClick(event) {
    const button = event.target.closest('[data-feedback-key]');
    if (!button) return;
    setFeedback(button.dataset.feedbackKey, button.dataset.feedbackValue);
    const cache = readJson(CACHE_KEY, null);
    render(cache?.data, cache?.createdAt, cache?.meta);
  }

  function createLine(label, value) {
    if (!value) return null;
    const paragraph = document.createElement('p');
    const prefix = document.createElement('span');
    prefix.className = 'xc-ai-label';
    prefix.textContent = `${label}: `;
    paragraph.append(prefix, document.createTextNode(String(value)));
    return paragraph;
  }

  function render(data, cachedAt, meta = {}) {
    const output = document.getElementById('xcAiCoachOutput');
    const status = document.getElementById('xcAiCoachStatus');
    if (!output || !status) return;

    if (!data || typeof data !== 'object') {
      output.textContent = '';
      status.textContent = 'AI analysis was not available.';
      return;
    }

    const settings = aiSettings();
    const score = Number.isFinite(Number(data.winningScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.winningScore)))) : null;
    const priorities = Array.isArray(data.priorities) ? data.priorities : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const insufficiencies = Array.isArray(data.insufficientData) ? data.insufficientData : [];
    const athleteTrends = Array.isArray(data.athleteTrends) ? data.athleteTrends : [];

    output.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'xc-ai-summary';
    summary.innerHTML = `
      <div class="xc-ai-metric"><span class="sub">Winning trajectory</span><strong>${score == null ? '—' : `${score}/100`}</strong></div>
      <div class="xc-ai-metric"><span class="sub">Priority actions</span><strong>${priorities.length}</strong></div>
      <div class="xc-ai-metric"><span class="sub">Research sources</span><strong>${sources.length}</strong></div>
    `;
    output.appendChild(summary);

    const scopeBox = document.createElement('div');
    scopeBox.className = 'xc-ai-inline-list';
    const scopeText = (data.scopeCoverage || []).length ? data.scopeCoverage.join(' • ') : Object.entries(settings.scope).filter(([, on]) => on).map(([name]) => name).join(' • ');
    scopeBox.textContent = `Scope: ${scopeText || 'teamTrends'} | Role view: ${settings.role === 'assistant_coach' ? 'Assistant coach' : 'Head coach'}`;
    output.appendChild(scopeBox);

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

    if (insufficiencies.length) {
      const box = document.createElement('div');
      box.className = 'insight';
      const title = document.createElement('strong');
      title.textContent = 'Data sufficiency limits';
      box.appendChild(title);
      insufficiencies.forEach((item) => {
        const p = document.createElement('p');
        p.textContent = String(item);
        box.appendChild(p);
      });
      output.appendChild(box);
    }

    priorities.forEach((priority, index) => {
      const section = document.createElement('section');
      section.className = 'xc-ai-priority';
      const heading = document.createElement('h4');
      heading.textContent = `${index + 1}. ${priority.title || 'Coaching priority'}`;
      section.appendChild(heading);
      [
        ['Finding', priority.finding],
        ['Why it matters', priority.why],
        ['Action', priority.action],
        ['Measure', priority.measure],
        ['Evidence', priority.evidence]
      ].forEach(([label, value]) => {
        const line = createLine(label, value);
        if (line) section.appendChild(line);
      });

      const key = feedbackKey(priority);
      const feedback = feedbackStore().byKey?.[key] || { accepted: 0, rejected: 0, last: null };
      const feedbackRow = document.createElement('div');
      feedbackRow.className = 'xc-ai-feedback';
      feedbackRow.innerHTML = `
        <span class="sub">Usefulness:</span>
        <button type="button" data-feedback-key="${key}" data-feedback-value="accepted" class="${feedback.last === 'accepted' ? 'active' : ''}">Useful (${feedback.accepted})</button>
        <button type="button" data-feedback-key="${key}" data-feedback-value="rejected" class="${feedback.last === 'rejected' ? 'active' : ''}">Not useful (${feedback.rejected})</button>
      `;
      section.appendChild(feedbackRow);

      output.appendChild(section);
    });

    if (settings.scope.athleteTrends && settings.athleteDetail === 'anonymized' && settings.role === 'head_coach' && athleteTrends.length) {
      const athleteBox = document.createElement('div');
      athleteBox.className = 'xc-ai-sources';
      const title = document.createElement('strong');
      title.textContent = 'Anonymized athlete trend highlights';
      athleteBox.appendChild(title);
      athleteTrends.slice(0, 8).forEach((row) => {
        const p = document.createElement('p');
        p.textContent = `${row.athleteId || 'Runner'}: ${row.focus || row.trend || 'Trend noted'}. ${row.action || ''}`.trim();
        athleteBox.appendChild(p);
      });
      output.appendChild(athleteBox);
    }

    if (data.workloadBalance) {
      const box = document.createElement('div');
      box.className = 'xc-ai-sources';
      const title = document.createElement('strong');
      title.textContent = 'Workload balance';
      const text = document.createElement('p');
      text.textContent = String(data.workloadBalance);
      box.append(title, text);
      output.appendChild(box);
    }

    if (data.raceReadiness) {
      const box = document.createElement('div');
      box.className = 'xc-ai-sources';
      const title = document.createElement('strong');
      title.textContent = 'Race readiness';
      const text = document.createElement('p');
      text.textContent = String(data.raceReadiness);
      box.append(title, text);
      output.appendChild(box);
    }

    if (Array.isArray(data.coachQueries) && data.coachQueries.length) {
      const box = document.createElement('div');
      box.className = 'xc-ai-sources';
      const title = document.createElement('strong');
      title.textContent = 'Suggested coach queries';
      box.appendChild(title);
      data.coachQueries.forEach((query) => {
        const p = document.createElement('p');
        p.textContent = `• ${query}`;
        box.appendChild(p);
      });
      output.appendChild(box);
    }

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

    status.textContent = cachedAt
      ? `Updated ${new Date(cachedAt).toLocaleString()}. ${meta.retried ? 'Loaded after retry.' : 'Auto-refreshes weekly.'}`
      : 'Analysis complete.';
  }

  async function fetchRecommendations(payload) {
    let error;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch('/api/coach-recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'AI coaching request failed.');
        return { body, retried: attempt > 0 };
      } catch (err) {
        error = err;
        if (attempt < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
    throw error;
  }

  async function refresh(force = false) {
    const status = document.getElementById('xcAiCoachStatus');
    const button = document.getElementById('refreshAiCoach');
    const cache = readJson(CACHE_KEY, null);

    if (!force && cache?.createdAt && Date.now() - new Date(cache.createdAt).getTime() < REFRESH_INTERVAL_MS) {
      render(cache.data, cache.createdAt, cache.meta);
      return;
    }

    const snapshot = anonymizedSnapshot();
    if (!snapshot.team.athleteCount) {
      if (status) status.textContent = 'Add athletes before requesting AI coaching analysis.';
      return;
    }

    const insufficiencies = dataSufficiency(snapshot);
    if (status) status.textContent = insufficiencies.length
      ? `Limited confidence: ${insufficiencies[0]}`
      : 'Reviewing team trends and current endurance research…';
    if (button) button.disabled = true;

    try {
      const payload = {
        snapshot,
        aiSettings: aiSettings(),
        feedbackSummary: feedbackSummary(),
        insufficiencyContext: insufficiencies
      };
      const { body, retried } = await fetchRecommendations(payload);
      const createdAt = new Date().toISOString();
      const next = {
        createdAt,
        data: body,
        meta: { retried }
      };
      writeJson(CACHE_KEY, next);
      render(next.data, createdAt, next.meta);
    } catch (error) {
      if (status) status.textContent = error.message || 'AI coaching analysis could not be loaded.';
      if (cache?.data) render(cache.data, cache.createdAt, cache.meta);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function install() {
    addStyles();
    installCard();
    const cache = readJson(CACHE_KEY, null);
    if (cache?.data) render(cache.data, cache.createdAt, cache.meta);
    refresh(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

(() => {
  'use strict';

  const APP_KEY = 'coachos_xc_v2';
  const RIEGEL_EXPONENT = 1.06;
  const STANDARD_METERS = { '1 Mile': 1609.344, '2 Mile': 3218.688, '3K': 3000, '3200m': 3200, '5K': 5000 };

  function readState() {
    try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; }
    catch { return {}; }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function metersFromDistance(label) {
    if (!label) return null;
    if (STANDARD_METERS[label]) return STANDARD_METERS[label];
    const value = String(label).trim().toLowerCase().replace(/,/g, '');
    let match = value.match(/([0-9]*\.?[0-9]+)\s*(km|k|kilometers?|kilometres?)/);
    if (match) return Number(match[1]) * 1000;
    match = value.match(/([0-9]*\.?[0-9]+)\s*(m|meters?|metres?)$/);
    if (match) return Number(match[1]);
    match = value.match(/([0-9]*\.?[0-9]+)\s*(mi|mile|miles)/);
    if (match) return Number(match[1]) * 1609.344;
    return null;
  }

  function riegelTime(seconds, fromMeters, toMeters) {
    if (!(seconds > 0 && fromMeters > 0 && toMeters > 0)) return null;
    return seconds * Math.pow(toMeters / fromMeters, RIEGEL_EXPONENT);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function dateValue(value) {
    const parsed = new Date(`${value || ''}T12:00:00`).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function attendanceRate(state, athleteId, days = 35) {
    const cutoff = Date.now() - days * 86400000;
    let present = 0;
    let marked = 0;
    Object.entries(state.attendance || {}).forEach(([date, statuses]) => {
      if (dateValue(date) < cutoff) return;
      const status = statuses?.[athleteId];
      if (status === 'Present' || status === 'Absent') {
        marked += 1;
        if (status === 'Present') present += 1;
      }
    });
    return marked ? present / marked : null;
  }

  function targetMeters(athlete) {
    if (Number(athlete.grade) <= 8) return 3200;
    return athlete.sex === 'Female' ? 3000 : 5000;
  }

  function normalizedResults(state, athlete) {
    const target = targetMeters(athlete);
    return (state.results || [])
      .filter((result) => result.athleteId === athlete.id && Number(result.seconds) > 0)
      .map((result) => {
        const meters = Number(result.distanceMeters) || metersFromDistance(result.distance);
        if (!meters) return null;
        return {
          ...result,
          meters,
          targetSeconds: riegelTime(Number(result.seconds), meters, target),
          dateMs: dateValue(result.date)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateMs - b.dateMs);
  }

  function weightedRecentPrediction(rows) {
    const recent = rows.slice(-4);
    if (!recent.length) return null;
    const weights = recent.map((_, index) => index + 1);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    return recent.reduce((sum, row, index) => sum + row.targetSeconds * weights[index], 0) / totalWeight;
  }

  function trendPercent(rows) {
    if (rows.length < 2) return null;
    const recent = rows.slice(-6);
    const split = Math.max(1, Math.floor(recent.length / 2));
    const early = recent.slice(0, split).reduce((sum, row) => sum + row.targetSeconds, 0) / split;
    const lateRows = recent.slice(split);
    const late = lateRows.reduce((sum, row) => sum + row.targetSeconds, 0) / lateRows.length;
    return ((early - late) / early) * 100;
  }

  function enduranceBalance(rows, target) {
    const short = rows.filter((row) => row.meters <= 1800).slice(-2);
    const long = rows.filter((row) => row.meters >= target * 0.9).slice(-2);
    if (!short.length || !long.length) return null;
    const shortPrediction = short.reduce((sum, row) => sum + row.targetSeconds, 0) / short.length;
    const longActual = long.reduce((sum, row) => sum + row.targetSeconds, 0) / long.length;
    return ((longActual - shortPrediction) / shortPrediction) * 100;
  }

  function analyzeRunner(state, athlete) {
    const rows = normalizedResults(state, athlete);
    const attendance = attendanceRate(state, athlete.id);
    const target = targetMeters(athlete);
    const prediction = weightedRecentPrediction(rows);
    const trend = trendPercent(rows);
    const balance = enduranceBalance(rows, target);
    const dataPoints = rows.length;
    let confidence = dataPoints >= 5 && attendance != null ? 'High' : dataPoints >= 2 ? 'Moderate' : 'Low';
    let focus = 'Establish a valid baseline';
    let prescription = `Record two controlled efforts at known distances before assigning individual pace targets.`;
    let rationale = 'The engine will not manufacture precision from one performance.';

    if (dataPoints >= 2) {
      if (attendance != null && attendance < 0.8) {
        focus = 'Training consistency';
        prescription = 'Keep intensity conservative and prioritize regular easy running, strides, and attendance before adding workout volume.';
        rationale = `Recent attendance is ${Math.round(attendance * 100)}%; inconsistent exposure limits adaptation more than another hard session can repair.`;
      } else if (trend != null && trend < -2) {
        focus = 'Recovery and load review';
        prescription = 'Reduce the next hard-session volume, preserve easy frequency, and reassess after 3–5 days. Do not schedule consecutive hard days.';
        rationale = `Equivalent race performance has declined ${Math.abs(trend).toFixed(1)}% across recent tests, a signal to review fatigue rather than prescribe punishment.`;
      } else if (balance != null && balance > 4) {
        focus = 'Aerobic endurance and threshold durability';
        prescription = 'Use one controlled threshold session weekly, a progressive long aerobic run, and predominantly easy running. Keep repetitions even rather than racing practice.';
        rationale = `Long-course performance is ${balance.toFixed(1)}% slower than short-distance performance predicts, suggesting aerobic durability is the larger opportunity.`;
      } else if (balance != null && balance < -2) {
        focus = 'Running economy and speed reserve';
        prescription = 'Maintain aerobic volume while adding strides, short hill sprints with full recovery, and 1–2 brief strength sessions each week.';
        rationale = `Long-course performance is stronger than the short-distance profile predicts, so economy and speed reserve may produce more gain than extra threshold volume.`;
      } else if (trend != null && trend > 1.5) {
        focus = 'Continue current progression';
        prescription = 'Keep the present training pattern, progress only one variable at a time, and retain mostly low-intensity running.';
        rationale = `Equivalent race performance has improved ${trend.toFixed(1)}%; successful training should be preserved before being made more complicated.`;
      } else {
        focus = 'Balanced development';
        prescription = 'Use a mostly easy week with one threshold-oriented session, one race-specific or hill session, and separated recovery days.';
        rationale = 'The current profile does not show a large speed-endurance imbalance, so balanced development is preferable to aggressive specialization.';
      }
    }

    return { athlete, target, rows, prediction, trend, balance, attendance, confidence, focus, prescription, rationale };
  }

  function targetLabel(meters) {
    if (meters === 3000) return '3K';
    if (meters === 3200) return '3200m';
    if (meters === 5000) return '5K';
    return `${meters}m`;
  }

  function addStyles() {
    if (document.getElementById('individualScienceStyles')) return;
    const style = document.createElement('style');
    style.id = 'individualScienceStyles';
    style.textContent = `
      .runner-science-card{border:1px solid #d8deea;border-radius:14px;padding:15px;margin:12px 0;background:#fff}
      .runner-science-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .runner-science-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
      .runner-science-metric{background:#f7f9fc;border-radius:10px;padding:9px}.runner-science-metric strong{display:block;margin-top:3px;color:#0b1739}
      .runner-science-card p{line-height:1.5;margin:7px 0}
      @media(max-width:700px){.runner-science-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    const insights = document.getElementById('insights');
    const improversCard = document.getElementById('topImprovers')?.closest('.card');
    if (!insights || !improversCard || document.getElementById('individualScienceCard')) return;
    addStyles();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'individualScienceCard';
    card.innerHTML = `
      <div class="card-head"><div><h3>Individual physiology profiles</h3><div class="sub">Distance-normalized trends, attendance, race-demand balance, and confidence-aware recommendations</div></div><span class="pill good">Science engine</span></div>
      <div class="insight"><strong>Transparent formulas, not mystery scores.</strong><p>Race performances are normalized with the Riegel endurance model (exponent 1.06), weighted toward recent results, then interpreted with attendance and short-versus-long race balance. Predictions are estimates, not laboratory measurements.</p></div>
      <div id="individualScienceOutput"></div>`;
    improversCard.parentElement.insertBefore(card, improversCard.nextSibling);
    render();

    const observer = new MutationObserver(() => render());
    observer.observe(document.getElementById('athleteTable') || document.body, { childList: true, subtree: true });
  }

  function render() {
    const output = document.getElementById('individualScienceOutput');
    if (!output) return;
    const state = readState();
    const analyses = (state.athletes || []).filter((athlete) => athlete.active !== false).map((athlete) => analyzeRunner(state, athlete));
    if (!analyses.length) {
      output.innerHTML = '<div class="empty">Add athletes and recorded efforts to build individual physiology profiles.</div>';
      return;
    }
    output.innerHTML = analyses.map((item) => `
      <article class="runner-science-card">
        <div class="runner-science-head"><div><div class="name">${esc(item.athlete.name)}</div><div class="meta">${esc(item.athlete.sex)} • Grade ${esc(item.athlete.grade)} • Target ${targetLabel(item.target)}</div></div><span class="pill ${item.confidence === 'High' ? 'good' : item.confidence === 'Low' ? 'warn' : ''}">${item.confidence} confidence</span></div>
        <div class="runner-science-metrics">
          <div class="runner-science-metric"><span class="sub">Projected ${targetLabel(item.target)}</span><strong>${formatTime(item.prediction)}</strong></div>
          <div class="runner-science-metric"><span class="sub">Recent trend</span><strong>${item.trend == null ? '—' : `${item.trend >= 0 ? '+' : ''}${item.trend.toFixed(1)}%`}</strong></div>
          <div class="runner-science-metric"><span class="sub">Attendance</span><strong>${item.attendance == null ? '—' : `${Math.round(item.attendance * 100)}%`}</strong></div>
          <div class="runner-science-metric"><span class="sub">Valid efforts</span><strong>${item.rows.length}</strong></div>
        </div>
        <p><strong>Primary focus:</strong> ${esc(item.focus)}</p>
        <p><strong>Coach prescription:</strong> ${esc(item.prescription)}</p>
        <p><strong>Physiology rationale:</strong> ${esc(item.rationale)}</p>
      </article>`).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

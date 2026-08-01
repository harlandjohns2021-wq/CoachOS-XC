const XC_SEASON_RESET_APPLIED = (() => {
  'use strict';

  const STORAGE_KEY = 'coachos_xc_v2';
  const LEGACY_KEY = 'coachos_xc_v1';
  const RESET_KEY = 'xccommand_season_reset_2026_08_01_v1';
  const BACKUP_KEY = 'xccommand_backup_before_2026_08_01_reset';
  const PRACTICE_KEY = 'xccommand_practice_details_v1';
  const TEAM_KEY = 'xccommand_team_assignments_v1';
  const SELECTED_TEAM_KEY = 'xccommand_selected_practice_team_v1';

  if (localStorage.getItem(RESET_KEY)) return false;

  const highSchool = [
    ['Tony Hernandez', '6:05'],
    ['Chris Jimnez', ''],
    ['Yaretzi Prado', ''],
    ['Claire Scoggins', '7:00'],
    ['Julian Garcia', ''],
    ['Molly Bloomer', '8:04'],
    ['Paisley Bloomer', '8:14'],
    ['Daena Salazar', '7:31'],
    ['Delainy Torres', '8:32'],
    ['Ivan Olvera', '6:50'],
    ['Lukas Marshall', '6:23'],
    ['Bianca Aguilar', '8:42'],
    ['Aaron Klump', '6:50'],
    ['Gerardo Hernandez', ''],
    ['Katherine Orsorto', ''],
    ['Jackie Arellano', ''],
    ['Jesus Cordova', '']
  ];

  const juniorHigh = [
    ['Cynthia Hernandez', ''],
    ['Nicole Hernandez', '8:18'],
    ['Lia Ayala', '9:09'],
    ['Abel Green', '5:47'],
    ['Aiden Green', '7:51'],
    ['Isaac Ates', ''],
    ['Conner Shumate', '11:00'],
    ['Julian Wario', ''],
    ['McKaelah Segura', ''],
    ['Miranda Lierra', ''],
    ['AJ Green', '8:41'],
    ['Tess Scoggins', '8:31'],
    ['Kynlee Cheek', '10:41'],
    ['Jaelle Rocha', '9:24'],
    ['Sumaya Romero', '9:01'],
    ['Aliyah Torres', '8:00'],
    ['Emmett Thomas', '8:55'],
    ['Zachary Dunn', '8:00'],
    ['Martin Williams', '8:57'],
    ['Roan Clark', '6:38'],
    ['Jameson Nichols', '9:15']
  ];

  function safeJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function slug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function seconds(value) {
    if (!value) return null;
    const [minutes, secs] = value.split(':').map(Number);
    return Number.isFinite(minutes) && Number.isFinite(secs) ? minutes * 60 + secs : null;
  }

  const previous = safeJson(localStorage.getItem(STORAGE_KEY), null);
  if (previous && !localStorage.getItem(BACKUP_KEY)) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(previous));
  }

  const priorSettings = previous?.settings && typeof previous.settings === 'object'
    ? previous.settings
    : {};

  const createdAt = '2026-08-01T19:11:00.000Z';
  const athletes = [];
  const results = [];

  function addRoster(rows, level) {
    rows.forEach(([name, time]) => {
      const athleteId = `${level === 'HS' ? 'hs' : 'jh'}_${slug(name)}`;
      athletes.push({
        id: athleteId,
        name,
        sex: 'Unassigned',
        grade: level,
        teamId: 'all',
        active: true,
        createdAt
      });

      const totalSeconds = seconds(time);
      if (totalSeconds == null) return;
      results.push({
        id: `baseline_${athleteId}`,
        athleteId,
        distance: '1 Mile',
        seconds: totalSeconds,
        date: '2026-08-01',
        source: 'Practice',
        meetName: 'Aug. 1 Mile Benchmark',
        isPR: true,
        createdAt
      });
    });
  }

  addRoster(highSchool, 'HS');
  addRoster(juniorHigh, 'JH');

  const nextState = {
    version: 2,
    settings: {
      teamName: priorSettings.teamName || 'Harts Bluff XC',
      season: '2026 XC',
      coachName: priorSettings.coachName || '',
      aiRole: priorSettings.aiRole || 'head_coach',
      aiAthleteDetail: priorSettings.aiAthleteDetail || 'team_only',
      aiScope: {
        teamTrends: priorSettings.aiScope?.teamTrends ?? true,
        athleteTrends: priorSettings.aiScope?.athleteTrends ?? true,
        workloadBalance: priorSettings.aiScope?.workloadBalance ?? true,
        raceReadiness: priorSettings.aiScope?.raceReadiness ?? true,
        coachQueries: priorSettings.aiScope?.coachQueries ?? true
      }
    },
    athletes,
    results,
    attendance: {},
    practices: []
  };

  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(PRACTICE_KEY);
  localStorage.removeItem(TEAM_KEY);
  localStorage.removeItem(SELECTED_TEAM_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  localStorage.setItem(RESET_KEY, JSON.stringify({
    appliedAt: new Date().toISOString(),
    athletes: athletes.length,
    results: results.length
  }));

  window.location.reload();
  return true;
})();

if (!XC_SEASON_RESET_APPLIED) {
(() => {
  'use strict';

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SUPPORTED_INPUT_TYPES = new Set(['text', 'search', 'tel', 'url', 'email', 'number']);
  let activeRecognition = null;
  let activeButton = null;

  function addStyles() {
    if (document.getElementById('xcSpeechStyles')) return;
    const style = document.createElement('style');
    style.id = 'xcSpeechStyles';
    style.textContent = `
      .xc-speech-wrap{display:flex;gap:8px;align-items:stretch;width:100%}
      .xc-speech-wrap>input,.xc-speech-wrap>textarea,.xc-speech-wrap>select{flex:1;min-width:0}
      .xc-speech-btn{flex:0 0 auto;min-width:42px;padding:8px 10px;border:1px solid #d8deea;border-radius:10px;background:#fff;color:#0b1739;cursor:pointer;font:inherit;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center}
      .xc-speech-btn:hover{background:#f4f6fa}
      .xc-speech-btn.listening{background:#0b1739;color:#fff;border-color:#0b1739}
      .xc-speech-btn:disabled{opacity:.45;cursor:not-allowed}
      .xc-speech-status{font-size:12px;color:#667085;margin-top:5px}
      @media(max-width:480px){.xc-speech-btn{min-width:44px}}
    `;
    document.head.appendChild(style);
  }

  function labelFor(control) {
    if (control.id) {
      const label = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (label) return label.textContent.trim();
    }
    const field = control.closest('.field');
    const label = field?.querySelector('label');
    return label?.textContent.trim() || control.getAttribute('aria-label') || control.placeholder || 'field';
  }

  function shouldEnhance(control) {
    if (control.dataset.noSpeech === 'true' || control.dataset.speechEnhanced === 'true') return false;
    if (control.disabled || control.readOnly) return false;
    if (control.tagName === 'TEXTAREA' || control.tagName === 'SELECT') return true;
    if (control.tagName === 'INPUT') return SUPPORTED_INPUT_TYPES.has((control.type || 'text').toLowerCase());
    return false;
  }

  function dispatchInputEvents(control) {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function normalizeSpokenTime(text) {
    let value = text.trim().toLowerCase();
    value = value.replace(/minutes?|mins?/g, ':').replace(/seconds?|secs?/g, '');
    value = value.replace(/\s+/g, ' ').trim();
    const clockMatch = value.match(/^(\d{1,2})\s*[: ]\s*(\d{1,2})$/);
    if (clockMatch) return `${clockMatch[1]}:${String(clockMatch[2]).padStart(2, '0')}`;
    return text.trim();
  }

  function applyTranscript(control, transcript) {
    const clean = transcript.trim();
    if (!clean) return false;

    if (control.tagName === 'SELECT') {
      const spoken = clean.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
      const options = [...control.options];
      const exact = options.find((option) => option.textContent.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim() === spoken);
      const partial = options.find((option) => {
        const label = option.textContent.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
        return label.includes(spoken) || spoken.includes(label);
      });
      const match = exact || partial;
      if (!match) return false;
      control.value = match.value;
      dispatchInputEvents(control);
      return true;
    }

    let value = clean;
    if (control.matches('[data-time-athlete]')) value = normalizeSpokenTime(clean);

    if (control.tagName === 'TEXTAREA') {
      const separator = control.value.trim() ? (control.id === 'rosterPaste' ? '\n' : ' ') : '';
      control.value = `${control.value}${separator}${value}`;
    } else {
      control.value = value;
    }
    dispatchInputEvents(control);
    return true;
  }

  function setStatus(button, message) {
    const status = button.closest('.xc-speech-wrap')?.nextElementSibling;
    if (status?.classList.contains('xc-speech-status')) status.textContent = message;
  }

  function stopActiveRecognition() {
    if (!activeRecognition) return;
    try { activeRecognition.stop(); } catch {}
  }

  function startListening(control, button) {
    if (!Recognition) {
      setStatus(button, 'Speech-to-text is not supported by this browser.');
      return;
    }

    if (activeRecognition) stopActiveRecognition();

    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    activeRecognition = recognition;
    activeButton = button;

    recognition.onstart = () => {
      button.classList.add('listening');
      button.textContent = '■';
      button.setAttribute('aria-label', `Stop listening for ${labelFor(control)}`);
      setStatus(button, 'Listening…');
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const applied = applyTranscript(control, transcript);
      setStatus(button, applied ? `Heard: “${transcript}”` : `Could not match “${transcript}” to this field.`);
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone permission was denied.',
        'audio-capture': 'No microphone was available.',
        'no-speech': 'No speech was detected.',
        network: 'Speech recognition could not reach its service.'
      };
      setStatus(button, messages[event.error] || 'Speech recognition stopped unexpectedly.');
    };

    recognition.onend = () => {
      button.classList.remove('listening');
      button.textContent = '🎙';
      button.setAttribute('aria-label', `Speak to fill ${labelFor(control)}`);
      if (activeRecognition === recognition) activeRecognition = null;
      if (activeButton === button) activeButton = null;
    };

    try {
      recognition.start();
    } catch {
      setStatus(button, 'Speech recognition is already starting.');
    }
  }

  function enhanceControl(control) {
    if (!shouldEnhance(control)) return;
    control.dataset.speechEnhanced = 'true';

    const parent = control.parentElement;
    if (!parent) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'xc-speech-wrap';
    parent.insertBefore(wrapper, control);
    wrapper.appendChild(control);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xc-speech-btn';
    button.textContent = '🎙';
    button.setAttribute('aria-label', `Speak to fill ${labelFor(control)}`);
    button.title = `Speak to fill ${labelFor(control)}`;
    if (!Recognition) {
      button.disabled = true;
      button.title = 'Speech-to-text is not supported by this browser';
    }
    wrapper.appendChild(button);

    const status = document.createElement('div');
    status.className = 'xc-speech-status';
    status.setAttribute('aria-live', 'polite');
    parent.insertBefore(status, wrapper.nextSibling);

    button.addEventListener('click', () => {
      if (activeButton === button && activeRecognition) stopActiveRecognition();
      else startListening(control, button);
    });
  }

  function scan(root = document) {
    root.querySelectorAll('input, textarea, select').forEach(enhanceControl);
  }

  function observeDynamicControls() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('input, textarea, select')) enhanceControl(node);
          scan(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  addStyles();
  scan();
  observeDynamicControls();
})();

import('./season-reset-cloud.js')
  .then(({ prepareSeasonResetCloud }) => prepareSeasonResetCloud())
  .then((status) => {
    if (status?.allowCloudSync !== false) {
      return import('./firebase-cloud.js');
    }
    console.error('XC Command cloud sync was paused to prevent old season data from returning.', status?.error || '');
    return null;
  })
  .catch((error) => console.error('XC Command season reset/cloud preparation failed.', error));
import('./distance-enhancements.js').catch((error) => console.error('XC Command distance enhancements failed to load.', error));
import('./ai-coach.js').catch((error) => console.error('XC Command AI coach failed to load.', error));
import('./individual-science-engine.js').catch((error) => console.error('XC Command individual science engine failed to load.', error));
}

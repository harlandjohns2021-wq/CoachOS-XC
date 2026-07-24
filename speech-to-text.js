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

import('./firebase-cloud.js').catch((error) => console.error('XC Command cloud module failed to load.', error));
import('./distance-enhancements.js').catch((error) => console.error('XC Command distance enhancements failed to load.', error));
import('./ai-coach.js').catch((error) => console.error('XC Command AI coach failed to load.', error));

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'app.js',
  'app-modules.js',
  'data-integrity-fixes.js',
  'firebase-cloud.js',
  'sync-core.js',
  'distance-enhancements.js',
  'distance-core.js',
  'past-seasons.js',
  'readability.js',
  'ai-coach.js',
  'individual-science-engine.js',
  'speech-to-text.js',
  'sw.js',
  'firestore.rules'
];

const contents = {};
for (const file of requiredFiles) {
  contents[file] = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(contents[file].trim().length > 0, `${file} must not be empty`);
}

assert.ok(!contents['speech-to-text.js'].includes('SpeechRecognition'), 'speech recognition code must remain removed');
assert.ok(!contents['speech-to-text.js'].includes('🎙'), 'microphone icons must remain removed');
assert.ok(contents['speech-to-text.js'].includes("import('./app-modules.js')"), 'startup loader must run');
assert.ok(contents['app-modules.js'].includes("import('./firebase-cloud.js')"), 'Firebase module must load');
assert.ok(contents['app-modules.js'].includes("import('./distance-enhancements.js')"), 'distance and history modules must load');
assert.ok(contents['app-modules.js'].includes("import('./ai-coach.js')"), 'AI coach must load');
assert.ok(contents['firebase-cloud.js'].includes('runTransaction'), 'cloud writes must use Firestore transactions');
assert.ok(contents['firebase-cloud.js'].includes("from './sync-core.js'"), 'cloud sync must use tested shared merge logic');
assert.ok(contents['sw.js'].includes("'./app-modules.js'"), 'service worker must cache startup loader');
assert.ok(contents['sw.js'].includes("'./sync-core.js'"), 'service worker must cache sync core');
assert.ok(contents['sw.js'].includes("'./data-integrity-fixes.js'"), 'service worker must cache integrity layer');
assert.ok(contents['sw.js'].includes("event.request.mode === 'navigate'"), 'offline HTML fallback must be navigation-only');
assert.ok(contents['firestore.rules'].includes('request.auth.uid'), 'Firestore rules must require authentication');

console.log(JSON.stringify({
  status: 'passed',
  filesChecked: requiredFiles.length
}, null, 2));

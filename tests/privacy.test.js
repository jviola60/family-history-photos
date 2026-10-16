import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  migrateSecretsFromLocalStorage,
  partitionAiSettings,
  buildFalUploadConfirmMessage,
  confirmFalPhotoUpload,
  saveAiSettings,
  getAiSettings,
  forgetAiSecrets
} from '../src/lib/aiSettings.js';
import { collectStorageKeysToClear, AI_SETTINGS_KEY, AI_SECRETS_KEY } from '../src/lib/browserData.js';

const DEMO_CLIENT_ID = '23f66817-f4a4-4367-93ae-c9dfadba2a57';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    key(index) { return [...map.keys()][index] ?? null; },
    get length() { return map.size; }
  };
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, acc);
    else if (/\.(js|jsx|py|html|yml|md|css)$/.test(name)) acc.push(path);
  }
  return acc;
}

test('demo Microsoft client id is not hardcoded', () => {
  const root = join(import.meta.dirname, '..');
  const hits = [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'ai_service')),
    join(root, 'index.html'),
    join(root, 'vite.config.js'),
    join(root, 'README.md')
  ].filter((path) => readFileSync(path, 'utf8').includes(DEMO_CLIENT_ID));
  assert.deepEqual(hits, []);
});

test('Fal confirm message names the photo and the third party', () => {
  const message = buildFalUploadConfirmMessage('Grandma_porch.jpg');
  assert.match(message, /Grandma_porch\.jpg/);
  assert.match(message, /third-party server \(fal\.ai\)/);
  assert.match(message, /leave this device/);
});

test('Fal upload is refused unless confirm returns true', () => {
  assert.equal(confirmFalPhotoUpload('a.jpg', () => false), false);
  assert.equal(confirmFalPhotoUpload('a.jpg', () => undefined), false);
  assert.equal(confirmFalPhotoUpload('a.jpg', () => true), true);
});

test('API keys are removed from local settings and kept for the session', () => {
  const local = memoryStorage({
    [AI_SETTINGS_KEY]: JSON.stringify({
      provider: 'fal',
      falApiKey: 'id:secret',
      replicateApiKey: 'rep-key',
      falModel: 'fal-ai/codeformer'
    })
  });
  const session = memoryStorage();
  const migrated = migrateSecretsFromLocalStorage(local, session);
  assert.equal(migrated.falApiKey, 'id:secret');
  const stored = JSON.parse(local.getItem(AI_SETTINGS_KEY));
  assert.equal(stored.falApiKey, undefined);
  assert.equal(stored.replicateApiKey, undefined);
  assert.equal(stored.provider, 'fal');
  assert.equal(stored.falModel, 'fal-ai/codeformer');
  const secrets = JSON.parse(session.getItem(AI_SECRETS_KEY));
  assert.equal(secrets.falApiKey, 'id:secret');
  assert.equal(secrets.replicateApiKey, 'rep-key');
});

test('partition never leaves secret fields in the durable copy', () => {
  const { rest, secrets } = partitionAiSettings({ falApiKey: 'abc', provider: 'self_contained' });
  assert.equal(rest.falApiKey, undefined);
  assert.equal(rest.provider, 'self_contained');
  assert.equal(secrets.falApiKey, 'abc');
});

test('clear-data key list includes drafts and AI settings', () => {
  const keys = collectStorageKeysToClear([
    'fhp_draft_photo1',
    'family_history_ai_settings',
    'family_history_ai_secrets',
    'unrelated'
  ]);
  assert.deepEqual(keys, [
    'fhp_draft_photo1',
    'family_history_ai_settings',
    'family_history_ai_secrets'
  ]);
});

test('saveAiSettings does not write the Fal key into localStorage', () => {
  let local;
  let session;
  try {
    local = globalThis.localStorage;
    session = globalThis.sessionStorage;
  } catch {
    return;
  }
  if (!local || !session) return;
  local.removeItem(AI_SETTINGS_KEY);
  session.removeItem(AI_SECRETS_KEY);
  saveAiSettings({ provider: 'self_contained', falApiKey: 'tab:only' });
  const durable = JSON.parse(local.getItem(AI_SETTINGS_KEY) || '{}');
  assert.equal(durable.falApiKey, undefined);
  assert.equal(getAiSettings().falApiKey, 'tab:only');
  forgetAiSecrets();
  local.removeItem(AI_SETTINGS_KEY);
  session.removeItem(AI_SECRETS_KEY);
});

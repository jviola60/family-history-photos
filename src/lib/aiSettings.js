import { fal } from '@fal-ai/client';
import { AI_SECRETS_KEY, AI_SETTINGS_KEY } from './browserData.js';

/**
 * AI provider settings.
 * Non-secret preferences stay in localStorage.
 * The Fal API key is kept in memory and sessionStorage only, and any copy
 * found in localStorage is deleted on load.
 */

const SETTINGS_KEY = AI_SETTINGS_KEY;
const SECRETS_KEY = AI_SECRETS_KEY;
const SECRET_FIELDS = ['falApiKey', 'replicateApiKey'];

let memorySecrets = { falApiKey: '', replicateApiKey: '' };

function storageOrNull(name) {
  try {
    const storage = globalThis[name];
    if (!storage || typeof storage.getItem !== 'function') return null;
    storage.getItem('__fhp_probe');
    return storage;
  } catch {
    return null;
  }
}

export function partitionAiSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings
    : {};
  const secrets = { falApiKey: '', replicateApiKey: '' };
  const rest = { ...source };
  for (const field of SECRET_FIELDS) {
    if (typeof source[field] === 'string') secrets[field] = source[field];
    delete rest[field];
  }
  return { rest, secrets };
}

export function migrateSecretsFromLocalStorage(localStore, sessionStore) {
  if (!localStore) return { falApiKey: '', replicateApiKey: '' };
  const raw = localStore.getItem(SETTINGS_KEY);
  if (!raw) return readSessionSecrets(sessionStore);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStore.removeItem(SETTINGS_KEY);
    return readSessionSecrets(sessionStore);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return readSessionSecrets(sessionStore);
  }
  if (!SECRET_FIELDS.some((field) => field in parsed)) {
    return readSessionSecrets(sessionStore);
  }
  const { rest, secrets } = partitionAiSettings(parsed);
  const existing = readSessionSecrets(sessionStore);
  const merged = {
    falApiKey: existing.falApiKey || secrets.falApiKey || '',
    replicateApiKey: existing.replicateApiKey || secrets.replicateApiKey || '',
  };
  if (sessionStore && (merged.falApiKey || merged.replicateApiKey)) {
    sessionStore.setItem(SECRETS_KEY, JSON.stringify(merged));
  }
  localStore.setItem(SETTINGS_KEY, JSON.stringify(rest));
  return merged;
}

function readSessionSecrets(sessionStore) {
  if (!sessionStore) return { falApiKey: '', replicateApiKey: '' };
  try {
    const raw = sessionStore.getItem(SECRETS_KEY);
    if (!raw) return { falApiKey: '', replicateApiKey: '' };
    const parsed = JSON.parse(raw);
    return {
      falApiKey: typeof parsed.falApiKey === 'string' ? parsed.falApiKey : '',
      replicateApiKey: typeof parsed.replicateApiKey === 'string' ? parsed.replicateApiKey : ''
    };
  } catch {
    return { falApiKey: '', replicateApiKey: '' };
  }
}

function loadSecrets() {
  const localStore = storageOrNull('localStorage');
  const sessionStore = storageOrNull('sessionStorage');
  const migrated = migrateSecretsFromLocalStorage(localStore, sessionStore);
  memorySecrets = {
    falApiKey: migrated.falApiKey || memorySecrets.falApiKey || '',
    replicateApiKey: migrated.replicateApiKey || memorySecrets.replicateApiKey || ''
  };
  return memorySecrets;
}

function writeSecrets(secrets) {
  memorySecrets = {
    falApiKey: secrets.falApiKey || '',
    replicateApiKey: secrets.replicateApiKey || ''
  };
  const sessionStore = storageOrNull('sessionStorage');
  if (!sessionStore) return;
  try {
    sessionStore.setItem(SECRETS_KEY, JSON.stringify(memorySecrets));
  } catch {
    // The in-memory copy still lasts for this page.
  }
}

export function forgetAiSecrets() {
  memorySecrets = { falApiKey: '', replicateApiKey: '' };
  const sessionStore = storageOrNull('sessionStorage');
  const localStore = storageOrNull('localStorage');
  try { sessionStore?.removeItem(SECRETS_KEY); } catch { /* ignore */ }
  if (!localStore) return;
  try {
    const raw = localStore.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const { rest } = partitionAiSettings(parsed);
    localStore.setItem(SETTINGS_KEY, JSON.stringify(rest));
  } catch {
    try { localStore.removeItem(SETTINGS_KEY); } catch { /* ignore */ }
  }
}

loadSecrets();

export const FAL_MODELS = [
  {
    id: 'fal-ai/clarity-upscaler',
    name: 'Clarity Ultra-HD (Generative AI)',
    badge: 'Breathtaking Detail',
    cost: '~$0.015 / photo',
    time: '~5-8s',
    desc: 'Replaces blurry pixels with real photorealistic textures: skin pores, eyelashes, hair strands, and fabric weaves.'
  },
  {
    id: 'fal-ai/ccsr',
    name: 'CCSR (Real-World Super-Resolution)',
    badge: 'Full Photo 4K',
    cost: '~$0.005 / photo',
    time: '~3-5s',
    desc: 'Contrastive Continuous Super-Resolution. Restores the entire photograph (background & people) with natural sharpness.'
  },
  {
    id: 'fal-ai/codeformer',
    name: 'CodeFormer (Face Restoration)',
    badge: 'Fast & Cheap',
    cost: '~$0.0015 / photo',
    time: '~1.5s',
    desc: 'Traditional lightweight face-only GAN repair. Best for quick touch-ups on low budgets.'
  }
];

export const DEFAULT_AI_SETTINGS = {
  provider: 'self_contained', // 'self_contained' | 'fal' | 'replicate'
  localFaceModel: 'codeformer', // 'codeformer' | 'gfpgan' | 'none'
  localFidelity: 0.75,
  localRepairScratches: true,
  localScratchStrength: 0.75,
  localRestoreColor: true,
  localDefadeStrength: 0.70,
  localUpscale: true,
  falApiKey: '',
  falModel: 'fal-ai/clarity-upscaler', // Default to Clarity for breathtaking results!
  falFidelity: 0.75, // For CodeFormer (0.0 to 1.0)
  falResemblance: 0.75, // For Clarity (0.0 to 1.0, higher = closer to original face)
  falCreativity: 0.30, // For Clarity (0.0 to 1.0, higher = more fine texture generated)
  replicateApiKey: ''
};

export function getAiSettings() {
  const secrets = loadSecrets();
  try {
    const localStore = storageOrNull('localStorage');
    const raw = localStore ? localStore.getItem(SETTINGS_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    const { rest } = partitionAiSettings(parsed);
    return {
      ...DEFAULT_AI_SETTINGS,
      ...rest,
      falApiKey: secrets.falApiKey || '',
      replicateApiKey: secrets.replicateApiKey || ''
    };
  } catch {
    return {
      ...DEFAULT_AI_SETTINGS,
      falApiKey: secrets.falApiKey || '',
      replicateApiKey: secrets.replicateApiKey || ''
    };
  }
}

export function saveAiSettings(settings) {
  try {
    const merged = { ...getAiSettings(), ...settings };
    const { rest, secrets } = partitionAiSettings(merged);
    const localStore = storageOrNull('localStorage');
    if (localStore) localStore.setItem(SETTINGS_KEY, JSON.stringify(rest));
    writeSecrets(secrets);
    const updated = { ...DEFAULT_AI_SETTINGS, ...rest, ...memorySecrets };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_settings_changed', { detail: updated }));
    }
    return updated;
  } catch (err) {
    console.error('Failed to save AI settings:', err);
    return DEFAULT_AI_SETTINGS;
  }
}

export function buildFalUploadConfirmMessage(photoName) {
  const name = (photoName && String(photoName).trim()) || 'this photo';
  return [
    `Send "${name}" to fal.ai?`,
    '',
    'This photo will be uploaded to a third-party server (fal.ai) for cloud restoration. It will leave this device.',
    'The local engine does not upload photos. Choose Cancel to keep this photo on your device.'
  ].join('\n');
}

export class FalUploadDeclined extends Error {
  constructor() {
    super('The photo was not sent. Cloud restore needs your OK first.');
    this.name = 'FalUploadDeclined';
  }
}

export function confirmFalPhotoUpload(photoName, ask) {
  const message = buildFalUploadConfirmMessage(photoName);
  const askFn = ask || ((text) => {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
    return window.confirm(text);
  });
  return askFn(message) === true;
}

/**
 * Sanitize and clean Fal.ai API key (removes 'export FAL_KEY=', quotes, prefixes)
 */
export function sanitizeFalKey(key) {
  if (!key) return '';
  let cleaned = key.trim();
  cleaned = cleaned.replace(/^export\s+/i, '');
  cleaned = cleaned.replace(/^FAL_KEY\s*[:=]\s*/i, '');
  cleaned = cleaned.replace(/^(Key|Bearer)\s+/i, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  return cleaned;
}

/**
 * Test connectivity with Fal.ai API key
 */
export async function testFalConnection(apiKey) {
  const cleanKey = sanitizeFalKey(apiKey);
  if (!cleanKey) {
    return { success: false, message: 'Please enter a Fal.ai API key first.' };
  }

  const hasColon = cleanKey.includes(':');
  if (!hasColon) {
    return {
      success: false,
      message: "Fal.ai keys must be in 'Key_ID:Key_Secret' format with a colon in the middle. It looks like only one half was copied."
    };
  }

  try {
    // True auth verification: checks if Key ID & Secret exist for a real user
    const res = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file_name: 'ping.txt',
        content_type: 'text/plain'
      })
    });

    if (res.status === 401 || res.status === 403) {
      let detail = 'No user found for Key ID and Secret';
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch {}
      return { 
        success: false, 
        message: `Fal.ai rejected key: "${detail}". Please copy the full Key ID and Secret from fal.ai/dashboard/keys.` 
      };
    }

    if (res.ok) {
      return { success: true, message: 'Connected and verified successfully with Fal.ai!' };
    }

    const errText = await res.text();
    return { success: false, message: `Fal.ai returned status ${res.status}: ${errText.slice(0, 100)}` };
  } catch (err) {
    return { success: false, message: 'Network connection failed: ' + (err.message || 'Unknown network error') };
  }
}

/**
 * Restore image using Cloud AI (Fal.ai CodeFormer)
 */
export async function restoreWithCloudAi(imageSource, settings, onProgress, options = {}) {
  const currentSettings = settings || getAiSettings();

  if (currentSettings.provider === 'fal') {
    const cleanKey = sanitizeFalKey(currentSettings.falApiKey);
    if (!cleanKey) {
      throw new Error('Fal.ai API key is missing. Please enter your key in Settings.');
    }

    if (!confirmFalPhotoUpload(options.photoName, options.ask)) {
      throw new FalUploadDeclined();
    }

    // Configure fal client with user credentials
    fal.config({
      credentials: cleanKey
    });

    let uploadedUrl = imageSource;

    try {
      // If imageSource is a blob: or data: URL, upload it to Fal cloud storage
      if (imageSource.startsWith('blob:') || imageSource.startsWith('data:')) {
        if (onProgress) onProgress('Uploading photo to Fal cloud storage...');
        const response = await fetch(imageSource);
        const blob = await response.blob();
        uploadedUrl = await fal.storage.upload(blob);
      }

      const chosenModelId = currentSettings.falModel || 'fal-ai/clarity-upscaler';
      const modelMeta = FAL_MODELS.find(m => m.id === chosenModelId) || FAL_MODELS[0];

      if (onProgress) onProgress(`⚡ Running ${modelMeta.name} on cloud GPU (${modelMeta.time})...`);

      // Prepare input payload tailored to each specific Fal.ai model
      let inputPayload = { image_url: uploadedUrl };

      if (chosenModelId === 'fal-ai/clarity-upscaler') {
        inputPayload = {
          image_url: uploadedUrl,
          upscale_factor: 2,
          prompt: "masterpiece, highly detailed authentic photograph, natural facial textures, clean eyes, sharp film scan, restored vintage portrait, 4k 8k uhd",
          resemblance: typeof currentSettings.falResemblance === 'number' ? currentSettings.falResemblance : 0.75,
          creativity: typeof currentSettings.falCreativity === 'number' ? currentSettings.falCreativity : 0.30,
          enable_safety_checker: true
        };
      } else if (chosenModelId === 'fal-ai/ccsr') {
        inputPayload = {
          image_url: uploadedUrl,
          scale: 2
        };
      } else if (chosenModelId === 'fal-ai/codeformer') {
        inputPayload = {
          image_url: uploadedUrl,
          fidelity: typeof currentSettings.falFidelity === 'number' ? currentSettings.falFidelity : 0.75,
          face_upscale: true,
          upscale_factor: 2
        };
      }

      // Execute request (fal.subscribe is best for generative models with queues)
      let result;
      try {
        result = await fal.subscribe(chosenModelId, {
          input: inputPayload,
          pollInterval: 1000
        });
      } catch (subErr) {
        console.warn('fal.subscribe fallback to fal.run:', subErr);
        result = await fal.run(chosenModelId, {
          input: inputPayload
        });
      }

      console.log('Fal.ai restoration response:', result);

      const outputUrl = result?.data?.image?.url 
        || result?.image?.url 
        || result?.images?.[0]?.url 
        || result?.data?.images?.[0]?.url 
        || (typeof result?.data?.image === 'string' ? result.data.image : null)
        || (typeof result?.image === 'string' ? result.image : null);

      if (outputUrl) {
        return {
          success: true,
          url: outputUrl,
          provider: `Fal.ai (${modelMeta.name})`
        };
      } else {
        throw new Error('Fal.ai response did not contain an output image URL: ' + JSON.stringify(result));
      }
    } catch (err) {
      console.error('Fal.ai restoration error:', err);
      let detailMsg = err.message || 'Fal.ai error';
      if (err.body && err.body.detail) {
        detailMsg = typeof err.body.detail === 'string' ? err.body.detail : JSON.stringify(err.body.detail);
      }
      throw new Error(detailMsg);
    }
  }

  throw new Error(`Unsupported cloud provider: ${currentSettings.provider}`);
}

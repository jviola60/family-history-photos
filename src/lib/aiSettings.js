import { fal } from '@fal-ai/client';

/**
 * AI Provider Settings & Cloud Restoration Integration (Fal.ai, Replicate, Self-Contained)
 * Safely persists keys in localStorage so each user has their own private configuration.
 */

const SETTINGS_KEY = 'who_is_this_ai_settings';

export const DEFAULT_AI_SETTINGS = {
  provider: 'self_contained', // 'self_contained' | 'fal' | 'replicate'
  falApiKey: '',
  falFidelity: 0.75, // 0.0 (maximum enhancement) to 1.0 (strict original likeness)
  replicateApiKey: ''
};

export function getAiSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings) {
  try {
    const updated = { ...getAiSettings(), ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('ai_settings_changed', { detail: updated }));
    return updated;
  } catch (err) {
    console.error('Failed to save AI settings:', err);
    return DEFAULT_AI_SETTINGS;
  }
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
export async function restoreWithCloudAi(imageSource, settings, onProgress) {
  const currentSettings = settings || getAiSettings();

  if (currentSettings.provider === 'fal') {
    const cleanKey = sanitizeFalKey(currentSettings.falApiKey);
    if (!cleanKey) {
      throw new Error('Fal.ai API key is missing. Please enter your key in Settings.');
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

      if (onProgress) onProgress('⚡ Running CodeFormer AI face reconstruction on cloud GPU...');

      // Direct fast HTTP request (~1.5s, no websocket queue polling hang)
      let result;
      try {
        result = await fal.run('fal-ai/codeformer', {
          input: {
            image_url: uploadedUrl,
            fidelity: typeof currentSettings.falFidelity === 'number' ? currentSettings.falFidelity : 0.75,
            face_upscale: true,
            upscale_factor: 2
          }
        });
      } catch (runErr) {
        console.warn('fal.run direct call error, trying fal.subscribe:', runErr);
        result = await fal.subscribe('fal-ai/codeformer', {
          input: {
            image_url: uploadedUrl,
            fidelity: typeof currentSettings.falFidelity === 'number' ? currentSettings.falFidelity : 0.75,
            face_upscale: true,
            upscale_factor: 2
          }
        });
      }

      console.log('Fal.ai restoration response:', result);

      const outputUrl = result?.data?.image?.url || result?.image?.url || (typeof result?.data?.image === 'string' ? result.data.image : null);
      if (outputUrl) {
        return {
          success: true,
          url: outputUrl,
          provider: 'Fal.ai (CodeFormer)'
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

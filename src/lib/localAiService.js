/**
 * Local AI Photo Restoration & Enhancement Client (100% Offline)
 * Communicates with the local Python server running at http://localhost:8008
 * Features:
 *  - CodeFormer & GFPGAN Face Restoration
 *  - OpenCV Scratch, Tear & Fold Inpainting
 *  - White-Balance & LAB-CLAHE Color Restoration & De-Fading
 *  - Real-ESRGAN 4K Neural Super-Resolution
 */

export const LOCAL_AI_URL = 'http://localhost:8008';

let lastHealthCheck = null;
let lastHealthTime = 0;
const HEALTH_CACHE_MS = 4000;

/**
 * Check if the local AI restoration server is running and healthy
 */
export async function checkLocalAiHealth(force = false) {
  const now = Date.now();
  if (!force && lastHealthCheck && (now - lastHealthTime) < HEALTH_CACHE_MS) {
    return lastHealthCheck;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const resp = await fetch(`${LOCAL_AI_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      lastHealthCheck = {
        available: true,
        version: data.version,
        codeformer: !!data.codeformer,
        gfpgan: !!data.gfpgan,
        esrgan: !!data.esrgan,
        scratchRepair: !!data.scratch_repair,
        colorRestoration: !!data.color_restoration
      };
      lastHealthTime = now;
      return lastHealthCheck;
    }
  } catch {
    // Server is not currently reachable
  }

  lastHealthCheck = { available: false };
  lastHealthTime = now;
  return lastHealthCheck;
}

/**
 * Convert any image source (Blob URL, HTTP URL, or canvas) to a Base64 data URL
 */
async function toDataUrl(source) {
  if (typeof source === 'string' && source.startsWith('data:image/')) {
    return source;
  }

  const resp = await fetch(source);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Restore an image using the local 100% offline AI restoration server
 */
export async function restoreWithLocalAi(imageSource, options = {}, onProgress = null) {
  const {
    faceModel = 'codeformer',     // 'codeformer' | 'gfpgan' | 'none'
    fidelity = 0.75,              // 0.0 to 1.0 (likeness preservation)
    repairScratches = true,       // Auto-detect & inpaint scratches & fold cracks
    scratchStrength = 0.75,       // 0.0 to 1.0
    restoreColor = true,          // White-balance & LAB CLAHE de-fade
    defadeStrength = 0.70,        // 0.0 to 1.0
    upscale = true,               // Real-ESRGAN 4x super resolution
    faceBox = null
  } = options;

  if (onProgress) onProgress('Preparing high-resolution photo for local AI engine...');
  const base64Image = await toDataUrl(imageSource);

  if (onProgress) {
    const steps = [];
    if (repairScratches) steps.push('Scratch & Fold Inpainting');
    if (restoreColor) steps.push('Color De-Fading');
    if (faceModel !== 'none') steps.push(`${faceModel === 'codeformer' ? 'CodeFormer' : 'GFPGAN'} Face Restoration`);
    if (upscale) steps.push('Real-ESRGAN 4K Super-Resolution');
    onProgress(`Running Local AI Engine (${steps.join(' → ')})...`);
  }

  const payload = {
    image: base64Image,
    face_model: faceModel,
    fidelity,
    repair_scratches: repairScratches,
    scratch_strength: scratchStrength,
    restore_color: restoreColor,
    defade_strength: defadeStrength,
    upscale,
    face_box: faceBox
  };

  const resp = await fetch(`${LOCAL_AI_URL}/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let msg = `Local AI Server error (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) msg = errJson.error;
    } catch {}
    throw new Error(msg);
  }

  const result = await resp.json();
  if (!result.success || !result.image) {
    throw new Error(result.error || 'Unknown error occurred during local restoration');
  }

  return {
    url: result.image,
    width: result.width,
    height: result.height,
    durationSeconds: result.duration_seconds
  };
}

/**
 * Perform manual object/scratch inpainting with user brush mask using OpenCV Telea
 */
export async function inpaintWithLocalAi(imageSource, maskSource) {
  const [base64Image, base64Mask] = await Promise.all([
    toDataUrl(imageSource),
    toDataUrl(maskSource)
  ]);

  const resp = await fetch(`${LOCAL_AI_URL}/inpaint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: base64Image,
      mask: base64Mask
    })
  });

  if (!resp.ok) {
    throw new Error(`Inpainting request failed with status ${resp.status}`);
  }

  const result = await resp.json();
  if (!result.success || !result.image) {
    throw new Error(result.error || 'Local inpainting failed');
  }

  return result.image;
}

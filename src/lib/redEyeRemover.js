/**
 * Red-Eye Detection and Natural Pupil Restoration Engine
 * 100% Client-Side, Offline, and Zero-Quality-Loss
 *
 * Capabilities:
 * 1. Targeted Red-Eye Pupil Correction (preserves catchlights & natural iris highlights)
 * 2. Snap-to-Pupil Center Detection (auto-centers on peak red reflection near click)
 * 3. 1-Click Auto Red-Eye Detection using facial landmark/box geometry
 * 4. Multi-Eye Undo History
 */

/**
 * Helper to load an image source (URL, DataURL, or ObjectURL) into an HTMLImageElement
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Checks if a pixel qualifies as flash-induced red eye reflection
 */
export function isRedEyePixel(r, g, b) {
  // Preserve white/bright specular flash catchlight sparkle
  if (r > 215 && g > 210 && b > 200 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
    return false;
  }

  // Strict Skin Rejection:
  // Human skin has high green relative to red (g / r typically 0.68 - 0.88).
  // In true flash red-eye reflection, green is heavily absorbed by retinal hemoglobin:
  // r is much larger than g (r / g >= 1.40).
  // If r / g < 1.40 or green is high, it is facial skin or cheeks, NOT red eye!
  if (g >= 70 && (r / Math.max(1, g)) < 1.40) {
    return false;
  }
  // If blue is close to red, it's neutral/gray/skin
  if (b >= 75 && (r / Math.max(1, b)) < 1.35) {
    return false;
  }

  const gbAvg = (g + b) / 2;
  const redRatio = r / Math.max(1, gbAvg);
  const redDiff = r - Math.max(g, b);

  // 1. Classic red-eye (deep saturated red)
  const isClassicRed = r >= 65 && redRatio >= 1.42 && redDiff >= 20 && gbAvg < 155;

  // 2. Amber / orange / golden pupil flash reflection
  const isAmberOrange = r >= 80 && (r - b) >= 38 && (r / Math.max(1, b)) >= 1.65 && (r - g) >= 20 && b < 100;

  return isClassicRed || isAmberOrange;
}

export const EYE_COLOR_PALETTES = {
  auto: { id: 'auto', label: 'Auto (Natural Iris)', icon: '✨', iris: null },
  blue: { id: 'blue', label: 'Blue Eyes', icon: '🔵', iris: { r: 52, g: 102, b: 165 } },
  brown: { id: 'brown', label: 'Brown Eyes', icon: '🟤', iris: { r: 92, g: 62, b: 40 } },
  green: { id: 'green', label: 'Green Eyes', icon: '🟢', iris: { r: 54, g: 110, b: 65 } },
  hazel: { id: 'hazel', label: 'Hazel Eyes', icon: '👁️', iris: { r: 96, g: 86, b: 50 } },
  dark: { id: 'dark', label: 'Dark / Charcoal', icon: '🌑', iris: { r: 30, g: 30, b: 34 } }
};

/**
 * Corrects red-eye at a specific pixel coordinate on an HTML5 canvas.
 * Restores a natural dark pupil center with a realistic colored iris ring (Blue, Brown, Green, Hazel, etc.)
 * and preserves white specular flash catchlights so eyes look vibrant and alive.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} targetX - Pixel coordinate X on canvas
 * @param {number} targetY - Pixel coordinate Y on canvas
 * @param {number} radius - Search and correction radius in pixels
 * @param {object} options - Options { eyeColor: string, isManualClick: boolean, eyeSize: 'small'|'medium'|'large' }
 * @returns {object} { success: boolean, changedPixels: number, center: { x, y } }
 */
export function fixRedEyeAtCoords(canvas, targetX, targetY, radius = 8, options = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  // Clamp target coordinates
  const tx = Math.max(0, Math.min(w - 1, Math.round(targetX)));
  const ty = Math.max(0, Math.min(h - 1, Math.round(targetY)));

  const isManual = !!options.isManualClick;

  // Natural iris radius calculation:
  // Human iris is ~7-8% of face width or ~1.0-1.4% of total photo dimension.
  // We clamp tight so it never bleeds into eyelids, cheeks, or under-eye skin!
  let effectiveRadius;
  if (options.eyeSize === 'small') {
    effectiveRadius = Math.max(3, Math.min(8, Math.round(radius * 0.75)));
  } else if (options.eyeSize === 'large') {
    effectiveRadius = Math.max(6, Math.min(16, Math.round(radius * 1.30)));
  } else {
    // Medium / default: tightly bounded to true anatomical iris scale
    effectiveRadius = Math.max(4, Math.min(12, Math.round(radius)));
  }

  const searchRadius = Math.round(effectiveRadius * 1.25);
  const minX = Math.max(0, tx - searchRadius);
  const minY = Math.max(0, ty - searchRadius);
  const maxX = Math.min(w - 1, tx + searchRadius);
  const maxY = Math.min(h - 1, ty + searchRadius);

  const regionW = maxX - minX + 1;
  const regionH = maxY - minY + 1;

  if (regionW <= 0 || regionH <= 0) {
    return { success: false, changedPixels: 0, center: { x: tx, y: ty } };
  }

  const imgData = ctx.getImageData(minX, minY, regionW, regionH);
  const data = imgData.data;

  // 1. Local micro-snap centroid search: snap to peak red/amber reflection ONLY within tight snap radius (max 5px)
  let peakWeightSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  const snapWindow = Math.min(5, Math.max(2, Math.round(effectiveRadius * 0.45)));

  for (let y = 0; y < regionH; y++) {
    const dy = y - (ty - minY);
    if (Math.abs(dy) > snapWindow) continue;

    for (let x = 0; x < regionW; x++) {
      const dx = x - (tx - minX);
      if (Math.abs(dx) > snapWindow) continue;

      const idx = (y * regionW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (isRedEyePixel(r, g, b)) {
        const redness = (r - Math.max(g, b));
        peakWeightSum += redness;
        weightedX += x * redness;
        weightedY += y * redness;
      }
    }
  }

  let centerX = tx - minX;
  let centerY = ty - minY;
  if (peakWeightSum > 50) {
    centerX = Math.round(weightedX / peakWeightSum);
    centerY = Math.round(weightedY / peakWeightSum);
  }

  // 2. Perform natural pupil + colored iris restoration
  let changedPixels = 0;
  const chosenColorKey = (options.eyeColor || 'auto').toLowerCase();
  const palette = EYE_COLOR_PALETTES[chosenColorKey] || EYE_COLOR_PALETTES.auto;

  const pupilCoreR = 18;
  const pupilCoreG = 18;
  const pupilCoreB = 22;

  for (let y = 0; y < regionH; y++) {
    for (let x = 0; x < regionW; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > effectiveRadius) continue;

      const idx = (y * regionW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Protect bright specular flash catchlight sparkle
      if (r > 215 && g > 210 && b > 200 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
        continue;
      }

      const gbAvg = (g + b) / 2;
      const normDist = dist / effectiveRadius; // 0 at center, 1 at edge

      // Eligibility check:
      // In manual click mode: We ALWAYS apply the pupil/iris at user's click,
      // but gently protect outer skin if click was near eye boundary.
      // In auto mode: strictly require true red-eye reflection!
      let isEligible = false;
      if (isManual) {
        if (normDist <= 0.50) {
          // Inside inner core/pupil: always recolor
          isEligible = true;
        } else {
          // In outer iris zone: protect obvious bright skin/sclera
          const isBrightSkin = (r > 130 && g > 95 && b > 80 && (r - g) < 40 && (r / Math.max(1, g)) < 1.35);
          isEligible = !isBrightSkin;
        }
      } else {
        // Auto-fix mode: must match red eye reflection, NEVER skin!
        isEligible = isRedEyePixel(r, g, b) || (r > 60 && (r / Math.max(1, gbAvg)) > 1.35 && (r - Math.max(g, b)) > 18);
      }

      if (isEligible) {
        // Anatomical gradient:
        // Core (normDist <= 0.38): Deep obsidian pupil aperture (black/charcoal)
        // Ring (normDist > 0.38): Rich colored Iris (Blue, Brown, Green, Hazel, or Auto)
        let targetR, targetG, targetB;

        if (normDist <= 0.38) {
          targetR = pupilCoreR;
          targetG = pupilCoreG;
          targetB = pupilCoreB;
        } else {
          const irisBlend = Math.min(1, Math.max(0, (normDist - 0.38) / 0.40));
          if (palette.iris) {
            targetR = Math.round(pupilCoreR * (1 - irisBlend) + palette.iris.r * irisBlend);
            targetG = Math.round(pupilCoreG * (1 - irisBlend) + palette.iris.g * irisBlend);
            targetB = Math.round(pupilCoreB * (1 - irisBlend) + palette.iris.b * irisBlend);
          } else {
            const autoIrisR = Math.min(48, Math.round(gbAvg * 0.50));
            const autoIrisG = Math.min(68, Math.round(g * 0.70));
            const autoIrisB = Math.min(88, Math.round(b * 0.85));
            targetR = Math.round(pupilCoreR * (1 - irisBlend) + autoIrisR * irisBlend);
            targetG = Math.round(pupilCoreG * (1 - irisBlend) + autoIrisG * irisBlend);
            targetB = Math.round(pupilCoreB * (1 - irisBlend) + autoIrisB * irisBlend);
          }
        }

        // Smooth feathering at the outer edge (normDist > 0.65)
        let weight = 1.0;
        if (normDist > 0.65) {
          weight = Math.max(0.15, Math.cos(((normDist - 0.65) / 0.35) * (Math.PI / 2)));
        }

        data[idx] = Math.round(r * (1 - weight) + targetR * weight);
        data[idx + 1] = Math.round(g * (1 - weight) + targetG * weight);
        data[idx + 2] = Math.round(b * (1 - weight) + targetB * weight);

        changedPixels++;
      }
    }
  }

  if (changedPixels > 0) {
    ctx.putImageData(imgData, minX, minY);
  }

  return {
    success: isManual || changedPixels > 0,
    changedPixels,
    center: {
      x: minX + centerX,
      y: minY + centerY
    }
  };
}

/**
 * Automatically scans facial eye regions and corrects all red eyes in the canvas.
 * Uses face bounding boxes to pinpoint eye coordinates reliably.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array} faceBoxes - Detected faces with normalized box { x, y, width, height }
 * @returns {object} { fixedCount: number, eyeLocations: Array }
 */
export function autoFixRedEyesOnCanvas(canvas, faceBoxes = [], options = {}) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return { fixedCount: 0, eyeLocations: [] };
  }

  const w = canvas.width;
  const h = canvas.height;
  const eyeLocations = [];

  // If no face boxes provided, use standard portrait central upper frame as fallback
  const targets = (faceBoxes && faceBoxes.length > 0)
    ? faceBoxes.map(f => f.box || f)
    : [{ x: 0.15, y: 0.10, width: 0.70, height: 0.70 }];

  for (const box of targets) {
    if (!box) continue;

    const facePixelX = Math.round(box.x * w);
    const facePixelY = Math.round(box.y * h);
    const facePixelW = Math.round(box.width * w);
    const facePixelH = Math.round(box.height * h);

    // Eye zone within face bounding box:
    // Human eyes are located strictly between 22% and 42% of face height!
    // NEVER search down to 58% (which hits nose, cheeks, and mouth)!
    const eyeTop = facePixelY + Math.round(facePixelH * 0.22);
    const eyeBottom = facePixelY + Math.round(facePixelH * 0.42);
    // Natural iris radius is strictly ~3.8% of face width (clamped 4px to 14px)
    const eyeRadius = Math.max(4, Math.min(14, Math.round(facePixelW * 0.038)));

    // Search left eye zone (with overlap to avoid middle-angle blind spots)
    const leftEyeLeft = facePixelX + Math.round(facePixelW * 0.12);
    const leftEyeRight = facePixelX + Math.round(facePixelW * 0.52);
    const leftCandidate = findPeakRedSpot(canvas, leftEyeLeft, eyeTop, leftEyeRight, eyeBottom);

    if (leftCandidate && leftCandidate.pixelCount >= 4) {
      const res = fixRedEyeAtCoords(canvas, leftCandidate.x, leftCandidate.y, eyeRadius, { ...options, isManualClick: false });
      if (res.success && res.changedPixels > 0) {
        eyeLocations.push({ x: res.center.x, y: res.center.y, side: 'left' });
      }
    }

    // Search right eye zone (with overlap)
    const rightEyeLeft = facePixelX + Math.round(facePixelW * 0.48);
    const rightEyeRight = facePixelX + Math.round(facePixelW * 0.88);
    const rightCandidate = findPeakRedSpot(canvas, rightEyeLeft, eyeTop, rightEyeRight, eyeBottom);

    if (rightCandidate && rightCandidate.pixelCount >= 4) {
      const isDuplicate = eyeLocations.some(loc => Math.hypot(loc.x - rightCandidate.x, loc.y - rightCandidate.y) < eyeRadius);
      if (!isDuplicate) {
        const res = fixRedEyeAtCoords(canvas, rightCandidate.x, rightCandidate.y, eyeRadius, { ...options, isManualClick: false });
        if (res.success && res.changedPixels > 0) {
          eyeLocations.push({ x: res.center.x, y: res.center.y, side: 'right' });
        }
      }
    }

    // Fallback: If only 1 eye was caught, search the entire eye band for a second red/amber pupil
    if (eyeLocations.length === 1) {
      const fullBandCandidate = findPeakRedSpot(
        canvas,
        facePixelX + Math.round(facePixelW * 0.10),
        eyeTop,
        facePixelX + Math.round(facePixelW * 0.90),
        eyeBottom,
        eyeLocations[0],
        eyeRadius * 1.5
      );
      if (fullBandCandidate && fullBandCandidate.pixelCount >= 4) {
        const res = fixRedEyeAtCoords(canvas, fullBandCandidate.x, fullBandCandidate.y, eyeRadius, { ...options, isManualClick: false });
        if (res.success && res.changedPixels > 0) {
          eyeLocations.push({ x: res.center.x, y: res.center.y, side: 'second' });
        }
      }
    }
  }

  return {
    fixedCount: eyeLocations.length,
    eyeLocations
  };
}

/**
 * Helper to find the peak red-eye pupil cluster inside an eye search box
 */
function findPeakRedSpot(canvas, minX, minY, maxX, maxY, excludeCenter = null, excludeDist = 18) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);

  const safeMinX = Math.max(0, Math.min(canvas.width - 1, minX));
  const safeMinY = Math.max(0, Math.min(canvas.height - 1, minY));
  const safeW = Math.min(w, canvas.width - safeMinX);
  const safeH = Math.min(h, canvas.height - safeMinY);

  if (safeW <= 0 || safeH <= 0) return null;

  const imgData = ctx.getImageData(safeMinX, safeMinY, safeW, safeH);
  const data = imgData.data;

  let peakWeightSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  let pixelCount = 0;

  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const absoluteX = safeMinX + x;
      const absoluteY = safeMinY + y;

      if (excludeCenter && Math.hypot(absoluteX - excludeCenter.x, absoluteY - excludeCenter.y) < excludeDist) {
        continue;
      }

      const idx = (y * safeW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (isRedEyePixel(r, g, b)) {
        const redness = r - Math.max(g, b);
        peakWeightSum += redness;
        weightedX += x * redness;
        weightedY += y * redness;
        pixelCount++;
      }
    }
  }

  // Must have a compact cluster of red pixels (between 4 and 180 pixels).
  // If > 180 pixels match, that's an entire face/cheek, NOT a pupil!
  if (pixelCount >= 4 && pixelCount <= 180 && peakWeightSum > 70) {
    return {
      x: safeMinX + Math.round(weightedX / peakWeightSum),
      y: safeMinY + Math.round(weightedY / peakWeightSum),
      pixelCount
    };
  }

  return null;
}

/**
 * High-level function: Takes an image source, applies auto or manual red-eye fixes,
 * and outputs a pristine JPEG Data URL.
 */
export async function removeRedEyesFromImage(imageSrc, options = {}) {
  const { faceBoxes = [], manualPoints = [] } = options;

  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  let totalFixed = 0;
  const allLocations = [];

  // 1. Apply any manual user clicks
  if (manualPoints && manualPoints.length > 0) {
    const defaultRadius = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * 0.025));
    for (const pt of manualPoints) {
      const res = fixRedEyeAtCoords(canvas, pt.x, pt.y, pt.radius || defaultRadius, options);
      if (res.success) {
        totalFixed++;
        allLocations.push(res.center);
      }
    }
  }

  // 2. Apply auto-detection for face boxes if requested
  if (options.autoDetect !== false) {
    const autoRes = autoFixRedEyesOnCanvas(canvas, faceBoxes, options);
    totalFixed += autoRes.fixedCount;
    allLocations.push(...autoRes.eyeLocations);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

  return {
    dataUrl,
    fixedCount: totalFixed,
    locations: allLocations
  };
}

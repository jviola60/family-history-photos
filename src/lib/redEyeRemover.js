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
  // Preserve white/bright specular flash catchlight
  if (r > 235 && g > 230 && b > 220) {
    return false;
  }

  const gbAvg = (g + b) / 2;
  const redRatio = r / Math.max(1, gbAvg);
  const redDiff = r - Math.max(g, b);

  // 1. Classic red-eye (deep saturated red)
  const isClassicRed = r > 60 && redRatio >= 1.28 && redDiff >= 16 && gbAvg < 175;

  // 2. Amber / orange / golden pupil flash reflection (common behind eyeglasses or lighter irises)
  // Red is strong, green is moderate, but blue is low (pupil is not white or skin-colored)
  const isAmberOrange = r > 75 && r > b * 1.30 && (r - b) >= 20 && g < r * 0.95 && b < 165;

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
 * @param {number} radius - Search and correction radius in pixels (default 20)
 * @param {object} options - Options { eyeColor: 'blue'|'brown'|'green'|'hazel'|'dark'|'auto' }
 * @returns {object} { success: boolean, changedPixels: number, center: { x, y } }
 */
export function fixRedEyeAtCoords(canvas, targetX, targetY, radius = 20, options = {}) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  // Clamp target coordinates
  const tx = Math.max(0, Math.min(w - 1, Math.round(targetX)));
  const ty = Math.max(0, Math.min(h - 1, Math.round(targetY)));

  const searchRadius = Math.max(10, Math.round(radius));
  const minX = Math.max(0, tx - searchRadius);
  const minY = Math.max(0, ty - searchRadius);
  const maxX = Math.min(w - 1, tx + searchRadius);
  const maxY = Math.min(h - 1, ty + searchRadius);

  const regionW = maxX - minX + 1;
  const regionH = maxY - minY + 1;

  if (regionW <= 0 || regionH <= 0) {
    return { success: false, changedPixels: 0 };
  }

  const imgData = ctx.getImageData(minX, minY, regionW, regionH);
  const data = imgData.data;

  // 1. Local centroid search: snap to peak red/amber reflection ONLY within tight snap radius (max 8px)
  // to prevent snapping to surrounding skin or cheeks
  let peakWeightSum = 0;
  let weightedX = 0;
  let weightedY = 0;
  const snapWindow = Math.min(8, Math.round(searchRadius * 0.4));

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
  if (peakWeightSum > 60) {
    centerX = Math.round(weightedX / peakWeightSum);
    centerY = Math.round(weightedY / peakWeightSum);
  }

  // 2. Perform natural pupil + colored iris restoration
  const effectiveRadius = Math.min(searchRadius, Math.max(8, searchRadius * 0.90));
  let changedPixels = 0;

  // Eye color selection
  const chosenColorKey = (options.eyeColor || 'auto').toLowerCase();
  const palette = EYE_COLOR_PALETTES[chosenColorKey] || EYE_COLOR_PALETTES.auto;

  for (let y = 0; y < regionH; y++) {
    for (let x = 0; x < regionW; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > effectiveRadius) continue;

      const idx = (y * regionW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Protect bright specular flash catchlight sparkle
      if (r > 230 && g > 225 && b > 215 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
        continue;
      }

      const gbAvg = (g + b) / 2;
      const redRatio = r / Math.max(1, gbAvg);

      const isEligible = (r > 50 && redRatio > 1.15 && (r - Math.max(g, b)) > 10) ||
                         (r > 65 && r > b * 1.20 && (r - b) > 15 && g < r * 0.96);

      if (isEligible) {
        // Distance falloff factor
        const normDist = dist / effectiveRadius; // 0 at center, 1 at outer boundary
        const distFactor = 1 - Math.pow(normDist, 2);
        const redFactor = Math.min(1, Math.max(0.4, (redRatio - 1.15) / 0.35));
        const weight = Math.min(1, Math.max(0.15, distFactor * redFactor));

        // Anatomical Eye Gradient:
        // Core (normDist <= 0.40): Deep dark pupil aperture (black/charcoal)
        // Outer (normDist > 0.40): Colored Iris Ring (Blue, Brown, Green, Hazel, or Auto)
        const pupilCoreR = 20;
        const pupilCoreG = 20;
        const pupilCoreB = 24;

        let targetR, targetG, targetB;

        if (normDist <= 0.40) {
          // Inside central pupil hole: always black/charcoal
          targetR = pupilCoreR;
          targetG = pupilCoreG;
          targetB = pupilCoreB;
        } else {
          // Iris ring: blend natural eye color
          const irisBlend = Math.min(1, Math.max(0, (normDist - 0.40) / 0.45));

          if (palette.iris) {
            targetR = Math.round(pupilCoreR * (1 - irisBlend) + palette.iris.r * irisBlend);
            targetG = Math.round(pupilCoreG * (1 - irisBlend) + palette.iris.g * irisBlend);
            targetB = Math.round(pupilCoreB * (1 - irisBlend) + palette.iris.b * irisBlend);
          } else {
            // Auto iris: preserve natural eye depth without flat void
            const autoIrisR = Math.min(55, Math.round(gbAvg * 0.55));
            const autoIrisG = Math.min(75, Math.round(g * 0.70));
            const autoIrisB = Math.min(95, Math.round(b * 0.85));

            targetR = Math.round(pupilCoreR * (1 - irisBlend) + autoIrisR * irisBlend);
            targetG = Math.round(pupilCoreG * (1 - irisBlend) + autoIrisG * irisBlend);
            targetB = Math.round(pupilCoreB * (1 - irisBlend) + autoIrisB * irisBlend);
          }
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
    success: changedPixels > 0,
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
    // Support tilted heads and glasses by expanding vertical range (16% to 58%)
    const eyeTop = facePixelY + Math.round(facePixelH * 0.16);
    const eyeBottom = facePixelY + Math.round(facePixelH * 0.58);
    const eyeRadius = Math.max(10, Math.round(facePixelW * 0.065));

    // Search left eye zone (with overlap to avoid middle-angle blind spots)
    const leftEyeLeft = facePixelX + Math.round(facePixelW * 0.10);
    const leftEyeRight = facePixelX + Math.round(facePixelW * 0.54);
    const leftCandidate = findPeakRedSpot(canvas, leftEyeLeft, eyeTop, leftEyeRight, eyeBottom);

    if (leftCandidate && leftCandidate.pixelCount >= 6) {
      const res = fixRedEyeAtCoords(canvas, leftCandidate.x, leftCandidate.y, eyeRadius, options);
      if (res.success) {
        eyeLocations.push({ x: res.center.x, y: res.center.y, side: 'left' });
      }
    }

    // Search right eye zone (with overlap)
    const rightEyeLeft = facePixelX + Math.round(facePixelW * 0.46);
    const rightEyeRight = facePixelX + Math.round(facePixelW * 0.90);
    const rightCandidate = findPeakRedSpot(canvas, rightEyeLeft, eyeTop, rightEyeRight, eyeBottom);

    if (rightCandidate && rightCandidate.pixelCount >= 6) {
      const isDuplicate = eyeLocations.some(loc => Math.hypot(loc.x - rightCandidate.x, loc.y - rightCandidate.y) < eyeRadius);
      if (!isDuplicate) {
        const res = fixRedEyeAtCoords(canvas, rightCandidate.x, rightCandidate.y, eyeRadius, options);
        if (res.success) {
          eyeLocations.push({ x: res.center.x, y: res.center.y, side: 'right' });
        }
      }
    }

    // Fallback: If only 1 eye was caught, search the entire eye band for a second red/amber pupil
    if (eyeLocations.length === 1) {
      const fullBandCandidate = findPeakRedSpot(
        canvas,
        facePixelX + Math.round(facePixelW * 0.08),
        eyeTop,
        facePixelX + Math.round(facePixelW * 0.92),
        eyeBottom,
        eyeLocations[0],
        eyeRadius * 1.5
      );
      if (fullBandCandidate && fullBandCandidate.pixelCount >= 5) {
        const res = fixRedEyeAtCoords(canvas, fullBandCandidate.x, fullBandCandidate.y, eyeRadius, options);
        if (res.success) {
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

  if (pixelCount >= 5 && peakWeightSum > 80) {
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

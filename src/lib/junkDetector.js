/**
 * junkDetector.js
 * Identifies screenshots, photos without people, and low-resolution/unwanted files
 * to help users declutter their photo library.
 */

const SCREENSHOT_NAME_REGEX = /(?:screenshot|screen_shot|capture|snip|screen\s*\d+|grab|prtscr)/i;
const SCREENSHOT_PATH_REGEX = /(?:screenshots|captures|snips|screen recordings)/i;

/**
 * Detects whether a photo is almost certainly a screenshot.
 */
export function isScreenshotPhoto(photo) {
  if (!photo) return false;

  // 1. Explicit filename pattern
  if (photo.name && SCREENSHOT_NAME_REGEX.test(photo.name)) {
    return true;
  }

  // 2. Relative path in Screenshots folder
  if (photo.relativePath && SCREENSHOT_PATH_REGEX.test(photo.relativePath)) {
    return true;
  }

  // 3. Common desktop/mobile screen aspect ratios without camera metadata
  if (photo.width && photo.height) {
    const w = photo.width;
    const h = photo.height;
    const ratio = Math.max(w, h) / Math.min(w, h);

    // Common screen ratios: 16:9 (~1.778), 16:10 (1.6), 19.5:9 (~2.167), 2152x1128 (~1.908)
    const isExactScreenRes = (
      (w === 1920 && h === 1080) ||
      (w === 2560 && h === 1440) ||
      (w === 3840 && h === 2160) ||
      (w === 1366 && h === 768) ||
      (w === 1440 && h === 900) ||
      (w === 2152 && h === 1128) ||
      (w === 1170 && h === 2532) ||
      (w === 1080 && h === 2400)
    );

    // If exact screen resolution and name doesn't look like camera photo (IMG_, DSC_, etc.)
    if (isExactScreenRes && !/^(?:img_|dsc_|p_|\d{8}_\d{6})/i.test(photo.name || '')) {
      return true;
    }
  }

  return false;
}

const CAMERA_NAME_REGEX = /^(?:img_|dsc_|p_|\d{4}[-_]\d{2}[-_]\d{2}|\d{8}[-_]\d{6})/i;

/**
 * Checks whether a photo contains people.
 * Uses existing detected faces or tagged family members.
 */
export function hasPeopleInPhoto(photo) {
  if (!photo) return false;
  if (photo.faces && photo.faces.length > 0) return true;
  if (photo.people && photo.people.length > 0) return true;
  return false;
}

/**
 * Analyzes and categorizes a photo for junk / unwanted cleanup.
 * Strictly focuses on computer app/desktop screenshots.
 * Real camera photos and vintage family pictures are NEVER flagged as junk!
 */
export function evaluatePhotoValue(photo, ignoredJunkIds = new Set()) {
  if (!photo || photo.isMarkedDuplicate || ignoredJunkIds.has(photo.id)) {
    return null;
  }

  // Camera photos and vintage timestamped family pictures are protected!
  if (photo.name && CAMERA_NAME_REGEX.test(photo.name)) {
    return null;
  }

  const isScreen = isScreenshotPhoto(photo);
  const hasPeople = hasPeopleInPhoto(photo);

  let category = null;
  const reasons = [];

  if (isScreen) {
    if (hasPeople) {
      category = 'screenshot_people';
      reasons.push('Screenshot with people detected (Family Video Call / Webcam)');
    } else {
      category = 'screenshot_ui';
      reasons.push('App / desktop screenshot with no people (Code, Windows, UI)');
    }
  }

  // NOTE: Vintage, low-resolution, or small camera photos belong in the 4K Enhancement hub, NEVER in Junk!

  if (!category) return null;

  return {
    photo,
    category,
    reasons,
    hasPeople,
    isScreenshot: isScreen,
    isLowRes: false
  };
}

/**
 * Scans a list of photos and returns categorized cleanup candidates.
 */
export function scanPhotoLibraryForJunk(photos, options = {}) {
  const { ignoredJunkIds = new Set() } = options;
  const candidates = [];

  for (const photo of photos) {
    const evalResult = evaluatePhotoValue(photo, ignoredJunkIds);
    if (evalResult) {
      candidates.push(evalResult);
    }
  }

  // Sort: screenshot_ui first, then screenshot_people (keep/review carefully)
  const categoryOrder = { screenshot_ui: 1, screenshot_people: 2, other: 3 };
  candidates.sort((a, b) => (categoryOrder[a.category] || 4) - (categoryOrder[b.category] || 4));

  return candidates;
}

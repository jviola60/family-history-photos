/**
 * Real Browser-Native Neural Face Detection & 128-D ResNet-34 Face Recognition Engine
 * Powered by @vladmandic/face-api (SSD MobileNet v1 + 68-pt Tiny Landmarks + ResNet-34 128-D).
 * Rejects non-human objects (dogs, documents, furniture) and prevents false ~50% pixel-grid matches.
 */

const NEURAL_DB_KEY = 'fhp_neural_faces_v2';
export const MAX_MATCH_DIST = 0.56;
export const STRONG_MATCH_DIST = 0.46;
export const AUTO_ASSIGN_DIST = 0.40;
export const SUGGEST_DIST_CUTOFF = 0.54;

export function distToScore(d) {
  return Math.max(0, Math.min(0.99, 1.0 - Math.max(0, d - 0.22) * 1.15));
}

export function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 99;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function computeEffectiveDistance(vec, samples) {
  if (!vec || !Array.isArray(samples) || samples.length === 0) return 99;
  let bestDist = 99;
  const dim = vec.length;
  const sumVec = new Float64Array(dim);
  let validCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s || !Array.isArray(s.vec) || s.vec.length !== dim) continue;
    const d = euclideanDistance(vec, s.vec);
    if (d < bestDist) bestDist = d;
    for (let k = 0; k < dim; k++) sumVec[k] += s.vec[k];
    validCount++;
  }
  if (validCount === 0) return 99;
  if (validCount === 1) return bestDist;

  const centroid = new Array(dim);
  for (let k = 0; k < dim; k++) centroid[k] = sumVec[k] / validCount;
  const centroidDist = euclideanDistance(vec, centroid);
  return bestDist * 0.75 + centroidDist * 0.25;
}

const INVALID_NAME_SET = new Set([
  'unknown', 'unnamed', 'person', 'face', 'relative', 'man', 'woman', 'child', 'boy', 'girl',
  'family', 'friend', 'photo', 'none', 'n/a', 'na', 'test', 'other', 'someone'
]);

function normalizePersonKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isValidPersonName(name) {
  const clean = normalizePersonKey(name);
  if (!clean || clean.length < 2) return false;
  if (INVALID_NAME_SET.has(clean)) return false;
  if (/^(person|face|unknown)\s*\d*$/i.test(clean)) return false;
  return true;
}

function loadNeuralDb() {
  try {
    const raw = localStorage.getItem(NEURAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.people) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return { version: 2, people: {} };
}

function saveNeuralDb(db) {
  try {
    localStorage.setItem(NEURAL_DB_KEY, JSON.stringify(db));
  } catch {
    // Quota guard: trim oldest samples if full
    try {
      const keys = Object.keys(db.people || {});
      keys.forEach((k) => {
        if (Array.isArray(db.people[k].samples) && db.people[k].samples.length > 5) {
          db.people[k].samples = db.people[k].samples.slice(-5);
        }
      });
      localStorage.setItem(NEURAL_DB_KEY, JSON.stringify(db));
    } catch {
      // ignore
    }
  }
}

function loadImageElement(source) {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
    return Promise.resolve(source);
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl = null;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for neural face detection'));
    };
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else {
      img.src = typeof source === 'string' ? source : (source && source.src ? source.src : '');
    }
  });
}

function drawScaledCanvas(imgEl, maxDim = 960) {
  const origW = imgEl.naturalWidth || imgEl.width || 320;
  const origH = imgEl.naturalHeight || imgEl.height || 240;
  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  const w = Math.max(1, Math.round(origW * scale));
  const h = Math.max(1, Math.round(origH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgEl, 0, 0, w, h);
  return { canvas, width: w, height: h };
}

function cropFaceThumbnailFromImg(imgEl, box, outSize = 96) {
  const origW = imgEl.naturalWidth || imgEl.width || 320;
  const origH = imgEl.naturalHeight || imgEl.height || 240;
  const bx = box && box.x !== undefined ? Number(box.x) : 0;
  const by = box && box.y !== undefined ? Number(box.y) : 0;
  const bw = box && box.width !== undefined ? Number(box.width) : 0.2;
  const bh = box && box.height !== undefined ? Number(box.height) : 0.2;

  const padX = bw * 0.18;
  const padY = bh * 0.18;
  const sx = Math.max(0, Math.round((bx - padX) * origW));
  const sy = Math.max(0, Math.round((by - padY) * origH));
  const sw = Math.min(origW - sx, Math.max(16, Math.round((bw + padX * 2) * origW)));
  const sh = Math.min(origH - sy, Math.max(16, Math.round((bh + padY * 2) * origH)));

  const c = document.createElement('canvas');
  c.width = outSize;
  c.height = outSize;
  const ctx = c.getContext('2d');
  ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outSize, outSize);
  const url = c.toDataURL('image/jpeg', 0.85);
  c.width = 0;
  c.height = 0;
  return url;
}

function sortFacesSpatially(faces) {
  if (!faces || faces.length <= 1) return faces || [];
  const list = faces.slice().sort((a, b) => {
    const ba = a.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
    const bb = b.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
    return (ba.y + ba.height * 0.5) - (bb.y + bb.height * 0.5);
  });

  const rows = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const b = item.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
    const cy = b.y + b.height * 0.5;
    const cx = b.x + b.width * 0.5;
    let placed = false;

    for (let r = 0; r < rows.length; r++) {
      const rowObj = rows[r];
      const tolY = Math.max(0.18, rowObj.avgH * 1.35);
      if (Math.abs(cy - rowObj.avgCy) <= tolY) {
        let xConflict = false;
        for (let k = 0; k < rowObj.items.length; k++) {
          const ob = rowObj.items[k].box || { x: 0, y: 0, width: 0.1, height: 0.1 };
          const ocx = ob.x + ob.width * 0.5;
          if (Math.abs(cx - ocx) < Math.min(b.width, ob.width) * 0.55) {
            xConflict = true;
            break;
          }
        }
        if (!xConflict) {
          const n = rowObj.items.length;
          rowObj.avgCy = (rowObj.avgCy * n + cy) / (n + 1);
          rowObj.avgH = (rowObj.avgH * n + b.height) / (n + 1);
          rowObj.items.push(item);
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      rows.push({ avgCy: cy, avgH: b.height || 0.1, items: [item] });
    }
  }

  rows.sort((a, b) => a.avgCy - b.avgCy);
  const out = [];
  for (let r = 0; r < rows.length; r++) {
    rows[r].items.sort((a, b) => {
      const ba = a.box || { x: 0, width: 0 };
      const bb = b.box || { x: 0, width: 0 };
      return (ba.x + ba.width * 0.5) - (bb.x + bb.width * 0.5);
    });
    for (let k = 0; k < rows[r].items.length; k++) out.push(rows[r].items[k]);
  }
  return out;
}

function boxIoU(a, b) {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function roundVec(desc) {
  const out = new Array(desc.length);
  for (let i = 0; i < desc.length; i++) {
    out[i] = Math.round(desc[i] * 10000) / 10000;
  }
  return out;
}

export function createNeuralFaceEngine(legacyFallback = null) {
  let faceapiMod = null;
  let modelsLoaded = false;
  let loadPromise = null;
  let activeBackend = 'initializing';

  async function ensureNeuralModelsLoaded(onStatus = null) {
    if (modelsLoaded && faceapiMod) return faceapiMod;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      if (onStatus) onStatus('Loading neural face recognition library...');
      const faceapi = await import('@vladmandic/face-api');
      faceapiMod = faceapi;

      try {
        if (faceapi.tf) {
          try {
            await faceapi.tf.setBackend('webgl');
            await faceapi.tf.ready();
            activeBackend = 'webgl';
          } catch {
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
            activeBackend = 'cpu';
          }
        }
      } catch {
        activeBackend = 'cpu';
      }

      const modelBaseUrl = new URL('./models/face-api', window.location.href).href;
      if (onStatus) onStatus('Loading neural human face & 128-D recognition models...');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelBaseUrl),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelBaseUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl)
      ]);
      modelsLoaded = true;
      return faceapi;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });

    return loadPromise;
  }

  function getEngineInfo() {
    return {
      neural: true,
      loaded: modelsLoaded,
      backend: activeBackend,
      modelName: 'Neural ResNet-34 (128-D)'
    };
  }

  async function detectWithDescriptorsOnImg(imgEl, opts = {}) {
    const faceapi = await ensureNeuralModelsLoaded(opts.onStatus);
    const maxDim = opts.maxDim || 960;
    const minConfidence = opts.minConfidence !== undefined ? opts.minConfidence : 0.60;
    const { canvas, width, height } = drawScaledCanvas(imgEl, maxDim);

    try {
      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      const valid = [];
      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        const b = det.detection.box;
        if (!b || b.width < 22 || b.height < 22) continue;
        const ratio = b.width / b.height;
        if (ratio < 0.52 || ratio > 1.95) continue;

        const normBox = {
          x: Math.max(0, Math.min(1, b.x / width)),
          y: Math.max(0, Math.min(1, b.y / height)),
          width: Math.max(0.02, Math.min(1, b.width / width)),
          height: Math.max(0.02, Math.min(1, b.height / height))
        };
        const cropUrl = cropFaceThumbnailFromImg(imgEl, normBox, 96);
        valid.push({
          id: 'neural_' + i,
          box: normBox,
          cropUrl,
          descriptor: roundVec(det.descriptor),
          detectionScore: Math.round((det.detection.score || 0) * 1000) / 1000,
          neural: true
        });
      }
      return sortFacesSpatially(valid).map((f, idx) => ({ ...f, id: 'face_' + (idx + 1) }));
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  async function computeDescriptorForBoxOnImg(imgEl, box) {
    const faceapi = await ensureNeuralModelsLoaded();
    const origW = imgEl.naturalWidth || imgEl.width || 320;
    const origH = imgEl.naturalHeight || imgEl.height || 240;
    const bx = box && box.x !== undefined ? Number(box.x) : 0;
    const by = box && box.y !== undefined ? Number(box.y) : 0;
    const bw = box && box.width !== undefined ? Number(box.width) : 0.2;
    const bh = box && box.height !== undefined ? Number(box.height) : 0.2;

    const padX = bw * 0.2;
    const padY = bh * 0.2;
    const sx = Math.max(0, Math.round((bx - padX) * origW));
    const sy = Math.max(0, Math.round((by - padY) * origH));
    const sw = Math.min(origW - sx, Math.max(24, Math.round((bw + padX * 2) * origW)));
    const sh = Math.min(origH - sy, Math.max(24, Math.round((bh + padY * 2) * origH)));

    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, 160, 160);
    try {
      const desc = await faceapi.computeFaceDescriptor(c);
      return desc && desc.length === 128 ? roundVec(desc) : null;
    } finally {
      c.width = 0;
      c.height = 0;
    }
  }

  async function detectFaces(source, opts = {}) {
    if (!source) return [];
    const imgEl = await loadImageElement(source);
    return await detectWithDescriptorsOnImg(imgEl, opts);
  }

  async function extractFaceDescriptor(source, box) {
    if (!source || !box) return null;
    const imgEl = await loadImageElement(source);
    const detected = await detectWithDescriptorsOnImg(imgEl, { minConfidence: 0.50 });
    let bestDet = null;
    let bestIoU = 0;
    for (let i = 0; i < detected.length; i++) {
      const iou = boxIoU(box, detected[i].box);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestDet = detected[i];
      }
    }
    const vec = (bestDet && bestIoU >= 0.22)
      ? bestDet.descriptor
      : await computeDescriptorForBoxOnImg(imgEl, box);
    return {
      vec,
      cropUrl: cropFaceThumbnailFromImg(imgEl, box, 96)
    };
  }

  function makeFaceSourceKey(photoId, box) {
    if (legacyFallback && typeof legacyFallback.makeFaceSourceKey === 'function') {
      return legacyFallback.makeFaceSourceKey(photoId, box);
    }
    if (!photoId) return '';
    if (!box) return String(photoId);
    const rx = Math.round((box.x || 0) * 100);
    const ry = Math.round((box.y || 0) * 100);
    const rw = Math.round((box.width || 0) * 100);
    const rh = Math.round((box.height || 0) * 100);
    return `${photoId}:${rx},${ry},${rw},${rh}`;
  }

  function forgetFace(sourceKey) {
    if (!sourceKey) return;
    const db = loadNeuralDb();
    let changed = false;
    Object.keys(db.people).forEach((k) => {
      const p = db.people[k];
      if (p && Array.isArray(p.samples)) {
        const before = p.samples.length;
        p.samples = p.samples.filter((s) => s.sourceKey !== sourceKey);
        if (p.samples.length !== before) changed = true;
        if (p.samples.length === 0) {
          delete db.people[k];
          changed = true;
        }
      }
    });
    if (changed) saveNeuralDb(db);
  }

  async function learnFace(source, box, personInfo, sourceKey) {
    const name = typeof personInfo === 'string' ? personInfo : (personInfo && personInfo.name ? personInfo.name : '');
    if (!isValidPersonName(name) || !source || !box) return null;
    if (sourceKey) forgetFace(sourceKey);

    try {
      const desc = await extractFaceDescriptor(source, box);
      if (!desc || !desc.vec || desc.vec.length !== 128) return null;

      const db = loadNeuralDb();
      const key = normalizePersonKey(name);
      const existing = db.people[key] || {
        name: name.trim(),
        fsId: '',
        rel: 'Relative',
        branch: '',
        avatar: '',
        samples: []
      };

      existing.name = name.trim();
      if (personInfo && typeof personInfo === 'object') {
        if (personInfo.fsId) {
          const isPidValid = (typeof window !== 'undefined' && window.FamilySearchClient && typeof window.FamilySearchClient.isPidValidForPersonName === 'function')
            ? window.FamilySearchClient.isPidValidForPersonName(personInfo.fsId, name)
            : true;
          existing.fsId = isPidValid ? personInfo.fsId : '';
        }
        if (personInfo.rel) existing.rel = personInfo.rel;
        if (personInfo.branch) existing.branch = personInfo.branch;
      }
      if (desc.cropUrl) existing.avatar = desc.cropUrl;
      if (!Array.isArray(existing.samples)) existing.samples = [];
      existing.samples.push({
        sourceKey: sourceKey || ('manual_' + Date.now()),
        vec: desc.vec,
        updatedAt: Date.now()
      });
      if (existing.samples.length > 15) {
        existing.samples = existing.samples.slice(existing.samples.length - 15);
      }

      db.people[key] = existing;
      saveNeuralDb(db);
      return existing;
    } catch (e) {
      console.warn('NeuralFaceEngine learnFace notice:', e);
      return null;
    }
  }

  function getLearnedPeople() {
    const db = loadNeuralDb();
    return Object.keys(db.people)
      .map((k) => {
        const p = db.people[k];
        return {
          name: p.name,
          fsId: p.fsId || '',
          rel: p.rel || 'Relative',
          branch: p.branch || '',
          avatar: p.avatar || '',
          sampleCount: Array.isArray(p.samples) ? p.samples.length : 0
        };
      })
      .filter((p) => Boolean(p.name) && p.sampleCount > 0)
      .sort((a, b) => {
        if (b.sampleCount !== a.sampleCount) return b.sampleCount - a.sampleCount;
        return a.name.localeCompare(b.name);
      });
  }

  function hasLearnedPerson(name) {
    const key = normalizePersonKey(name);
    if (!key) return false;
    const db = loadNeuralDb();
    const rec = db.people[key];
    return Boolean(rec && Array.isArray(rec.samples) && rec.samples.length > 0);
  }

  function scoreDescriptorAgainstPeople(vec, db, personKeys, photoNameSet) {
    const scored = [];
    for (let i = 0; i < personKeys.length; i++) {
      const pKey = personKeys[i];
      const person = db.people[pKey];
      const rawDist = computeEffectiveDistance(vec, person.samples);
      const effectiveDist = (photoNameSet && photoNameSet.has(pKey)) ? Math.max(0, rawDist - 0.03) : rawDist;
      if (effectiveDist <= MAX_MATCH_DIST) {
        const score = distToScore(effectiveDist);
        scored.push({
          key: pKey,
          person,
          name: person.name,
          fsId: person.fsId || '',
          rel: person.rel || 'Relative',
          branch: person.branch || '',
          avatar: person.avatar || '',
          dist: Math.round(effectiveDist * 1000) / 1000,
          score,
          confidence: Math.round(score * 100)
        });
      }
    }
    scored.sort((a, b) => a.dist - b.dist);
    return scored;
  }

  async function recognizeFaces(source, faces, photoPeople, opts = {}) {
    if (!source || !faces || faces.length === 0) return faces || [];
    let imgEl;
    try {
      imgEl = await loadImageElement(source);
    } catch {
      return faces;
    }

    const db = loadNeuralDb();
    const personKeys = Object.keys(db.people).filter((k) =>
      db.people[k] && Array.isArray(db.people[k].samples) && db.people[k].samples.length > 0
    );

    const photoNameSet = new Set();
    if (Array.isArray(photoPeople)) {
      photoPeople.forEach((pr) => {
        const pn = typeof pr === 'string' ? pr : (pr && pr.name ? pr.name : '');
        if (pn) photoNameSet.add(normalizePersonKey(pn));
      });
    }

    const needsDetection = faces.some((f) => !Array.isArray(f.descriptor) || f.descriptor.length !== 128);
    let neuralDets = [];
    if (needsDetection) {
      try {
        neuralDets = await detectWithDescriptorsOnImg(imgEl, { minConfidence: 0.50, maxDim: opts.maxDim || 960 });
      } catch {
        neuralDets = [];
      }
    }

    const allPairs = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const b = f.box || { x: 0, y: 0, width: 0.2, height: 0.2 };
      if (!f.cropUrl) f.cropUrl = cropFaceThumbnailFromImg(imgEl, b, 96);

      let vec = (Array.isArray(f.descriptor) && f.descriptor.length === 128) ? f.descriptor : null;
      if (!vec && neuralDets.length > 0) {
        let bestIoU = 0;
        let bestDet = null;
        for (let di = 0; di < neuralDets.length; di++) {
          const iou = boxIoU(b, neuralDets[di].box);
          if (iou > bestIoU) {
            bestIoU = iou;
            bestDet = neuralDets[di];
          }
        }
        if (bestDet && bestIoU >= 0.25) vec = bestDet.descriptor;
      }
      if (!vec) {
        try {
          vec = await computeDescriptorForBoxOnImg(imgEl, b);
        } catch {
          vec = null;
        }
      }
      if (vec) f.descriptor = vec;
      f.candidates = [];

      if (personKeys.length > 0 && vec) {
        const scoredForFace = scoreDescriptorAgainstPeople(vec, db, personKeys, photoNameSet);
        f.candidates = scoredForFace.slice(0, 3).map((c) => ({
          key: c.key,
          name: c.name,
          fsId: c.fsId,
          rel: c.rel,
          branch: c.branch,
          avatar: c.avatar,
          dist: c.dist,
          score: c.score,
          confidence: c.confidence
        }));
        for (let ci = 0; ci < scoredForFace.length; ci++) {
          const c = scoredForFace[ci];
          allPairs.push({
            faceIdx: i,
            personKey: c.key,
            person: c.person,
            dist: c.dist,
            score: c.score
          });
        }
      }
    }

    allPairs.sort((a, b) => a.dist - b.dist);
    const assignedFaces = new Set();
    const assignedPeople = new Set();

    faces.forEach((f, idx) => {
      if (f.confirmed && f.name) {
        assignedFaces.add(idx);
        assignedPeople.add(normalizePersonKey(f.name));
      }
    });

    for (let pIdx = 0; pIdx < allPairs.length; pIdx++) {
      const pair = allPairs[pIdx];
      if (assignedFaces.has(pair.faceIdx) || assignedPeople.has(pair.personKey)) continue;

      const targetFace = faces[pair.faceIdx];
      const inPhotoPeople = photoNameSet.has(pair.personKey);
      const canAutoAssign = (photoNameSet.size === 0 && pair.dist <= AUTO_ASSIGN_DIST) || (inPhotoPeople && pair.dist <= 0.45);
      let safeFsId = pair.person.fsId || '';
      if (safeFsId && typeof window !== 'undefined' && window.FamilySearchClient && typeof window.FamilySearchClient.isPidValidForPersonName === 'function') {
        if (!window.FamilySearchClient.isPidValidForPersonName(safeFsId, pair.person.name)) {
          safeFsId = '';
        }
      }

      if (canAutoAssign) {
        targetFace.name = pair.person.name;
        if (safeFsId && !targetFace.fsId) targetFace.fsId = safeFsId;
        targetFace.recognized = true;
        targetFace.suggestedName = pair.person.name;
        targetFace.suggestedFsId = safeFsId;
        targetFace.matchConfidence = Math.round(pair.score * 100);
        assignedFaces.add(pair.faceIdx);
        assignedPeople.add(pair.personKey);
      } else if (pair.dist <= SUGGEST_DIST_CUTOFF) {
        targetFace.suggestedName = pair.person.name;
        targetFace.suggestedFsId = safeFsId;
        targetFace.matchConfidence = Math.round(pair.score * 100);
        assignedFaces.add(pair.faceIdx);
        assignedPeople.add(pair.personKey);
      }
    }

    return faces;
  }

  async function matchPhotoAgainstLearned(source, targetPersonName = '', opts = {}) {
    const db = loadNeuralDb();
    let personKeys = Object.keys(db.people).filter((k) =>
      db.people[k] && Array.isArray(db.people[k].samples) && db.people[k].samples.length > 0
    );
    if (targetPersonName) {
      const targetKey = normalizePersonKey(targetPersonName);
      personKeys = personKeys.filter((k) => k === targetKey);
    }
    if (personKeys.length === 0) return [];

    const detected = await detectFaces(source, {
      maxDim: opts.maxDim || 640,
      minConfidence: opts.minConfidence !== undefined ? opts.minConfidence : 0.62
    });
    if (!detected.length) return [];

    const hits = [];
    for (let i = 0; i < detected.length; i++) {
      const f = detected[i];
      if (!f.descriptor) continue;
      const scored = scoreDescriptorAgainstPeople(f.descriptor, db, personKeys, null);
      if (scored.length > 0 && scored[0].dist <= SUGGEST_DIST_CUTOFF) {
        const best = scored[0];
        hits.push({
          faceBox: f.box,
          cropUrl: f.cropUrl,
          personName: best.name,
          fsId: best.fsId,
          dist: best.dist,
          score: best.score,
          confidence: best.confidence,
          avatar: best.avatar
        });
      }
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  async function cropFaceThumbnail(source, box) {
    if (!source || !box) return '';
    try {
      const imgEl = await loadImageElement(source);
      return cropFaceThumbnailFromImg(imgEl, box, 96);
    } catch {
      return '';
    }
  }

  function toGedcomXRegion(box) {
    if (legacyFallback && typeof legacyFallback.toGedcomXRegion === 'function') {
      return legacyFallback.toGedcomXRegion(box);
    }
    const b = box || { x: 0, y: 0, width: 0.2, height: 0.2 };
    return {
      x: Math.max(0, Math.min(1, Number(b.x) || 0)),
      y: Math.max(0, Math.min(1, Number(b.y) || 0)),
      width: Math.max(0.01, Math.min(1, Number(b.width) || 0.2)),
      height: Math.max(0.01, Math.min(1, Number(b.height) || 0.2))
    };
  }

  function cleanupMismatchedPids() {
    const isPidValid = (typeof window !== 'undefined' && window.FamilySearchClient && typeof window.FamilySearchClient.isPidValidForPersonName === 'function')
      ? window.FamilySearchClient.isPidValidForPersonName
      : null;
    if (!isPidValid) return;

    const db = loadNeuralDb();
    let changed = false;
    Object.keys(db.people).forEach((k) => {
      const p = db.people[k];
      if (p && p.fsId && !isPidValid(p.fsId, p.name)) {
        p.fsId = '';
        changed = true;
      }
    });
    if (changed) saveNeuralDb(db);
    if (legacyFallback && typeof legacyFallback.cleanupMismatchedPids === 'function') {
      legacyFallback.cleanupMismatchedPids();
    }
  }

  async function loadCascade() {
    return true;
  }

  return {
    detectFaces,
    recognizeFaces,
    matchPhotoAgainstLearned,
    learnFace,
    forgetFace,
    getLearnedPeople,
    hasLearnedPerson,
    extractFaceDescriptor,
    cropFaceThumbnail,
    makeFaceSourceKey,
    toGedcomXRegion,
    cleanupMismatchedPids,
    ensureNeuralModelsLoaded,
    getEngineInfo,
    loadCascade
  };
}

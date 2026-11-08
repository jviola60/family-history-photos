/**
 * Family History Photos - Browser Face Detection Engine
 * 100% Client-Side, fully offline, no server dependencies.
 * Powered by Pico.js cascade classifier + ShapeDetection API fallback.
 */

(function (window) {
  'use strict';

  var picoClassifier = null;
  var cascadePromise = null;

  // Unpack binary Haar/Viola-Jones cascade model
  function unpackCascade(bytes) {
    var dview = new DataView(new ArrayBuffer(4));
    var p = 8;

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    var tdepth = dview.getInt32(0, true);
    p = p + 4;

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    var ntrees = dview.getInt32(0, true);
    p = p + 4;

    var tcodes_ls = [];
    var tpreds_ls = [];
    var thresh_ls = [];

    for (var t = 0; t < ntrees; ++t) {
      Array.prototype.push.apply(tcodes_ls, [0, 0, 0, 0]);
      Array.prototype.push.apply(tcodes_ls, bytes.slice(p, p + 4 * Math.pow(2, tdepth) - 4));
      p = p + 4 * Math.pow(2, tdepth) - 4;

      for (var i = 0; i < Math.pow(2, tdepth); ++i) {
        dview.setUint8(0, bytes[p + 0]);
        dview.setUint8(1, bytes[p + 1]);
        dview.setUint8(2, bytes[p + 2]);
        dview.setUint8(3, bytes[p + 3]);
        tpreds_ls.push(dview.getFloat32(0, true));
        p = p + 4;
      }

      dview.setUint8(0, bytes[p + 0]);
      dview.setUint8(1, bytes[p + 1]);
      dview.setUint8(2, bytes[p + 2]);
      dview.setUint8(3, bytes[p + 3]);
      thresh_ls.push(dview.getFloat32(0, true));
      p = p + 4;
    }

    var tcodes = new Int8Array(tcodes_ls);
    var tpreds = new Float32Array(tpreds_ls);
    var thresh = new Float32Array(thresh_ls);

    return function classifyRegion(r, c, s, pixels, ldim) {
      r = 256 * r;
      c = 256 * c;
      var root = 0;
      var o = 0.0;
      var pow2tdepth = Math.pow(2, tdepth) >> 0;

      for (var i = 0; i < ntrees; ++i) {
        var idx = 1;
        for (var j = 0; j < tdepth; ++j) {
          idx = 2 * idx + (
            pixels[((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8)] <=
            pixels[((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8)]
          );
        }
        o = o + tpreds[pow2tdepth * i + idx - pow2tdepth];
        if (o <= thresh[i]) return -1;
        root += 4 * pow2tdepth;
      }
      return o - thresh[ntrees - 1];
    };
  }

  function runCascade(image, classifyRegion, params) {
    var pixels = image.pixels;
    var nrows = image.nrows;
    var ncols = image.ncols;
    var ldim = image.ldim;

    var shiftfactor = params.shiftfactor || 0.1;
    var minsize = params.minsize || 24;
    var maxsize = params.maxsize || 600;
    var scalefactor = params.scalefactor || 1.15;

    var scale = minsize;
    var detections = [];

    while (scale <= maxsize) {
      var step = Math.max(shiftfactor * scale, 1) >> 0;
      var offset = (scale / 2 + 1) >> 0;

      for (var r = offset; r <= nrows - offset; r += step) {
        for (var c = offset; c <= ncols - offset; c += step) {
          var q = classifyRegion(r, c, scale, pixels, ldim);
          if (q > 0.0) {
            detections.push([r, c, scale, q]);
          }
        }
      }
      scale = scale * scalefactor;
    }
    return detections;
  }

  function clusterDetections(dets, iouthreshold) {
    iouthreshold = iouthreshold || 0.25;
    dets = dets.slice().sort(function (a, b) { return b[3] - a[3]; });

    function calculateIoU(det1, det2) {
      var r1 = det1[0], c1 = det1[1], s1 = det1[2];
      var r2 = det2[0], c2 = det2[1], s2 = det2[2];
      var overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
      var overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
      return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
    }

    var assignments = new Array(dets.length).fill(0);
    var clusters = [];

    for (var i = 0; i < dets.length; ++i) {
      if (assignments[i] === 0) {
        var r = 0.0, c = 0.0, s = 0.0, q = 0.0, n = 0, maxQ = dets[i][3];
        for (var j = i; j < dets.length; ++j) {
          if (calculateIoU(dets[i], dets[j]) > iouthreshold) {
            assignments[j] = 1;
            r += dets[j][0];
            c += dets[j][1];
            s += dets[j][2];
            q += dets[j][3];
            if (dets[j][3] > maxQ) maxQ = dets[j][3];
            n++;
          }
        }
        clusters.push([r / n, c / n, s / n, q, n, maxQ]);
      }
    }
    return clusters;
  }

  /**
   * Multi-Scale Non-Maximum Suppression with Containment Elimination.
   * Eliminates spurious oversized torso/clothing boxes when a tighter face is inside,
   * and eliminates duplicate overlapping boxes on the same face.
   */
  function nonMaxSuppressionWithContainment(clusters) {
    if (!clusters || clusters.length <= 1) return clusters || [];
    var sorted = clusters.slice().sort(function (a, b) { return b[3] - a[3]; });
    var suppressed = new Set();

    for (var i = 0; i < sorted.length; i++) {
      if (suppressed.has(i)) continue;
      var r1 = sorted[i][0], c1 = sorted[i][1], s1 = sorted[i][2], q1 = sorted[i][3];
      var top1 = r1 - s1 * 0.5, bot1 = r1 + s1 * 0.5, left1 = c1 - s1 * 0.5, right1 = c1 + s1 * 0.5;
      var area1 = s1 * s1;

      for (var j = 0; j < sorted.length; j++) {
        if (i === j || suppressed.has(j)) continue;
        var r2 = sorted[j][0], c2 = sorted[j][1], s2 = sorted[j][2], q2 = sorted[j][3];
        var top2 = r2 - s2 * 0.5, bot2 = r2 + s2 * 0.5, left2 = c2 - s2 * 0.5, right2 = c2 + s2 * 0.5;
        var area2 = s2 * s2;

        var interR = Math.max(0, Math.min(bot1, bot2) - Math.max(top1, top2));
        var interC = Math.max(0, Math.min(right1, right2) - Math.max(left1, left2));
        var interArea = interR * interC;
        if (interArea <= 0) continue;

        var minArea = Math.min(area1, area2);
        var unionArea = area1 + area2 - interArea;
        var iou = interArea / unionArea;
        var iom = interArea / minArea; // Containment ratio
        var scaleRatio = Math.max(s1, s2) / Math.min(s1, s2);

        // Case 1: One box substantially contains the other (e.g. torso/collar box enclosing a face)
        if (iom > 0.38 && scaleRatio >= 1.32) {
          // The smaller box is the true face crop; the larger box is the enclosing torso/clothing false positive
          var largerIdx = s1 > s2 ? i : j;
          suppressed.add(largerIdx);
          if (largerIdx === i) break;
        } else if (iou > 0.28 || (iom > 0.45 && scaleRatio < 1.32)) {
          // Case 2: Similar-scale duplicate detection of the same face
          var weakerIdx = q1 >= q2 ? j : i;
          suppressed.add(weakerIdx);
          if (weakerIdx === i) break;
        }
      }
    }

    return sorted.filter(function (_, idx) { return !suppressed.has(idx); });
  }

  async function loadCascade() {
    if (picoClassifier) return picoClassifier;
    if (cascadePromise) return cascadePromise;

    cascadePromise = (async function () {
      var candidates = [
        'models/facefinder',
        './models/facefinder',
        '/models/facefinder',
        '../models/facefinder',
        'https://jviola60.github.io/family-history-photos/models/facefinder'
      ];

      for (var i = 0; i < candidates.length; i++) {
        try {
          var res = await fetch(candidates[i]);
          if (res.ok) {
            var buf = await res.arrayBuffer();
            picoClassifier = unpackCascade(new Int8Array(buf));
            return picoClassifier;
          }
        } catch (e) {
          // try next
        }
      }
      console.warn('FaceDetectorEngine: Failed to load facefinder cascade.');
      return null;
    })();

    return cascadePromise;
  }

  function loadImageElement(source) {
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
      return Promise.resolve(source);
    }
    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
      return Promise.resolve(source);
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var objectUrl = null;
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = function () {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image for face detection'));
      };
      if (typeof Blob !== 'undefined' && source instanceof Blob) {
        objectUrl = URL.createObjectURL(source);
        img.src = objectUrl;
      } else {
        img.src = typeof source === 'string' ? source : (source && source.src ? source.src : '');
      }
    });
  }

  function sortFacesSpatially(faces) {
    if (!faces || faces.length <= 1) return faces || [];
    var list = faces.slice();
    // Sort roughly top-to-bottom first to seed horizontal standing/sitting rows
    list.sort(function (a, b) {
      var ba = a.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
      var bb = b.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
      return (ba.y + ba.height * 0.5) - (bb.y + bb.height * 0.5);
    });

    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var b = item.box || { x: 0, y: 0, width: 0.1, height: 0.1 };
      var cy = b.y + b.height * 0.5;
      var cx = b.x + b.width * 0.5;
      var placed = false;

      for (var r = 0; r < rows.length; r++) {
        var rowObj = rows[r];
        var tolY = Math.max(0.18, rowObj.avgH * 1.35);
        if (Math.abs(cy - rowObj.avgCy) <= tolY) {
          // Ensure this face isn't stacked directly above/below someone already in this row
          var xConflict = false;
          for (var k = 0; k < rowObj.items.length; k++) {
            var ob = rowObj.items[k].box || { x: 0, y: 0, width: 0.1, height: 0.1 };
            var ocx = ob.x + ob.width * 0.5;
            if (Math.abs(cx - ocx) < Math.min(b.width, ob.width) * 0.55) {
              xConflict = true;
              break;
            }
          }
          if (!xConflict) {
            var n = rowObj.items.length;
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

    rows.sort(function (a, b) { return a.avgCy - b.avgCy; });
    var out = [];
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].items.sort(function (a, b) {
        return ((a.box && a.box.x) || 0) - ((b.box && b.box.x) || 0);
      });
      for (var m = 0; m < rows[ri].items.length; m++) {
        out.push(rows[ri].items[m]);
      }
    }
    return out;
  }

  async function detectFaces(source) {
    if (!source) return [];
    var imgEl;
    try {
      imgEl = await loadImageElement(source);
    } catch (e) {
      console.warn('FaceDetectorEngine image load error:', e);
      return [];
    }

    var origW = imgEl.naturalWidth || imgEl.width || 320;
    var origH = imgEl.naturalHeight || imgEl.height || 240;
    if (origW < 20 || origH < 20) return [];

    // Use 1200px working resolution (and gentle upscale on small scans) so group-photo faces stay >= 28px
    var maxDim = 1200;
    var scale = Math.min(maxDim / origW, maxDim / origH, 1.8);
    var w = Math.max(48, Math.round(origW * scale));
    var h = Math.max(48, Math.round(origH * scale));

    // 1. Collect native FaceDetector hits if available (merged with cascade below so speckled vintage faces aren't missed)
    var nativeClusters = [];
    if (typeof window.FaceDetector === 'function') {
      try {
        var nativeDetector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 30 });
        var nativeFaces = await nativeDetector.detect(imgEl);
        if (nativeFaces && nativeFaces.length > 0) {
          nativeClusters = nativeFaces.map(function (f) {
            var bb = f.boundingBox;
            var r = (bb.y + bb.height * 0.5) * scale;
            var c = (bb.x + bb.width * 0.5) * scale;
            var s = Math.max(bb.width, bb.height) * scale;
            return [r, c, s, 48.0, 8, 16.0];
          });
        }
      } catch (nativeErr) {
        // Continue to multi-pass cascade
      }
    }

    // 2. Multi-pass Despeckled + Local-Contrast PICO Cascade Detector
    var classifier = await loadCascade();
    if (!classifier && nativeClusters.length === 0) return [];

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, 0, 0, w, h);

    var imgData = ctx.getImageData(0, 0, w, h);
    var data = imgData.data;

    // Detect if image is colored or monochrome (black & white / sepia)
    var colorDiffSum = 0;
    var sampleStep = Math.max(4, Math.floor((w * h) / 1000));
    var sampleCount = 0;
    for (var pIdx = 0; pIdx < data.length; pIdx += sampleStep * 4) {
      var pr = data[pIdx], pg = data[pIdx + 1], pb = data[pIdx + 2];
      colorDiffSum += Math.abs(pr - pg) + Math.abs(pr - pb) + Math.abs(pg - pb);
      sampleCount++;
    }
    var isColorImage = (sampleCount > 0 && (colorDiffSum / sampleCount) > 14);

    var grayRaw = new Uint8Array(w * h);
    for (var r = 0; r < h; ++r) {
      for (var c = 0; c < w; ++c) {
        var idx = (r * w + c) * 4;
        grayRaw[r * w + c] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      }
    }

    // 3x3 median despeckle so white vintage snow/pebble glare dots don't blind the cascade
    var gray = new Uint8Array(grayRaw);
    var medWin = new Uint8Array(9);
    for (var mr = 1; mr < h - 1; ++mr) {
      var mRow = mr * w;
      for (var mc = 1; mc < w - 1; ++mc) {
        var mk = 0;
        for (var mdy = -1; mdy <= 1; ++mdy) {
          var nrOff = (mr + mdy) * w + mc;
          for (var mdx = -1; mdx <= 1; ++mdx) {
            medWin[mk++] = grayRaw[nrOff + mdx];
          }
        }
        for (var ma = 1; ma < 9; ++ma) {
          var mv = medWin[ma];
          var mb = ma - 1;
          while (mb >= 0 && medWin[mb] > mv) {
            medWin[mb + 1] = medWin[mb];
            mb--;
          }
          medWin[mb + 1] = mv;
        }
        gray[mRow + mc] = medWin[4];
      }
    }

    var validClusters = nativeClusters.slice();

    if (classifier) {
      // Build local-contrast normalized gray via integral image so faded/flash-washed & sunglasses faces pop
      var normGray = new Uint8Array(w * h);
      var lRad = Math.max(12, Math.round(Math.min(w, h) * 0.035));
      var stride = w + 1;
      var intS = new Float64Array(stride * (h + 1));
      var intSq = new Float64Array(stride * (h + 1));
      for (var iy = 1; iy <= h; ++iy) {
        var rowS = 0, rowSq = 0;
        var gRow = (iy - 1) * w;
        var iRow = iy * stride;
        var pRow = (iy - 1) * stride;
        for (var ix = 1; ix <= w; ++ix) {
          var gv = gray[gRow + (ix - 1)];
          rowS += gv;
          rowSq += gv * gv;
          intS[iRow + ix] = intS[pRow + ix] + rowS;
          intSq[iRow + ix] = intSq[pRow + ix] + rowSq;
        }
      }
      for (var ny = 0; ny < h; ++ny) {
        var y0 = Math.max(0, ny - lRad), y1 = Math.min(h, ny + lRad + 1);
        var r0 = y0 * stride, r1 = y1 * stride;
        var outRow = ny * w;
        for (var nx = 0; nx < w; ++nx) {
          var x0 = Math.max(0, nx - lRad), x1 = Math.min(w, nx + lRad + 1);
          var area = (y1 - y0) * (x1 - x0);
          var sumL = intS[r1 + x1] - intS[r0 + x1] - intS[r1 + x0] + intS[r0 + x0];
          var sumSqL = intSq[r1 + x1] - intSq[r0 + x1] - intSq[r1 + x0] + intSq[r0 + x0];
          var meanL = sumL / area;
          var stdL = Math.max(13, Math.sqrt(Math.max(0, sumSqL / area - meanL * meanL)));
          var origV = gray[outRow + nx];
          var stretched = 128 + ((origV - meanL) / stdL) * 46;
          normGray[outRow + nx] = Math.max(0, Math.min(255, Math.round(0.32 * origV + 0.68 * stretched)));
        }
      }

      var minsize = Math.max(24, Math.round(Math.min(w, h) * 0.038));
      var maxsize = Math.round(Math.min(w, h) * 0.70);
      var cascadeParams = {
        shiftfactor: 0.06,
        minsize: minsize,
        maxsize: maxsize,
        scalefactor: 1.09
      };

      var dets1 = runCascade({ pixels: gray, nrows: h, ncols: w, ldim: w }, classifier, cascadeParams) || [];
      var dets2 = runCascade({ pixels: normGray, nrows: h, ncols: w, ldim: w }, classifier, cascadeParams) || [];
      var rawDetections = dets1.concat(dets2);

      if (rawDetections.length > 0) {
        var clusters = clusterDetections(rawDetections, 0.25);
        var cascadeValid = clusters.filter(function (c) {
          return (c[4] >= 3 && c[5] >= 7.8) || (c[4] >= 6 && c[3] >= 38.0);
        });
        validClusters = validClusters.concat(cascadeValid);
      }
    }

    if (validClusters.length === 0) return [];

    // Apply Multi-Scale Non-Maximum Suppression with Containment & Center-Proximity Elimination
    validClusters = nonMaxSuppressionWithContainment(validClusters);
    var deduped = [];
    for (var di = 0; di < validClusters.length; di++) {
      var cand = validClusters[di];
      var dup = false;
      for (var dj = 0; dj < deduped.length; dj++) {
        var kept = deduped[dj];
        var maxSz = Math.max(cand[2], kept[2]);
        if (Math.abs(cand[0] - kept[0]) < maxSz * 0.48 && Math.abs(cand[1] - kept[1]) < maxSz * 0.48) {
          dup = true;
          break;
        }
      }
      if (!dup) deduped.push(cand);
    }
    validClusters = deduped;
    if (validClusters.length === 0) return [];

    var results = [];
    for (var i = 0; i < validClusters.length; i++) {
      var row = validClusters[i][0];
      var col = validClusters[i][1];
      var size = validClusters[i][2];
      var quality = validClusters[i][3];
      var maxQ = validClusters[i][5] || quality;

      // Validate standard deviation of pixels to avoid flat walls/columns, and check skin tones (including pale/flash-lit 1980s skin)
      var halfProbe = size * 0.5;
      var sx = Math.max(0, Math.round(col - halfProbe));
      var ex = Math.min(w - 1, Math.round(col + halfProbe));
      var sy = Math.max(0, Math.round(row - halfProbe));
      var ey = Math.min(h - 1, Math.round(row + halfProbe));

      var sum = 0, sumSq = 0, count = 0;
      var skinCount = 0;
      var midY = (sy + ey) * 0.5;
      var topSkin = 0, botSkin = 0;

      for (var py = sy; py <= ey; py += 2) {
        for (var px = sx; px <= ex; px += 2) {
          var val = gray[py * w + px];
          sum += val;
          sumSq += val * val;
          count++;

          if (isColorImage) {
            var cIdx = (py * w + px) * 4;
            var cr = data[cIdx], cg = data[cIdx + 1], cb = data[cIdx + 2];
            var isWarmSkin = cr > 45 && cg > 25 && cb > 20 && cr > cb && (cr - cb) >= 6 && (cr - cg) >= 1;
            var maxCh = cr > cg ? (cr > cb ? cr : cb) : (cg > cb ? cg : cb);
            var minCh = cr < cg ? (cr < cb ? cr : cb) : (cg < cb ? cg : cb);
            var isPaleVintageSkin = cr > 145 && cg > 130 && cb > 125 && cr >= cb - 2 && cr >= cg - 1 && (maxCh - minCh) <= 45;
            if (isWarmSkin || isPaleVintageSkin) {
              skinCount++;
              if (py < midY) topSkin++;
              else botSkin++;
            }
          }
        }
      }

      if (count > 0) {
        var mean = sum / count;
        var variance = (sumSq / count) - (mean * mean);
        if (Math.sqrt(Math.max(0, variance)) < 10) continue;

        if (isColorImage) {
          var skinRatio = skinCount / count;
          if (skinRatio < 0.10 && maxQ < 12.5) continue;
          if (botSkin === 0 && topSkin > 0 && (size / Math.min(w, h)) > 0.25) continue;
        }
      }

      var halfW = size * 0.54;
      var halfH = size * 0.58;
      var xNorm = Math.max(0, (col - halfW) / w);
      var yNorm = Math.max(0, (row - halfH) / h);
      var wNorm = Math.min(1 - xNorm, (halfW * 2) / w);
      var hNorm = Math.min(1 - yNorm, (halfH * 2) / h);

      results.push({
        id: 'face_' + Date.now() + '_' + i,
        box: {
          x: Math.round(xNorm * 1000) / 1000,
          y: Math.round(yNorm * 1000) / 1000,
          width: Math.round(wNorm * 1000) / 1000,
          height: Math.round(hNorm * 1000) / 1000
        },
        confidence: Math.min(0.99, Math.round((0.72 + Math.min(quality, 28) / 100) * 100) / 100)
      });
    }

    return sortFacesSpatially(results);
  }

  /**
   * Convert normalized box ({x, y, width, height}) into FamilySearch / GEDCOM X RectangleRegion string
   * Format: "x,y,width,height" where all values are 0.0 - 1.0 floats
   */
  function toGedcomXRegion(box) {
    if (!box) return null;
    var x = Math.max(0, Math.min(0.99, box.x !== undefined ? Number(box.x) : (box.left !== undefined ? Number(box.left) : 0)));
    var y = Math.max(0, Math.min(0.99, box.y !== undefined ? Number(box.y) : (box.top !== undefined ? Number(box.top) : 0)));
    var w = Math.max(0.01, Math.min(1 - x, box.width !== undefined ? Number(box.width) : (box.w !== undefined ? Number(box.w) : 0.15)));
    var h = Math.max(0.01, Math.min(1 - y, box.height !== undefined ? Number(box.height) : (box.h !== undefined ? Number(box.h) : 0.15)));

    return [
      x.toFixed(4),
      y.toFixed(4),
      w.toFixed(4),
      h.toFixed(4)
    ].join(',');
  }

  /* =====================================================================
   * VISUAL FACE RECOGNITION & PORTRAIT CROP ENGINE
   * Learns 192-dim zero-mean facial structure + chromaticity descriptors
   * when relatives are tagged, and recognizes them on scans.
   * ===================================================================== */
  var FACE_DB_KEY = 'fhp_face_recognition_v1';

  function loadFaceDb() {
    try {
      var raw = localStorage.getItem(FACE_DB_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.people) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('FaceDetectorEngine: Could not read face recognition store:', e);
    }
    return { version: 1, people: {} };
  }

  function saveFaceDb(db) {
    try {
      localStorage.setItem(FACE_DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('FaceDetectorEngine: Could not save face recognition store:', e);
    }
  }

  function normalizePersonKey(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isValidPersonName(name) {
    var s = String(name || '').trim();
    if (!s) return false;
    if (/^face\s*#?\d+/i.test(s) || /^person\s*#?\d+/i.test(s) || /^unidentified/i.test(s) || /^unknown/i.test(s)) {
      return false;
    }
    return true;
  }

  function makeFaceSourceKey(photoId, box) {
    if (!photoId || !box) return '';
    var bx = Math.round((Number(box.x) || 0) * 100);
    var by = Math.round((Number(box.y) || 0) * 100);
    var bw = Math.round((Number(box.width) || 0.2) * 100);
    return String(photoId) + ':' + bx + '_' + by + '_' + bw;
  }

  function zScoreNormalize(arr) {
    var n = arr.length;
    if (n === 0) return arr;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += arr[i];
    var mean = sum / n;
    var sq = 0;
    for (var j = 0; j < n; j++) {
      var d = arr[j] - mean;
      sq += d * d;
    }
    var std = Math.sqrt(sq / n);
    var out = new Array(n);
    if (std < 1e-5) {
      for (var k = 0; k < n; k++) out[k] = 0;
      return out;
    }
    for (var m = 0; m < n; m++) {
      out[m] = (arr[m] - mean) / std;
    }
    return out;
  }

  function cropFaceThumbnailFromImg(imgEl, box, outSize) {
    var size = outSize || 96;
    var origW = imgEl.naturalWidth || imgEl.width || 320;
    var origH = imgEl.naturalHeight || imgEl.height || 240;
    var bx = box && box.x !== undefined ? Number(box.x) : 0;
    var by = box && box.y !== undefined ? Number(box.y) : 0;
    var bw = box && box.width !== undefined ? Number(box.width) : 0.2;
    var bh = box && box.height !== undefined ? Number(box.height) : 0.2;

    // Add 18% context padding so hair/chin/shoulders frame the portrait nicely
    var padX = bw * 0.18;
    var padY = bh * 0.18;
    var sx = Math.max(0, Math.round((bx - padX) * origW));
    var sy = Math.max(0, Math.round((by - padY) * origH));
    var sw = Math.min(origW - sx, Math.max(16, Math.round((bw + padX * 2) * origW)));
    var sh = Math.min(origH - sy, Math.max(16, Math.round((bh + padY * 2) * origH)));

    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var ctx = c.getContext('2d');
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.85);
  }

  async function cropFaceThumbnail(source, box) {
    if (!source || !box) return '';
    try {
      var imgEl = await loadImageElement(source);
      return cropFaceThumbnailFromImg(imgEl, box, 96);
    } catch (e) {
      return '';
    }
  }

  function extractDescriptorFromImg(imgEl, box) {
    var origW = imgEl.naturalWidth || imgEl.width || 320;
    var origH = imgEl.naturalHeight || imgEl.height || 240;
    var bx = box && box.x !== undefined ? Number(box.x) : 0;
    var by = box && box.y !== undefined ? Number(box.y) : 0;
    var bw = box && box.width !== undefined ? Number(box.width) : 0.2;
    var bh = box && box.height !== undefined ? Number(box.height) : 0.2;

    // Slight horizontal inset (4%) focuses on facial features rather than background wall
    var insetX = bw * 0.04;
    var sx = Math.max(0, Math.round((bx + insetX) * origW));
    var sy = Math.max(0, Math.round(by * origH));
    var sw = Math.min(origW - sx, Math.max(12, Math.round((bw - insetX * 2) * origW)));
    var sh = Math.min(origH - sy, Math.max(12, Math.round(bh * origH)));

    var S = 48; // 48x48 canonical face patch -> 8x8 cells of 6x6 pixels
    var c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, S, S);
    var data = ctx.getImageData(0, 0, S, S).data;

    var gray = new Float32Array(S * S);
    var rgWarm = new Float32Array(S * S);
    var gbTint = new Float32Array(S * S);

    for (var i = 0; i < S * S; i++) {
      var r = data[i * 4];
      var g = data[i * 4 + 1];
      var b = data[i * 4 + 2];
      var tot = r + g + b + 1.0;
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      rgWarm[i] = (r - b) / tot;
      gbTint[i] = (g - 0.5 * (r + b)) / tot;
    }

    // 1. 64-dim 8x8 spatial luminance (Z-scored to be illumination invariant & zero-mean)
    var lumCells = new Array(64);
    var cellW = S / 8; // 6
    for (var cy = 0; cy < 8; cy++) {
      for (var cx = 0; cx < 8; cx++) {
        var lSum = 0;
        for (var py = cy * cellW; py < (cy + 1) * cellW; py++) {
          for (var px = cx * cellW; px < (cx + 1) * cellW; px++) {
            lSum += gray[py * S + px];
          }
        }
        lumCells[cy * 8 + cx] = lSum / (cellW * cellW);
      }
    }
    var lumNorm = zScoreNormalize(lumCells);

    // 2. 64-dim facial edge gradients: 8x4 horizontal |dx| + 8x4 vertical |dy|
    var dxCells = new Array(32);
    var dyCells = new Array(32);
    for (var gy = 0; gy < 8; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var sumDx = 0, sumDy = 0, cntG = 0;
        var startY = gy * 6;
        var startX = gx * 12;
        for (var y = startY; y < startY + 6; y++) {
          for (var x = startX; x < startX + 12; x++) {
            var xm = Math.max(0, x - 1), xp = Math.min(S - 1, x + 1);
            var ym = Math.max(0, y - 1), yp = Math.min(S - 1, y + 1);
            sumDx += Math.abs(gray[y * S + xp] - gray[y * S + xm]);
            sumDy += Math.abs(gray[yp * S + x] - gray[ym * S + x]);
            cntG++;
          }
        }
        dxCells[gy * 4 + gx] = sumDx / cntG;
        dyCells[gy * 4 + gx] = sumDy / cntG;
      }
    }
    var gradNorm = zScoreNormalize(dxCells.concat(dyCells));

    // 3. 64-dim hair/skin chromaticity distribution (8x4 warm-cool + 8x4 tint)
    var warmCells = new Array(32);
    var tintCells = new Array(32);
    var chromaVarCheck = 0;
    for (var hy = 0; hy < 8; hy++) {
      for (var hx = 0; hx < 4; hx++) {
        var wSum = 0, tSum = 0, cCnt = 0;
        for (var y2 = hy * 6; y2 < (hy + 1) * 6; y2++) {
          for (var x2 = hx * 12; x2 < (hx + 1) * 12; x2++) {
            wSum += rgWarm[y2 * S + x2];
            tSum += gbTint[y2 * S + x2];
            cCnt++;
          }
        }
        var wAvg = wSum / cCnt;
        warmCells[hy * 4 + hx] = wAvg;
        tintCells[hy * 4 + hx] = tSum / cCnt;
        chromaVarCheck += Math.abs(wAvg);
      }
    }
    var isColored = (chromaVarCheck / 32) > 0.025;
    var chromaWeight = isColored ? 0.65 : 0.15;
    var chromaNorm = zScoreNormalize(warmCells.concat(tintCells));

    // Combine 192 dimensions and L2-normalize to unit sphere
    var vec = new Array(192);
    var normSq = 0;
    for (var d = 0; d < 64; d++) {
      var v0 = lumNorm[d] * 1.0;
      var v1 = gradNorm[d] * 1.15;
      var v2 = chromaNorm[d] * chromaWeight;
      vec[d] = v0;
      vec[64 + d] = v1;
      vec[128 + d] = v2;
      normSq += v0 * v0 + v1 * v1 + v2 * v2;
    }
    var mag = Math.sqrt(normSq) || 1;
    for (var idx = 0; idx < 192; idx++) {
      vec[idx] = Math.round((vec[idx] / mag) * 10000) / 10000;
    }
    return vec;
  }

  async function extractFaceDescriptor(source, box) {
    if (!source || !box) return null;
    var imgEl = await loadImageElement(source);
    return {
      vec: extractDescriptorFromImg(imgEl, box),
      cropUrl: cropFaceThumbnailFromImg(imgEl, box, 96)
    };
  }

  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    var denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 1e-7 ? (dot / denom) : 0;
  }

  function forgetFace(sourceKey) {
    if (!sourceKey) return;
    var db = loadFaceDb();
    var changed = false;
    Object.keys(db.people).forEach(function (k) {
      var p = db.people[k];
      if (p && Array.isArray(p.samples)) {
        var before = p.samples.length;
        p.samples = p.samples.filter(function (s) { return s.sourceKey !== sourceKey; });
        if (p.samples.length !== before) {
          changed = true;
        }
        if (p.samples.length === 0) {
          delete db.people[k];
          changed = true;
        }
      }
    });
    if (changed) saveFaceDb(db);
  }

  async function learnFace(source, box, personInfo, sourceKey) {
    var name = typeof personInfo === 'string' ? personInfo : (personInfo && personInfo.name ? personInfo.name : '');
    if (!isValidPersonName(name) || !source || !box) return null;

    if (sourceKey) {
      forgetFace(sourceKey);
    }

    try {
      var desc = await extractFaceDescriptor(source, box);
      if (!desc || !desc.vec) return null;

      var db = loadFaceDb();
      var key = normalizePersonKey(name);
      var existing = db.people[key] || {
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
          var isPidValid = (typeof window !== 'undefined' && window.FamilySearchClient && typeof window.FamilySearchClient.isPidValidForPersonName === 'function')
            ? window.FamilySearchClient.isPidValidForPersonName(personInfo.fsId, name)
            : true;
          existing.fsId = isPidValid ? personInfo.fsId : '';
        }
        if (personInfo.rel) existing.rel = personInfo.rel;
        if (personInfo.branch) existing.branch = personInfo.branch;
      }
      if (desc.cropUrl) {
        existing.avatar = desc.cropUrl;
      }

      if (!Array.isArray(existing.samples)) existing.samples = [];
      existing.samples.push({
        sourceKey: sourceKey || ('manual_' + Date.now()),
        vec: desc.vec,
        updatedAt: Date.now()
      });
      // Keep up to 12 most informative recent samples per person
      if (existing.samples.length > 12) {
        existing.samples = existing.samples.slice(existing.samples.length - 12);
      }

      db.people[key] = existing;
      saveFaceDb(db);
      return existing;
    } catch (e) {
      console.warn('FaceDetectorEngine learnFace notice:', e);
      return null;
    }
  }

  function getLearnedPeople() {
    var db = loadFaceDb();
    return Object.keys(db.people).map(function (k) {
      var p = db.people[k];
      return {
        name: p.name,
        fsId: p.fsId || '',
        rel: p.rel || 'Relative',
        branch: p.branch || '',
        avatar: p.avatar || '',
        sampleCount: Array.isArray(p.samples) ? p.samples.length : 0
      };
    }).filter(function (p) { return Boolean(p.name); }).sort(function (a, b) {
      if (b.sampleCount !== a.sampleCount) return b.sampleCount - a.sampleCount;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Generates portrait crops and compares every detected face against learned relatives.
   * Uses greedy 1-to-1 best-first matching across the photo so one relative is never
   * assigned to two different faces in the same photo.
   */
  async function recognizeFaces(source, faces, photoPeople) {
    if (!source || !faces || faces.length === 0) return faces || [];
    var imgEl;
    try {
      imgEl = await loadImageElement(source);
    } catch (e) {
      return faces;
    }

    var db = loadFaceDb();
    var personKeys = Object.keys(db.people).filter(function (k) {
      return db.people[k] && Array.isArray(db.people[k].samples) && db.people[k].samples.length > 0;
    });

    var photoNameSet = new Set();
    if (Array.isArray(photoPeople)) {
      photoPeople.forEach(function (pr) {
        var pn = typeof pr === 'string' ? pr : (pr && pr.name ? pr.name : '');
        if (pn) photoNameSet.add(normalizePersonKey(pn));
      });
    }

    var allPairs = [];

    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      var b = f.box || { x: 0, y: 0, width: 0.2, height: 0.2 };
      f.cropUrl = cropFaceThumbnailFromImg(imgEl, b, 96);
      var vec = extractDescriptorFromImg(imgEl, b);
      f.candidates = [];

      if (personKeys.length > 0 && vec) {
        var scoredForFace = [];
        for (var pkIdx = 0; pkIdx < personKeys.length; pkIdx++) {
          var pKey = personKeys[pkIdx];
          var person = db.people[pKey];
          var bestSim = -1;
          for (var sIdx = 0; sIdx < person.samples.length; sIdx++) {
            var sim = cosineSimilarity(vec, person.samples[sIdx].vec);
            if (sim > bestSim) bestSim = sim;
          }
          // Gentle +0.03 tie-breaker if this relative is already listed in this photo's metadata
          if (photoNameSet.has(pKey)) {
            bestSim = Math.min(0.99, bestSim + 0.03);
          }
          if (bestSim >= 0.42) {
            scoredForFace.push({
              key: pKey,
              name: person.name,
              fsId: person.fsId || '',
              rel: person.rel || 'Relative',
              branch: person.branch || '',
              avatar: person.avatar || '',
              score: bestSim,
              confidence: Math.round(bestSim * 100)
            });
            allPairs.push({
              faceIdx: i,
              personKey: pKey,
              person: person,
              score: bestSim
            });
          }
        }
        scoredForFace.sort(function (a, b2) { return b2.score - a.score; });
        f.candidates = scoredForFace.slice(0, 3);
      }
    }

    // Greedy 1-to-1 assignment (highest similarity pair first across the entire photo)
    allPairs.sort(function (a, b) { return b.score - a.score; });
    var assignedFaces = new Set();
    var assignedPeople = new Set();

    // Respect any face already manually confirmed on this photo
    faces.forEach(function (f, idx) {
      if (f.confirmed && f.name) {
        assignedFaces.add(idx);
        assignedPeople.add(normalizePersonKey(f.name));
      }
    });

    for (var pIdx2 = 0; pIdx2 < allPairs.length; pIdx2++) {
      var pair = allPairs[pIdx2];
      if (assignedFaces.has(pair.faceIdx) || assignedPeople.has(pair.personKey)) continue;

      var targetFace = faces[pair.faceIdx];
      if (pair.score >= 0.68) {
        // High-confidence face recognition match -> auto-fill & highlight!
        targetFace.name = pair.person.name;
        if (pair.person.fsId && !targetFace.fsId) {
          targetFace.fsId = pair.person.fsId;
        }
        targetFace.recognized = true;
        targetFace.suggestedName = pair.person.name;
        targetFace.suggestedFsId = pair.person.fsId || '';
        targetFace.matchConfidence = Math.round(pair.score * 100);
        assignedFaces.add(pair.faceIdx);
        assignedPeople.add(pair.personKey);
      } else if (pair.score >= 0.48) {
        // Moderate similarity -> show as 1-click suggestion without forcing wrong auto-tag
        targetFace.suggestedName = pair.person.name;
        targetFace.suggestedFsId = pair.person.fsId || '';
        targetFace.matchConfidence = Math.round(pair.score * 100);
        assignedFaces.add(pair.faceIdx);
        assignedPeople.add(pair.personKey);
      }
    }

    return faces;
  }

  function cleanupMismatchedPids() {
    var db = loadFaceDb();
    var changed = false;
    var isPidValid = (typeof window !== 'undefined' && window.FamilySearchClient && typeof window.FamilySearchClient.isPidValidForPersonName === 'function')
      ? window.FamilySearchClient.isPidValidForPersonName
      : null;
    if (!isPidValid) return;

    Object.keys(db.people).forEach(function (k) {
      var p = db.people[k];
      if (p && p.fsId) {
        if (!isPidValid(p.fsId, p.name)) {
          console.warn('[FaceDetectorEngine] Purging mismatched PID ' + p.fsId + ' from learned record: ' + p.name);
          p.fsId = '';
          changed = true;
        }
      }
    });
    if (changed) saveFaceDb(db);
  }

  window.FaceDetectorEngine = {
    detectFaces: detectFaces,
    loadCascade: loadCascade,
    toGedcomXRegion: toGedcomXRegion,
    cropFaceThumbnail: cropFaceThumbnail,
    extractFaceDescriptor: extractFaceDescriptor,
    makeFaceSourceKey: makeFaceSourceKey,
    learnFace: learnFace,
    forgetFace: forgetFace,
    getLearnedPeople: getLearnedPeople,
    recognizeFaces: recognizeFaces,
    cleanupMismatchedPids: cleanupMismatchedPids
  };

})(typeof window !== 'undefined' ? window : this);



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
        var r = 0.0, c = 0.0, s = 0.0, q = 0.0, n = 0;
        for (var j = i; j < dets.length; ++j) {
          if (calculateIoU(dets[i], dets[j]) > iouthreshold) {
            assignments[j] = 1;
            r += dets[j][0];
            c += dets[j][1];
            s += dets[j][2];
            q += dets[j][3];
            n++;
          }
        }
        clusters.push([r / n, c / n, s / n, q]);
      }
    }
    return clusters;
  }

  async function loadCascade() {
    if (picoClassifier) return picoClassifier;
    if (cascadePromise) return cascadePromise;

    cascadePromise = (async function () {
      var candidates = [
        '../models/facefinder',
        'models/facefinder',
        './models/facefinder',
        '/models/facefinder',
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
    if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
      return Promise.resolve(source);
    }
    if (source instanceof HTMLCanvasElement) {
      return Promise.resolve(source);
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function (e) { reject(new Error('Failed to load image for face detection')); };
      img.src = typeof source === 'string' ? source : (source.src || '');
    });
  }

  async function detectFaces(source) {
    if (!source) return [];
    var imgEl;
    try {
      imgEl = await loadImageElement(source);
    } catch (e) {
      console.warn('FaceDetectorEngine image load load error:', e);
      return [];
    }

    var origW = imgEl.naturalWidth || imgEl.width || 320;
    var origH = imgEl.naturalHeight || imgEl.height || 240;
    if (origW < 20 || origH < 20) return [];

    // 1. Try native FaceDetector API if available
    if (typeof window.FaceDetector === 'function') {
      try {
        var nativeDetector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 10 });
        var nativeFaces = await nativeDetector.detect(imgEl);
        if (nativeFaces && nativeFaces.length > 0) {
          return nativeFaces.map(function (f, idx) {
            var bb = f.boundingBox;
            return {
              id: 'face_' + Date.now() + '_' + idx,
              box: {
                x: Math.max(0, Math.min(1, Math.round((bb.x / origW) * 1000) / 1000)),
                y: Math.max(0, Math.min(1, Math.round((bb.y / origH) * 1000) / 1000)),
                width: Math.min(1, Math.round((bb.width / origW) * 1000) / 1000),
                height: Math.min(1, Math.round((bb.height / origH) * 1000) / 1000)
              },
              confidence: 0.95
            };
          });
        }
      } catch (nativeErr) {
        // Fall back to cascade
      }
    }

    // 2. Cascade detector
    var classifier = await loadCascade();
    if (!classifier) return [];

    // Scale image down to max 500px for speed & scale consistency
    var maxDim = 500;
    var scale = Math.min(maxDim / origW, maxDim / origH, 1.0);
    var w = Math.round(origW * scale);
    var h = Math.round(origH * scale);

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0, w, h);

    var imgData = ctx.getImageData(0, 0, w, h);
    var data = imgData.data;

    var gray = new Uint8Array(w * h);
    for (var r = 0; r < h; ++r) {
      for (var c = 0; c < w; ++c) {
        var idx = (r * w + c) * 4;
        gray[r * w + c] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      }
    }

    var image = { pixels: gray, nrows: h, ncols: w, ldim: w };
    var minsize = Math.max(22, Math.round(Math.min(w, h) * 0.08));
    var maxsize = Math.round(Math.min(w, h) * 0.88);

    var rawDetections = runCascade(image, classifier, {
      shiftfactor: 0.08,
      minsize: minsize,
      maxsize: maxsize,
      scalefactor: 1.12
    });

    if (!rawDetections || rawDetections.length === 0) return [];

    var clusters = clusterDetections(rawDetections, 0.25);
    var validClusters = clusters.filter(function (c) { return c[3] >= 3.2; });
    if (validClusters.length === 0) return [];

    var results = [];
    for (var i = 0; i < validClusters.length; i++) {
      var row = validClusters[i][0];
      var col = validClusters[i][1];
      var size = validClusters[i][2];
      var quality = validClusters[i][3];

      // Validate standard deviation of pixels to avoid flat patterns
      var halfS = size * 0.5;
      var sx = Math.max(0, Math.round(col - halfS));
      var ex = Math.min(w - 1, Math.round(col + halfS));
      var sy = Math.max(0, Math.round(row - halfS));
      var ey = Math.min(h - 1, Math.round(row + halfS));

      var sum = 0, sumSq = 0, count = 0;
      for (var py = sy; py <= ey; py += 2) {
        for (var px = sx; px <= ex; px += 2) {
          var val = gray[py * w + px];
          sum += val;
          sumSq += val * val;
          count++;
        }
      }

      if (count > 0) {
        var mean = sum / count;
        var variance = (sumSq / count) - (mean * mean);
        if (Math.sqrt(Math.max(0, variance)) < 12) continue; // Skip flat textures
      }

      var xNorm = Math.max(0, (col - halfS) / w);
      var yNorm = Math.max(0, (row - halfS) / h);
      var wNorm = Math.min(1 - xNorm, size / w);
      var hNorm = Math.min(1 - yNorm, (size * 1.05) / h);

      results.push({
        id: 'face_' + Date.now() + '_' + i,
        box: {
          x: Math.round(xNorm * 1000) / 1000,
          y: Math.round(yNorm * 1000) / 1000,
          width: Math.round(wNorm * 1000) / 1000,
          height: Math.round(hNorm * 1000) / 1000
        },
        confidence: Math.min(0.99, Math.round((0.70 + Math.min(quality, 30) / 100) * 100) / 100)
      });
    }

    return results;
  }

  /**
   * Convert normalized box ({x, y, width, height}) into GEDCOM X RectangleRegion string
   * Format: "x1,y1,x2,y2" where all values are 0.0 - 1.0
   */
  function toGedcomXRegion(box) {
    if (!box) return null;
    var x1 = Math.max(0, Math.min(1, box.x || 0));
    var y1 = Math.max(0, Math.min(1, box.y || 0));
    var x2 = Math.max(x1, Math.min(1, (box.x || 0) + (box.width || 0.2)));
    var y2 = Math.max(y1, Math.min(1, (box.y || 0) + (box.height || 0.2)));

    return [
      x1.toFixed(4),
      y1.toFixed(4),
      x2.toFixed(4),
      y2.toFixed(4)
    ].join(',');
  }

  window.FaceDetectorEngine = {
    detectFaces: detectFaces,
    loadCascade: loadCascade,
    toGedcomXRegion: toGedcomXRegion
  };

})(typeof window !== 'undefined' ? window : this);

import { computeFileMd5 } from './md5.js';

/**
 * Recursively lists ALL files inside a Google Drive folder (including photos, docs, .paf, .ged, etc.)
 * with their relative paths, sizes, and Google Drive md5Checksum values.
 */
export async function scanDriveFolderAllFiles(token, folderId = 'root', folderName = 'Google Drive', onProgress = null) {
  const results = [];
  const queue = [{ id: folderId, relPrefix: '' }];
  let foldersScanned = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    foldersScanned++;
    let pageToken = '';

    do {
      const q = `'${current.id}' in parents and trashed = false`;
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime)',
        pageSize: '200'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Google Drive scan failed (${res.status}): ${errText || res.statusText}`);
      }
      const data = await res.json();
      for (const f of (data.files || [])) {
        const relPath = current.relPrefix ? `${current.relPrefix}/${f.name}` : f.name;
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: f.id, relPrefix: relPath });
        } else {
          results.push({
            id: f.id,
            name: f.name,
            relPath,
            mimeType: f.mimeType || '',
            size: Number(f.size) || 0,
            md5Checksum: (f.md5Checksum || '').toLowerCase(),
            modifiedTime: f.modifiedTime || ''
          });
        }
      }

      pageToken = data.nextPageToken || '';
      if (onProgress) {
        onProgress({
          foldersScanned,
          filesFound: results.length,
          currentPath: current.relPrefix || folderName
        });
      }
    } while (pageToken);
  }

  return results;
}

function getLocalRelPath(file, stripMyDrivePrefix = false) {
  const raw = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  let rel = parts.length > 1 ? parts.slice(1).join('/') : (parts[0] || file.name);
  if (stripMyDrivePrefix && /^My Drive\//i.test(rel)) {
    rel = rel.slice('My Drive/'.length);
  }
  return rel;
}

const GOOGLE_DOC_EXT_RE = /\.(gdoc|gsheet|gslides|gdraw|gform|gsite|gmap|glink)$/i;

/**
 * Compares a local folder's FileList/array against a Google Drive folder's file list.
 * Uses relative path + size + MD5 checksum verification.
 */
export async function compareLocalAndDrive(localFiles, driveFiles, { verifyMd5 = true } = {}, onProgress = null) {
  const driveByRelPath = new Map();
  const driveByMd5 = new Map();
  const driveSizes = new Set();
  const matchedDriveIds = new Set();
  let driveHasMyDrivePrefix = false;

  for (const df of driveFiles) {
    if (/^My Drive\//i.test(df.relPath)) driveHasMyDrivePrefix = true;
    driveByRelPath.set(df.relPath.toLowerCase(), df);
    if (df.size > 0) driveSizes.add(df.size);
    if (df.md5Checksum) {
      if (!driveByMd5.has(df.md5Checksum)) driveByMd5.set(df.md5Checksum, []);
      driveByMd5.get(df.md5Checksum).push(df);
    }
  }
  const stripMyDrivePrefix = !driveHasMyDrivePrefix;

  const driveById = new Map();
  for (const df of driveFiles) {
    if (df.id) driveById.set(df.id, df);
  }

  const identical = [];
  const missingInCloud = [];
  const checksumMismatch = [];
  const unreadable = [];

  const safeComputeMd5 = async (file) => {
    try {
      return { ok: true, md5: await computeFileMd5(file) };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'File could not be read' };
    }
  };

  let lastProgressAt = 0;
  const total = localFiles.length;
  for (let i = 0; i < total; i++) {
    const lf = localFiles[i];
    const relPath = getLocalRelPath(lf, stripMyDrivePrefix);
    const key = relPath.toLowerCase();
    const df = driveByRelPath.get(key);

    const now = Date.now();
    if (onProgress && (i % 15 === 0 || i === total - 1 || now - lastProgressAt > 200)) {
      lastProgressAt = now;
      onProgress({
        checked: i + 1,
        total,
        currentName: relPath
      });
    }

    if (GOOGLE_DOC_EXT_RE.test(lf.name || '')) {
      // Google Workspace virtual shortcuts (.gdoc, .gsheet, .gmap, etc.) live in Drive natively and have no binary MD5
      const stemKey = key.replace(GOOGLE_DOC_EXT_RE, '');
      let docMatch = df || driveByRelPath.get(stemKey);
      let stubDocId = '';
      if (!docMatch) {
        try {
          const stubTxt = await lf.text();
          const parsedStub = JSON.parse(stubTxt);
          stubDocId = parsedStub.doc_id || parsedStub.resource_id || '';
          if (stubDocId && driveById.has(stubDocId)) {
            docMatch = driveById.get(stubDocId);
          }
        } catch (_) {}
      }
      if (docMatch) {
        matchedDriveIds.add(docMatch.id);
        identical.push({ localFile: lf, relPath, driveFile: docMatch, localMd5: '' });
      } else {
        // Virtual Google Workspace shortcut (.gmap/.gdoc/etc.) cannot be uploaded as a binary file
        unreadable.push({
          localFile: lf,
          relPath,
          reason: stubDocId
            ? `Google Workspace cloud shortcut (ID: ${stubDocId}) — already lives in Google Cloud, not a local binary file`
            : 'Google Workspace cloud shortcut (.gmap/.gdoc/etc.) — cannot be uploaded as a binary file'
        });
      }
      continue;
    }

    if (df) {
      matchedDriveIds.add(df.id);
      if (df.size > 0 && lf.size !== df.size) {
        checksumMismatch.push({ localFile: lf, relPath, driveFile: df, reason: 'Size mismatch' });
        continue;
      }
      if (verifyMd5 && df.md5Checksum) {
        const res = await safeComputeMd5(lf);
        if (!res.ok) {
          unreadable.push({ localFile: lf, relPath, driveFile: df, reason: `Size matched, MD5 skipped (${res.error})` });
          continue;
        }
        if (res.md5 !== df.md5Checksum) {
          checksumMismatch.push({
            localFile: lf,
            relPath,
            driveFile: df,
            localMd5: res.md5,
            reason: 'MD5 checksum mismatch'
          });
          continue;
        }
        identical.push({ localFile: lf, relPath, driveFile: df, localMd5: res.md5 });
      } else {
        identical.push({ localFile: lf, relPath, driveFile: df, localMd5: '' });
      }
    } else {
      // Check if an identical file exists in Drive under a different folder/name via MD5
      // Optimization: only read/hash the local file if at least one file in Drive has the exact same byte size!
      let movedMatch = null;
      let readFailed = null;
      if (verifyMd5 && driveByMd5.size > 0 && (lf.size === 0 || driveSizes.has(lf.size))) {
        const res = await safeComputeMd5(lf);
        if (!res.ok) {
          readFailed = res.error;
        } else {
          const candidates = driveByMd5.get(res.md5);
          if (candidates && candidates.length > 0) {
            movedMatch = candidates[0];
            matchedDriveIds.add(movedMatch.id);
            identical.push({
              localFile: lf,
              relPath,
              driveFile: movedMatch,
              localMd5: res.md5,
              movedNote: `In Drive at: ${movedMatch.relPath}`
            });
          }
        }
      }
      if (!movedMatch) {
        if (readFailed) {
          unreadable.push({ localFile: lf, relPath, driveFile: null, reason: readFailed });
        } else {
          missingInCloud.push({ localFile: lf, relPath });
        }
      }
    }

    if (i > 0 && i % 25 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const cloudOnly = driveFiles.filter((df) => !matchedDriveIds.has(df.id));

  return {
    identical,
    missingInCloud,
    checksumMismatch,
    cloudOnly,
    unreadable
  };
}

async function fetchWithRetry(url, options, retries = 3) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (res.ok || (res.status !== 429 && res.status < 500) || attempt >= retries) {
      return res;
    }
    const delayMs = Math.min(8000, 600 * Math.pow(2, attempt)) + Math.floor(Math.random() * 300);
    await new Promise((r) => setTimeout(r, delayMs));
    attempt++;
  }
}

export async function ensureDriveFolderPath(token, rootFolderId, folderParts, folderCache, folderPromiseCache = new Map()) {
  let parentId = rootFolderId || 'root';
  let pathAcc = '';

  for (const part of folderParts) {
    if (!part) continue;
    pathAcc = pathAcc ? `${pathAcc}/${part}` : part;
    if (folderCache.has(pathAcc)) {
      parentId = folderCache.get(pathAcc);
      continue;
    }
    if (folderPromiseCache.has(pathAcc)) {
      parentId = await folderPromiseCache.get(pathAcc);
      continue;
    }

    const currentParent = parentId;
    const promise = (async () => {
      const escaped = part.replace(/'/g, "\\'");
      const q = `'${currentParent}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const findRes = await fetchWithRetry(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (findRes.status === 401) {
        const e = new Error('Google Drive session expired (401)');
        e.status = 401;
        throw e;
      }
      if (findRes.ok) {
        const findData = await findRes.json();
        if (findData.files && findData.files.length > 0) {
          const existingId = findData.files[0].id;
          folderCache.set(pathAcc, existingId);
          return existingId;
        }
      }

      const createRes = await fetchWithRetry('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentParent]
        })
      });
      if (!createRes.ok) {
        const e = new Error(`Could not create Drive folder "${part}" (${createRes.status})`);
        e.status = createRes.status;
        throw e;
      }
      const created = await createRes.json();
      folderCache.set(pathAcc, created.id);
      return created.id;
    })();

    folderPromiseCache.set(pathAcc, promise);
    try {
      parentId = await promise;
    } catch (err) {
      folderPromiseCache.delete(pathAcc);
      throw err;
    }
  }

  return parentId;
}

export async function uploadFileToDrive(token, rootFolderId, relPath, file, folderCache = new Map(), folderPromiseCache = new Map()) {
  const parts = String(relPath || file.name).split('/').filter(Boolean);
  const fileName = parts.pop() || file.name;
  const parentId = await ensureDriveFolderPath(token, rootFolderId, parts, folderCache, folderPromiseCache);

  let fileBuf;
  try {
    fileBuf = await file.arrayBuffer();
  } catch (readErr) {
    throw new Error(`Unreadable local/virtual file ${fileName}: ${readErr && readErr.message ? readErr.message : 'cannot read bytes'}`);
  }

  const metadata = {
    name: fileName,
    parents: [parentId]
  };

  let attempt = 0;
  while (true) {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileBuf], { type: file.type || 'application/octet-stream' }), fileName);

    let res;
    try {
      res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,md5Checksum,size',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form
        }
      );
    } catch (netErr) {
      if (attempt < 3) {
        const delayMs = Math.min(8000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
        continue;
      }
      throw new Error(`Network error uploading ${fileName}: ${netErr && netErr.message ? netErr.message : 'Failed to fetch'}`);
    }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const delayMs = Math.min(8000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
      continue;
    }
    const errText = await res.text().catch(() => '');
    const err = new Error(`Upload failed for ${fileName} (${res.status}): ${errText || res.statusText}`);
    err.status = res.status;
    throw err;
  }
}

export async function trashDriveFile(token, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: true })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Could not move file to Trash (${res.status}): ${errText || res.statusText}`);
  }
  return res.json();
}

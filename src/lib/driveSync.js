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

function getLocalRelPath(file) {
  const raw = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join('/') : (parts[0] || file.name);
}

/**
 * Compares a local folder's FileList/array against a Google Drive folder's file list.
 * Uses relative path + size + MD5 checksum verification.
 */
export async function compareLocalAndDrive(localFiles, driveFiles, { verifyMd5 = true } = {}, onProgress = null) {
  const driveByRelPath = new Map();
  const driveByMd5 = new Map();
  const matchedDriveIds = new Set();

  for (const df of driveFiles) {
    driveByRelPath.set(df.relPath.toLowerCase(), df);
    if (df.md5Checksum) {
      if (!driveByMd5.has(df.md5Checksum)) driveByMd5.set(df.md5Checksum, []);
      driveByMd5.get(df.md5Checksum).push(df);
    }
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

  const total = localFiles.length;
  for (let i = 0; i < total; i++) {
    const lf = localFiles[i];
    const relPath = getLocalRelPath(lf);
    const key = relPath.toLowerCase();
    const df = driveByRelPath.get(key);

    if (onProgress && (i % 15 === 0 || i === total - 1)) {
      onProgress({
        checked: i + 1,
        total,
        currentName: relPath
      });
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
      let movedMatch = null;
      let readFailed = null;
      if (verifyMd5 && driveByMd5.size > 0) {
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

export async function ensureDriveFolderPath(token, rootFolderId, folderParts, folderCache) {
  let parentId = rootFolderId || 'root';
  let pathAcc = '';

  for (const part of folderParts) {
    if (!part) continue;
    pathAcc = pathAcc ? `${pathAcc}/${part}` : part;
    if (folderCache.has(pathAcc)) {
      parentId = folderCache.get(pathAcc);
      continue;
    }

    const escaped = part.replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const findRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (findRes.ok) {
      const findData = await findRes.json();
      if (findData.files && findData.files.length > 0) {
        parentId = findData.files[0].id;
        folderCache.set(pathAcc, parentId);
        continue;
      }
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: part,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });
    if (!createRes.ok) {
      throw new Error(`Could not create Drive folder "${part}" (${createRes.status})`);
    }
    const created = await createRes.json();
    parentId = created.id;
    folderCache.set(pathAcc, parentId);
  }

  return parentId;
}

export async function uploadFileToDrive(token, rootFolderId, relPath, file, folderCache = new Map()) {
  const parts = String(relPath || file.name).split('/').filter(Boolean);
  const fileName = parts.pop() || file.name;
  const parentId = await ensureDriveFolderPath(token, rootFolderId, parts, folderCache);

  const metadata = {
    name: fileName,
    parents: [parentId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,md5Checksum,size',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Upload failed for ${fileName} (${res.status}): ${errText || res.statusText}`);
  }
  return res.json();
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

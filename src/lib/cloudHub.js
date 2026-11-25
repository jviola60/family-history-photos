import JSZip from 'jszip';

const CLOUD_SETTINGS_KEY = 'fhp_cloud_settings_v1';
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|tiff?)$/i;
export const DEFAULT_GOOGLE_CLIENT_ID = '1061905446657-a8qontau11bbj658t7jk3q4r7i6m54fa.apps.googleusercontent.com';

export function getCloudSettings() {
  try {
    const raw = localStorage.getItem(CLOUD_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...parsed,
      googleClientId: (parsed && parsed.googleClientId) || DEFAULT_GOOGLE_CLIENT_ID
    };
  } catch {
    return { googleClientId: DEFAULT_GOOGLE_CLIENT_ID };
  }
}

export function saveCloudSettings(partial) {
  const next = { ...getCloudSettings(), ...partial };
  try {
    localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
  return next;
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function isImageFile(name, mimeType) {
  return IMAGE_EXT_RE.test(name || '') || Boolean(mimeType && mimeType.startsWith('image/'));
}

/* ============================================================================
   1. GOOGLE DRIVE & GOOGLE PHOTOS
   ============================================================================ */

const GOOGLE_TOKEN_CACHE_KEY = 'fhp_gdrive_token_cache_v1';
const GOOGLE_ACCOUNT_HINT_KEY = 'fhp_gdrive_account_hint_v1';
const _silentRefreshInFlight = new Map();
let _memoryGoogleToken = null;

function matchGoogleScope(have, requiredScope) {
  if (!requiredScope || have === requiredScope) return true;
  if (requiredScope === 'https://www.googleapis.com/auth/drive.readonly' && String(have || '').includes('https://www.googleapis.com/auth/drive')) {
    return true;
  }
  return false;
}

function readGoogleTokenStore() {
  if (_memoryGoogleToken && _memoryGoogleToken.byScope) return _memoryGoogleToken;
  try {
    let raw = localStorage.getItem(GOOGLE_TOKEN_CACHE_KEY);
    let fromSession = false;
    if (!raw) {
      raw = sessionStorage.getItem(GOOGLE_TOKEN_CACHE_KEY);
      fromSession = Boolean(raw);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      let normalized = null;
      if (parsed && parsed.byScope && typeof parsed.byScope === 'object') {
        normalized = parsed;
      } else if (parsed && parsed.token && parsed.expiresAt) {
        normalized = { byScope: { [parsed.scope || 'default']: parsed } };
      }
      if (normalized) {
        _memoryGoogleToken = normalized;
        if (fromSession) {
          try {
            localStorage.setItem(GOOGLE_TOKEN_CACHE_KEY, JSON.stringify(normalized));
            sessionStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY);
          } catch {
            // ignore migration storage errors
          }
        }
        return normalized;
      }
    }
  } catch {
    // ignore storage errors
  }
  return { byScope: {} };
}

function saveGoogleTokenCache(token, scope, expiresInSec = 3500) {
  const store = readGoogleTokenStore();
  const key = scope || 'default';
  const rec = {
    token,
    scope: key,
    expiresAt: Date.now() + Math.max(60, Number(expiresInSec) || 3500) * 1000
  };
  store.byScope[key] = rec;
  _memoryGoogleToken = store;
  try {
    localStorage.setItem(GOOGLE_TOKEN_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
  return rec;
}

export function getCachedGoogleToken(requiredScope = 'https://www.googleapis.com/auth/drive.readonly') {
  const store = readGoogleTokenStore();
  const entries = Object.values(store.byScope || {});
  const now = Date.now();
  for (let i = 0; i < entries.length; i++) {
    const cached = entries[i];
    if (!cached || !cached.token) continue;
    if (cached.expiresAt - now <= 120_000) continue;
    if (matchGoogleScope(cached.scope || '', requiredScope)) return cached.token;
  }
  return '';
}

export function getGoogleTokenExpiresAt(requiredScope = 'https://www.googleapis.com/auth/drive.readonly') {
  const store = readGoogleTokenStore();
  const entries = Object.values(store.byScope || {});
  let maxExp = 0;
  for (let i = 0; i < entries.length; i++) {
    const cached = entries[i];
    if (!cached || !cached.token || !cached.expiresAt) continue;
    if (matchGoogleScope(cached.scope || '', requiredScope)) {
      maxExp = Math.max(maxExp, Number(cached.expiresAt) || 0);
    }
  }
  return maxExp;
}

export function getGoogleAccountHint() {
  try {
    const raw = localStorage.getItem(GOOGLE_ACCOUNT_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.email || parsed.displayName)) return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveGoogleAccountHint(info) {
  const email = String(info?.email || '').trim();
  const displayName = String(info?.displayName || '').trim();
  if (!email && !displayName) return null;
  const payload = { email, displayName, savedAt: Date.now() };
  try {
    localStorage.setItem(GOOGLE_ACCOUNT_HINT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
  return payload;
}

async function fetchAndSaveGoogleDriveUserHint(token) {
  if (!token) return null;
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return saveGoogleAccountHint({
      email: data?.user?.emailAddress,
      displayName: data?.user?.displayName
    });
  } catch {
    return null;
  }
}

export function clearCachedGoogleToken(scope = '') {
  if (!scope) {
    _memoryGoogleToken = null;
    try {
      localStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY);
      sessionStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  const store = readGoogleTokenStore();
  if (store.byScope && store.byScope[scope]) {
    delete store.byScope[scope];
    _memoryGoogleToken = store;
    try {
      localStorage.setItem(GOOGLE_TOKEN_CACHE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
}

export async function tryRefreshGoogleTokenSilently(
  clientId,
  scope = 'https://www.googleapis.com/auth/drive.readonly',
  timeoutMs = 5500
) {
  const cleanId = String(clientId || '').trim();
  if (!cleanId) return '';

  const existing = getCachedGoogleToken(scope);
  if (existing && getGoogleTokenExpiresAt(scope) - Date.now() > 12 * 60 * 1000) {
    return existing;
  }

  const inflightKey = `${cleanId}::${scope || 'default'}`;
  if (_silentRefreshInFlight.has(inflightKey)) {
    return _silentRefreshInFlight.get(inflightKey);
  }

  const promise = (async () => {
    try {
      await loadScriptOnce('https://accounts.google.com/gsi/client');
      if (!window.google?.accounts?.oauth2) return '';
      const savedHint = getGoogleAccountHint()?.email || '';
      return await new Promise((resolve) => {
        let settled = false;
        const finish = (tok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(tok || '');
        };
        const timer = setTimeout(() => finish(''), Math.max(1500, Number(timeoutMs) || 5500));
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: cleanId,
            scope,
            ...(savedHint ? { hint: savedHint } : {}),
            callback: (resp) => {
              if (resp?.error || !resp?.access_token) {
                finish('');
                return;
              }
              saveGoogleTokenCache(resp.access_token, scope, resp.expires_in);
              if (String(scope || '').includes('/auth/drive')) {
                fetchAndSaveGoogleDriveUserHint(resp.access_token).catch(() => {});
              }
              finish(resp.access_token);
            },
            error_callback: () => finish('')
          });
          client.requestAccessToken({ prompt: 'none' });
        } catch {
          finish('');
        }
      });
    } catch {
      return '';
    } finally {
      _silentRefreshInFlight.delete(inflightKey);
    }
  })();

  _silentRefreshInFlight.set(inflightKey, promise);
  return promise;
}

export async function requestGoogleToken(clientId, scope, opts = {}) {
  const cleanId = String(clientId || '').trim();
  if (!cleanId) throw new Error('Please enter your Google OAuth Client ID first.');

  if (!opts.forcePrompt) {
    const cached = getCachedGoogleToken(scope);
    if (cached) return cached;
  }

  await loadScriptOnce('https://accounts.google.com/gsi/client');
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Sign-In library failed to load.');
  }

  const savedHint = getGoogleAccountHint()?.email || '';

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cleanId,
      scope,
      ...(savedHint ? { hint: savedHint } : {}),
      callback: (resp) => {
        if (resp?.error) {
          reject(new Error(resp.error_description || resp.error || 'Google sign-in cancelled.'));
          return;
        }
        if (!resp?.access_token) {
          reject(new Error('No Google access token returned.'));
          return;
        }
        saveGoogleTokenCache(resp.access_token, scope, resp.expires_in);
        if (String(scope || '').includes('/auth/drive')) {
          fetchAndSaveGoogleDriveUserHint(resp.access_token).catch(() => {});
        }
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'Google sign-in cancelled.'));
      }
    });
    client.requestAccessToken({ prompt: opts.forcePrompt ? 'consent' : '' });
  });
}

async function fetchDriveWithRetry(url, token, attempt = 0) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) {
    clearCachedGoogleToken('https://www.googleapis.com/auth/drive.readonly');
    throw new Error('Google Drive session expired — please reconnect Google Drive.');
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const waitMs = [800, 1800, 3500][attempt] || 2000;
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchDriveWithRetry(url, token, attempt + 1);
  }
  return res;
}

export async function downloadGoogleDriveFile(token, fileRec) {
  const fileId = fileRec?.cloudId || fileRec?.id;
  if (!fileId) throw new Error('Missing Google Drive file ID.');
  const dl = await fetchDriveWithRetry(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    token
  );
  if (!dl.ok) throw new Error(`Failed to download ${fileRec?.name || fileId} (${dl.status})`);
  const blob = await dl.blob();
  const modMs = fileRec?.lastModified || Date.now();
  const file = new File([blob], fileRec?.name || `drive_${fileId}.jpg`, {
    type: blob.type || fileRec?.type || 'image/jpeg',
    lastModified: modMs
  });
  if (fileRec?.webkitRelativePath) {
    try {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: fileRec.webkitRelativePath,
        configurable: true
      });
    } catch {
      // ignore if non-configurable
    }
  }
  return file;
}

export async function fetchGoogleDriveThumbnailLinks(token, fileIds, options = {}) {
  const uniqueIds = Array.from(new Set((fileIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  const resultMap = new Map();
  if (!token || uniqueIds.length === 0) return resultMap;

  const onEach = typeof options.onEach === 'function' ? options.onEach : null;
  const concurrency = Math.min(6, uniqueIds.length);
  let cursor = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < uniqueIds.length) {
      const fileId = uniqueIds[cursor++];
      try {
        const res = await fetchDriveWithRetry(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,thumbnailLink&supportsAllDrives=true`,
          token
        );
        if (!res.ok) continue;
        const data = await res.json();
        const link = (data && data.thumbnailLink) ? String(data.thumbnailLink) : '';
        if (link) {
          resultMap.set(fileId, link);
          if (onEach) onEach(fileId, link);
        }
      } catch (err) {
        if (String(err && err.message || '').includes('session expired')) {
          throw err;
        }
      }
    }
  });

  await Promise.all(workers);
  return resultMap;
}

export async function listGoogleDriveFolders(token, parentId = 'root') {
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetchDriveWithRetry(url, token);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive folder list failed (${res.status}): ${errText || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function listSharedWithMeDriveFolders(token) {
  const q = "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,owners(displayName))&orderBy=name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetchDriveWithRetry(url, token);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Shared Google Drive folder list failed (${res.status}): ${errText || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function scanGoogleDriveAllImages(token, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
  const includeFolders = options.includeFolders !== false;

  const folderMap = new Map();
  let foldersFound = 0;
  let pagesFetched = 0;

  if (includeFolders) {
    let fPageToken = '';
    do {
      if (shouldStop()) break;
      const params = new URLSearchParams({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'nextPageToken,files(id,name,parents)',
        pageSize: '1000',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (fPageToken) params.set('pageToken', fPageToken);
      const res = await fetchDriveWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Google Drive folder index failed (${res.status}): ${errText || res.statusText}`);
      }
      const data = await res.json();
      const files = data.files || [];
      for (let i = 0; i < files.length; i++) {
        const fl = files[i];
        folderMap.set(fl.id, { name: fl.name || 'Folder', parentId: (fl.parents && fl.parents[0]) || '' });
        foldersFound++;
      }
      pagesFetched++;
      fPageToken = data.nextPageToken || '';
      if (onProgress) {
        onProgress({ phase: 'folders', photosFound: 0, foldersFound, pagesFetched, sampleName: '' });
      }
    } while (fPageToken);
  }

  const pathMemo = new Map();
  const resolveFolderPath = (parentId) => {
    if (!parentId) return 'My Drive';
    if (pathMemo.has(parentId)) return pathMemo.get(parentId);
    const parts = [];
    const seen = new Set();
    let cur = parentId;
    while (cur && !seen.has(cur) && parts.length < 12) {
      seen.add(cur);
      const info = folderMap.get(cur);
      if (!info) break;
      parts.unshift(info.name);
      cur = info.parentId;
    }
    const resolved = parts.length > 0 ? `My Drive / ${parts.join(' / ')}` : 'My Drive';
    pathMemo.set(parentId, resolved);
    return resolved;
  };

  const results = [];
  let pageToken = '';
  do {
    if (shouldStop()) break;
    const params = new URLSearchParams({
      q: "mimeType contains 'image/' and trashed = false",
      fields: 'nextPageToken,files(id,name,description,mimeType,size,modifiedTime,thumbnailLink,parents)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetchDriveWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Drive image scan failed (${res.status}): ${errText || res.statusText}`);
    }
    const data = await res.json();
    const files = data.files || [];
    let sampleName = '';

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || !f.name) continue;
      if (!sampleName) sampleName = f.name;
      const parentId = (f.parents && f.parents[0]) || '';
      const folderPath = resolveFolderPath(parentId);
      const modMs = f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now();
      results.push({
        isCloudFile: true,
        provider: 'gdrive',
        source: 'gdrive',
        cloudId: f.id,
        id: f.id,
        name: f.name,
        description: f.description || '',
        size: Number(f.size) || 0,
        type: f.mimeType || 'image/jpeg',
        lastModified: modMs,
        thumbnailLink: f.thumbnailLink || '',
        path: folderPath,
        webkitRelativePath: `${folderPath}/${f.name}`
      });
    }

    pagesFetched++;
    pageToken = data.nextPageToken || '';
    if (onProgress) {
      onProgress({
        phase: 'images',
        photosFound: results.length,
        foldersFound,
        pagesFetched,
        sampleName
      });
    }
  } while (pageToken);

  return results;
}

export async function searchGoogleDriveImages(token, rawQueryTerms, options = {}) {
  const terms = Array.isArray(rawQueryTerms)
    ? rawQueryTerms.map((t) => String(t || '').trim()).filter(Boolean)
    : [String(rawQueryTerms || '').trim()].filter(Boolean);
  if (terms.length === 0) return [];

  const escDriveTerm = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const nameClauses = terms.slice(0, 6).map((t) => {
    const clean = escDriveTerm(t);
    return `(name contains '${clean}' or fullText contains '${clean}')`;
  });
  const q = `mimeType contains 'image/' and trashed = false and (${nameClauses.join(' or ')})`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,description,mimeType,size,modifiedTime,thumbnailLink,parents)',
    pageSize: String(Math.min(200, Math.max(10, Number(options.limit) || 80))),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true'
  });

  const res = await fetchDriveWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive search failed (${res.status}): ${errText || res.statusText}`);
  }
  const data = await res.json();
  const files = data.files || [];
  return files
    .filter((f) => f && isImageFile(f.name, f.mimeType))
    .map((f) => {
      const modMs = f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now();
      const rec = {
        isCloudFile: true,
        provider: 'gdrive',
        source: 'gdrive',
        cloudId: f.id,
        id: f.id,
        name: f.name,
        description: f.description || '',
        size: Number(f.size) || 0,
        type: f.mimeType || 'image/jpeg',
        lastModified: modMs,
        thumbnailLink: f.thumbnailLink || '',
        path: 'Google Drive Search',
        webkitRelativePath: `Google Drive/${f.name}`
      };
      rec.fetchFile = () => downloadGoogleDriveFile(token, rec);
      return rec;
    });
}

export async function scanGoogleDriveFolder(token, folderId = 'root', folderName = 'Google Drive', onProgress = null) {
  const results = [];
  const queue = [{ id: folderId, path: folderName }];
  const visitedFolders = new Set([folderId]);
  const seenFileIds = new Set();
  let foldersScanned = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    foldersScanned++;
    let pageToken = '';

    do {
      const q = current.id === '__shared_with_me__'
        ? 'sharedWithMe = true and trashed = false'
        : `'${current.id}' in parents and trashed = false`;
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken,files(id,name,description,mimeType,size,modifiedTime,thumbnailLink,shortcutDetails(targetId,targetMimeType))',
        pageSize: '1000',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetchDriveWithRetry(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token);
      if (!res.ok) {
        if ((res.status === 403 || res.status === 404) && foldersScanned > 1) {
          console.warn(`Skipping inaccessible Drive subfolder "${current.path}" (${res.status})`);
          break;
        }
        throw new Error(`Google Drive scan failed (${res.status})`);
      }
      const data = await res.json();
      const files = data.files || [];

      for (const f of files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (!visitedFolders.has(f.id)) {
            visitedFolders.add(f.id);
            queue.push({ id: f.id, path: `${current.path}/${f.name}` });
          }
        } else if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails && f.shortcutDetails.targetId) {
          const targetId = f.shortcutDetails.targetId;
          const targetMime = f.shortcutDetails.targetMimeType || '';
          if (targetMime === 'application/vnd.google-apps.folder') {
            if (!visitedFolders.has(targetId)) {
              visitedFolders.add(targetId);
              queue.push({ id: targetId, path: `${current.path}/${f.name}` });
            }
          } else if (isImageFile(f.name, targetMime) && !seenFileIds.has(targetId)) {
            seenFileIds.add(targetId);
            const sizeBytes = Number(f.size) || 0;
            const modMs = f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now();
            const relPath = `${current.path}/${f.name}`;
            const rec = {
              isCloudFile: true,
              provider: 'gdrive',
              source: 'gdrive',
              cloudId: targetId,
              id: targetId,
              name: f.name,
              description: f.description || '',
              size: sizeBytes,
              type: targetMime || 'image/jpeg',
              lastModified: modMs,
              thumbnailLink: f.thumbnailLink || '',
              path: current.path,
              webkitRelativePath: relPath
            };
            rec.fetchFile = () => downloadGoogleDriveFile(token, rec);
            results.push(rec);
          }
        } else if (isImageFile(f.name, f.mimeType) && !seenFileIds.has(f.id)) {
          seenFileIds.add(f.id);
          const sizeBytes = Number(f.size) || 0;
          const modMs = f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now();
          const relPath = `${current.path}/${f.name}`;
          const rec = {
            isCloudFile: true,
            provider: 'gdrive',
            source: 'gdrive',
            cloudId: f.id,
            id: f.id,
            name: f.name,
            description: f.description || '',
            size: sizeBytes,
            type: f.mimeType || 'image/jpeg',
            lastModified: modMs,
            thumbnailLink: f.thumbnailLink || '',
            path: current.path,
            webkitRelativePath: relPath
          };
          rec.fetchFile = () => downloadGoogleDriveFile(token, rec);
          results.push(rec);
        }
      }

      pageToken = data.nextPageToken || '';
      if (onProgress) {
        onProgress({
          foldersScanned,
          photosFound: results.length,
          currentFolder: current.path
        });
      }
    } while (pageToken);
  }

  return results;
}

export async function launchGooglePhotosPicker(clientId, onStatus = null, options = {}) {
  const gpScope = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
  if (onStatus) onStatus('Signing in to Google Photos...');
  const token = await requestGoogleToken(clientId, gpScope);

  if (onStatus) onStatus('Creating Google Photos picker session...');
  let sessRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  if (sessRes.status === 401) {
    clearCachedGoogleToken(gpScope);
    const freshToken = await requestGoogleToken(clientId, gpScope, { forcePrompt: true });
    sessRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${freshToken}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
  }
  if (!sessRes.ok) {
    const errText = await sessRes.text().catch(() => '');
    let errMsg = errText || sessRes.statusText;
    try {
      const parsed = JSON.parse(errText);
      if (parsed && parsed.error && parsed.error.message) errMsg = parsed.error.message;
    } catch {}
    if (sessRes.status === 403 && /SERVICE_DISABLED|Photos Picker API|has not been used/i.test(errMsg)) {
      throw new Error('Google Photos Picker API is not enabled on this Google Cloud OAuth project yet. Enable "Google Photos Picker API" in Google Cloud Console (or import a Google Photos / Takeout .zip file below).');
    }
    throw new Error(`Google Photos Picker failed (${sessRes.status}): ${errMsg}`);
  }
  const session = await sessRes.json();
  const pickerUrl = `${session.pickerUri}/autoclose`;
  const popup = window.open(pickerUrl, 'fhp_gphotos_picker', 'width=980,height=740');
  if (!popup) {
    if (typeof options.onPickerUrl === 'function') {
      options.onPickerUrl(pickerUrl);
    } else {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    }
  } else if (typeof options.onPickerUrl === 'function') {
    options.onPickerUrl(pickerUrl);
  }

  if (onStatus) onStatus(popup ? 'Select your photos or album in the Google Photos window, then click Done...' : 'Click "Open Google Photos Window" below to select your photos, then click Done...');

  // Poll session until mediaItemsSet is true or popup closed
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    if (typeof options.shouldStop === 'function' && options.shouldStop()) {
      throw new Error('Google Photos import cancelled.');
    }
    await new Promise((r) => setTimeout(r, 2000));
    if (typeof options.shouldStop === 'function' && options.shouldStop()) {
      throw new Error('Google Photos import cancelled.');
    }
    const checkRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(session.id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (checkRes.ok) {
      const state = await checkRes.json();
      if (state.mediaItemsSet) {
        ready = true;
        break;
      }
    }
    if (popup && popup.closed) {
      // One final check in case they clicked Done right as window closed
      const finalCheck = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(session.id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (finalCheck.ok) {
        const finalState = await finalCheck.json();
        if (finalState.mediaItemsSet) ready = true;
      }
      break;
    }
  }

  try { if (popup && !popup.closed) popup.close(); } catch {}
  if (!ready) {
    throw new Error('No photos were selected in Google Photos.');
  }

  if (onStatus) onStatus('Fetching selected Google Photos list...');
  const items = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ sessionId: session.id, pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const listRes = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!listRes.ok) throw new Error(`Failed to list picked Google Photos (${listRes.status})`);
    const listData = await listRes.json();
    for (const mi of (listData.mediaItems || [])) {
      if (mi.type !== 'PHOTO' && !String(mi.mediaFile?.mimeType || '').startsWith('image/')) continue;
      const baseUrl = mi.mediaFile?.baseUrl;
      const name = mi.mediaFile?.filename || `google_photo_${mi.id}.jpg`;
      const mimeType = mi.mediaFile?.mimeType || 'image/jpeg';
      const modMs = mi.createTime ? new Date(mi.createTime).getTime() : Date.now();
      if (!baseUrl) continue;
      items.push({
        isCloudFile: true,
        provider: 'gphotos',
        cloudId: mi.id,
        name,
        size: 0,
        type: mimeType,
        lastModified: modMs,
        webkitRelativePath: `Google_Photos/${name}`,
        fetchFile: async () => {
          const dl = await fetch(`${baseUrl}=d`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!dl.ok) throw new Error(`Failed to download ${name} (${dl.status})`);
          const blob = await dl.blob();
          return new File([blob], name, {
            type: blob.type || mimeType,
            lastModified: modMs
          });
        }
      });
    }
    pageToken = listData.nextPageToken || '';
  } while (pageToken);

  return items;
}

/* ============================================================================
   2. MICROSOFT ONEDRIVE
   ============================================================================ */

export async function requestOneDriveToken(clientId) {
  const cleanId = String(clientId || '').trim();
  if (!cleanId) throw new Error('Please enter your Microsoft Entra / Azure Client ID first.');

  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const state = `od_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', cleanId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'Files.Read User.Read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const popup = window.open(authUrl.toString(), 'fhp_onedrive_auth', 'width=600,height=700');
  if (!popup) throw new Error('Popup was blocked. Please allow popups for this site.');

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('Microsoft sign-in window was closed.'));
      }
    }, 500);

    const onMsg = (ev) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type === 'fhp_onedrive_token' && ev.data?.state === state) {
        cleanup();
        if (ev.data.error) {
          reject(new Error(ev.data.errorDescription || ev.data.error));
        } else if (ev.data.accessToken) {
          resolve(ev.data.accessToken);
        } else {
          reject(new Error('No OneDrive access token received.'));
        }
      }
    };

    function cleanup() {
      settled = true;
      clearInterval(timer);
      window.removeEventListener('message', onMsg);
    }

    window.addEventListener('message', onMsg);
  });
}

export async function listOneDriveFolders(token, itemId = 'root') {
  const endpoint = itemId === 'root'
    ? 'https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,folder&$top=200'
    : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/children?$select=id,name,folder&$top=200`;

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OneDrive folder list failed (${res.status}): ${errText || res.statusText}`);
  }
  const data = await res.json();
  return (data.value || []).filter((item) => Boolean(item.folder));
}

export async function scanOneDriveFolder(token, itemId = 'root', folderName = 'OneDrive', onProgress = null) {
  const results = [];
  const queue = [{ id: itemId, path: folderName }];
  let foldersScanned = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    foldersScanned++;
    let nextLink = current.id === 'root'
      ? 'https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,file,folder,lastModifiedDateTime,@microsoft.graph.downloadUrl&$top=200'
      : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(current.id)}/children?$select=id,name,size,file,folder,lastModifiedDateTime,@microsoft.graph.downloadUrl&$top=200`;

    while (nextLink) {
      const res = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`OneDrive scan failed (${res.status})`);
      const data = await res.json();

      for (const item of (data.value || [])) {
        if (item.folder) {
          queue.push({ id: item.id, path: `${current.path}/${item.name}` });
        } else if (item.file && isImageFile(item.name, item.file.mimeType)) {
          const modMs = item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).getTime() : Date.now();
          const relPath = `${current.path}/${item.name}`;
          results.push({
            isCloudFile: true,
            provider: 'onedrive',
            cloudId: item.id,
            name: item.name,
            size: Number(item.size) || 0,
            type: item.file.mimeType || 'image/jpeg',
            lastModified: modMs,
            webkitRelativePath: relPath,
            fetchFile: async () => {
              // Fetch fresh download URL from Graph item endpoint (downloadUrls expire after ~1 hour)
              const metaRes = await fetch(
                `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}?$select=@microsoft.graph.downloadUrl`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              let dlUrl = item['@microsoft.graph.downloadUrl'];
              if (metaRes.ok) {
                const meta = await metaRes.json();
                if (meta['@microsoft.graph.downloadUrl']) dlUrl = meta['@microsoft.graph.downloadUrl'];
              }
              if (!dlUrl) throw new Error(`No download URL for ${item.name}`);
              const dl = await fetch(dlUrl);
              if (!dl.ok) throw new Error(`Failed to download ${item.name} (${dl.status})`);
              const blob = await dl.blob();
              return new File([blob], item.name, {
                type: blob.type || item.file.mimeType || 'image/jpeg',
                lastModified: modMs
              });
            }
          });
        }
      }

      nextLink = data['@odata.nextLink'] || '';
      if (onProgress) {
        onProgress({
          foldersScanned,
          photosFound: results.length,
          currentFolder: current.path
        });
      }
    }
  }

  return results;
}

export async function launchOneDrivePickerSdk(clientId) {
  await loadScriptOnce('https://js.live.net/v7.2/OneDrive.js');
  if (!window.OneDrive) throw new Error('OneDrive Picker SDK could not be loaded.');
  const effectiveClientId = String(clientId || '').trim() || '23f66817-f4a4-4367-93ae-c9dfadba2a57';

  return new Promise((resolve, reject) => {
    window.OneDrive.open({
      clientId: effectiveClientId,
      action: 'download',
      multiSelect: true,
      openInNewWindow: true,
      advanced: { filter: '.jpg,.jpeg,.png,.webp,.bmp,.gif' },
      success: (response) => {
        const values = response?.values || [];
        const items = values
          .filter((item) => Boolean(item['@microsoft.graph.downloadUrl']))
          .map((item) => {
            const dlUrl = item['@microsoft.graph.downloadUrl'];
            const name = item.name || 'onedrive_photo.jpg';
            const modMs = item.fileSystemInfo?.lastModifiedDateTime
              ? new Date(item.fileSystemInfo.lastModifiedDateTime).getTime()
              : Date.now();
            return {
              isCloudFile: true,
              provider: 'onedrive',
              cloudId: item.id || name,
              name,
              size: Number(item.size) || 0,
              type: 'image/jpeg',
              lastModified: modMs,
              webkitRelativePath: `OneDrive/${name}`,
              fetchFile: async () => {
                const dl = await fetch(dlUrl);
                if (!dl.ok) throw new Error(`Failed to download ${name}`);
                const blob = await dl.blob();
                return new File([blob], name, { type: blob.type || 'image/jpeg', lastModified: modMs });
              }
            };
          });
        resolve(items);
      },
      cancel: () => resolve([]),
      error: (err) => reject(new Error(err?.message || 'OneDrive Picker error'))
    });
  });
}

/* ============================================================================
   3. ZIP UNPACKER (Apple iCloud Photos.zip, Google Takeout, OneDrive ZIP)
   ============================================================================ */

export async function extractImagesFromZip(zipFile, sourceLabel = 'Cloud_Archive', onProgress = null) {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    if (relativePath.includes('__MACOSX') || relativePath.split('/').pop().startsWith('._')) return;
    if (isImageFile(relativePath, '')) {
      entries.push({ relativePath, entry });
    }
  });

  const files = [];
  for (let i = 0; i < entries.length; i++) {
    const { relativePath, entry } = entries[i];
    const blob = await entry.async('blob');
    const name = relativePath.split('/').pop() || `photo_${i + 1}.jpg`;
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const file = new File([blob], name, {
      type: mime,
      lastModified: entry.date ? entry.date.getTime() : Date.now()
    });
    // Preserve subfolder path for the batch loader
    Object.defineProperty(file, 'webkitRelativePath', {
      value: `${sourceLabel}/${relativePath}`,
      configurable: true
    });
    files.push(file);
    if (onProgress && (i % 10 === 0 || i === entries.length - 1)) {
      onProgress({ extracted: i + 1, total: entries.length });
    }
  }
  return files;
}

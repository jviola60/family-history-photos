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

export async function requestGoogleToken(clientId, scope) {
  const cleanId = String(clientId || '').trim();
  if (!cleanId) throw new Error('Please enter your Google OAuth Client ID first.');

  await loadScriptOnce('https://accounts.google.com/gsi/client');
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Sign-In library failed to load.');
  }

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cleanId,
      scope,
      callback: (resp) => {
        if (resp?.error) {
          reject(new Error(resp.error_description || resp.error || 'Google sign-in cancelled.'));
          return;
        }
        if (!resp?.access_token) {
          reject(new Error('No Google access token returned.'));
          return;
        }
        resolve(resp.access_token);
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function listGoogleDriveFolders(token, parentId = 'root') {
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive folder list failed (${res.status}): ${errText || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function scanGoogleDriveFolder(token, folderId = 'root', folderName = 'Google Drive', onProgress = null) {
  const results = [];
  const queue = [{ id: folderId, path: folderName }];
  let foldersScanned = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    foldersScanned++;
    let pageToken = '';

    do {
      const q = `'${current.id}' in parents and trashed = false`;
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
        pageSize: '200'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(`Google Drive scan failed (${res.status})`);
      }
      const data = await res.json();
      const files = data.files || [];

      for (const f of files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: f.id, path: `${current.path}/${f.name}` });
        } else if (isImageFile(f.name, f.mimeType)) {
          const sizeBytes = Number(f.size) || 0;
          const modMs = f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now();
          const relPath = `${current.path}/${f.name}`;
          results.push({
            isCloudFile: true,
            provider: 'gdrive',
            cloudId: f.id,
            name: f.name,
            size: sizeBytes,
            type: f.mimeType || 'image/jpeg',
            lastModified: modMs,
            webkitRelativePath: relPath,
            fetchFile: async () => {
              const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (!dl.ok) throw new Error(`Failed to download ${f.name} (${dl.status})`);
              const blob = await dl.blob();
              return new File([blob], f.name, {
                type: blob.type || f.mimeType || 'image/jpeg',
                lastModified: modMs
              });
            }
          });
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

export async function launchGooglePhotosPicker(clientId, onStatus = null) {
  if (onStatus) onStatus('Signing in to Google Photos...');
  const token = await requestGoogleToken(
    clientId,
    'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
  );

  if (onStatus) onStatus('Creating Google Photos picker session...');
  const sessRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  if (!sessRes.ok) {
    const errText = await sessRes.text().catch(() => '');
    throw new Error(`Google Photos Picker failed (${sessRes.status}): ${errText || sessRes.statusText}`);
  }
  const session = await sessRes.json();
  const pickerUrl = `${session.pickerUri}/autoclose`;
  const popup = window.open(pickerUrl, 'fhp_gphotos_picker', 'width=980,height=740');
  if (!popup) {
    throw new Error('Popup was blocked. Please allow popups for this site and try again.');
  }

  if (onStatus) onStatus('Select your photos or album in the Google Photos window, then click Done...');

  // Poll session until mediaItemsSet is true or popup closed
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
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
    if (popup.closed) {
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

  try { if (!popup.closed) popup.close(); } catch {}
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

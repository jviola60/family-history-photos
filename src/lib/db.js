import { createStore, get, set, del, clear } from 'idb-keyval';

/**
 * Isolated, dedicated IndexedDB database.
 * NEVER connects to the default 'keyval-store' database which may contain corrupted
 * LevelDB entries from previous oversized FileSystemFileHandle crashes.
 */
let memoriesStore = null;
try {
  if (typeof window !== 'undefined' && window.indexedDB) {
    memoriesStore = createStore('who_is_this_memories_v3', 'memories_store');
  }
} catch (e) {
  console.warn('IndexedDB not supported or blocked in this context:', e);
}

const CATALOG_KEY = 'photo_catalog_metadata';
const PEOPLE_KEY = 'people_directory';
const IGNORED_DUPLICATES_KEY = 'ignored_duplicates';
const IGNORED_JUNK_KEY = 'ignored_junk';

// Reads of large saved data can take longer than the short default; never treat a slow read as empty.
const LONG_READ_MS = 30000;
const DB_READ_FAILED = Symbol('db-read-failed');

/**
 * Helper to execute an IndexedDB operation with a strict timeout (600ms)
 * to guarantee it never hangs, blocks the main thread, or crashes the browser.
 */
async function safeDb(operation, fallback = null, timeoutMs = 600) {
  if (!memoriesStore) return fallback;
  try {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(fallback);
      }, timeoutMs);
    });

    const opPromise = Promise.resolve()
      .then(() => operation(memoriesStore))
      .then(res => {
        clearTimeout(timeoutId);
        return res;
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.warn('Safe IndexedDB operation failed non-critically:', err);
        return fallback;
      });

    const result = await Promise.race([opPromise, timeoutPromise]);
    return result ?? fallback;
  } catch (err) {
    console.warn('Safe IndexedDB operation failed non-critically:', err);
    return fallback;
  }
}

/**
 * Sanitize a photo object so it only contains lightweight, serializable metadata.
 * Strips raw File blobs, transient blob: URLs, and circular directory handles
 * that cause out-of-memory browser crashes on large libraries.
 */
export function sanitizePhotoForStorage(p) {
  if (!p) return null;
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    relativePath: String(p.relativePath || p.name || ''),
    folderName: String(p.folderName || ''),
    thumbnailUrl: p.thumbnailUrl ? String(p.thumbnailUrl) : (p.enhancedUrl ? String(p.enhancedUrl) : ''),
    size: Number(p.size) || 0,
    lastModified: Number(p.lastModified) || 0,
    width: Number(p.width) || 0,
    height: Number(p.height) || 0,
    people: Array.isArray(p.people) ? p.people.map(String) : [],
    personRelationships: (p.personRelationships && typeof p.personRelationships === 'object') ? p.personRelationships : {},
    faces: Array.isArray(p.faces) ? p.faces : [],
    noPeople: Boolean(p.noPeople),
    facesScanned: Boolean(p.facesScanned),
    facesCascadeVerified: Boolean(p.facesCascadeVerified),
    relationship: String(p.relationship || ''),
    decade: String(p.decade || ''),
    date: String(p.date || ''),
    story: String(p.story || ''),
    location: String(p.location || ''),
    familyBranch: String(p.familyBranch || ''),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    enhanced: Boolean(p.enhanced),
    isMarkedDuplicate: Boolean(p.isMarkedDuplicate)
  };
}

/**
 * Checks if a photo has user customizations or review status
 */
export function isPhotoModifiedByUser(p) {
  if (!p) return false;
  return Boolean(
    (Array.isArray(p.people) && p.people.length > 0) ||
    (p.personRelationships && Object.keys(p.personRelationships).length > 0) ||
    p.noPeople ||
    p.relationship ||
    p.story ||
    p.decade ||
    p.date ||
    p.location ||
    p.familyBranch ||
    p.isMarkedDuplicate ||
    p.enhanced
  );
}

export async function saveCatalogToDB(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) return;
  
  // Load existing catalog so photos tagged across multiple different folders are NEVER erased.
  // If the read fails or times out, SKIP saving rather than overwrite everything with a partial list.
  const existingCatalog = await safeDb(
    async store => (await get(CATALOG_KEY, store)) ?? [],
    DB_READ_FAILED,
    LONG_READ_MS
  );
  if (existingCatalog === DB_READ_FAILED) {
    console.warn('Catalog read failed; skipping save to protect existing notes.');
    return;
  }
  const catalogMap = new Map();

  const getCanonicalKey = (p) => {
    const f = (p.folderName || '').toLowerCase().trim();
    const r = (p.relativePath || p.name || p.id || '').toLowerCase().trim();
    return f ? `${f}::${r}` : `_any_::${r}`;
  };

  // 1. Populate existing entries (deduplicated by canonical key)
  if (Array.isArray(existingCatalog)) {
    existingCatalog.forEach(item => {
      const sanitized = sanitizePhotoForStorage(item);
      if (sanitized) {
        const key = getCanonicalKey(sanitized);
        catalogMap.set(key, sanitized);
      }
    });
  }

  // 2. Merge newly modified photos into catalog
  catalog
    .filter(isPhotoModifiedByUser)
    .forEach(item => {
      const sanitized = sanitizePhotoForStorage(item);
      if (sanitized) {
        const key = getCanonicalKey(sanitized);
        // Clean up any legacy unnamespaced entry for this exact relative path
        const r = (sanitized.relativePath || sanitized.name || '').toLowerCase().trim();
        const legacyKey = `_any_::${r}`;
        if (sanitized.folderName && catalogMap.has(legacyKey)) {
          catalogMap.delete(legacyKey);
        }
        catalogMap.set(key, sanitized);
      }
    });

  // Strict deduplication to ensure exactly one unique record per photo
  const uniqueItems = [];
  const seenPaths = new Set();
  for (const item of catalogMap.values()) {
    const uniqueId = `${(item.folderName || '').toLowerCase().trim()}::${(item.relativePath || item.name).toLowerCase().trim()}`;
    if (!seenPaths.has(uniqueId)) {
      seenPaths.add(uniqueId);
      uniqueItems.push(item);
    }
  }

  await safeDb(store => set(CATALOG_KEY, uniqueItems, store));
}

export async function loadCatalogFromDB() {
  const data = await safeDb(store => get(CATALOG_KEY, store), [], LONG_READ_MS);
  return Array.isArray(data) ? data : [];
}

export async function overwriteCatalogInDB(catalog) {
  if (!Array.isArray(catalog)) return;
  const sanitized = catalog.map(sanitizePhotoForStorage).filter(Boolean);
  await safeDb(store => set(CATALOG_KEY, sanitized, store));
}

export async function savePeopleDirectoryToDB(people) {
  if (!people || typeof people !== 'object') return;
  await safeDb(store => set(PEOPLE_KEY, people, store));
}

export async function loadPeopleDirectoryFromDB() {
  const data = await safeDb(store => get(PEOPLE_KEY, store), {}, LONG_READ_MS);
  return (data && typeof data === 'object') ? data : {};
}

export async function saveIgnoredDuplicatesToDB(ignoredList) {
  const arr = Array.from(ignoredList || []);
  await safeDb(store => set(IGNORED_DUPLICATES_KEY, arr, store));
}

export async function loadIgnoredDuplicatesFromDB() {
  const list = await safeDb(store => get(IGNORED_DUPLICATES_KEY, store), []);
  return new Set(Array.isArray(list) ? list : []);
}

export async function saveIgnoredJunkToDB(ignoredSet) {
  const arr = Array.from(ignoredSet || []);
  await safeDb(store => set(IGNORED_JUNK_KEY, arr, store));
}

export async function loadIgnoredJunkFromDB() {
  const list = await safeDb(store => get(IGNORED_JUNK_KEY, store), []);
  return new Set(Array.isArray(list) ? list : []);
}

export async function clearAllLocalData() {
  await safeDb(store => clear(store));
  // Safely request unlinking of dead legacy databases if supported
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
      indexedDB.deleteDatabase('keyval-store');
      indexedDB.deleteDatabase('who_is_this_photo_catalog_v2');
      indexedDB.deleteDatabase('who_is_this_photo_catalog_v1');
    }
  } catch {
    // Non-critical
  }
}

/* ==========================================================================
   Last Session & Directory Handle Persistence
   ========================================================================== */

const LAST_DIR_HANDLE_KEY = 'last_opened_dir_handle';
const LAST_SESSION_INFO_KEY = 'last_album_session_info';
const CLOUD_PHOTOS_CACHE_KEY = 'cloud_photos_cache';

export async function saveLastSessionInfo(info) {
  if (!info) return;
  await safeDb(store => set(LAST_SESSION_INFO_KEY, info, store));
}

export async function loadLastSessionInfo() {
  return await safeDb(store => get(LAST_SESSION_INFO_KEY, store), null);
}

export async function saveStoredDirectoryHandle(handle) {
  if (!handle) return;
  try {
    await safeDb(store => set(LAST_DIR_HANDLE_KEY, handle, store));
  } catch (e) {
    console.warn('Could not store directory handle in IndexedDB:', e);
  }
}

export async function loadStoredDirectoryHandle() {
  return await safeDb(store => get(LAST_DIR_HANDLE_KEY, store), null);
}

const SAVED_FOLDERS_MAP_KEY = 'saved_folder_handles_map';

export async function saveNamedFolderHandle(folderName, handle) {
  if (!folderName || !handle) return;
  try {
    const existing = (await safeDb(store => get(SAVED_FOLDERS_MAP_KEY, store), {})) || {};
    existing[folderName] = handle;
    await safeDb(store => set(SAVED_FOLDERS_MAP_KEY, existing, store));
  } catch (e) {
    console.warn('Could not store named folder handle:', e);
  }
}

export async function loadSavedFolderHandlesMap() {
  const map = await safeDb(store => get(SAVED_FOLDERS_MAP_KEY, store), {});
  return (map && typeof map === 'object') ? map : {};
}

const ACTIVE_ALBUM_PHOTOS_KEY = 'active_album_photos_cache';

export async function saveActiveAlbumCacheToDB(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return;
  const sanitized = photos.map(sanitizePhotoForStorage).filter(Boolean);
  await safeDb(store => set(ACTIVE_ALBUM_PHOTOS_KEY, sanitized, store));
}

export async function loadActiveAlbumCacheFromDB() {
  return await safeDb(store => get(ACTIVE_ALBUM_PHOTOS_KEY, store), [], LONG_READ_MS);
}

/* ==========================================================================
   Edited pictures (4K restore, rotate, crop, erase)
   Stored separately so they survive a page reload.
   ========================================================================== */

const enhancedKey = (photoKey) => `enhanced_image::${String(photoKey || '').toLowerCase()}`;

export async function saveEnhancedImageToDB(photoKey, dataUrl) {
  if (!photoKey || !dataUrl) return;
  await safeDb(store => set(enhancedKey(photoKey), dataUrl, store), null, LONG_READ_MS);
}

export async function loadEnhancedImageFromDB(photoKey) {
  if (!photoKey) return null;
  return await safeDb(store => get(enhancedKey(photoKey), store), null, LONG_READ_MS);
}

export async function deleteEnhancedImageFromDB(photoKey) {
  if (!photoKey) return;
  await safeDb(store => del(enhancedKey(photoKey), store));
}

export async function clearStoredDirectoryHandle(folderNameToClear = null) {
  if (folderNameToClear) {
    try {
      const existing = (await safeDb(store => get(SAVED_FOLDERS_MAP_KEY, store), {})) || {};
      delete existing[folderNameToClear];
      await safeDb(store => set(SAVED_FOLDERS_MAP_KEY, existing, store));
    } catch {}
  }
  await safeDb(store => del(LAST_DIR_HANDLE_KEY, store));
  await safeDb(store => del(LAST_SESSION_INFO_KEY, store));
  await safeDb(store => del(CLOUD_PHOTOS_CACHE_KEY, store));
  await safeDb(store => del(ACTIVE_ALBUM_PHOTOS_KEY, store));
}

export async function saveCloudPhotosToDB(photos) {
  if (!Array.isArray(photos)) return;
  try {
    const serialized = await Promise.all(photos.map(async p => {
      let fileBlob = p.file;
      if (!fileBlob && p.objectUrl && p.objectUrl.startsWith('blob:')) {
        try {
          const r = await fetch(p.objectUrl);
          fileBlob = await r.blob();
        } catch {}
      }
      return {
        id: p.id,
        name: p.name,
        size: p.size,
        lastModified: p.lastModified,
        relativePath: p.relativePath,
        width: p.width,
        height: p.height,
        people: p.people || [],
        relationship: p.relationship || '',
        personRelationships: p.personRelationships || {},
        decade: p.decade || '',
        date: p.date || '',
        story: p.story || '',
        location: p.location || '',
        familyBranch: p.familyBranch || '',
        tags: p.tags || [],
        enhanced: !!p.enhanced,
        isMarkedDuplicate: !!p.isMarkedDuplicate,
        blob: fileBlob
      };
    }));
    await safeDb(store => set(CLOUD_PHOTOS_CACHE_KEY, serialized, store));
  } catch (err) {
    console.warn('Could not cache cloud photos:', err);
  }
}

export async function loadCloudPhotosFromDB() {
  const cached = await safeDb(store => get(CLOUD_PHOTOS_CACHE_KEY, store), []);
  if (!Array.isArray(cached) || cached.length === 0) return [];
  return cached.map(item => {
    let objectUrl = null;
    let file = null;
    if (item.blob) {
      objectUrl = URL.createObjectURL(item.blob);
      file = new File([item.blob], item.name, {
        type: item.blob.type || 'image/jpeg',
        lastModified: item.lastModified || Date.now()
      });
    }
    return {
      ...item,
      file,
      objectUrl,
      handle: null,
      parentDirHandle: null
    };
  });
}

/* ==========================================================================
   In-Progress Photo Draft Autosave Helpers
   ========================================================================== */

export function savePhotoDraft(photoKey, draftData) {
  if (!photoKey || !draftData) return;
  try {
    localStorage.setItem(`fhp_draft_${photoKey}`, JSON.stringify({
      ...draftData,
      savedAt: Date.now()
    }));
  } catch {}
}

export function loadPhotoDraft(photoKey) {
  if (!photoKey) return null;
  try {
    const raw = localStorage.getItem(`fhp_draft_${photoKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPhotoDraft(photoKey) {
  if (!photoKey) return;
  try {
    localStorage.removeItem(`fhp_draft_${photoKey}`);
  } catch {}
}

/* ==========================================================================
   FamilySearch Tree Person Mappings (Local Name -> FamilySearch Tree ID)
   ========================================================================== */

const FS_PERSON_MAPPINGS_KEY = 'fs_person_mappings';

export async function getFamilySearchPersonMappings() {
  const mappings = await safeDb(store => get(FS_PERSON_MAPPINGS_KEY, store), {});
  try {
    const local = JSON.parse(localStorage.getItem(FS_PERSON_MAPPINGS_KEY) || '{}');
    return { ...local, ...(mappings || {}) };
  } catch {
    return mappings || {};
  }
}

export async function saveFamilySearchPersonMapping(name, fsPerson) {
  if (!name || !fsPerson) return;
  const current = await getFamilySearchPersonMappings();
  const updated = {
    ...current,
    [name.trim()]: {
      id: fsPerson.id?.trim().toUpperCase(),
      name: fsPerson.name || name.trim(),
      lifespan: fsPerson.lifespan || ''
    }
  };
  await safeDb(store => set(FS_PERSON_MAPPINGS_KEY, updated, store));
  try {
    localStorage.setItem(FS_PERSON_MAPPINGS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}


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

/**
 * Helper to execute an IndexedDB operation with a strict timeout (600ms)
 * to guarantee it never hangs, blocks the main thread, or crashes the browser.
 */
async function safeDb(operation, fallback = null) {
  if (!memoriesStore) return fallback;
  try {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(fallback);
      }, 600);
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
    size: Number(p.size) || 0,
    lastModified: Number(p.lastModified) || 0,
    width: Number(p.width) || 0,
    height: Number(p.height) || 0,
    people: Array.isArray(p.people) ? p.people.map(String) : [],
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
  // Only persist photos that have actual user customizations or review flags!
  // This reduces storage size from 16,000+ items to just customized photos (< 50KB)
  const modifiedOnly = catalog
    .filter(isPhotoModifiedByUser)
    .map(sanitizePhotoForStorage)
    .filter(Boolean);

  await safeDb(store => set(CATALOG_KEY, modifiedOnly, store));
}

export async function loadCatalogFromDB() {
  const data = await safeDb(store => get(CATALOG_KEY, store), []);
  return Array.isArray(data) ? data : [];
}

export async function savePeopleDirectoryToDB(people) {
  if (!people || typeof people !== 'object') return;
  await safeDb(store => set(PEOPLE_KEY, people, store));
}

export async function loadPeopleDirectoryFromDB() {
  const data = await safeDb(store => get(PEOPLE_KEY, store), {});
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

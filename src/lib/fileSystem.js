/**
 * File System Access API & Folder Reader with fallback
 */

import { extractMetadataFromFile } from './photoMetadata';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'avif', 'tiff'
]);

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Open local folder with File System Access API
 */
export async function pickLocalDirectory() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. Please use Chrome or Edge.');
  }

  const dirHandle = await window.showDirectoryPicker({
    mode: 'readwrite'
  });

  return dirHandle;
}

/**
 * Recursively scans directory for image files
 */
export async function scanDirectoryForImages(dirHandle, path = '', onProgress = null) {
  const images = [];
  let duplicateReviewHandle = null;
  let counter = 0;

  async function traverse(currentDirHandle, currentPath) {
    for await (const [name, entry] of currentDirHandle.entries()) {
      if (entry.kind === 'directory') {
        if (name === '_Duplicates_Review') {
          duplicateReviewHandle = entry;
          await traverse(entry, `${currentPath}${name}/`);
        } else if (!name.startsWith('.')) {
          await traverse(entry, `${currentPath}${name}/`);
        }
      } else if (entry.kind === 'file') {
        const ext = name.split('.').pop().toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          counter++;
          if (counter % 150 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }

          let file;
          try {
            file = await entry.getFile();
          } catch {
            // File might have been moved, deleted, or locked by OS/sync
            continue;
          }
          if (!file) continue;

          const relativePath = `${currentPath}${name}`;
          const isMarkedDuplicate = currentPath.includes('_Duplicates_Review');

          // Check for embedded FamilySearch XMP/IPTC metadata inside the JPEG file
          let embeddedMeta = null;
          if (ext === 'jpg' || ext === 'jpeg') {
            try {
              embeddedMeta = await extractMetadataFromFile(file);
            } catch {}
          }

          const imageItem = {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            folderName: dirHandle?.name || '',
            file: null, // do not retain raw File blob to prevent OOM
            handle: entry,
            parentDirHandle: currentDirHandle,
            size: file.size,
            lastModified: file.lastModified,
            relativePath,
            isMarkedDuplicate,
            objectUrl: null, // lazily created when displayed
            width: 0,
            height: 0,
            // User metadata - auto-filled from embedded XMP if photo was previously tagged!
            people: embeddedMeta?.people || [],
            relationship: '',
            decade: embeddedMeta?.decade || '',
            date: embeddedMeta?.date || '',
            story: embeddedMeta?.story || '',
            location: embeddedMeta?.location || '',
            familyBranch: embeddedMeta?.familyBranch || '',
            tags: embeddedMeta?.tags || [],
            enhanced: false,
            enhancedUrl: null
          };

          images.push(imageItem);
          if (onProgress && counter % 20 === 0) {
            onProgress(images.length, name);
          }
        }
      }
    }
  }

  await traverse(dirHandle, path);
  return { images, duplicateReviewHandle };
}

/**
 * Helper to get natural dimensions of an image URL
 */
export function getImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Move a file into the _Duplicates_Review directory
 */
/**
 * Resolves the parent directory handle for a given relative path
 */
export async function getParentDirectoryHandle(rootDirHandle, relativePath) {
  if (!rootDirHandle || !relativePath) return rootDirHandle;
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length <= 1) return rootDirHandle;
  let current = rootDirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i]);
    } catch {
      return null;
    }
  }
  return current;
}

/**
 * Resolves a unique destination filename inside the target directory handle (Option A auto-suffix)
 * to avoid destructive overwrites or File System API lock collisions.
 */
async function getUniqueTargetFileName(dirHandle, originalName) {
  let finalName = originalName;
  let counter = 1;
  const dotIndex = originalName.lastIndexOf('.');
  const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName;
  const ext = dotIndex !== -1 ? originalName.slice(dotIndex) : '';

  while (true) {
    try {
      await dirHandle.getFileHandle(finalName, { create: false });
      // File exists -> generate unique numbered suffix
      finalName = `${baseName}_(${counter})${ext}`;
      counter++;
    } catch {
      // NotFoundError -> filename is unique and safe to write
      break;
    }
  }
  return finalName;
}

/**
 * Move a file into the _Duplicates_Review directory
 */
export async function moveFileToDuplicatesReview(rootDirHandle, photoItem, existingReviewDirHandle = null) {
  if (!rootDirHandle || !photoItem.handle) {
    // Virtual move if no writable handles
    photoItem.isMarkedDuplicate = true;
    photoItem.relativePath = `_Duplicates_Review/${photoItem.name}`;
    return true;
  }

  try {
    // 1. Get or create _Duplicates_Review subfolder
    const reviewDirHandle = existingReviewDirHandle || await rootDirHandle.getDirectoryHandle('_Duplicates_Review', { create: true });
    
    // Auto-suffix collision check (Option A: Never overwrite existing files)
    const targetFileName = await getUniqueTargetFileName(reviewDirHandle, photoItem.name);

    // 2. Try native OS-level handle.move() first (instant, 0 memory, no buffer allocation)
    if (typeof photoItem.handle.move === 'function') {
      try {
        await photoItem.handle.move(reviewDirHandle, targetFileName);
        photoItem.name = targetFileName;
        photoItem.parentDirHandle = reviewDirHandle;
        photoItem.isMarkedDuplicate = true;
        photoItem.relativePath = `_Duplicates_Review/${targetFileName}`;
        if (photoItem.objectUrl) {
          try { URL.revokeObjectURL(photoItem.objectUrl); } catch {}
          photoItem.objectUrl = null;
        }
        return true;
      } catch (nativeErr) {
        // Fallback to copy/delete if handle.move is not supported on this platform/origin
      }
    }

    // 3. Resolve source file and parent handle
    let sourceFile = null;
    let parentDir = photoItem.parentDirHandle;
    if (!parentDir && photoItem.relativePath) {
      parentDir = await getParentDirectoryHandle(rootDirHandle, photoItem.relativePath);
      photoItem.parentDirHandle = parentDir;
    }

    try {
      sourceFile = await photoItem.handle.getFile();
    } catch (readErr) {
      // If cached handle threw InvalidStateError, fetch fresh handle from parent dir
      if (parentDir && typeof parentDir.getFileHandle === 'function') {
        const freshHandle = await parentDir.getFileHandle(photoItem.name);
        photoItem.handle = freshHandle;
        sourceFile = await freshHandle.getFile();
      } else {
        throw readErr;
      }
    }

    // 4. Create target file inside _Duplicates_Review and stream/write directly
    const targetFileHandle = await reviewDirHandle.getFileHandle(targetFileName, { create: true });
    const writable = await targetFileHandle.createWritable();
    
    try {
      // Writing File/Blob directly is supported by File System Access API without arrayBuffer memory exhaustion
      await writable.write(sourceFile);
    } catch (writeErr) {
      // Fallback slice buffer write if direct Blob write was rejected by platform
      const buffer = await sourceFile.slice(0, sourceFile.size).arrayBuffer();
      await writable.write(buffer);
    } finally {
      // Guaranteed close to prevent Windows file-handle leaks and IPC stalls
      try {
        await writable.close();
      } catch {}
    }

    // 5. Remove from original directory
    if (parentDir && typeof parentDir.removeEntry === 'function') {
      try {
        await parentDir.removeEntry(photoItem.name);
      } catch (removeErr) {
        console.warn(`Could not delete original file from parent dir: ${photoItem.name}`, removeErr);
      }
    }

    // Clean up memory
    if (photoItem.objectUrl) {
      try { URL.revokeObjectURL(photoItem.objectUrl); } catch {}
      photoItem.objectUrl = null;
    }

    photoItem.name = targetFileName;
    photoItem.handle = targetFileHandle;
    photoItem.parentDirHandle = reviewDirHandle;
    photoItem.isMarkedDuplicate = true;
    photoItem.relativePath = `_Duplicates_Review/${targetFileName}`;
    return true;
  } catch (err) {
    console.error('Failed to move file to _Duplicates_Review:', err);
    // Graceful fallback to virtual flag
    photoItem.isMarkedDuplicate = true;
    return false;
  }
}

/**
 * Move multiple files to _Duplicates_Review with permission verification and progress callback
 */
export async function moveMultipleFilesToDuplicatesReview(rootDirHandle, photoItems, onProgress = null) {
  if (!photoItems || photoItems.length === 0) return { moved: 0, failed: 0 };

  // 1. Verify/request write permission while in direct user interaction context
  if (rootDirHandle && typeof rootDirHandle.queryPermission === 'function') {
    try {
      const perm = await rootDirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof rootDirHandle.requestPermission === 'function') {
        await rootDirHandle.requestPermission({ mode: 'readwrite' });
      }
    } catch (permErr) {
      console.warn('Write permission check:', permErr);
    }
  }

  // 2. Pre-create / resolve _Duplicates_Review directory handle once
  let reviewDirHandle = null;
  if (rootDirHandle) {
    try {
      reviewDirHandle = await rootDirHandle.getDirectoryHandle('_Duplicates_Review', { create: true });
    } catch (dirErr) {
      console.warn('Could not pre-open _Duplicates_Review:', dirErr);
    }
  }

  let moved = 0;
  let failed = 0;
  const total = photoItems.length;

  for (let i = 0; i < total; i++) {
    const item = photoItems[i];
    const success = await moveFileToDuplicatesReview(rootDirHandle, item, reviewDirHandle);
    if (success) {
      moved++;
    } else {
      failed++;
    }

    // Throttle progress updates to avoid hundreds of React state updates
    if (onProgress && (i % 8 === 0 || i === total - 1)) {
      onProgress(i + 1, total, item);
    }

    // Yield control and let Chrome GC every 5 items
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 12));
    }
  }

  return { moved, failed };
}

/**
 * Restore a file from _Duplicates_Review back to the root folder
 */
export async function restoreFileFromDuplicatesReview(rootDirHandle, photoItem) {
  if (!rootDirHandle || !photoItem.handle) {
    photoItem.isMarkedDuplicate = false;
    photoItem.relativePath = photoItem.name;
    return true;
  }

  try {
    const sourceFile = await photoItem.handle.getFile();
    const targetFileHandle = await rootDirHandle.getFileHandle(photoItem.name, { create: true });
    const writable = await targetFileHandle.createWritable();
    try {
      await writable.write(sourceFile);
    } catch {
      const buffer = await sourceFile.slice(0, sourceFile.size).arrayBuffer();
      await writable.write(buffer);
    } finally {
      try {
        await writable.close();
      } catch {}
    }

    // Remove from _Duplicates_Review
    if (photoItem.parentDirHandle && photoItem.parentDirHandle.removeEntry) {
      try {
        await photoItem.parentDirHandle.removeEntry(photoItem.name);
      } catch {}
    }

    photoItem.handle = targetFileHandle;
    photoItem.parentDirHandle = rootDirHandle;
    photoItem.isMarkedDuplicate = false;
    photoItem.relativePath = photoItem.name;
    return true;
  } catch (err) {
    console.error('Failed to restore file from _Duplicates_Review:', err);
    photoItem.isMarkedDuplicate = false;
    return false;
  }
}

/**
 * Restore multiple files from _Duplicates_Review back to the main library folder
 */
export async function restoreMultipleFilesFromDuplicatesReview(rootDirHandle, photoItems, onProgress = null) {
  if (!photoItems || photoItems.length === 0) return { restored: 0, failed: 0 };

  let restored = 0;
  let failed = 0;
  const total = photoItems.length;

  for (let i = 0; i < total; i++) {
    const item = photoItems[i];
    const success = await restoreFileFromDuplicatesReview(rootDirHandle, item);
    if (success) {
      restored++;
    } else {
      failed++;
    }

    if (onProgress && (i % 8 === 0 || i === total - 1)) {
      onProgress(i + 1, total, item);
    }

    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 12));
    }
  }

  return { restored, failed };
}

/**
 * Permanently delete a single file from the _Duplicates_Review folder on disk
 */
export async function permanentlyDeleteFromDuplicatesReview(rootDirHandle, photoItem) {
  if (rootDirHandle) {
    try {
      const reviewDirHandle = await rootDirHandle.getDirectoryHandle('_Duplicates_Review', { create: false });
      if (reviewDirHandle && reviewDirHandle.removeEntry) {
        await reviewDirHandle.removeEntry(photoItem.name);
      }
    } catch (err) {
      console.warn('Could not remove file from disk:', err);
    }
  }
  return true;
}

/**
 * Permanently delete multiple files from _Duplicates_Review folder on disk
 */
export async function emptyDuplicatesReviewFolder(rootDirHandle, photoList) {
  if (rootDirHandle) {
    try {
      const reviewDirHandle = await rootDirHandle.getDirectoryHandle('_Duplicates_Review', { create: false });
      for (const p of photoList) {
        try {
          await reviewDirHandle.removeEntry(p.name);
        } catch {}
      }
    } catch (err) {
      console.warn('Could not empty review folder on disk:', err);
    }
  }
  return true;
}


/**
 * Save metadata catalog (.family_memories.json) directly into the directory
 */
export async function saveCatalogToFileSystem(dirHandle, catalogData) {
  if (!dirHandle) return false;
  try {
    const fileHandle = await dirHandle.getFileHandle('.family_memories_catalog.json', { create: true });
    const writable = await fileHandle.createWritable();
    try {
      const cleanData = catalogData.map(item => ({
        name: item.name,
        relativePath: item.relativePath,
        size: item.size,
        width: item.width,
        height: item.height,
        people: item.people,
        relationship: item.relationship,
        decade: item.decade,
        date: item.date,
        story: item.story,
        location: item.location,
        familyBranch: item.familyBranch,
        tags: item.tags,
        isMarkedDuplicate: item.isMarkedDuplicate
      }));
      await writable.write(JSON.stringify(cleanData, null, 2));
    } finally {
      try {
        await writable.close();
      } catch {}
    }
    return true;
  } catch (err) {
    console.warn('Could not write metadata to disk directly:', err);
    return false;
  }
}

/**
 * Traverse directories to retrieve a File by its relativePath
 */
export async function getFileFromPath(rootDirHandle, relativePath) {
  if (!rootDirHandle || !relativePath) return null;
  try {
    const parts = relativePath.split('/').filter(Boolean);
    let current = rootDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
  } catch (err) {
    return null;
  }
}


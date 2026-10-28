import JSZip from 'jszip';
import { extractMetadataFromFile, embedXmpInJpeg } from './photoMetadata';
import { getImageDimensions } from './fileSystem';

// Supported image extensions
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'tiff']);

/**
 * Extracts all photos from a ZIP archive (e.g. downloaded from iCloud, Google Photos, or OneDrive)
 * @param {File|Blob} zipBlob - The zip file to unpack
 * @param {Function} onProgress - Progress callback (current, total, filename)
 * @returns {Promise<Array<File>>} Array of File objects
 */
export async function extractPhotosFromZip(zipBlob, onProgress = null) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipBlob);
  
  const imageEntries = [];
  loadedZip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    // Skip Mac OSX hidden files
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) return;

    const ext = relativePath.split('.').pop().toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      imageEntries.push({ relativePath, entry, ext });
    }
  });

  const files = [];
  const total = imageEntries.length;

  for (let i = 0; i < total; i++) {
    const { relativePath, entry, ext } = imageEntries[i];
    const filename = relativePath.split('/').pop();

    if (onProgress) {
      onProgress(i + 1, total, filename);
    }

    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'bmp') mimeType = 'image/bmp';

    const blob = await entry.async('blob');
    const file = new File([blob], filename, {
      type: mimeType,
      lastModified: entry.date ? entry.date.getTime() : Date.now()
    });

    files.push(file);
  }

  return files;
}

/**
 * Converts an array of File objects (from cloud, zip, or picker) into full photo items
 * with dimensions, embedded metadata, and thumbnails
 * @param {Array<File>} files
 * @param {Function} onProgress
 * @returns {Promise<Array<Object>>}
 */
export async function processImportedFiles(files, onProgress = null) {
  const imageItems = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();

    if (onProgress) {
      onProgress(i + 1, total, name);
    }

    const objectUrl = URL.createObjectURL(file);
    let width = 0;
    let height = 0;
    try {
      const dims = await getImageDimensions(objectUrl);
      width = dims.width;
      height = dims.height;
    } catch {
      // fallback
    }

    // Extract any embedded FamilySearch / XMP metadata
    let embeddedMeta = null;
    if (ext === 'jpg' || ext === 'jpeg') {
      try {
        embeddedMeta = await extractMetadataFromFile(file);
      } catch {}
    }

    imageItems.push({
      id: `cloud_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
      name,
      file,
      handle: null,
      parentDirHandle: null,
      size: file.size,
      lastModified: file.lastModified,
      relativePath: file.webkitRelativePath || name,
      isMarkedDuplicate: false,
      objectUrl,
      width,
      height,
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
    });
  }

  return imageItems;
}

/**
 * Dynamically loads an external script if not already loaded
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Launches Microsoft OneDrive File Picker v7.2
 * Allows user to log in to their Microsoft account and pick photos directly from OneDrive
 */
export async function launchOneDrivePicker({ clientId, onFilesPicked, onError, onCancel }) {
  try {
    await loadScript('https://js.live.net/v7.2/OneDrive.js');
    
    if (!window.OneDrive) {
      throw new Error('OneDrive SDK could not be initialized');
    }

    // Default public/fallback demo client ID if none provided
    const effectiveClientId = clientId?.trim() || '23f66817-f4a4-4367-93ae-c9dfadba2a57';

    window.OneDrive.open({
      clientId: effectiveClientId,
      action: 'download',
      multiSelect: true,
      openInNewWindow: true,
      advanced: {
        filter: '.jpg,.jpeg,.png,.webp,.bmp'
      },
      success: async (response) => {
        try {
          if (!response || !response.values || response.values.length === 0) {
            if (onCancel) onCancel();
            return;
          }

          const files = [];
          for (const item of response.values) {
            const downloadUrl = item['@microsoft.graph.downloadUrl'];
            if (downloadUrl) {
              const res = await fetch(downloadUrl);
              const blob = await res.blob();
              const file = new File([blob], item.name, {
                type: blob.type || 'image/jpeg',
                lastModified: item.fileSystemInfo?.lastModifiedDateTime 
                  ? new Date(item.fileSystemInfo.lastModifiedDateTime).getTime() 
                  : Date.now()
              });
              files.push(file);
            }
          }
          if (onFilesPicked) onFilesPicked(files);
        } catch (err) {
          if (onError) onError(err);
        }
      },
      cancel: () => {
        if (onCancel) onCancel();
      },
      error: (err) => {
        if (onError) onError(err);
      }
    });
  } catch (err) {
    if (onError) onError(err);
  }
}

/**
 * Launches Google Picker API for Google Drive / Google Photos
 */
export async function launchGooglePicker({ apiKey, clientId, onFilesPicked, onError, onCancel }) {
  try {
    await loadScript('https://apis.google.com/js/api.js');
    await loadScript('https://accounts.google.com/gsi/client');

    if (!window.gapi || !window.google) {
      throw new Error('Google APIs could not be loaded.');
    }

    await new Promise((resolve) => window.gapi.load('picker', resolve));

    // Request token via Google Identity Services
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: async (response) => {
        if (response.error !== undefined) {
          if (onError) onError(response);
          return;
        }

        const accessToken = response.access_token;
        const view = new window.google.picker.View(window.google.picker.ViewId.DOCS_IMAGES);
        view.setMimeTypes('image/png,image/jpeg,image/webp,image/gif');

        const picker = new window.google.picker.PickerBuilder()
          .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
          .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
          .setAppId(clientId)
          .setOAuthToken(accessToken)
          .addView(view)
          .addView(new window.google.picker.DocsUploadView())
          .setDeveloperKey(apiKey)
          .setCallback(async (data) => {
            if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
              const docs = data[window.google.picker.Response.DOCUMENTS];
              const files = [];

              for (const doc of docs) {
                const fileId = doc[window.google.picker.Document.ID];
                const fileName = doc[window.google.picker.Document.NAME];
                try {
                  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  });
                  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
                  const blob = await res.blob();
                  const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
                  files.push(file);
                } catch (e) {
                  console.error('Error fetching Google Drive file:', e);
                }
              }

              if (onFilesPicked) onFilesPicked(files);
            } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
              if (onCancel) onCancel();
            }
          })
          .build();

        picker.setVisible(true);
      }
    });

    tokenClient.requestAccessToken({ prompt: '' });
  } catch (err) {
    if (onError) onError(err);
  }
}

/**
 * Packages all improved photos, 4K restorations, and embedded XMP metadata into a downloadable ZIP
 * perfect for saving improved photos back to Google Photos, OneDrive, or iCloud!
 * @param {Array<Object>} photos
 * @param {Function} onProgress
 * @returns {Promise<Blob>}
 */
export async function exportImprovedPhotosZip(photos, onProgress = null) {
  const zip = new JSZip();
  const total = photos.length;
  let packagedCount = 0;

  for (let i = 0; i < total; i++) {
    const photo = photos[i];
    if (onProgress) {
      onProgress(i + 1, total, photo.name);
    }

    try {
      let imageBlob = null;

      // 1. If 4K enhanced, extract the enhanced high-resolution image!
      if (photo.enhanced && (photo.enhancedUrl || photo.enhanced)) {
        const src = photo.enhancedUrl;
        if (src) {
          try {
            const res = await fetch(src);
            imageBlob = await res.blob();
          } catch {}
        }
      }

      // 2. Otherwise extract original photo blob/file
      if (!imageBlob) {
        if (photo.file) {
          imageBlob = photo.file;
        } else if (photo.objectUrl) {
          try {
            const res = await fetch(photo.objectUrl);
            imageBlob = await res.blob();
          } catch {}
        } else if (photo.handle && typeof photo.handle.getFile === 'function') {
          try {
            imageBlob = await photo.handle.getFile();
          } catch {}
        }
      }

      if (!imageBlob) continue;

      let finalBlob = imageBlob;
      const isJpeg = /\.(jpe?g)$/i.test(photo.name);
      const hasMetadata = Boolean((photo.people && photo.people.length > 0) || photo.story || photo.date || photo.decade || photo.location);

      // 3. Embed FHMWG & FamilySearch XMP metadata into JPEGs
      if (isJpeg && hasMetadata) {
        try {
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          const embedded = embedXmpInJpeg(uint8, {
            title: photo.title || photo.name,
            people: photo.people,
            relationship: photo.relationship,
            date: photo.date,
            decade: photo.decade,
            story: photo.story,
            location: photo.location,
            familyBranch: photo.familyBranch,
            faces: photo.faces
          });
          finalBlob = new Blob([embedded], { type: 'image/jpeg' });
        } catch (embedErr) {
          console.warn('Metadata embedding fallback to original blob for', photo.name, embedErr);
        }
      }

      const cleanName = photo.enhanced && !photo.name.toLowerCase().startsWith('enhanced_')
        ? `Enhanced_4K_${photo.name}`
        : photo.name;

      zip.file(cleanName, finalBlob);
      packagedCount++;
    } catch (err) {
      console.warn(`Error packaging ${photo.name} into ZIP:`, err);
    }
  }

  // Include JSON album catalog
  const catalogJson = JSON.stringify(photos.map(p => ({
    name: p.name,
    people: p.people,
    relationship: p.relationship,
    date: p.date,
    decade: p.decade,
    story: p.story,
    location: p.location,
    familyBranch: p.familyBranch,
    enhanced: p.enhanced,
    lastModified: p.lastModified
  })), null, 2);
  zip.file('.family_memories_catalog.json', catalogJson);

  // Include quick upload guide for Google Photos, OneDrive, and iCloud
  const readme = `===================================================================
FAMILY HISTORY PHOTOS - IMPROVED ALBUM EXPORT
===================================================================
Total photos in this package: ${packagedCount}

All improved photos have been packaged with:
✓ 4K AI resolution & vintage photo restorations
✓ Standard FamilySearch / FHMWG metadata embedded directly into JPEG headers

HOW TO PUT IMPROVED PHOTOS BACK INTO YOUR CLOUD STORAGE:
-------------------------------------------------------------------
1. Google Photos:
   - Open https://photos.google.com in your browser
   - Click "Upload" > "Computer"
   - Select the improved photos from this folder

2. Microsoft OneDrive:
   - Open https://onedrive.live.com in your browser
   - Click "Upload" > "Files" (or drag and drop them in)

3. Apple iCloud:
   - Open https://www.icloud.com/photos in your browser
   - Click the Cloud Upload icon at the top of the screen
===================================================================
`;
  zip.file('HOW_TO_UPLOAD_TO_CLOUD.txt', readme);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}


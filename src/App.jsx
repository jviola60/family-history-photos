import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FolderCheck, Undo2, Sparkles } from 'lucide-react';
import Header from './components/Header';
import GuidedTour from './components/GuidedTour';
import FolderPickerHero from './components/FolderPickerHero';
import SearchFilterBar from './components/SearchFilterBar';
import PhotoGrid from './components/PhotoGrid';
import MetadataModal from './components/MetadataModal';
import DuplicateManagerModal from './components/DuplicateManagerModal';
import PhotoEnhancerModal from './components/PhotoEnhancerModal';
import PhotoEditorModal from './components/PhotoEditorModal';
import PeopleDirectoryModal from './components/PeopleDirectoryModal';
import JunkCleanerModal from './components/JunkCleanerModal';
import SettingsModal from './components/SettingsModal';
import CloudStorageModal from './components/CloudStorageModal';
import HelpGuideModal from './components/HelpGuideModal';

import { 
  pickLocalDirectory, 
  scanDirectoryForImages, 
  moveMultipleFilesToDuplicatesReview,
  restoreFileFromDuplicatesReview,
  restoreMultipleFilesFromDuplicatesReview,
  saveCatalogToFileSystem,
  getImageDimensions
} from './lib/fileSystem';
import { writeMetadataToPhotoHandle, createPhotoThumbnail } from './lib/photoMetadata';
import { findDuplicateGroups, getPairKey } from './lib/duplicateDetector';
import { scanPhotoLibraryForJunk, isScreenshotPhoto } from './lib/junkDetector';
import { 
  saveCatalogToDB, 
  loadCatalogFromDB, 
  savePeopleDirectoryToDB, 
  loadPeopleDirectoryFromDB,
  clearAllLocalData,
  saveIgnoredDuplicatesToDB,
  loadIgnoredDuplicatesFromDB,
  saveIgnoredJunkToDB,
  loadIgnoredJunkFromDB,
  saveLastSessionInfo,
  loadLastSessionInfo,
  saveStoredDirectoryHandle,
  loadStoredDirectoryHandle,
  clearStoredDirectoryHandle,
  saveNamedFolderHandle,
  loadSavedFolderHandlesMap,
  saveCloudPhotosToDB,
  loadCloudPhotosFromDB,
  saveActiveAlbumCacheToDB,
  loadActiveAlbumCacheFromDB,
  overwriteCatalogInDB
} from './lib/db';
import { 
  permanentlyDeleteFromDuplicatesReview, 
  emptyDuplicatesReviewFolder 
} from './lib/fileSystem';
// Sample album removed per user request

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [rootDirHandle, setRootDirHandle] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [peopleDirectory, setPeopleDirectory] = useState({});
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [ignoredPairs, setIgnoredPairs] = useState(new Set());
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [duplicateScanProgress, setDuplicateScanProgress] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [pendingResumeSession, setPendingResumeSession] = useState(null);
  const [savedCatalog, setSavedCatalog] = useState([]);
  const [savedFolderHandles, setSavedFolderHandles] = useState({});

  // Modals
  const [activeMetadataPhoto, setActiveMetadataPhoto] = useState(null);
  const [activeEnhancePhoto, setActiveEnhancePhoto] = useState(null);
  const [activeEditorPhoto, setActiveEditorPhoto] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalInitialTab, setDuplicateModalInitialTab] = useState('found');
  const [showJunkModal, setShowJunkModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showHelpGuideModal, setShowHelpGuideModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Ignored junk / low-value photos (user chose to keep)
  const [ignoredJunkIds, setIgnoredJunkIds] = useState(new Set());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_asc');
  const [selectedSubfolder, setSelectedSubfolder] = useState('all');

  const isInitialLoadRef = React.useRef(true);
  const savedMetadataMapRef = React.useRef(new Map());

  // Load initial cached data from IndexedDB safely without crashing
  useEffect(() => {
    let isMounted = true;
    async function initCache() {
      try {
        const cachedCatalog = await loadCatalogFromDB();
        const cachedPeople = await loadPeopleDirectoryFromDB();
        const loadedIgnored = await loadIgnoredDuplicatesFromDB();
        const loadedIgnoredJunk = await loadIgnoredJunkFromDB();
        if (!isMounted) return;

        if (loadedIgnored && loadedIgnored.size > 0) {
          setIgnoredPairs(loadedIgnored);
        }

        if (loadedIgnoredJunk && loadedIgnoredJunk.size > 0) {
          setIgnoredJunkIds(loadedIgnoredJunk);
        }

        if (cachedPeople && Object.keys(cachedPeople).length > 0) {
          // Clean out any legacy sample people from previous sessions
          const cleaned = {};
          for (const [id, person] of Object.entries(cachedPeople)) {
            const isSample = ['person_1', 'person_2', 'person_3', 'person_4'].includes(id) ||
              person?.branch?.includes('Miller Family') ||
              person?.name === 'Grandpa Arthur' ||
              person?.name === 'Grandma Rose' ||
              person?.name === 'Uncle David' ||
              person?.name === 'Aunt Evelyn';
            if (!isSample) {
              cleaned[id] = person;
            }
          }
          setPeopleDirectory(cleaned);
          await savePeopleDirectoryToDB(cleaned);
        } else {
          setPeopleDirectory({});
        }
        isPeopleLoadedRef.current = true;

        if (cachedCatalog && cachedCatalog.length > 0) {
          setSavedCatalog(cachedCatalog);
          const map = new Map();
          cachedCatalog.forEach(item => {
            if (item.relativePath) map.set(item.relativePath, item);
            if (item.name) map.set(item.name, item);
          });
          savedMetadataMapRef.current = map;
        }

        const folderHandles = await loadSavedFolderHandlesMap();
        if (folderHandles && isMounted) {
          setSavedFolderHandles(folderHandles);
        }

        // 1. Immediately restore cached active album photos so the screen is NEVER blank on refresh!
        const cachedActivePhotos = await loadActiveAlbumCacheFromDB();
        const lastSession = await loadLastSessionInfo();

        if (cachedActivePhotos && cachedActivePhotos.length > 0 && isMounted) {
          setPhotos(cachedActivePhotos);
          if (lastSession?.folderName) {
            setFolderName(lastSession.folderName);
          }
        }

        // 2. Restore previous album session where user left off
        if (lastSession && isMounted) {
          if (lastSession.type === 'directory') {
            const storedHandle = await loadStoredDirectoryHandle();
            if (storedHandle) {
              try {
                // If browser already granted permission (e.g. within session or persisted origin)
                const perm = await storedHandle.queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                  // The cached photos have no live file links after a reload,
                  // so reconnect to the folder to bring the pictures back.
                  await loadFolderFromHandle(storedHandle);
                  return;
                }
              } catch {}
              // Browser security needs 1 user click to activate folder access:
              setPendingResumeSession({
                handle: storedHandle,
                info: lastSession
              });
            }
          } else if (lastSession.type === 'cloud') {
            const cachedCloud = await loadCloudPhotosFromDB();
            if (cachedCloud && cachedCloud.length > 0) {
              setPhotos(cachedCloud);
              setFolderName(lastSession.folderName || 'Cloud Photos');
              checkDuplicates(cachedCloud);
            }
          } else if (lastSession.type === 'sample') {
            // Ignore legacy sample album session
            await clearStoredDirectoryHandle();
          }
        }
      } catch (err) {
        console.warn('Failed to load initial cache from IndexedDB:', err);
      }
    }
    initCache();
    return () => { isMounted = false; };
  }, []);

  // Save changes to DB whenever photos change (debounced and guarded)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (photos.length > 0) {
        isInitialLoadRef.current = false;
      }
      return;
    }

    if (photos.length > 0) {
      const timer = setTimeout(() => {
        saveCatalogToDB(photos);
        saveActiveAlbumCacheToDB(photos);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [photos]);

  const isPeopleLoadedRef = React.useRef(false);

  useEffect(() => {
    if (!isPeopleLoadedRef.current) return;
    if (Object.keys(peopleDirectory).length > 0) {
      savePeopleDirectoryToDB(peopleDirectory);
    }
  }, [peopleDirectory]);

  const handleClearAlbum = async () => {
    if (window.confirm('Do you want to close this album and choose another? (Your saved notes and tags are preserved)')) {
      await clearStoredDirectoryHandle();
      setPendingResumeSession(null);
      setPhotos([]);
      setFolderName('');
      setRootDirHandle(null);
      setDuplicateGroups([]);
      setIgnoredPairs(new Set());
      setIgnoredJunkIds(new Set());
    }
  };

  // Core loader that populates photos from a FileSystemDirectoryHandle
  const loadFolderFromHandle = async (dirHandle) => {
    try {
      setIsScanning(true);
      setScanProgress('Opening folder...');
      setRootDirHandle(dirHandle);
      setFolderName(dirHandle.name);

      const savedMap = savedMetadataMapRef.current;
      const knownPathsSet = new Set(savedMap.keys());

      setScanProgress('Connecting to photos...');
      const { images } = await scanDirectoryForImages(dirHandle, '', (count, name) => {
        setScanProgress(`Connected ${count} photos...`);
      }, knownPathsSet);

      // Seamlessly merge saved user metadata (names, stories, review status) with live files
      const mergedImages = images.map(img => {
        const saved = savedMap.get(img.relativePath) || savedMap.get(img.name);
        if (saved) {
          return {
            ...img,
            thumbnailUrl: saved.thumbnailUrl || img.thumbnailUrl,
            width: saved.width || img.width,
            height: saved.height || img.height,
            enhanced: !!saved.enhanced,
            enhancedUrl: saved.enhancedUrl || null,
            people: (saved.people && saved.people.length > 0) ? saved.people : img.people,
            relationship: saved.relationship || img.relationship,
            story: saved.story || img.story,
            decade: saved.decade || img.decade,
            date: saved.date || img.date,
            location: saved.location || img.location,
            familyBranch: saved.familyBranch || img.familyBranch,
            isMarkedDuplicate: !!saved.isMarkedDuplicate
          };
        }
        return img;
      });

      setPhotos(mergedImages);
      saveActiveAlbumCacheToDB(mergedImages);
      setIsScanning(false);
      setScanProgress('');

      // Auto-scan duplicates in background
      checkDuplicates(mergedImages);
      setPendingResumeSession(null);

      // Save for subsequent visits so user leaves off where they were
      await saveStoredDirectoryHandle(dirHandle);
      await saveNamedFolderHandle(dirHandle.name, dirHandle);
      setSavedFolderHandles(prev => ({ ...prev, [dirHandle.name]: dirHandle }));
      await saveLastSessionInfo({
        type: 'directory',
        folderName: dirHandle.name,
        photoCount: mergedImages.length,
        lastOpened: Date.now()
      });
    } catch (err) {
      console.warn('Folder loading cancelled or failed:', err);
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // Open local directory with File System Access API
  const handlePickFolder = async () => {
    try {
      const dirHandle = await pickLocalDirectory();
      await loadFolderFromHandle(dirHandle);
    } catch (err) {
      console.warn('Folder selection cancelled or failed:', err);
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // 1-Click Resume previous album
  const handleResumePreviousAlbum = async () => {
    if (!pendingResumeSession?.handle) return;
    try {
      setIsScanning(true);
      setScanProgress('Reconnecting to your folder...');
      const perm = await pendingResumeSession.handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await loadFolderFromHandle(pendingResumeSession.handle);
      } else {
        alert('Permission was not granted to open this folder.');
        setIsScanning(false);
      }
    } catch (err) {
      console.warn('Could not resume folder:', err);
      setIsScanning(false);
      alert('Could not resume previous folder automatically. Please use "Open My Photos Folder" to select it.');
    }
  };

  const handleDismissResume = async () => {
    setPendingResumeSession(null);
    await clearStoredDirectoryHandle();
  };

  // 1-Click view relative from Family Directory (auto-reconnects album if needed)
  const handleSelectPersonFromDirectory = async (personName) => {
    setActiveFilter(personName);
    setShowPeopleModal(false);

    // If album photos aren't loaded in memory yet, reconnect folder automatically
    if (photos.length === 0 && pendingResumeSession?.handle) {
      try {
        setIsScanning(true);
        setScanProgress(`Opening album for ${personName}...`);
        const perm = await pendingResumeSession.handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          await loadFolderFromHandle(pendingResumeSession.handle);
        } else {
          setIsScanning(false);
          setScanProgress('');
        }
      } catch (err) {
        console.warn('Could not auto-open album on filter:', err);
        setIsScanning(false);
        setScanProgress('');
      }
    }
  };

  // Open a specific folder by name and optionally filter by person
  const handleOpenFolderByName = async (targetFolderName, personNameToFilter = null) => {
    setShowPeopleModal(false);
    if (personNameToFilter) {
      setActiveFilter(personNameToFilter);
    }

    if (!targetFolderName) return;

    // 1. If currently open album is already this folder, we are already there
    if (rootDirHandle && (rootDirHandle.name === targetFolderName || folderName === targetFolderName)) {
      return;
    }

    // 2. Check if we have a stored handle for this folder
    const handle = savedFolderHandles[targetFolderName] || (pendingResumeSession?.handle?.name === targetFolderName ? pendingResumeSession.handle : null);
    if (handle) {
      try {
        setIsScanning(true);
        setScanProgress(`Opening "${targetFolderName}"...`);
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          await loadFolderFromHandle(handle);
          return;
        }
      } catch (err) {
        console.warn('Could not auto-open folder from handle:', err);
      }
    }

    // 3. Prompt user with folder picker directly within the user click gesture
    try {
      setIsScanning(true);
      setScanProgress(`Please choose your "${targetFolderName}" folder...`);
      const picked = await pickLocalDirectory();
      await loadFolderFromHandle(picked);
    } catch (err) {
      console.warn('Folder selection cancelled or failed:', err);
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // Fallback for file input
  const handleFallbackFilesSelected = async (fileList) => {
    setIsScanning(true);
    setScanProgress(`Processing ${fileList.length} files...`);

    const imageItems = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(file);
        let width = 0;
        let height = 0;
        try {
          const dims = await getImageDimensions(objectUrl);
          width = dims.width;
          height = dims.height;
        } catch {}

        imageItems.push({
          id: `img_upload_${Date.now()}_${i}`,
          name: file.name,
          file,
          handle: null,
          parentDirHandle: null,
          size: file.size,
          lastModified: file.lastModified,
          relativePath: file.webkitRelativePath || file.name,
          isMarkedDuplicate: false,
          objectUrl,
          width,
          height,
          people: [],
          relationship: '',
          decade: '',
          date: '',
          story: '',
          location: '',
          familyBranch: '',
          tags: [],
          enhanced: false,
          enhancedUrl: null
        });
      }
    }

    setPhotos(imageItems);
    setFolderName('Imported Photos');
    setIsScanning(false);
    checkDuplicates(imageItems);
  };

  // Import photos from cloud (OneDrive, Google Photos, Apple iCloud, ZIP unpacker)
  const handleImportCloudPhotos = async (importedPhotos, sourceName = 'Cloud Import') => {
    if (!importedPhotos || importedPhotos.length === 0) return;
    let combined = [];
    setPhotos(prev => {
      if (prev.length === 0) {
        combined = importedPhotos;
        checkDuplicates(importedPhotos);
        return importedPhotos;
      }
      const existingKeys = new Set(prev.map(p => `${p.name}_${p.size}`));
      const unique = importedPhotos.filter(p => !existingKeys.has(`${p.name}_${p.size}`));
      combined = [...prev, ...unique];
      checkDuplicates(combined);
      return combined;
    });
    if (!folderName) {
      setFolderName(sourceName);
    }
    setPendingResumeSession(null);

    // Save cloud photos to IndexedDB so they persist across page reloads!
    const toSave = combined.length > 0 ? combined : importedPhotos;
    await saveCloudPhotosToDB(toSave);
    await saveLastSessionInfo({
      type: 'cloud',
      folderName: sourceName,
      photoCount: toSave.length,
      lastOpened: Date.now()
    });
  };

  // Sample album loader removed per user request

  // Run high-performance duplicate detector
  const checkDuplicates = async (photoList = photos, mode = 'all') => {
    if (!photoList || photoList.length === 0) return;
    try {
      setIsScanningDuplicates(true);
      setDuplicateScanProgress({ percent: 10, message: 'Starting duplicate detection...' });
      const groups = await findDuplicateGroups(photoList, { mode, rootDirHandle, ignoredPairs }, (progress) => {
        setDuplicateScanProgress(progress);
      });
      setDuplicateGroups(groups);
    } catch (err) {
      console.warn('Duplicate check failed:', err);
    } finally {
      setIsScanningDuplicates(false);
      setDuplicateScanProgress(null);
    }
  };

  // Ignore / dismiss false duplicate pair permanently
  const handleIgnoreDuplicatePair = (photoA, photoB) => {
    const pairKey = getPairKey(photoA, photoB);
    setIgnoredPairs(prev => {
      const updated = new Set(prev);
      updated.add(pairKey);
      saveIgnoredDuplicatesToDB(updated);
      return updated;
    });

    setDuplicateGroups(prev => {
      return prev.map(grp => {
        if (grp.bestToKeep.id === photoA.id || grp.bestToKeep.id === photoB.id) {
          const remaining = grp.duplicateCandidates.filter(
            c => c.photo.id !== photoA.id && c.photo.id !== photoB.id
          );
          if (remaining.length === 0) return null;
          return { ...grp, duplicateCandidates: remaining };
        }
        return grp;
      }).filter(Boolean);
    });
  };

  // Move duplicates to _Duplicates_Review
  const handleMoveToReview = async (candidatesToMove, onProgress = null) => {
    if (!candidatesToMove || candidatesToMove.length === 0) return;
    await moveMultipleFilesToDuplicatesReview(rootDirHandle, candidatesToMove, onProgress);
    const movedIds = new Set(candidatesToMove.map(cand => cand.id));
    let updatedCatalog = [];
    setPhotos(prev => {
      updatedCatalog = prev.map(p => {
        if (movedIds.has(p.id)) {
          return {
            ...p,
            isMarkedDuplicate: true,
            relativePath: `_Duplicates_Review/${p.name}`
          };
        }
        return p;
      });
      return updatedCatalog;
    });
    if (updatedCatalog.length > 0) {
      checkDuplicates(updatedCatalog);
    }
    setShowDuplicateModal(false);
  };

  // Restore duplicates from _Duplicates_Review
  const handleRestoreFromReview = async (photoToRestore) => {
    await restoreFileFromDuplicatesReview(rootDirHandle, photoToRestore);
    setPhotos(prev => prev.map(p => {
      if (p.id === photoToRestore.id) {
        return { ...p, isMarkedDuplicate: false, relativePath: photoToRestore.name };
      }
      return p;
    }));
  };

  // Restore multiple photos from _Duplicates_Review back to main library
  const handleRestoreMultipleFromReview = async (photosToRestore, onProgress = null) => {
    if (!photosToRestore || photosToRestore.length === 0) return;
    await restoreMultipleFilesFromDuplicatesReview(rootDirHandle, photosToRestore, onProgress);
    const restoredIds = new Set(photosToRestore.map(p => p.id));
    setPhotos(prev => prev.map(p => {
      if (restoredIds.has(p.id)) {
        return { ...p, isMarkedDuplicate: false, relativePath: p.name };
      }
      return p;
    }));
  };

  // Permanently delete file(s) from Review folder on disk
  const handlePermanentlyDeleteReview = async (photoToDelete = null) => {
    if (photoToDelete) {
      if (window.confirm(`Permanently delete "${photoToDelete.name}" from disk? This cannot be undone.`)) {
        await permanentlyDeleteFromDuplicatesReview(rootDirHandle, photoToDelete);
        setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id));
      }
    } else {
      const reviewed = photos.filter(p => p.isMarkedDuplicate);
      if (reviewed.length === 0) return;
      if (window.confirm(`Permanently delete all ${reviewed.length} files in the Review folder from disk? This cannot be undone.`)) {
        await emptyDuplicatesReviewFolder(rootDirHandle, reviewed);
        setPhotos(prev => prev.filter(p => !p.isMarkedDuplicate));
      }
    }
  };

  // Ignore / keep photo so it is never flagged as junk in future scans
  const handleIgnoreJunk = (photo) => {
    if (!photo) return;
    setIgnoredJunkIds(prev => {
      const next = new Set(prev);
      next.add(photo.id);
      saveIgnoredJunkToDB(next);
      return next;
    });
  };

  // Move junk / unwanted photos to _Duplicates_Review folder
  const handleMoveJunkToReview = async (junkList, onProgress = null) => {
    if (!junkList || junkList.length === 0) return;
    await moveMultipleFilesToDuplicatesReview(rootDirHandle, junkList, onProgress);
    const movedIds = new Set(junkList.map(item => item.id));
    setPhotos(prev => prev.map(p => {
      if (movedIds.has(p.id)) {
        return {
          ...p,
          isMarkedDuplicate: true,
          relativePath: `_Duplicates_Review/${p.name}`
        };
      }
      return p;
    }));
  };

  // Update photo metadata
  const handleSaveMetadata = (photoId, updatedFields) => {
    setPhotos(prev => {
      const next = prev.map(p => {
        if (p.id === photoId) {
          const updated = {
            ...p,
            ...updatedFields,
            folderName: p.folderName || folderName
          };
          if (!updated.thumbnailUrl && (updated.objectUrl || updated.handle)) {
            createPhotoThumbnail(updated).then(thumb => {
              if (thumb) {
                setPhotos(current => current.map(item => item.id === photoId ? { ...item, thumbnailUrl: thumb } : item));
                setSavedCatalog(current => current.map(item => item.id === photoId ? { ...item, thumbnailUrl: thumb } : item));
              }
            });
          }
          return updated;
        }
        return p;
      });
      setSavedCatalog(next);
      return next;
    });

    setActiveMetadataPhoto(prev => {
      if (prev && prev.id === photoId) {
        return { ...prev, ...updatedFields };
      }
      return prev;
    });
  };

  // Bulk rename person across all photos, detected face tags, and albums
  const handleRenamePerson = async (oldName, newName, personId) => {
    if (!oldName || !newName) return false;
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) return false;

    // 1. Update peopleDirectory
    let updatedPeople = {};
    setPeopleDirectory(prev => {
      const copy = { ...prev };
      let targetKey = personId && copy[personId] ? personId : null;
      if (!targetKey) {
        targetKey = Object.keys(copy).find(
          k => copy[k].name && copy[k].name.trim().toLowerCase() === cleanOld.toLowerCase()
        );
      }

      if (targetKey && copy[targetKey]) {
        copy[targetKey] = {
          ...copy[targetKey],
          name: cleanNew
        };
      } else {
        const newKey = `person_${Date.now()}`;
        copy[newKey] = {
          id: newKey,
          name: cleanNew,
          relationship: '',
          branch: '',
          avatarUrl: null,
          embeddings: []
        };
      }
      updatedPeople = copy;
      return copy;
    });

    if (Object.keys(updatedPeople).length > 0) {
      await savePeopleDirectoryToDB(updatedPeople);
    }

    // Helper to rename a person in a photo object
    const renameInPhoto = (p) => {
      if (!p) return p;
      let changed = false;

      // Update people list
      let updatedPeopleList = p.people;
      if (Array.isArray(p.people) && p.people.length > 0) {
        const mapped = p.people.map(person => {
          if (person && person.trim().toLowerCase() === cleanOld.toLowerCase()) {
            changed = true;
            return cleanNew;
          }
          return person;
        });
        updatedPeopleList = Array.from(new Set(mapped));
      }

      // Update detected face assignments
      let updatedFaces = p.detectedFaces || p.faces;
      if (Array.isArray(updatedFaces) && updatedFaces.length > 0) {
        updatedFaces = updatedFaces.map(f => {
          let faceChanged = false;
          let newF = { ...f };
          if (f.name && f.name.trim().toLowerCase() === cleanOld.toLowerCase()) {
            newF.name = cleanNew;
            faceChanged = true;
          }
          if (f.assignedTo && f.assignedTo.trim().toLowerCase() === cleanOld.toLowerCase()) {
            newF.assignedTo = cleanNew;
            faceChanged = true;
          }
          if (faceChanged) changed = true;
          return newF;
        });
      }

      // Update manual tags
      let updatedTags = p.manualTags;
      if (Array.isArray(p.manualTags) && p.manualTags.length > 0) {
        const mappedTags = p.manualTags.map(tag => {
          if (tag && tag.trim().toLowerCase() === cleanOld.toLowerCase()) {
            changed = true;
            return cleanNew;
          }
          return tag;
        });
        updatedTags = Array.from(new Set(mappedTags));
      }

      // Update personRelationships map
      let updatedPR = p.personRelationships;
      if (p.personRelationships && typeof p.personRelationships === 'object') {
        const nextPR = { ...p.personRelationships };
        for (const [key, val] of Object.entries(nextPR)) {
          if (key.trim().toLowerCase() === cleanOld.toLowerCase()) {
            delete nextPR[key];
            nextPR[cleanNew] = val;
            changed = true;
          }
        }
        updatedPR = nextPR;
      }

      if (!changed) return p;

      return {
        ...p,
        people: updatedPeopleList,
        detectedFaces: updatedFaces,
        faces: updatedFaces,
        manualTags: updatedTags,
        personRelationships: updatedPR
      };
    };

    // 2. Update photos in active album
    let updatedActivePhotos = [];
    setPhotos(prev => {
      updatedActivePhotos = prev.map(renameInPhoto);
      saveActiveAlbumCacheToDB(updatedActivePhotos);
      return updatedActivePhotos;
    });

    // 3. Update saved catalog across all albums
    setSavedCatalog(prev => {
      const updatedCatalog = (prev || []).map(renameInPhoto);
      overwriteCatalogInDB(updatedCatalog);
      return updatedCatalog;
    });

    // 4. Update active metadata modal if currently open
    setActiveMetadataPhoto(prev => (prev ? renameInPhoto(prev) : prev));

    // 5. Update person filter if currently active
    setSelectedPersonFilter(prev => {
      if (prev && prev.trim().toLowerCase() === cleanOld.toLowerCase()) {
        return cleanNew;
      }
      return prev;
    });

    // 6. Save catalog to disk file if folder is connected
    if (rootDirHandle && updatedActivePhotos.length > 0) {
      try {
        await saveCatalogToFileSystem(rootDirHandle, updatedActivePhotos);
      } catch (err) {
        console.warn('Could not update catalog file on disk:', err);
      }
    }

    return true;
  };

  // Register face match
  const handleRegisterFaceMatch = (personName, relationship, branch, embedding) => {
    if (!personName) return;
    setPeopleDirectory(prev => {
      const existingKey = Object.keys(prev).find(
        k => prev[k].name.toLowerCase() === personName.toLowerCase()
      );
      if (existingKey) {
        const existing = prev[existingKey];
        return {
          ...prev,
          [existingKey]: {
            ...existing,
            relationship: relationship || existing.relationship,
            branch: branch || existing.branch,
            embeddings: embedding 
              ? [...(existing.embeddings || []), embedding].slice(-10) 
              : (existing.embeddings || [])
          }
        };
      } else {
        const newKey = `person_${Date.now()}`;
        return {
          ...prev,
          [newKey]: {
            id: newKey,
            name: personName,
            relationship: relationship || '',
            branch: branch || '',
            avatarUrl: null,
            embeddings: embedding ? [embedding] : []
          }
        };
      }
    });
  };

  // Save enhanced photo
  const handleSaveEnhancedPhoto = (photoId, enhancedDataUrl) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId) {
        return {
          ...p,
          enhanced: true,
          enhancedUrl: enhancedDataUrl
        };
      }
      return p;
    }));
  };

  // Background face detection handler
  const handleFacesDetected = useCallback((photoId, faces, cascadeVerified = true) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId) {
        return {
          ...p,
          faces: faces || [],
          facesScanned: true,
          facesCascadeVerified: cascadeVerified
        };
      }
      return p;
    }));
  }, []);

  // Probed photo dimensions handler
  const handleDimensionsDetected = useCallback((photoId, width, height) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId && (!p.width || !p.height)) {
        return { ...p, width, height };
      }
      return p;
    }));
  }, []);

  // Determine whether a photo is vintage/low-resolution and eligible for 4K restoration
  const isNeedsEnhancement = useCallback((photo) => {
    if (!photo || photo.enhanced || photo.enhancedUrl) return false;
    if (photo.width > 0 && photo.height > 0) {
      return photo.width < 800 || photo.height < 800;
    }
    if (photo.size && photo.size < 75 * 1024) {
      return true;
    }
    return false;
  }, []);

  // Export catalog
  const handleExportCatalog = async () => {
    if (rootDirHandle) {
      // 1. Save JSON catalog to folder
      const saved = await saveCatalogToFileSystem(rootDirHandle, photos);

      // 2. Batch-embed standard FamilySearch XMP metadata into each tagged photo on disk
      let embeddedCount = 0;
      const taggedPhotos = photos.filter(p => (p.people && p.people.length > 0) || p.story || p.date || p.location);
      for (const p of taggedPhotos) {
        if (p.handle) {
          try {
            const ok = await writeMetadataToPhotoHandle(p.handle, p);
            if (ok) embeddedCount++;
          } catch {}
        }
      }

      if (saved || embeddedCount > 0) {
        alert(`✓ Album Saved & Preserved!\n\n• Album catalog saved to your folder as .family_memories_catalog.json\n• Standard FamilySearch XMP metadata embedded directly into ${embeddedCount} photo files.\n\nYour photos can now be shared or uploaded to FamilySearch.org with all stories and names intact!`);
        return;
      }
    }
    // Fallback: Download as JSON
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(photos, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'Family_Album_Memories.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Navigation inside metadata modal
  const handleNavigateMetadata = (direction) => {
    if (!activeMetadataPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === activeMetadataPhoto.id);
    if (direction === 'prev' && currentIndex > 0) {
      setActiveMetadataPhoto(filteredPhotos[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < filteredPhotos.length - 1) {
      setActiveMetadataPhoto(filteredPhotos[currentIndex + 1]);
    }
  };

  // Extract unique subfolders
  const subfolders = useMemo(() => {
    const folderSet = new Set();
    photos.forEach(p => {
      if (p.relativePath && p.relativePath.includes('/')) {
        const parts = p.relativePath.split('/');
        parts.pop(); // remove file name
        const folder = parts.join('/');
        if (folder && folder !== '_Duplicates_Review') {
          folderSet.add(folder);
        }
      }
    });
    return Array.from(folderSet).sort();
  }, [photos]);

  // Filtered and sorted photos
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      // Exclude moved duplicates from main gallery unless specifically viewing Review Folder
      if (activeFilter === 'review_folder') {
        if (!photo.isMarkedDuplicate) return false;
      } else if (photo.isMarkedDuplicate && activeFilter !== 'duplicates') {
        return false;
      }

      // Filter by selected subfolder
      if (selectedSubfolder !== 'all') {
        if (!photo.relativePath || !photo.relativePath.startsWith(`${selectedSubfolder}/`)) {
          return false;
        }
      }

      // Filter Chips
      if (activeFilter === 'screenshots') {
        if (!isScreenshotPhoto(photo)) return false;
      } else if (activeFilter === 'untagged') {
        const isTagged = (photo.people && photo.people.length > 0) || photo.relationship || photo.story;
        if (isTagged) return false;
      } else if (activeFilter === 'needs_enhancement') {
        if (!isNeedsEnhancement(photo)) return false;
      } else if (activeFilter === 'with_people') {
        const hasPeople = (photo.people && photo.people.length > 0) || (photo.faces && photo.faces.length > 0);
        if (!hasPeople) return false;
      } else if (activeFilter === 'grandparents') {
        const hasGrandparent = (photo.relationship && photo.relationship.toLowerCase().includes('grand')) ||
          (photo.people && photo.people.some(p => p.toLowerCase().includes('grand')));
        if (!hasGrandparent) return false;
      } else if (activeFilter === 'group') {
        if (!photo.people || photo.people.length < 2) return false;
      } else if (['1950s', '1960s', '1970s', '1980s', '1990s'].includes(activeFilter)) {
        if (!photo.decade || !photo.decade.includes(activeFilter)) return false;
      } else if (activeFilter !== 'all') {
        // Individual person filter
        if (!photo.people || !photo.people.includes(activeFilter)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = photo.name.toLowerCase().includes(q);
        const matchesPeople = photo.people && photo.people.some(p => p.toLowerCase().includes(q));
        const matchesRel = photo.relationship && photo.relationship.toLowerCase().includes(q);
        const matchesPersonRels = photo.personRelationships && Object.values(photo.personRelationships).some(r => r && r.toLowerCase().includes(q));
        const matchesDecade = photo.decade && photo.decade.toLowerCase().includes(q);
        const matchesStory = photo.story && photo.story.toLowerCase().includes(q);
        const matchesLocation = photo.location && photo.location.toLowerCase().includes(q);
        const matchesBranch = photo.familyBranch && photo.familyBranch.toLowerCase().includes(q);
        const matchesSubfolder = photo.relativePath && photo.relativePath.toLowerCase().includes(q);

        return matchesName || matchesPeople || matchesRel || matchesPersonRels || matchesDecade || matchesStory || matchesLocation || matchesBranch || matchesSubfolder;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_asc') {
        return (a.lastModified || 0) - (b.lastModified || 0);
      } else if (sortBy === 'date_desc') {
        return (b.lastModified || 0) - (a.lastModified || 0);
      } else if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'resolution_asc') {
        return (a.width * a.height) - (b.width * b.height);
      } else if (sortBy === 'resolution_desc') {
        return (b.width * b.height) - (a.width * a.height);
      }
      return 0;
    });
  }, [photos, activeFilter, searchQuery, sortBy, selectedSubfolder, isNeedsEnhancement]);

  // Memoized counters to prevent heavy recalculation on every render
  const untaggedCount = useMemo(() => {
    return photos.filter(p => !p.isMarkedDuplicate && (!p.people || p.people.length === 0) && !p.story).length;
  }, [photos]);

  const lowResCount = useMemo(() => {
    return photos.filter(p => !p.isMarkedDuplicate && isNeedsEnhancement(p)).length;
  }, [photos, isNeedsEnhancement]);

  const peopleDetectedCount = useMemo(() => {
    return photos.filter(p => !p.isMarkedDuplicate && ((p.people && p.people.length > 0) || (p.faces && p.faces.length > 0))).length;
  }, [photos]);

  const duplicateCandidatesCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + g.duplicateCandidates.length, 0);
  }, [duplicateGroups]);

  const reviewedDuplicates = useMemo(() => {
    return photos.filter(p => p.isMarkedDuplicate);
  }, [photos]);

  const screenshotCount = useMemo(() => {
    return photos.filter(p => !p.isMarkedDuplicate && isScreenshotPhoto(p)).length;
  }, [photos]);

  const junkCandidates = useMemo(() => {
    return scanPhotoLibraryForJunk(photos, { ignoredJunkIds });
  }, [photos, ignoredJunkIds]);

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header
        folderName={folderName}
        onPickFolder={handlePickFolder}
        onOpenCloudModal={() => setShowCloudModal(true)}
        onOpenHelpGuide={() => setShowHelpGuideModal(true)}
        onOpenDuplicates={() => {
          setDuplicateModalInitialTab('found');
          setShowDuplicateModal(true);
        }}
        duplicateCount={duplicateCandidatesCount}
        onOpenJunkCleaner={() => setShowJunkModal(true)}
        junkCount={junkCandidates.length}
        onOpenReviewFolder={() => {
          setDuplicateModalInitialTab('reviewed');
          setShowDuplicateModal(true);
        }}
        reviewCount={reviewedDuplicates.length}
        onOpenRestoration={() => setActiveFilter('needs_enhancement')}
        lowResCount={lowResCount}
        onOpenPeople={() => setShowPeopleModal(true)}
        peopleCount={Object.keys(peopleDirectory).length}
        onOpenSettings={() => setShowSettingsModal(true)}
        onToggleHelp={() => setShowHelp(!showHelp)}
        showHelp={showHelp}
        onExportCatalog={handleExportCatalog}
        onClearAlbum={handleClearAlbum}
        photoCount={photos.length}
      />

      <main className="app-main-content">
        {/* Senior-friendly Guided Tour */}
        {showHelp && (
          <GuidedTour
            onClose={() => setShowHelp(false)}
            onOpenFullGuide={() => setShowHelpGuideModal(true)}
            hasPhotos={photos.length > 0}
          />
        )}

        {/* Hero picker when empty */}
        {photos.length === 0 ? (
          <FolderPickerHero
            onPickFolder={handlePickFolder}
            onOpenCloudModal={() => setShowCloudModal(true)}
            onOpenHelpGuide={() => setShowHelpGuideModal(true)}
            pendingResumeSession={pendingResumeSession}
            onResumeAlbum={handleResumePreviousAlbum}
            onDismissResume={handleDismissResume}
            onFilesSelected={handleFallbackFilesSelected}
            isScanning={isScanning}
            scanProgress={scanProgress}
          />
        ) : (
          <div className="album-content-container">
            {/* Reconnect Folder Banner when photos are loaded from cache and folder handle needs user activation */}
            {pendingResumeSession && !rootDirHandle && (
              <div 
                className="reconnect-folder-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  border: '1.5px solid rgba(37, 99, 235, 0.35)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 18px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FolderCheck size={22} className="text-primary" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      Album "{folderName || pendingResumeSession.info?.folderName}" Loaded ({photos.length} photos)
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      All photos and family memories are preserved on screen. Click <strong>"Reconnect Folder"</strong> to enable saving and enhancing directly to disk.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResumePreviousAlbum}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FolderCheck size={15} />
                  <span>📁 Reconnect Folder Access</span>
                </button>
              </div>
            )}

            {/* Search and Filters */}
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              totalPhotos={photos.filter(p => !p.isMarkedDuplicate).length}
              untaggedCount={untaggedCount}
              lowResCount={lowResCount}
              screenshotCount={screenshotCount}
              reviewCount={reviewedDuplicates.length}
              peopleDetectedCount={peopleDetectedCount}
              subfolders={subfolders}
              selectedSubfolder={selectedSubfolder}
              onSubfolderChange={setSelectedSubfolder}
            />

            {/* Active 4K Restoration Hub Banner */}
            {activeFilter === 'needs_enhancement' && (
              <div 
                className="restoration-hub-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(194, 65, 12, 0.08)',
                  border: '1px solid rgba(194, 65, 12, 0.28)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={22} className="text-accent" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
                      ✨ 4K Photo Restoration & Enhancement Hub ({filteredPhotos.length} photos)
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      These vintage photos and thumbnails can be restored to high quality. Click <strong>"Make 4K"</strong> on any photo below to remove noise, sharpen faces, and upscale to 1080p / 4K.
                    </p>
                  </div>
                </div>
                {filteredPhotos.length > 0 && (
                  <button 
                    onClick={() => setActiveEnhancePhoto(filteredPhotos[0])}
                    className="btn btn-primary btn-sm"
                    title="Open the 4K enhancer for the first photo in this list"
                  >
                    <Sparkles size={15} />
                    <span>Start 4K Enhancer</span>
                  </button>
                )}
              </div>
            )}

            {/* Active Review Folder Banner */}
            {activeFilter === 'review_folder' && (
              <div 
                className="review-folder-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(217, 119, 6, 0.12)',
                  border: '1px solid rgba(217, 119, 6, 0.35)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 20px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FolderCheck size={24} className="text-warning" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
                      Viewing Review Folder ({filteredPhotos.length} photos)
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-subtle)' }}>
                      These photos are safely isolated in <code>_Duplicates_Review</code> and hidden from your main album.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {filteredPhotos.length > 0 && (
                    <button 
                      onClick={() => handleRestoreMultipleFromReview(filteredPhotos)}
                      className="btn btn-primary btn-sm"
                      title="Restore all displayed review photos back into your library"
                    >
                      <Undo2 size={15} />
                      <span>Restore All to Library</span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setDuplicateModalInitialTab('reviewed');
                      setShowDuplicateModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Open Review Manager
                  </button>
                </div>
              </div>
            )}

            {/* Gallery Grid */}
            <PhotoGrid
              photos={filteredPhotos}
              onOpenMetadata={(photo) => setActiveMetadataPhoto(photo)}
              onOpenEnhancer={(photo) => setActiveEnhancePhoto(photo)}
              onRestorePhoto={handleRestoreFromReview}
              onFacesDetected={handleFacesDetected}
              onDimensionsDetected={handleDimensionsDetected}
              onResetFilters={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
            />
          </div>
        )}
      </main>

      {/* Family History Metadata Modal */}
      {activeMetadataPhoto && (
        <MetadataModal
          photo={activeMetadataPhoto}
          onClose={() => setActiveMetadataPhoto(null)}
          onSave={handleSaveMetadata}
          onNavigate={handleNavigateMetadata}
          hasPrevious={filteredPhotos.findIndex(p => p.id === activeMetadataPhoto.id) > 0}
          hasNext={filteredPhotos.findIndex(p => p.id === activeMetadataPhoto.id) < filteredPhotos.length - 1}
          peopleDirectory={peopleDirectory}
          onRegisterFaceMatch={handleRegisterFaceMatch}
          onMoveToReview={handleMoveToReview}
          onOpenEnhancer={(photo) => {
            setActiveMetadataPhoto(null);
            setActiveEnhancePhoto(photo);
          }}
          onOpenEditor={(photo) => {
            setActiveMetadataPhoto(null);
            setActiveEditorPhoto(photo);
          }}
        />
      )}

      {/* Duplicate Manager Modal */}
      {showDuplicateModal && (
        <DuplicateManagerModal
          duplicateGroups={duplicateGroups}
          reviewedDuplicates={reviewedDuplicates}
          initialTab={duplicateModalInitialTab}
          onClose={() => setShowDuplicateModal(false)}
          onMoveToReview={handleMoveToReview}
          onRestoreFromReview={handleRestoreFromReview}
          onRestoreMultipleFromReview={handleRestoreMultipleFromReview}
          onRunScan={(mode) => checkDuplicates(photos, mode)}
          isScanningDuplicates={isScanningDuplicates}
          scanProgress={duplicateScanProgress}
          rootDirHandle={rootDirHandle}
          onPickFolder={handlePickFolder}
          onIgnorePair={handleIgnoreDuplicatePair}
          onPermanentDelete={handlePermanentlyDeleteReview}
        />
      )}

      {/* Smart Junk & Screenshot Cleaner Modal */}
      {showJunkModal && (
        <JunkCleanerModal
          candidates={junkCandidates}
          onClose={() => setShowJunkModal(false)}
          onMoveToReview={handleMoveJunkToReview}
          onIgnoreJunk={handleIgnoreJunk}
          rootDirHandle={rootDirHandle}
        />
      )}

      {/* 4K Photo Enhancer & Restorer Modal */}
      {activeEnhancePhoto && (
        <PhotoEnhancerModal
          photo={activeEnhancePhoto}
          onClose={() => setActiveEnhancePhoto(null)}
          onSaveEnhanced={handleSaveEnhancedPhoto}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenEditor={(photo) => {
            setActiveEnhancePhoto(null);
            setActiveEditorPhoto(photo);
          }}
        />
      )}

      {/* Crop & Magic Eraser Studio Modal */}
      {activeEditorPhoto && (
        <PhotoEditorModal
          photo={activeEditorPhoto}
          onClose={() => setActiveEditorPhoto(null)}
          onSave={handleSaveEnhancedPhoto}
        />
      )}

      {/* People Directory & Family Relations Modal */}
      {showPeopleModal && (
        <PeopleDirectoryModal
          peopleDirectory={peopleDirectory}
          photos={photos}
          savedCatalog={savedCatalog}
          pendingResumeSession={pendingResumeSession}
          currentFolderName={folderName || pendingResumeSession?.info?.folderName || ''}
          savedFolderHandles={savedFolderHandles}
          onResumeAlbum={handleResumePreviousAlbum}
          onOpenFolderByName={handleOpenFolderByName}
          onClose={() => setShowPeopleModal(false)}
          onSelectPersonFilter={handleSelectPersonFromDirectory}
          onRenamePerson={handleRenamePerson}
        />
      )}

      {/* App Settings & AI Providers Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Cloud Storage & Non-Synced Photos Modal */}
      <CloudStorageModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        onImportPhotos={handleImportCloudPhotos}
      />

      {/* Complete Help Center & User Guide Modal */}
      {showHelpGuideModal && (
        <HelpGuideModal
          isOpen={showHelpGuideModal}
          onClose={() => setShowHelpGuideModal(false)}
        />
      )}
    </div>
  );
}

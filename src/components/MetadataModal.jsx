import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Users, 
  Heart, 
  Calendar, 
  MapPin, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Sparkles, 
  UserPlus,
  Trash2,
  UserX,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  ShieldCheck,
  Copy,
  Crop,
  Eraser,
  CloudUpload
} from 'lucide-react';
import FamilySearchModal from './FamilySearchModal';
import { detectFacesInImage, extractFaceEmbedding, findMatchingPerson } from '../lib/faceEngine';
import { removeRedEyesFromImage } from '../lib/redEyeRemover';
import { 
  writeMetadataToPhotoHandle, 
  downloadPhotoWithEmbeddedMetadata,
  formatFamilySearchSummary 
} from '../lib/photoMetadata';
import { 
  savePhotoDraft, 
  loadPhotoDraft, 
  clearPhotoDraft 
} from '../lib/db';

const COMMON_RELATIONSHIPS = [
  'Self / Me',
  'Spouse / Partner (Husband / Wife)',
  'Immediate Family / Household',
  'Daughter',
  'Son',
  'Granddaughter',
  'Grandson',
  'Great-Granddaughter',
  'Great-Grandson',
  'Great-Grandchild',
  '2nd Great-Grandchild',
  '3rd Great-Grandchild',
  'Mother',
  'Father',
  'Sister',
  'Brother',
  'Grandmother',
  'Grandfather',
  'Great-Grandmother',
  'Great-Grandfather',
  '2nd Great-Grandmother',
  '2nd Great-Grandfather',
  '3rd Great-Grandmother',
  '3rd Great-Grandfather',
  '4th Great-Grandmother',
  '4th Great-Grandfather',
  '5th Great-Grandmother',
  '5th Great-Grandfather',
  '6th Great-Grandmother',
  '6th Great-Grandfather',
  '7th Great-Grandmother',
  '7th Great-Grandfather',
  '8th+ Great-Grandparent / Direct Ancestor',
  'Aunt',
  'Uncle',
  'Great-Aunt',
  'Great-Uncle',
  '2nd Great-Aunt / Uncle',
  'Niece / Nephew',
  'Cousin',
  'Son-in-Law / Daughter-in-Law',
  'In-Law (Brother / Sister)',
  'In-Law (Parent)',
  'Close Family Friend',
  'Neighbor',
  'Colleague / Classmate',
  'Non-Relative / Guest',
  'Unknown / Unidentified Person',
  'Pet'
];

const DECADES = [
  '1930s or earlier',
  '1940s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  'Recent'
];

export default function MetadataModal({
  photo,
  onClose,
  onSave,
  onNavigate,
  hasPrevious,
  hasNext,
  peopleDirectory,
  onRegisterFaceMatch,
  onMoveToReview,
  onOpenEnhancer,
  onOpenEditor
}) {
  const [people, setPeople] = useState(photo.people || []);
  const [currentNameInput, setCurrentNameInput] = useState('');
  const [relationship, setRelationship] = useState(photo.relationship || '');
  const [decade, setDecade] = useState(photo.decade || '');
  const [date, setDate] = useState(photo.date || '');
  const [story, setStory] = useState(photo.story || '');
  const [location, setLocation] = useState(photo.location || '');
  const [familyBranch, setFamilyBranch] = useState(photo.familyBranch || '');
  
  const [personRelationships, setPersonRelationships] = useState(photo.personRelationships || {});
  
  // Face detection & Red-Eye states
  const [showFamilySearchModal, setShowFamilySearchModal] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState(photo.faces || []);
  const [isScanningFaces, setIsScanningFaces] = useState(false);
  const [faceSuggestion, setFaceSuggestion] = useState(null);
  const [isFixingRedEyes, setIsFixingRedEyes] = useState(false);
  const [redEyeMessage, setRedEyeMessage] = useState('');
  const imgRef = useRef(null);

  // 📷 Resilient image source state with automatic file-handle recovery
  const [photoSrc, setPhotoSrc] = useState(photo.enhancedUrl || photo.objectUrl || null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    if (photo.enhancedUrl) {
      setPhotoSrc(photo.enhancedUrl);
      setImageLoadFailed(false);
      return;
    }

    if (photo.objectUrl && !photo.objectUrl.startsWith('blob:null')) {
      setPhotoSrc(photo.objectUrl);
      setImageLoadFailed(false);
      return;
    }

    // Lazy/Fresh load from file handle if objectUrl is null, revoked, or lost
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      photo.handle.getFile().then((file) => {
        if (active && file) {
          const freshUrl = URL.createObjectURL(file);
          photo.objectUrl = freshUrl;
          setPhotoSrc(freshUrl);
          setImageLoadFailed(false);
        }
      }).catch((err) => {
        console.warn('MetadataModal: Failed to read file from handle:', err);
        if (active) setImageLoadFailed(true);
      });
    } else {
      setImageLoadFailed(true);
    }

    return () => {
      active = false;
    };
  }, [photo.id, photo.enhancedUrl, photo.objectUrl, photo.handle]);

  // Automatic recovery if image fails to load or blob URL was revoked by browser
  const handleImageError = async () => {
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        if (file) {
          const freshUrl = URL.createObjectURL(file);
          photo.objectUrl = freshUrl;
          setPhotoSrc(freshUrl);
          setImageLoadFailed(false);
          return;
        }
      } catch (err) {
        console.warn('MetadataModal: handleImageError recovery failed:', err);
      }
    }
    setImageLoadFailed(true);
  };

  // Auto-Save and Draft states
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'saving' | 'saved' | ''
  const [draftNotice, setDraftNotice] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isInitialSyncRef = useRef(true);

  // Sync state when photo changes (e.g. Next/Prev button or initial mount)
  useEffect(() => {
    isInitialSyncRef.current = true;
    setAutoSaveStatus('');

    // Check if an in-progress draft exists for this photo
    const draft = loadPhotoDraft(photo.id || photo.name);
    if (draft && (draft.story || draft.people?.length || draft.date || draft.location)) {
      setPeople(draft.people || []);
      setCurrentNameInput('');
      setRelationship(draft.relationship || '');
      setDecade(draft.decade || '');
      setDate(draft.date || '');
      setStory(draft.story || '');
      setLocation(draft.location || '');
      setFamilyBranch(draft.familyBranch || '');
      setPersonRelationships(draft.personRelationships || {});
      const draftBaseFaces = draft.faces || photo.faces || [];
      const draftPeople = draft.people || photo.people || [];
      const syncedDraftFaces = draftBaseFaces.map(f => {
        if (!f.name && draftPeople.length === 1 && draftBaseFaces.length === 1) {
          return { ...f, name: draftPeople[0] };
        }
        return f;
      });
      setDetectedFaces(syncedDraftFaces);
      setDraftNotice('Restored your in-progress notes from where you left off.');
      setHasUnsavedChanges(true);
    } else {
      const currentPeople = photo.people || [];
      setPeople(currentPeople);
      setCurrentNameInput('');
      setRelationship(photo.relationship || '');
      setDecade(photo.decade || '');
      setDate(photo.date || '');
      setStory(photo.story || '');
      setLocation(photo.location || '');
      setFamilyBranch(photo.familyBranch || '');
      const baseFaces = photo.faces || [];
      const syncedFaces = baseFaces.map(f => {
        if (!f.name && currentPeople.length === 1 && baseFaces.length === 1) {
          return { ...f, name: currentPeople[0] };
        }
        return f;
      });
      setDetectedFaces(syncedFaces);
      setDraftNotice('');
      setHasUnsavedChanges(false);

      // Initialize person-specific relationships from directory
      const initialRels = { ...(photo.personRelationships || {}) };
      if (peopleDirectory) {
        (photo.people || []).forEach(name => {
          if (!initialRels[name]) {
            const person = Object.values(peopleDirectory).find(p => p.name.toLowerCase() === name.toLowerCase());
            if (person && person.relationship) {
              initialRels[name] = person.relationship;
            }
          }
        });
      }
      setPersonRelationships(initialRels);
    }

    setFaceSuggestion(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, [photo, peopleDirectory]);

  // Continuous Auto-Save: debounced write to draft and parent state whenever user types
  useEffect(() => {
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false;
      return;
    }

    setHasUnsavedChanges(true);
    setAutoSaveStatus('saving');

    const finalizedFaces = detectedFaces.map(face => {
      if (!face.name && people.length === 1 && detectedFaces.length === 1) {
        return { ...face, name: people[0] };
      }
      return face;
    });

    const draftData = {
      title: photo.name,
      people,
      relationship,
      personRelationships,
      decade,
      date,
      story,
      location,
      familyBranch,
      faces: finalizedFaces,
      facesCascadeVerified: true
    };

    // Save instant local draft in case of refresh or accidental navigation
    savePhotoDraft(photo.id || photo.name, draftData);

    // Debounce save to parent photo catalog (1000ms)
    const timer = setTimeout(() => {
      onSave(photo.id, draftData);
      setAutoSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timer);
  }, [people, relationship, personRelationships, decade, date, story, location, familyBranch, detectedFaces]);

  // 🔍 Senior Magnification & Fullscreen View States
  const [isMaximized, setIsMaximized] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });

  const handleZoomIn = () => {
    setZoomScale(s => Math.min(4, +(s + 0.5).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoomScale(s => {
      const next = Math.max(1, +(s - 0.5).toFixed(1));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoomTo = (level) => {
    setZoomScale(level);
    if (level === 1) setPanOffset({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomScale(current => {
      const next = Math.min(4, Math.max(1, +(current + delta).toFixed(2)));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handlePointerDown = (e) => {
    if (zoomScale <= 1) return;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (!isPanning || zoomScale <= 1) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    setPanOffset({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  // Run strict face scan when image loads & preserve all user-assigned names
  const handleImageLoad = async () => {
    if (!imgRef.current) return;
    
    // If user already marked this photo as having no people, honor that
    if (photo.noPeople) {
      setDetectedFaces([]);
      return;
    }

    // 1. If photo already has faces from storage, PRESERVE THEM!
    // Do not run detection from scratch and blow away user assignments!
    if (photo.faces && photo.faces.length > 0) {
      const existing = photo.faces.map(f => {
        if (!f.name && people.length === 1 && photo.faces.length === 1) {
          return { ...f, name: people[0] };
        }
        return f;
      });
      setDetectedFaces(existing);
      return;
    }

    setIsScanningFaces(true);
    try {
      const faces = await detectFacesInImage(imgRef.current);
      
      // Merge with previous face names to preserve user assignments
      const mergedFaces = (faces || []).map((newFace) => {
        if ((faces || []).length === 1 && people.length === 1) {
          return { ...newFace, name: people[0] };
        }
        const prevMatch = (photo.faces || []).find(pf => {
          if (!pf.box) return false;
          const dx = Math.abs(pf.box.x - newFace.box.x);
          const dy = Math.abs(pf.box.y - newFace.box.y);
          return dx < 0.20 && dy < 0.20;
        });
        if (prevMatch && prevMatch.name) {
          return { ...newFace, name: prevMatch.name };
        }
        return newFace;
      });

      setDetectedFaces(mergedFaces);
      onSave(photo.id, { faces: mergedFaces, facesCascadeVerified: true });

      // ONLY suggest a face if there are UNTAGGED, UNNAMED faces in the photo!
      // If people.length >= mergedFaces.length, every face in the photo is already accounted for!
      if (mergedFaces.length > 0 && people.length < mergedFaces.length) {
        for (const face of mergedFaces) {
          if (face.name) continue; // Skip already assigned face
          const emb = extractFaceEmbedding(imgRef.current, face.box);
          face.embedding = emb;
          if (emb && peopleDirectory) {
            const match = findMatchingPerson(emb, peopleDirectory);
            if (match && !people.includes(match.name)) {
              setFaceSuggestion({
                face,
                match
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Face scan failed:', err);
    } finally {
      setIsScanningFaces(false);
    }
  };

  const handleMarkNoPeople = () => {
    setDetectedFaces([]);
    setPeople([]);
    onSave(photo.id, { people: [], faces: [], noPeople: true, facesCascadeVerified: true });
  };

  const handleClearAllFaces = () => {
    setDetectedFaces([]);
    onSave(photo.id, { faces: [], facesCascadeVerified: true });
  };

  const handleRescanFaces = async () => {
    if (!imgRef.current) return;
    setIsScanningFaces(true);
    try {
      const faces = await detectFacesInImage(imgRef.current);
      setDetectedFaces(faces || []);
      onSave(photo.id, { faces: faces || [], facesCascadeVerified: true });
    } catch (err) {
      console.warn('Re-scan failed:', err);
    } finally {
      setIsScanningFaces(false);
    }
  };

  const handleQuickRedEyeFix = async () => {
    const currentSrc = photoSrc || photo.enhancedUrl || photo.objectUrl;
    if (!currentSrc) return;

    setIsFixingRedEyes(true);
    setRedEyeMessage('');
    try {
      const result = await removeRedEyesFromImage(currentSrc, {
        faceBoxes: detectedFaces.length > 0 ? detectedFaces : (photo.faces || []),
        autoDetect: true
      });

      if (result.fixedCount > 0) {
        setPhotoSrc(result.dataUrl);
        onSave(photo.id, {
          enhancedUrl: result.dataUrl,
          enhanced: true
        });
        setRedEyeMessage(`✓ Successfully removed red eyes from ${result.fixedCount} eye${result.fixedCount === 1 ? '' : 's'}!`);
        setTimeout(() => setRedEyeMessage(''), 7000);
      } else {
        setRedEyeMessage('No high-intensity red eyes found automatically. Click "Re-Enhance / Add Pass" above to use the manual Click-to-Fix eye tool!');
        setTimeout(() => setRedEyeMessage(''), 7000);
      }
    } catch (err) {
      console.warn('Red eye fix failed:', err);
      setRedEyeMessage('Could not process red eye removal.');
      setTimeout(() => setRedEyeMessage(''), 5000);
    } finally {
      setIsFixingRedEyes(false);
    }
  };

  const handleRevertOriginal = () => {
    if (!photo.enhancedUrl) return;
    const confirmRevert = window.confirm('Revert this photo back to the untouched original version?');
    if (confirmRevert) {
      onSave(photo.id, {
        enhancedUrl: null,
        enhanced: false
      });
      setRedEyeMessage('Reverted photo back to untouched original.');
      setTimeout(() => setRedEyeMessage(''), 5000);
    }
  };

  const handleRemoveFaceBox = (idxToRemove) => {
    const updated = detectedFaces.filter((_, idx) => idx !== idxToRemove);
    setDetectedFaces(updated);
    onSave(photo.id, { faces: updated, facesCascadeVerified: true });
  };

  const handleAddPerson = (nameToAdd) => {
    const trimmed = (nameToAdd || currentNameInput).trim();
    if (trimmed && !people.includes(trimmed)) {
      const updated = [...people, trimmed];
      setPeople(updated);
      setCurrentNameInput('');

      // Auto-assign to face if there is only 1 face box and it is not assigned yet
      setDetectedFaces(prev => {
        if (prev.length === 1 && !prev[0].name) {
          return [{ ...prev[0], name: trimmed }];
        }
        return prev;
      });

      // Look up known relationship from directory
      if (peopleDirectory) {
        const existing = Object.values(peopleDirectory).find(p => p.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (existing.relationship) {
            setPersonRelationships(prev => ({ ...prev, [trimmed]: existing.relationship }));
          }
          if (existing.branch && !familyBranch) {
            setFamilyBranch(existing.branch);
          }
        }
      }
    }
  };

  const handleSetPersonRelationship = (name, rel) => {
    setPersonRelationships(prev => ({
      ...prev,
      [name]: rel
    }));
  };

  const handleAssignFaceName = (indexToUpdate, name) => {
    setDetectedFaces(prev => prev.map((f, idx) => {
      if (idx === indexToUpdate) {
        return { ...f, name: name || undefined };
      }
      return f;
    }));
    if (name && !people.includes(name)) {
      setPeople(prev => [...prev, name]);
      if (peopleDirectory) {
        const existing = Object.values(peopleDirectory).find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (existing.relationship) {
            setPersonRelationships(prev => ({ ...prev, [name]: existing.relationship }));
          }
          if (existing.branch && !familyBranch) {
            setFamilyBranch(existing.branch);
          }
        }
      }
    }
    setFaceSuggestion(null);
  };

  const handleRemovePerson = (idxToRemove) => {
    const removedName = people[idxToRemove];
    setPeople(people.filter((_, idx) => idx !== idxToRemove));
    if (removedName) {
      setDetectedFaces(prev => prev.map(f => f.name === removedName ? { ...f, name: undefined } : f));
    }
  };

  const handleAcceptSuggestion = () => {
    if (faceSuggestion && faceSuggestion.match) {
      const suggestedName = faceSuggestion.match.name;
      handleAddPerson(suggestedName);
      if (faceSuggestion.face) {
        setDetectedFaces(prev => prev.map(f => {
          if (f === faceSuggestion.face || (f.box && faceSuggestion.face.box && f.box.x === faceSuggestion.face.box.x && f.box.y === faceSuggestion.face.box.y)) {
            return { ...f, name: suggestedName };
          }
          return f;
        }));
      }
      if (faceSuggestion.match.relationship) {
        handleSetPersonRelationship(suggestedName, faceSuggestion.match.relationship);
      }
      setFaceSuggestion(null);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyFamilySearch = async () => {
    const text = formatFamilySearchSummary(photo, {
      story,
      people,
      date,
      decade,
      location,
      familyBranch
    });
    if (!text) {
      alert('Enter some memories or family details first before copying.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      // Safe, invisible clipboard fallback that doesn't scroll viewport or disrupt layout
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.padding = '0';
      ta.style.border = 'none';
      ta.style.outline = 'none';
      ta.style.boxShadow = 'none';
      ta.style.background = 'transparent';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch (copyErr) {
        console.warn('execCommand copy fallback failed:', copyErr);
      }
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const handleDownloadEmbedded = async () => {
    setIsDownloading(true);
    try {
      await downloadPhotoWithEmbeddedMetadata(photo, {
        story,
        people,
        date,
        decade,
        location,
        familyBranch
      });
    } catch (err) {
      console.warn('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = () => {
    const finalizedFaces = detectedFaces.map(face => {
      if (!face.name && people.length === 1 && detectedFaces.length === 1) {
        return { ...face, name: people[0] };
      }
      return face;
    });

    const updatedMetadata = {
      title: photo.name,
      people,
      relationship,
      personRelationships,
      decade,
      date,
      story,
      location,
      familyBranch,
      faces: finalizedFaces,
      facesCascadeVerified: true
    };

    onSave(photo.id, updatedMetadata);

    // Automatically embed standard XMP/IPTC metadata into local JPEG on disk!
    if (photo.handle) {
      writeMetadataToPhotoHandle(photo.handle, updatedMetadata).then(ok => {
        if (ok) {
          console.log(`✓ Embedded FamilySearch metadata into ${photo.name}`);
        }
      }).catch(err => {
        console.warn('Could not write metadata into photo handle:', err);
      });
    }

    // 1. Register face embeddings specifically for the assigned person
    if (detectedFaces.length > 0 && onRegisterFaceMatch && imgRef.current) {
      detectedFaces.forEach((face, idx) => {
        const assignedName = face.name || (people.length === 1 && detectedFaces.length === 1 ? people[0] : null);
        if (assignedName) {
          const emb = face.embedding || extractFaceEmbedding(imgRef.current, face.box);
          if (emb) {
            const rel = personRelationships[assignedName] || relationship;
            onRegisterFaceMatch(assignedName, rel, familyBranch, emb);
          }
        }
      });
    }

    // 2. Also save each person's relationship into people directory
    if (onRegisterFaceMatch && people.length > 0) {
      people.forEach(name => {
        const rel = personRelationships[name];
        if (rel) {
          onRegisterFaceMatch(name, rel, familyBranch, null);
        }
      });
    }

    clearPhotoDraft(photo.id || photo.name);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have in-progress edits for this photo.\n\nYour notes are auto-saved as a draft so you can resume anytime.\n\nClick OK to close this window, or Cancel to keep editing.'
      );
      if (!confirmLeave) return;
    }
    onClose();
  };

  // Known family member list for quick click tags
  const knownPeople = peopleDirectory ? Object.values(peopleDirectory).map(p => p.name) : [];

  return (
    <div className="modal-backdrop">
      <div className={`metadata-modal-dialog ${isMaximized ? 'modal-dialog-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title">Family History & Memories</h3>
            <p className="modal-subtitle">{photo.name}</p>
          </div>

          <div className="modal-header-actions">
            {/* Big Screen / Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="btn-header-maximize"
              title={isMaximized ? "Return to standard size" : "Make window full-screen to see photo much bigger"}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isMaximized ? 'Standard Size' : 'Big Screen'}</span>
            </button>

            {onOpenEnhancer && (
              <button
                type="button"
                onClick={() => onOpenEnhancer(photo)}
                className="btn btn-warning-action btn-sm"
                title="Open 4K Photo Restorer to improve clarity and enhance faces"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
              >
                <Sparkles size={16} />
                <span>Fix Quality (4K)</span>
              </button>
            )}

            {/* Quick Next/Prev arrows */}
            <div className="nav-arrow-group">
              <button 
                onClick={() => onNavigate('prev')} 
                disabled={!hasPrevious} 
                className="btn-icon" 
                title="Previous Photo"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => onNavigate('next')} 
                disabled={!hasNext} 
                className="btn-icon" 
                title="Next Photo"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <button onClick={handleRequestClose} className="btn-icon-close" title="Close dialog">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Photo, Right Form */}
        <div className="metadata-modal-body">
          
          {/* Photo Display Column */}
          <div className="modal-photo-column">
            {/* Senior-Friendly Magnification Toolbar */}
            <div className="senior-zoom-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomIn size={13} />
                  <span>Magnify:</span>
                </span>
                <div className="senior-zoom-group">
                  <button 
                    type="button"
                    onClick={handleZoomOut}
                    className="senior-zoom-btn senior-zoom-btn-action"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={13} />
                    <span>-</span>
                  </button>

                  {[1, 1.5, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleZoomTo(level)}
                      className={`senior-zoom-btn ${zoomScale === level ? 'active' : ''}`}
                      title={`Magnify to ${Math.round(level * 100)}%`}
                    >
                      {level === 1 ? 'Fit (100%)' : `${Math.round(level * 100)}%`}
                    </button>
                  ))}

                  <button 
                    type="button"
                    onClick={handleZoomIn}
                    className="senior-zoom-btn senior-zoom-btn-action"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={13} />
                    <span>+</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {zoomScale > 1 && (
                  <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600' }}>
                    ✋ Click & drag photo to pan
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="senior-zoom-btn senior-zoom-btn-action"
                  style={{ backgroundColor: isMaximized ? '#2563eb' : 'rgba(255,255,255,0.12)' }}
                  title={isMaximized ? "Return to standard size" : "Expand photo window to full screen"}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isMaximized ? 'Standard Size' : 'Make Bigger ⛶'}</span>
                </button>
              </div>
            </div>

            <div 
              className="photo-display-container"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheelZoom}
              style={{ 
                cursor: zoomScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                touchAction: 'none' 
              }}
              title={zoomScale > 1 ? "Drag with mouse to pan around • Scroll wheel to zoom" : "Use Magnify buttons above to zoom in on faces"}
            >
              <div 
                className="modal-photo-viewport"
                style={{
                  transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
                  cursor: zoomScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
                }}
              >
                <img
                  ref={imgRef}
                  src={photoSrc || photo.enhancedUrl || photo.objectUrl}
                  alt={photo.name}
                  className="modal-photo-img"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  draggable={false}
                />

                {imageLoadFailed && !photoSrc && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#111827',
                    padding: '24px',
                    textAlign: 'center',
                    gap: '12px',
                    zIndex: 20
                  }}>
                    <p style={{ margin: 0, fontSize: '15px', color: '#f87171', fontWeight: '700' }}>
                      ⚠️ Photo preview lost connection
                    </p>
                    <button
                      type="button"
                      onClick={handleImageError}
                      className="btn btn-primary btn-sm"
                    >
                      Click to Reload Photo
                    </button>
                  </div>
                )}

              {/* Face Bounding Box Overlays */}
              {detectedFaces.map((f, idx) => (
                <div
                  key={f.id || `face-${idx}`}
                  className="face-bounding-box"
                  style={{
                    left: `${f.box.x * 100}%`,
                    top: `${f.box.y * 100}%`,
                    width: `${f.box.width * 100}%`,
                    height: `${f.box.height * 100}%`,
                    pointerEvents: 'none'
                  }}
                >
                  <div
                    className="face-box-tag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      pointerEvents: 'auto',
                      zIndex: 35 + idx
                    }}
                  >
                    {(() => {
                      const currentFaceName = f.name || (detectedFaces.length === 1 && people.length === 1 ? people[0] : '');
                      const otherFamily = knownPeople.filter(n => !people.includes(n));

                      return (
                        <select
                          value={currentFaceName || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleAssignFaceName(idx, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            background: '#1c1917',
                            color: '#ffffff',
                            border: currentFaceName ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.6)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            pointerEvents: 'auto'
                          }}
                          title={currentFaceName ? `Assigned to ${currentFaceName}` : "Click to assign which family member this face is"}
                        >
                          <option value="">
                            {currentFaceName ? '-- Clear Assignment --' : `Person ${idx + 1} (Click to Assign...)`}
                          </option>
                          {people.length > 0 && (
                            <optgroup label="People in this photo">
                              {people.map(name => (
                                <option key={name} value={name}>
                                  {name === currentFaceName ? `✓ ${name}` : name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {otherFamily.length > 0 && (
                            <optgroup label="All Family Members">
                              {otherFamily.map(name => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveFaceBox(idx);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Remove this false face box"
                      style={{
                        background: '#dc2626',
                        border: '1px solid #ef4444',
                        color: '#ffffff',
                        borderRadius: '3px',
                        width: '16px',
                        height: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        lineHeight: 1,
                        pointerEvents: 'auto'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* 4K Restoration Quick Action Card */}
            {onOpenEnhancer && (
              <div 
                className="photo-enhancer-cta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(194, 65, 12, 0.08)',
                  border: '1px solid rgba(194, 65, 12, 0.25)',
                  marginTop: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} className="text-accent" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                      {photo.enhancedUrl ? '✨ Restored to 4K Ultra HD' : '✨ Low Quality? Clean & Enhance to 4K'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                      {photo.enhancedUrl 
                        ? '4K restored (8.3MP). Click to fine-tune lighting, adjust eyes/shadows, or run additional passes!' 
                        : 'Upscale resolution, reduce noise, and sharpen facial details.'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onOpenEnhancer(photo)}
                    className="btn btn-warning btn-sm"
                    style={{ fontWeight: '700' }}
                    title="Open 4K Photo Restorer"
                  >
                    <Sparkles size={14} />
                    <span>{photo.enhancedUrl ? 'Re-Enhance / Add Pass' : 'Make 4K'}</span>
                  </button>
                  {onOpenEditor && (
                    <button
                      type="button"
                      onClick={() => onOpenEditor(photo)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Crop photo or erase scratches & unwanted objects"
                    >
                      <Crop size={14} />
                      <span>Crop & Erase</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Smart AI Face Recognition Prompt */}
            {faceSuggestion && (
              <div className="face-suggestion-card">
                <Sparkles size={18} className="suggestion-icon" />
                <div className="suggestion-text">
                  <p className="suggestion-title">
                    Face Scan match: Looks like <strong>{faceSuggestion.match.name}</strong> ({faceSuggestion.match.confidencePercent}% match)
                  </p>
                  <p className="suggestion-desc">
                    Recognized from previously tagged family photos!
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleAcceptSuggestion} className="btn btn-primary btn-sm">
                    <Check size={14} /> Yes, that's {faceSuggestion.match.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaceSuggestion(null)}
                    className="btn btn-secondary btn-sm"
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'var(--text-subtle)' }}
                    title="Not this person / Dismiss"
                  >
                    <X size={14} /> Not them
                  </button>
                </div>
              </div>
            )}

            {isScanningFaces && (
              <div className="face-scanning-pill">
                <Sparkles size={14} /> Scanning faces...
              </div>
            )}

            <div className="modal-photo-meta-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span>Original size: {photo.width} × {photo.height} px</span>
                {photo.lastModified && (
                  <span style={{ marginLeft: '10px' }}>File date: {new Date(photo.lastModified).toLocaleDateString()}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {detectedFaces.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllFaces}
                    className="btn btn-xs"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Remove all false face bounding boxes from this image"
                  >
                    <UserX size={12} />
                    <span>Clear All Face Boxes ({detectedFaces.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRescanFaces}
                  className="btn btn-xs"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    color: '#fef3c7',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Re-scan this photo using the trained AI face detector"
                  disabled={isScanningFaces}
                >
                  <Sparkles size={12} />
                  <span>{isScanningFaces ? 'Scanning...' : 'Re-scan Faces'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickRedEyeFix}
                  disabled={isFixingRedEyes}
                  className="btn btn-xs"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.2)',
                    color: '#fecaca',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Automatically detect and remove camera flash red eyes"
                >
                  <span style={{ fontSize: '11px' }}>🔴</span>
                  <span>{isFixingRedEyes ? 'Fixing Eyes...' : 'Remove Red Eyes'}</span>
                </button>
                {onOpenEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenEditor(photo)}
                    className="btn btn-xs"
                    style={{
                      backgroundColor: 'rgba(37, 99, 235, 0.18)',
                      color: '#bfdbfe',
                      border: '1px solid rgba(59, 130, 246, 0.45)',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Crop photo borders or erase dust, scratches, and unwanted objects"
                  >
                    <Crop size={12} />
                    <span>Crop & Erase</span>
                  </button>
                )}
                {photo.enhancedUrl && (
                  <button
                    type="button"
                    onClick={handleRevertOriginal}
                    className="btn btn-xs"
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--text-subtle)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer'
                    }}
                    title="Revert back to untouched original photo"
                  >
                    <span>Revert to Original</span>
                  </button>
                )}
              </div>
            </div>

            {/* Red Eye Quick Fix Notice */}
            {redEyeMessage && (
              <div style={{
                marginTop: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: redEyeMessage.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                border: redEyeMessage.startsWith('✓') ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(217, 119, 6, 0.4)',
                color: redEyeMessage.startsWith('✓') ? '#15803d' : '#b45309',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{redEyeMessage}</span>
                <button
                  type="button"
                  onClick={() => setRedEyeMessage('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Form Column */}
          <div className="modal-form-column">
            
            {draftNotice && (
              <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px', fontSize: '13px', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} />
                  <span>{draftNotice}</span>
                </div>
                <button type="button" onClick={() => setDraftNotice('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#15803d', fontWeight: 'bold' }}>✕</button>
              </div>
            )}

            {/* 1. Who is in this photo? */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <Users size={16} />
                  <span>Who is in this picture? (Names)</span>
                </label>
                <button
                  type="button"
                  onClick={handleMarkNoPeople}
                  className="btn btn-outline btn-xs"
                  title="Mark as scenery, document, or empty room with no people"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  <UserX size={12} />
                  <span>No People in This Photo</span>
                </button>
              </div>

              {/* Tagged people with individual relationship assignment */}
              {people.length > 0 && (
                <div className="tagged-people-container" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {people.map((p, idx) => (
                    <div 
                      key={idx} 
                      className="person-pill-editable"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(28, 25, 23, 0.04)',
                        border: '1px solid var(--border-light)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>👤 {p}</span>
                        <select
                          value={personRelationships[p] || ''}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              const val = window.prompt(`Enter custom relationship for ${p} (e.g. 5th Great-Grandmother, Godparent, Step-Sister):`, personRelationships[p] || '');
                              if (val && val.trim()) {
                                handleSetPersonRelationship(p, val.trim());
                              }
                            } else {
                              handleSetPersonRelationship(p, e.target.value);
                            }
                          }}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-main)',
                            backgroundColor: '#fff',
                            color: personRelationships[p] ? 'var(--accent)' : 'var(--text-muted)',
                            fontWeight: personRelationships[p] ? '700' : '500',
                            cursor: 'pointer'
                          }}
                          title={`Select ${p}'s relationship to you`}
                        >
                          <option value="">Role / Relationship to Me...</option>
                          {personRelationships[p] && !COMMON_RELATIONSHIPS.includes(personRelationships[p]) && (
                            <option value={personRelationships[p]}>{personRelationships[p]}</option>
                          )}
                          {COMMON_RELATIONSHIPS.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
                          <option value="__custom__">✏️ Enter Custom Relationship...</option>
                        </select>
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleRemovePerson(idx)} 
                        className="pill-remove-btn"
                        title={`Remove ${p}`}
                        style={{ fontSize: '14px', padding: '2px 6px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input for new name */}
              <div className="add-person-input-row">
                <input
                  type="text"
                  className="form-input"
                  value={currentNameInput}
                  onChange={(e) => setCurrentNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPerson();
                    }
                  }}
                  placeholder="Type a person's name (e.g. Uncle David, Grandma Rose)..."
                />
                <button 
                  type="button" 
                  onClick={() => handleAddPerson()} 
                  className="btn btn-secondary"
                >
                  <UserPlus size={16} /> Add
                </button>
              </div>

              {/* Quick family pills */}
              {knownPeople.length > 0 && (
                <div className="quick-family-pills">
                  <span className="quick-pills-label">Or click to add:</span>
                  {knownPeople.filter(n => !people.includes(n)).slice(0, 6).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAddPerson(name)}
                      className="quick-pill-btn"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Photo Group / Overall Category */}
            <div className="form-row-half">
              <div className="form-group">
                <label className="form-label">
                  <Heart size={16} />
                  <span>Photo Group / Overall Category</span>
                </label>
                <select
                  className="form-select"
                  value={relationship}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      const val = window.prompt('Enter custom photo group / category (e.g. 5-Generation Reunion, Cousins Trip, Church Choir):', relationship || '');
                      if (val && val.trim()) {
                        setRelationship(val.trim());
                      }
                    } else {
                      setRelationship(e.target.value);
                    }
                  }}
                >
                  <option value="">Select group category or leave blank...</option>
                  {relationship && !COMMON_RELATIONSHIPS.includes(relationship) && ![
                    'Immediate Family / Household',
                    'Spouse & Children',
                    'Parents & Children',
                    'Extended Family Gathering',
                    'Couple / Parents',
                    'Siblings / Children',
                    'Grandparents & Grandchildren',
                    'Great-Grandparents & Great-Grandchildren',
                    'Great-Grandchildren',
                    'Multi-Generational (3-4 Generations)',
                    'Multi-Generational (5+ Generations / Direct Ancestors)',
                    'Solo Portrait',
                    'Friends & Social'
                  ].includes(relationship) && (
                    <option value={relationship}>{relationship}</option>
                  )}
                  <option value="Immediate Family / Household">Immediate Family / Household</option>
                  <option value="Spouse & Children">Spouse & Children</option>
                  <option value="Parents & Children">Parents & Children</option>
                  <option value="Extended Family Gathering">Extended Family Gathering</option>
                  <option value="Couple / Parents">Couple / Parents</option>
                  <option value="Siblings / Children">Siblings / Children</option>
                  <option value="Grandparents & Grandchildren">Grandparents & Grandchildren</option>
                  <option value="Great-Grandparents & Great-Grandchildren">Great-Grandparents & Great-Grandchildren</option>
                  <option value="Great-Grandchildren">Great-Grandchildren</option>
                  <option value="Multi-Generational (3-4 Generations)">Multi-Generational (3-4 Generations)</option>
                  <option value="Multi-Generational (5+ Generations / Direct Ancestors)">Multi-Generational (5+ Generations / Direct Ancestors)</option>
                  <option value="Solo Portrait">Solo Portrait</option>
                  <option value="Friends & Social">Friends & Social</option>
                  {COMMON_RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                  <option value="__custom__">✏️ Enter Custom Category...</option>
                </select>
              </div>

              {/* Family Branch */}
              <div className="form-group">
                <label className="form-label">
                  <span>Family Branch / Side</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={familyBranch}
                  onChange={(e) => setFamilyBranch(e.target.value)}
                  placeholder="e.g. Viola Family, Mom's Side, Miller Family"
                />
              </div>
            </div>

            {/* 3. When was this? (Decade or Date) */}
            <div className="form-row-half">
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={16} />
                  <span>Estimated Decade</span>
                </label>
                <select
                  className="form-select"
                  value={decade}
                  onChange={(e) => setDecade(e.target.value)}
                >
                  <option value="">Choose decade...</option>
                  {DECADES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Specific Date / Year */}
              <div className="form-group">
                <label className="form-label">
                  <span>Exact Date / Year (if known)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="e.g. July 1974 or 1974-07-15"
                />
              </div>
            </div>

            {/* 4. Where was this? */}
            <div className="form-group">
              <label className="form-label">
                <MapPin size={16} />
                <span>Place or Occasion</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Grandma's Backyard, Wedding in Charleston, Lake George"
              />
            </div>

            {/* 5. Family Story & Memories */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <BookOpen size={16} />
                  <span>Family Story & Memories</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopyFamilySearch}
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', fontSize: '11px', color: isCopied ? '#16a34a' : 'inherit' }}
                  title="Copy formatted story, date, and people to your clipboard ready to paste into FamilySearch Memories Description box"
                >
                  {isCopied ? <Check size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
                  <span>{isCopied ? '✓ Copied for FamilySearch!' : '📋 Copy for FamilySearch'}</span>
                </button>
              </div>
              <textarea
                className="form-textarea"
                rows={3}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="What do you remember about this day? Any funny memories, who was visiting, or what was happening?"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#15803d', fontWeight: '500' }}>
                <ShieldCheck size={14} style={{ color: '#16a34a' }} />
                <span>Memories & people are automatically embedded directly into this JPEG file (FamilySearch & archive ready)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onMoveToReview && (
              <button 
                type="button" 
                onClick={() => {
                  if (window.confirm(`Move "${photo.name}" to the Review folder? You can restore it anytime.`)) {
                    onMoveToReview([photo]);
                    onClose();
                  }
                }} 
                className="btn btn-danger-outline btn-sm"
                title="Move this photo out of the album into the Review folder"
              >
                <Trash2 size={16} />
                <span>Move to Review</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyFamilySearch}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isCopied ? '#16a34a' : 'inherit' }}
              title="Copy formatted story and people list to clipboard ready to paste into FamilySearch Memories"
            >
              {isCopied ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
              <span>{isCopied ? '✓ Copied for FamilySearch!' : 'Copy for FamilySearch'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFamilySearchModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1d4ed8' }}
              title="Upload this photo to FamilySearch Memories and link it to family members"
            >
              <CloudUpload size={14} className="text-primary" />
              <span>Send to FamilySearch</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadEmbedded}
              disabled={isDownloading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Download a copy of this JPEG with all stories, dates, and people baked directly into the file for FamilySearch"
            >
              <Download size={14} />
              <span>{isDownloading ? 'Baking Metadata...' : 'Download File'}</span>
            </button>
          </div>

          <div className="flex items-center gap-10" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {autoSaveStatus === 'saved' && (
              <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Check size={14} />
                <span>Auto-saved</span>
              </span>
            )}
            {autoSaveStatus === 'saving' && (
              <span style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Saving draft...</span>
              </span>
            )}
            <button onClick={handleRequestClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary btn-save">
              <Check size={18} />
              <span>Save Memories & Close</span>
            </button>
          </div>
        </div>

      </div>

      {showFamilySearchModal && (
        <FamilySearchModal
          photo={photo}
          metadata={{
            people,
            relationship,
            personRelationships,
            decade,
            date,
            story,
            location,
            familyBranch,
            faces: detectedFaces
          }}
          isOpen={showFamilySearchModal}
          onClose={() => setShowFamilySearchModal(false)}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Undo2, 
  ShieldCheck, 
  FolderCheck,
  RefreshCw,
  HardDrive,
  ZoomIn,
  Eye,
  FolderOpen,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Flame,
  Image as ImageIcon
} from 'lucide-react';
import { getFileFromPath } from '../lib/fileSystem';

/**
 * Thumbnail component that dynamically resolves images from File handles,
 * disk paths, or object URLs, and enables full-resolution inspection.
 */
function DuplicatePhotoThumbnail({ photo, rootDirHandle, onZoom }) {
  const [src, setSrc] = useState(photo.enhancedUrl || photo.objectUrl || null);
  const [loading, setLoading] = useState(!src);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState(false);

  const resolveImage = useCallback(async (userTriggered = false) => {
    if (photo.enhancedUrl) {
      setSrc(photo.enhancedUrl);
      setLoading(false);
      return;
    }
    if (photo.objectUrl && !photo.objectUrl.startsWith('blob:null')) {
      setSrc(photo.objectUrl);
      setLoading(false);
      return;
    }

    if (photo.file) {
      try {
        const url = URL.createObjectURL(photo.file);
        photo.objectUrl = url;
        setSrc(url);
        setLoading(false);
        return;
      } catch {}
    }

    // Try File handle
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        if (userTriggered && typeof photo.handle.requestPermission === 'function') {
          const res = await photo.handle.requestPermission({ mode: 'read' });
          if (res !== 'granted') {
            setNeedsPermission(true);
            setLoading(false);
            return;
          }
        }
        const file = await photo.handle.getFile();
        const url = URL.createObjectURL(file);
        photo.objectUrl = url;
        setSrc(url);
        setLoading(false);
        setNeedsPermission(false);
        setError(false);
        return;
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setNeedsPermission(true);
          setLoading(false);
          return;
        }
      }
    }

    // Try root directory handle traversal
    if (rootDirHandle && photo.relativePath) {
      try {
        const file = await getFileFromPath(rootDirHandle, photo.relativePath);
        if (file) {
          const url = URL.createObjectURL(file);
          photo.objectUrl = url;
          setSrc(url);
          setLoading(false);
          setNeedsPermission(false);
          setError(false);
          return;
        }
      } catch {}
    }

    setLoading(false);
    setError(true);
  }, [photo, rootDirHandle]);

  useEffect(() => {
    resolveImage(false);
  }, [resolveImage]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (needsPermission) {
      resolveImage(true);
    } else if (onZoom) {
      onZoom(photo, src);
    }
  };

  return (
    <div className="duplicate-thumb-container" onClick={handleClick}>
      {src && !error ? (
        <>
          <img 
            src={src} 
            alt={photo.name} 
            className="comparison-img" 
            loading="lazy"
            onError={() => setError(true)}
          />
          <div className="thumb-zoom-overlay">
            <ZoomIn size={18} />
            <span>Click to Enlarge & Compare</span>
          </div>
        </>
      ) : needsPermission ? (
        <div className="thumb-action-fallback" title="Click to grant permission to display photo">
          <FolderOpen size={26} className="text-warning" />
          <span className="thumb-action-title">Permission Needed</span>
          <button 
            type="button" 
            className="btn btn-sm btn-secondary mt-6" 
            onClick={(e) => { e.stopPropagation(); resolveImage(true); }}
          >
            Click to View Photo
          </button>
        </div>
      ) : loading ? (
        <div className="thumb-loading-placeholder">
          <RefreshCw size={20} className="spin-icon text-muted" />
          <span>Loading preview...</span>
        </div>
      ) : (
        <div className="thumb-fallback-placeholder">
          <ImageIcon size={30} className="text-muted" />
          <span className="thumb-fallback-name">{photo.name}</span>
          <button 
            type="button" 
            className="btn btn-xs btn-secondary mt-4" 
            onClick={(e) => { e.stopPropagation(); resolveImage(true); }}
          >
            Load Photo
          </button>
        </div>
      )}
    </div>
  );
}

export default function DuplicateManagerModal({
  duplicateGroups,
  reviewedDuplicates,
  onClose,
  onMoveToReview,
  onRestoreFromReview,
  onRestoreMultipleFromReview,
  onRunScan,
  isScanningDuplicates,
  scanProgress,
  rootDirHandle,
  onPickFolder,
  onIgnorePair,
  onPermanentDelete,
  initialTab = 'found'
}) {
  const [selectedToMove, setSelectedToMove] = useState(() => {
    const initial = {};
    duplicateGroups.forEach(grp => {
      grp.duplicateCandidates.forEach(cand => {
        initial[cand.photo.id] = true;
      });
    });
    return initial;
  });

  const [activeTab, setActiveTab] = useState(initialTab || 'found');
  const [scanMode, setScanMode] = useState('all'); // 'all' | 'exact' | 'filename_copies' | 'visual'
  
  // Side-by-Side Zoom Inspector State
  const [inspectorData, setInspectorData] = useState(null);
  // inspectorData: { groupIndex, best: photo, duplicate: cand.photo, matchReason: string, candId: string }
  const [inspectorMode, setInspectorMode] = useState('split'); // 'split' | 'flip'
  const [flipCurrent, setFlipCurrent] = useState('best'); // 'best' | 'duplicate'
  const [isMoving, setIsMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState(null);

  // Review Folder selection and restore states
  const [selectedReviewedIds, setSelectedReviewedIds] = useState({});
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Update selected items whenever duplicateGroups changes
  useEffect(() => {
    const initial = {};
    duplicateGroups.forEach(grp => {
      grp.duplicateCandidates.forEach(cand => {
        initial[cand.photo.id] = true;
      });
    });
    setSelectedToMove(initial);
  }, [duplicateGroups]);

  const toggleSelect = (photoId) => {
    setSelectedToMove(prev => ({
      ...prev,
      [photoId]: !prev[photoId]
    }));
  };

  const toggleMoveBoth = (grp) => {
    const isBothSelected = !!selectedToMove[grp.bestToKeep.id];
    setSelectedToMove(prev => {
      const next = { ...prev };
      if (isBothSelected) {
        delete next[grp.bestToKeep.id];
      } else {
        next[grp.bestToKeep.id] = true;
        grp.duplicateCandidates.forEach(c => {
          next[c.photo.id] = true;
        });
      }
      return next;
    });
  };

  const handleIgnore = (photoA, photoB) => {
    if (onIgnorePair) {
      onIgnorePair(photoA, photoB);
    }
    if (inspectorData && (inspectorData.best.id === photoA.id || inspectorData.best.id === photoB.id)) {
      setInspectorData(null);
    }
  };

  const handleBatchMove = async () => {
    if (isMoving) return;
    const photosToMove = [];
    const addedIds = new Set();
    duplicateGroups.forEach(grp => {
      if (selectedToMove[grp.bestToKeep.id] && !addedIds.has(grp.bestToKeep.id)) {
        photosToMove.push(grp.bestToKeep);
        addedIds.add(grp.bestToKeep.id);
      }
      grp.duplicateCandidates.forEach(cand => {
        if (selectedToMove[cand.photo.id] && !addedIds.has(cand.photo.id)) {
          photosToMove.push(cand.photo);
          addedIds.add(cand.photo.id);
        }
      });
    });
    if (photosToMove.length === 0) return;

    setIsMoving(true);
    setMoveProgress({ current: 0, total: photosToMove.length, percent: 0 });
    try {
      await onMoveToReview(photosToMove, (current, total, item) => {
        setMoveProgress({
          current,
          total,
          percent: Math.round((current / total) * 100),
          name: item?.name
        });
      });
    } catch (err) {
      console.error('Batch move error:', err);
    } finally {
      setIsMoving(false);
      setMoveProgress(null);
    }
  };

  const toggleSelectReviewed = (photoId) => {
    setSelectedReviewedIds(prev => ({
      ...prev,
      [photoId]: !prev[photoId]
    }));
  };

  const selectAllReviewed = () => {
    const next = {};
    reviewedDuplicates.forEach(p => {
      next[p.id] = true;
    });
    setSelectedReviewedIds(next);
  };

  const deselectAllReviewed = () => {
    setSelectedReviewedIds({});
  };

  const selectedReviewedCount = Object.values(selectedReviewedIds).filter(Boolean).length;

  const handleBulkRestore = async () => {
    if (isRestoring) return;
    const toRestore = reviewedDuplicates.filter(p => selectedReviewedIds[p.id]);
    if (toRestore.length === 0) return;

    setIsRestoring(true);
    setRestoreProgress({ current: 0, total: toRestore.length, percent: 0 });
    try {
      if (onRestoreMultipleFromReview) {
        await onRestoreMultipleFromReview(toRestore, (curr, tot, item) => {
          setRestoreProgress({
            current: curr,
            total: tot,
            percent: Math.round((curr / tot) * 100),
            name: item?.name
          });
        });
      } else {
        for (let i = 0; i < toRestore.length; i++) {
          await onRestoreFromReview(toRestore[i]);
          setRestoreProgress({
            current: i + 1,
            total: toRestore.length,
            percent: Math.round(((i + 1) / toRestore.length) * 100),
            name: toRestore[i].name
          });
        }
      }
      setSelectedReviewedIds({});
    } catch (err) {
      console.error('Bulk restore failed:', err);
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  const handleOpenInspector = (groupIndex, bestPhoto, candPhoto, matchReason) => {
    setInspectorData({
      groupIndex,
      best: bestPhoto,
      duplicate: candPhoto,
      matchReason: matchReason || 'Duplicate Match',
      candId: candPhoto.id
    });
    setFlipCurrent('best');
  };

  const handleNavigateInspector = (direction) => {
    if (!inspectorData) return;
    const currentGroup = duplicateGroups[inspectorData.groupIndex];
    if (!currentGroup) return;

    // Find current cand index
    const candIndex = currentGroup.duplicateCandidates.findIndex(c => c.photo.id === inspectorData.candId);
    if (direction === 'next') {
      if (candIndex < currentGroup.duplicateCandidates.length - 1) {
        const nextCand = currentGroup.duplicateCandidates[candIndex + 1];
        handleOpenInspector(inspectorData.groupIndex, currentGroup.bestToKeep, nextCand.photo, nextCand.matchReason);
      } else if (inspectorData.groupIndex < duplicateGroups.length - 1) {
        const nextGroup = duplicateGroups[inspectorData.groupIndex + 1];
        if (nextGroup.duplicateCandidates.length > 0) {
          handleOpenInspector(inspectorData.groupIndex + 1, nextGroup.bestToKeep, nextGroup.duplicateCandidates[0].photo, nextGroup.duplicateCandidates[0].matchReason);
        }
      }
    } else if (direction === 'prev') {
      if (candIndex > 0) {
        const prevCand = currentGroup.duplicateCandidates[candIndex - 1];
        handleOpenInspector(inspectorData.groupIndex, currentGroup.bestToKeep, prevCand.photo, prevCand.matchReason);
      } else if (inspectorData.groupIndex > 0) {
        const prevGroup = duplicateGroups[inspectorData.groupIndex - 1];
        const lastCand = prevGroup.duplicateCandidates[prevGroup.duplicateCandidates.length - 1];
        if (lastCand) {
          handleOpenInspector(inspectorData.groupIndex - 1, prevGroup.bestToKeep, lastCand.photo, lastCand.matchReason);
        }
      }
    }
  };

  const totalCandidates = duplicateGroups.reduce(
    (acc, grp) => acc + grp.duplicateCandidates.length, 
    0
  );

  const totalWastedBytes = duplicateGroups.reduce((acc, grp) => {
    return acc + grp.duplicateCandidates.reduce((sub, cand) => sub + (cand.photo.size || 0), 0);
  }, 0);

  const formattedWastedSpace = totalWastedBytes > 1024 * 1024 * 1024
    ? `${(totalWastedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${(totalWastedBytes / (1024 * 1024)).toFixed(1)} MB`;

  const selectedCount = Object.values(selectedToMove).filter(Boolean).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="duplicate-modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title">
              {activeTab === 'reviewed' ? '📁 Review Folder Manager' : 'Duplicate Photo Assistant'}
            </h3>
            <p className="modal-subtitle">
              {activeTab === 'reviewed' 
                ? 'Review, restore back to your library, or permanently clean up isolated files' 
                : 'Scan, review, and visually confirm duplicate or lower-resolution copies side-by-side'}
            </p>
          </div>
          <button onClick={onClose} disabled={isMoving || isRestoring} className="btn-icon-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scan Controls Bar */}
        <div className="duplicate-scan-toolbar">
          <div className="scan-mode-selector">
            <span className="scan-label">Detection Method:</span>
            <button 
              onClick={() => setScanMode('all')}
              className={`btn-mode-pill ${scanMode === 'all' ? 'active' : ''}`}
              title="Best balance: matches identical files across folders, copy variants, and verified byte matches"
            >
              ⚡ Smart Duplicates (High Fidelity)
            </button>
            <button 
              onClick={() => setScanMode('exact')}
              className={`btn-mode-pill ${scanMode === 'exact' ? 'active' : ''}`}
              title="Strict matching: identical filenames in different folders or verified SHA-256 byte matches"
            >
              📁 Identical Across Folders
            </button>
            <button 
              onClick={() => setScanMode('filename_copies')}
              className={`btn-mode-pill ${scanMode === 'filename_copies' ? 'active' : ''}`}
              title="Detects files with copy suffixes like (1), - Copy, or lower-res thumbnails"
            >
              📑 Copy Suffixes & Thumbs
            </button>
            <button 
              onClick={() => setScanMode('visual')}
              className={`btn-mode-pill ${scanMode === 'visual' ? 'active' : ''}`}
              title="Perceptual visual matching on image appearance and orientation"
            >
              👁️ Visual Similarity
            </button>
          </div>

          <button 
            onClick={() => onRunScan && onRunScan(scanMode)}
            disabled={isScanningDuplicates}
            className="btn btn-primary btn-sm btn-rescan"
          >
            <RefreshCw size={15} className={isScanningDuplicates ? 'spin-icon' : ''} />
            <span>{isScanningDuplicates ? 'Scanning...' : 'Scan for Duplicates Now'}</span>
          </button>
        </div>

        {/* Progress bar if scanning */}
        {isScanningDuplicates && (
          <div className="duplicate-progress-bar-wrap">
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{ width: `${scanProgress?.percent || 30}%` }}
              ></div>
            </div>
            <p className="progress-status-text">
              {scanProgress?.message || 'Scanning photo library for duplicates...'}
            </p>
          </div>
        )}

        {/* Reconnect Folder Alert if folder handle missing */}
        {!rootDirHandle && onPickFolder && (
          <div className="reconnect-folder-alert">
            <div className="flex items-center gap-8">
              <FolderOpen size={18} className="text-warning" />
              <span>Click here to connect your folder so images can display at full resolution:</span>
            </div>
            <button onClick={onPickFolder} className="btn btn-sm btn-primary">
              Connect Folder
            </button>
          </div>
        )}

        {/* Safety Notice & Space Saved Banner */}
        <div className="duplicate-safety-banner">
          <div className="safety-info-left">
            <ShieldCheck size={20} className="safety-icon" />
            <div className="safety-text">
              <strong>Safe Cleaning:</strong> Duplicates are never permanently deleted immediately. 
              They are gently moved into your <code>_Duplicates_Review</code> folder with 1-click restore.
            </div>
          </div>
          {totalCandidates > 0 && (
            <div className="space-saved-pill">
              <HardDrive size={16} />
              <span>{formattedWastedSpace} wasted</span>
            </div>
          )}
        </div>

        {/* Tabs: Found vs In Review Folder */}
        <div className="duplicate-tab-bar">
          <button
            onClick={() => setActiveTab('found')}
            className={`duplicate-tab-btn ${activeTab === 'found' ? 'active' : ''}`}
          >
            <Copy size={16} />
            <span>Duplicates Found ({totalCandidates})</span>
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`duplicate-tab-btn ${activeTab === 'reviewed' ? 'active' : ''}`}
          >
            <FolderCheck size={16} />
            <span>In Review Folder ({reviewedDuplicates.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="duplicate-modal-body">
          {activeTab === 'found' ? (
            duplicateGroups.length === 0 ? (
              <div className="empty-duplicates-state">
                <CheckCircle size={48} className="text-success" />
                <h4>No duplicates found with current filter</h4>
                <p>
                  Click <strong>"Scan for Duplicates Now"</strong> above to scan your entire library across all subfolders.
                </p>
                <button 
                  onClick={() => onRunScan && onRunScan('all')} 
                  disabled={isScanningDuplicates}
                  className="btn btn-secondary mt-12"
                >
                  <RefreshCw size={16} className={isScanningDuplicates ? 'spin-icon' : ''} />
                  <span>Start Comprehensive Scan</span>
                </button>
              </div>
            ) : (
              <div className="duplicate-groups-list">
                {duplicateGroups.map((group, grpIdx) => (
                  <div key={group.groupId || grpIdx} className="duplicate-group-card">
                    <div className="group-card-header">
                      <div className="group-header-left">
                        <span className="group-badge">Duplicate Set #{grpIdx + 1}</span>
                        <span className="group-type-tag">
                          {group.matchType === 'exact' ? 'Exact Byte Copy' : 'Filename / Thumbnail Copy'}
                        </span>
                      </div>
                      <div className="flex items-center gap-8 flex-wrap">
                        {group.duplicateCandidates.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenInspector(grpIdx, group.bestToKeep, group.duplicateCandidates[0].photo, group.duplicateCandidates[0].matchReason)}
                            title="Inspect images side-by-side in full size"
                          >
                            <Eye size={14} />
                            <span>Compare Side-by-Side</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-xs ${selectedToMove[group.bestToKeep.id] ? 'btn-danger' : 'btn-outline'}`}
                          onClick={() => toggleMoveBoth(group)}
                          title="Select both Photo A and Photo B to be moved to the Review folder"
                        >
                          <Trash2 size={13} />
                          <span>{selectedToMove[group.bestToKeep.id] ? 'Both Marked to Move' : 'Move Both to Review'}</span>
                        </button>
                        {group.duplicateCandidates[0] && (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => handleIgnore(group.bestToKeep, group.duplicateCandidates[0].photo)}
                            title="These are different photos: never flag them as duplicates again"
                          >
                            <ShieldCheck size={13} />
                            <span>Not Duplicates</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="duplicate-comparison-grid">
                      {/* Best photo to keep */}
                      <div className="comparison-item item-best">
                        <div className="comparison-badge badge-keep">
                          <CheckCircle size={14} /> Photo A: Best Quality (Keep)
                        </div>
                        
                        <DuplicatePhotoThumbnail 
                          photo={group.bestToKeep} 
                          rootDirHandle={rootDirHandle}
                          onZoom={() => handleOpenInspector(grpIdx, group.bestToKeep, group.duplicateCandidates[0]?.photo)}
                        />

                        <div className="comparison-info">
                          <p className="file-name" title={group.bestToKeep.name}>{group.bestToKeep.name}</p>
                          <p className="file-meta">
                            Resolution: {group.bestToKeep.width ? `${group.bestToKeep.width} × ${group.bestToKeep.height} px` : 'Original'}
                          </p>
                          <p className="file-meta">
                            Size: {group.bestToKeep.size ? `${(group.bestToKeep.size / 1024).toFixed(0)} KB` : 'Standard'}
                          </p>
                          {group.bestToKeep.relativePath && (
                            <p className="file-folder-meta" title={group.bestToKeep.relativePath}>
                              📁 {group.bestToKeep.relativePath}
                            </p>
                          )}

                          <label className="checkbox-label" style={{ marginTop: '8px' }}>
                            <input
                              type="checkbox"
                              checked={!!selectedToMove[group.bestToKeep.id]}
                              onChange={() => toggleSelect(group.bestToKeep.id)}
                            />
                            <span>Also move Photo A to Review</span>
                          </label>
                        </div>
                      </div>

                      {/* Duplicates to review / move */}
                      {group.duplicateCandidates.map((cand) => (
                        <div key={cand.photo.id} className="comparison-item item-duplicate">
                          <div className="comparison-badge badge-dup">
                            <AlertTriangle size={14} /> 
                            {cand.matchReason || (cand.isExactMatch ? 'Exact Byte Duplicate' : `${cand.similarityPercent}% Match`)}
                          </div>
                          
                          <DuplicatePhotoThumbnail 
                            photo={cand.photo} 
                            rootDirHandle={rootDirHandle}
                            onZoom={() => handleOpenInspector(grpIdx, group.bestToKeep, cand.photo, cand.matchReason)}
                          />

                          <div className="comparison-info">
                            <p className="file-name" title={cand.photo.name}>{cand.photo.name}</p>
                            <p className="file-meta">
                              Resolution: {cand.photo.width ? `${cand.photo.width} × ${cand.photo.height} px` : 'Copy'}
                            </p>
                            <p className="file-meta">
                              Size: {cand.photo.size ? `${(cand.photo.size / 1024).toFixed(0)} KB` : 'Duplicate'}
                            </p>
                            {cand.photo.relativePath && (
                              <p className="file-folder-meta" title={cand.photo.relativePath}>
                                📁 {cand.photo.relativePath}
                              </p>
                            )}

                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={!!selectedToMove[cand.photo.id]}
                                onChange={() => toggleSelect(cand.photo.id)}
                              />
                              <span>Move Photo B to Review</span>
                            </label>

                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                              onClick={() => handleIgnore(group.bestToKeep, cand.photo)}
                              title="Never flag this pair as duplicates again"
                            >
                              <ShieldCheck size={13} />
                              <span>Not Duplicates (Never Flag Again)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Review Folder Tab */
            reviewedDuplicates.length === 0 ? (
              <div className="empty-duplicates-state">
                <FolderCheck size={48} className="text-muted" />
                <h4>Your _Duplicates_Review folder is empty</h4>
                <p>Any duplicates you move will appear here for safe keeping and easy 1-click restoring.</p>
              </div>
            ) : (
              <div className="reviewed-tab-container">
                <div 
                  className="reviewed-tab-header-bar" 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <strong>{reviewedDuplicates.length} photos</strong> in your <code>_Duplicates_Review</code> folder
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-subtle)' }}>
                      Files in Review are safely separated from your albums. You can restore them anytime or permanently clean them up.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={selectAllReviewed}
                      disabled={isRestoring}
                    >
                      Select All ({reviewedDuplicates.length})
                    </button>
                    {selectedReviewedCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={deselectAllReviewed}
                        disabled={isRestoring}
                      >
                        Deselect
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleBulkRestore}
                      disabled={selectedReviewedCount === 0 || isRestoring}
                    >
                      <Undo2 size={14} />
                      <span>
                        {isRestoring 
                          ? `Restoring ${restoreProgress?.current || 0}/${restoreProgress?.total || selectedReviewedCount}... (${restoreProgress?.percent || 0}%)` 
                          : `Restore Selected (${selectedReviewedCount}) to Library`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => onPermanentDelete && onPermanentDelete()}
                      disabled={isRestoring}
                      title="Permanently remove all review files from your hard drive"
                    >
                      <Flame size={14} />
                      <span>Empty Review Folder</span>
                    </button>
                  </div>
                </div>

                <div className="reviewed-duplicates-grid">
                  {reviewedDuplicates.map((photo) => (
                    <div key={photo.id} className="reviewed-photo-card" style={{ position: 'relative' }}>
                      <label 
                        className="checkbox-label"
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          zIndex: 10,
                          backgroundColor: 'rgba(0, 0, 0, 0.72)',
                          backdropFilter: 'blur(4px)',
                          borderRadius: '4px',
                          padding: '2px 7px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={!!selectedReviewedIds[photo.id]}
                          onChange={() => toggleSelectReviewed(photo.id)}
                          disabled={isRestoring}
                        />
                        <span style={{ fontSize: '11px', fontWeight: '600' }}>Select</span>
                      </label>
                      <DuplicatePhotoThumbnail 
                        photo={photo} 
                        rootDirHandle={rootDirHandle}
                      />
                      <div className="reviewed-info">
                        <p className="file-name" title={photo.name}>{photo.name}</p>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button 
                            onClick={() => onRestoreFromReview(photo)}
                            className="btn btn-secondary btn-xs"
                            style={{ flex: 1 }}
                            title="Restore back to original folder"
                            disabled={isRestoring}
                          >
                            <Undo2 size={13} /> Restore
                          </button>
                          <button 
                            onClick={() => onPermanentDelete && onPermanentDelete(photo)}
                            className="btn btn-danger-outline btn-xs"
                            title="Permanently delete from disk"
                            disabled={isRestoring}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button onClick={onClose} disabled={isMoving || isRestoring} className="btn btn-secondary">
            Close
          </button>

          {activeTab === 'found' && duplicateGroups.length > 0 && (
            <button 
              onClick={handleBatchMove} 
              disabled={selectedCount === 0 || isMoving}
              className="btn btn-warning-action"
            >
              <FolderCheck size={18} />
              <span>
                {isMoving 
                  ? `Moving ${moveProgress?.current || 0}/${moveProgress?.total || selectedCount}... (${moveProgress?.percent || 0}%)` 
                  : `Move Selected (${selectedCount}) to Review Folder`}
              </span>
            </button>
          )}

          {activeTab === 'reviewed' && reviewedDuplicates.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleBulkRestore}
                disabled={selectedReviewedCount === 0 || isRestoring}
                className="btn btn-primary"
              >
                <Undo2 size={16} />
                <span>
                  {isRestoring 
                    ? `Restoring ${restoreProgress?.current || 0}/${restoreProgress?.total || selectedReviewedCount}... (${restoreProgress?.percent || 0}%)` 
                    : `Restore Selected (${selectedReviewedCount}) to Library`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPermanentDelete && onPermanentDelete()}
                disabled={isRestoring}
                className="btn btn-danger"
              >
                <Trash2 size={16} />
                <span>Permanently Delete All ({reviewedDuplicates.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side High Resolution Inspector Lightbox */}
      {inspectorData && (
        <div className="zoom-lightbox-backdrop" onClick={() => setInspectorData(null)}>
          <div className="zoom-lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-lightbox-header">
              <div className="flex items-center gap-12">
                <h3 className="modal-title font-bold">
                  Side-by-Side Duplicate Comparison (Set #{inspectorData.groupIndex + 1})
                </h3>
                <span className="badge badge-warning">{inspectorData.matchReason}</span>
              </div>

              {/* Mode switch & Navigation */}
              <div className="flex items-center gap-10">
                <div className="btn-group-segmented">
                  <button
                    type="button"
                    className={`btn-segment ${inspectorMode === 'split' ? 'active' : ''}`}
                    onClick={() => setInspectorMode('split')}
                  >
                    <ArrowLeftRight size={14} /> Side-by-Side
                  </button>
                  <button
                    type="button"
                    className={`btn-segment ${inspectorMode === 'flip' ? 'active' : ''}`}
                    onClick={() => setInspectorMode('flip')}
                  >
                    <Eye size={14} /> Quick A/B Flip
                  </button>
                </div>

                <div className="flex items-center gap-4 ml-8">
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon-sm"
                    title="Previous Pair"
                    onClick={() => handleNavigateInspector('prev')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon-sm"
                    title="Next Pair"
                    onClick={() => handleNavigateInspector('next')}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={() => setInspectorData(null)} 
                  className="btn-icon-close ml-8"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="zoom-lightbox-body">
              {inspectorMode === 'split' ? (
                <div className="zoom-split-grid">
                  {/* Left: Best to Keep */}
                  <div className="zoom-panel zoom-panel-keep">
                    <div className="zoom-panel-header">
                      <div className="flex items-center gap-8">
                        <span className="badge badge-keep">
                          <CheckCircle size={14} /> Photo A: Keep (Best Quality)
                        </span>
                        <span className="text-xs text-muted">
                          {inspectorData.best.width ? `${inspectorData.best.width}×${inspectorData.best.height}` : 'Original'}
                        </span>
                      </div>
                      <label className="checkbox-label text-xs m-0">
                        <input
                          type="checkbox"
                          checked={!!selectedToMove[inspectorData.best.id]}
                          onChange={() => toggleSelect(inspectorData.best.id)}
                        />
                        <span>Move to Review</span>
                      </label>
                    </div>
                    <div className="zoom-img-wrapper">
                      <img 
                        src={inspectorData.best.enhancedUrl || inspectorData.best.objectUrl} 
                        alt={inspectorData.best.name}
                        className="zoom-img" 
                      />
                    </div>
                    <div className="zoom-panel-details">
                      <h4 className="font-bold text-sm">{inspectorData.best.name}</h4>
                      <div className="text-xs text-muted mt-2">
                        <span>Size: {inspectorData.best.size ? `${(inspectorData.best.size / 1024).toFixed(0)} KB` : 'N/A'}</span>
                        {inspectorData.best.relativePath && (
                          <div className="mt-1">📁 {inspectorData.best.relativePath}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Candidate to move */}
                  <div className="zoom-panel zoom-panel-dup">
                    <div className="zoom-panel-header">
                      <span className="badge badge-dup">
                        <AlertTriangle size={14} /> Photo B: Duplicate Copy
                      </span>
                      <label className="checkbox-label text-xs m-0">
                        <input
                          type="checkbox"
                          checked={!!selectedToMove[inspectorData.duplicate.id]}
                          onChange={() => toggleSelect(inspectorData.duplicate.id)}
                        />
                        <span>Move to Review</span>
                      </label>
                    </div>
                    <div className="zoom-img-wrapper">
                      <img 
                        src={inspectorData.duplicate.enhancedUrl || inspectorData.duplicate.objectUrl} 
                        alt={inspectorData.duplicate.name}
                        className="zoom-img" 
                      />
                    </div>
                    <div className="zoom-panel-details">
                      <h4 className="font-bold text-sm">{inspectorData.duplicate.name}</h4>
                      <div className="text-xs text-muted mt-2">
                        <span>Size: {inspectorData.duplicate.size ? `${(inspectorData.duplicate.size / 1024).toFixed(0)} KB` : 'N/A'}</span>
                        {inspectorData.duplicate.relativePath && (
                          <div className="mt-1">📁 {inspectorData.duplicate.relativePath}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Quick A/B Flip View */
                <div className="zoom-flip-wrapper">
                  <div className="flex items-center gap-12 mb-8">
                    <button
                      type="button"
                      className={`btn ${flipCurrent === 'best' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFlipCurrent('best')}
                    >
                      Showing Photo A (Keep)
                    </button>
                    <button
                      type="button"
                      className={`btn ${flipCurrent === 'duplicate' ? 'btn-warning-action' : 'btn-secondary'}`}
                      onClick={() => setFlipCurrent('duplicate')}
                    >
                      Showing Photo B (Duplicate)
                    </button>
                    <span className="text-xs text-muted">
                      💡 Click buttons to rapidly alternate views and detect subtle differences
                    </span>
                  </div>

                  <div className="zoom-flip-img-container">
                    <img
                      src={
                        flipCurrent === 'best'
                          ? (inspectorData.best.enhancedUrl || inspectorData.best.objectUrl)
                          : (inspectorData.duplicate.enhancedUrl || inspectorData.duplicate.objectUrl)
                      }
                      alt="Comparison"
                      className="zoom-img"
                    />
                  </div>

                  <div className="text-sm font-semibold mt-4">
                    Active: {flipCurrent === 'best' ? inspectorData.best.name : inspectorData.duplicate.name}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div className="flex items-center gap-16 flex-wrap">
                <label className="checkbox-label cursor-pointer m-0">
                  <input
                    type="checkbox"
                    checked={!!selectedToMove[inspectorData.duplicate.id]}
                    onChange={() => toggleSelect(inspectorData.duplicate.id)}
                  />
                  <span>Move Photo B to Review</span>
                </label>
                <label className="checkbox-label cursor-pointer m-0">
                  <input
                    type="checkbox"
                    checked={!!selectedToMove[inspectorData.best.id]}
                    onChange={() => toggleSelect(inspectorData.best.id)}
                  />
                  <span>Also Move Photo A to Review</span>
                </label>
              </div>

              <div className="flex items-center gap-8 flex-wrap">
                <button
                  type="button"
                  className={`btn btn-sm ${selectedToMove[inspectorData.best.id] && selectedToMove[inspectorData.duplicate.id] ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => {
                    const bothActive = selectedToMove[inspectorData.best.id] && selectedToMove[inspectorData.duplicate.id];
                    setSelectedToMove(p => ({
                      ...p,
                      [inspectorData.best.id]: !bothActive,
                      [inspectorData.duplicate.id]: !bothActive
                    }));
                  }}
                  title="Mark both photos to move to Review folder"
                >
                  <Trash2 size={14} />
                  <span>{selectedToMove[inspectorData.best.id] && selectedToMove[inspectorData.duplicate.id] ? 'Both Marked for Review' : 'Move Both to Review'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleIgnore(inspectorData.best, inspectorData.duplicate)}
                  title="Never flag these two photos as duplicates again"
                >
                  <ShieldCheck size={14} />
                  <span>🛡️ Not Duplicates (Ignore in Future)</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => setInspectorData(null)} 
                  className="btn btn-primary btn-sm"
                >
                  Done Inspecting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

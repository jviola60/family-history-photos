import React, { useState, useMemo, useCallback } from 'react';
import { 
  X, 
  ShieldCheck, 
  FolderCheck, 
  Monitor, 
  Users,
  Image as ImageIcon 
} from 'lucide-react';
import { getFileFromPath } from '../lib/fileSystem';
function JunkPhotoThumbnail({ photo, rootDirHandle }) {
  const [src, setSrc] = useState(photo.enhancedUrl || photo.objectUrl || null);
  const [loading, setLoading] = useState(!src);
  const [error, setError] = useState(false);

  const resolveImage = useCallback(async () => {
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

    if (photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        const url = URL.createObjectURL(file);
        photo.objectUrl = url;
        setSrc(url);
        setLoading(false);
        return;
      } catch {}
    }

    if (rootDirHandle && photo.relativePath) {
      try {
        const file = await getFileFromPath(rootDirHandle, photo.relativePath);
        if (file) {
          const url = URL.createObjectURL(file);
          photo.objectUrl = url;
          setSrc(url);
          setLoading(false);
          return;
        }
      } catch {}
    }

    setLoading(false);
    setError(true);
  }, [photo, rootDirHandle]);

  React.useEffect(() => {
    if (!src) {
      resolveImage();
    }
  }, [src, resolveImage]);

  return (
    <div className="duplicate-thumb-container" style={{ height: '160px' }}>
      {loading ? (
        <div className="thumb-loading-placeholder">
          <span className="spinner-sm"></span>
          <span>Loading...</span>
        </div>
      ) : error || !src ? (
        <div className="thumb-fallback-placeholder">
          <ImageIcon size={28} />
          <span className="thumb-fallback-name">{photo.name}</span>
        </div>
      ) : (
        <img 
          src={src} 
          alt={photo.name} 
          className="comparison-img" 
          style={{ height: '160px', objectFit: 'contain', background: '#111' }}
          loading="lazy" 
        />
      )}
    </div>
  );
}

export default function JunkCleanerModal({
  candidates = [],
  onClose,
  onMoveToReview,
  onIgnoreJunk,
  rootDirHandle
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'screenshot_ui' | 'screenshot_people' | 'low_res'
  const [selectedIds, setSelectedIds] = useState({}); // Safe default: 0 items pre-selected
  const [visibleLimit, setVisibleLimit] = useState(48);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setVisibleLimit(48);
  };

  const uiScreenshotsCount = useMemo(() => candidates.filter(c => c.category === 'screenshot_ui').length, [candidates]);
  const peopleScreenshotsCount = useMemo(() => candidates.filter(c => c.category === 'screenshot_people').length, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (activeFilter === 'all') return candidates;
    return candidates.filter(c => c.category === activeFilter);
  }, [candidates, activeFilter]);

  const visibleCandidates = useMemo(() => {
    return filteredCandidates.slice(0, visibleLimit);
  }, [filteredCandidates, visibleLimit]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAllCategory = (cat) => {
    setSelectedIds(prev => {
      const next = { ...prev };
      candidates.forEach(c => {
        if (!cat || c.category === cat) {
          next[c.photo.id] = true;
        }
      });
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedIds({});
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const totalSelectedBytes = useMemo(() => {
    return candidates.reduce((sum, c) => {
      return selectedIds[c.photo.id] ? sum + (c.photo.size || 0) : sum;
    }, 0);
  }, [candidates, selectedIds]);

  const formattedSelectedBytes = totalSelectedBytes > 1024 * 1024 * 1024
    ? `${(totalSelectedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB`;

  const [isMoving, setIsMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState(null);
  const [moveFinished, setMoveFinished] = useState(false);

  const handleBulkMove = async () => {
    const toMove = candidates
      .filter(c => selectedIds[c.photo.id])
      .map(c => c.photo);
    if (toMove.length === 0 || !onMoveToReview || isMoving) return;

    setIsMoving(true);
    setMoveProgress({ current: 0, total: toMove.length, percent: 0, fileName: 'Preparing files...' });

    try {
      await onMoveToReview(toMove, (current, total, item) => {
        setMoveProgress({
          current,
          total,
          percent: Math.round((current / total) * 100),
          fileName: item?.name || ''
        });
      });
      setMoveFinished(true);
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      console.error('Failed to move photos:', err);
      setIsMoving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={!isMoving ? onClose : undefined}>
      <div 
        className="duplicate-modal-dialog" 
        style={{ maxWidth: '1100px', position: 'relative' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Active Moving Progress Overlay */}
        {isMoving && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(28, 25, 23, 0.93)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: '#fff',
            borderRadius: 'var(--radius-xl)'
          }}>
            <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>
              {moveFinished ? (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                    Successfully Moved to Review Folder!
                  </h3>
                  <p style={{ color: '#d1d5db', fontSize: '14px' }}>
                    {moveProgress?.total} photos moved to <code>_Duplicates_Review</code>. Closing...
                  </p>
                </>
              ) : (
                <>
                  <div className="spinner" style={{ margin: '0 auto 16px', width: '38px', height: '38px', borderWidth: '3px' }}></div>
                  <h3 style={{ fontSize: '19px', fontWeight: '700', marginBottom: '6px' }}>
                    Moving to Review Folder...
                  </h3>
                  <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {moveProgress?.fileName}
                  </p>
                  <div style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    marginBottom: '10px'
                  }}>
                    <div style={{
                      width: `${moveProgress?.percent || 0}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent, #ea580c)',
                      borderRadius: '999px',
                      transition: 'width 0.15s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#e5e7eb' }}>
                    <span>{moveProgress?.current || 0} of {moveProgress?.total || 0} files</span>
                    <span>{moveProgress?.percent || 0}%</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>
                    Safely moving photos to your folder's <code>_Duplicates_Review</code> subfolder so you can restore them anytime.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title font-bold flex items-center gap-8">
              <span>🧹 Smart Junk & Screenshot Cleaner</span>
            </h3>
            <p className="modal-subtitle">
              Safely clean up computer app screenshots and tiny thumbnail artifacts without touching your family photos.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="duplicate-scan-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="scan-mode-selector">
            <button 
              type="button"
              className={`btn-mode-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All Identified ({candidates.length})
            </button>
            <button 
              type="button"
              className={`btn-mode-pill ${activeFilter === 'screenshot_ui' ? 'active' : ''}`}
              onClick={() => handleFilterChange('screenshot_ui')}
              title="Screenshots of apps, code, dialog boxes, and desktop windows"
            >
              <Monitor size={14} />
              App & Doc Screenshots ({uiScreenshotsCount})
            </button>
            <button 
              type="button"
              className={`btn-mode-pill ${activeFilter === 'screenshot_people' ? 'active' : ''}`}
              onClick={() => handleFilterChange('screenshot_people')}
              title="Screenshots where people/faces were found (Zoom, Skype, webcam)"
            >
              <Users size={14} />
              Screenshots with People ({peopleScreenshotsCount})
            </button>
          </div>

          {/* Quick Selection Shortcuts */}
          <div className="flex items-center gap-6 ml-auto flex-wrap">
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => selectAllCategory('screenshot_ui')}
              title="Select only computer app and document screenshots (safe to delete)"
            >
              Select App Screenshots (Safe)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={deselectAll}
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Body Grid */}
        <div className="duplicate-modal-body" style={{ padding: '16px 20px', minHeight: '360px' }}>
          {filteredCandidates.length === 0 ? (
            <div className="empty-duplicates-state">
              <FolderCheck size={48} className="text-success" />
              <h4>No cleanup candidates found in this category</h4>
              <p>Your library is tidy and contains no unreviewed images matching this criteria.</p>
            </div>
          ) : (
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '16px'
              }}
            >
              {visibleCandidates.map(({ photo, category, reasons }) => {
                const isSelected = !!selectedIds[photo.id];
                return (
                  <div 
                    key={photo.id}
                    className="reviewed-photo-card"
                    style={{
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-light)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Category Pill */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        zIndex: 10,
                        backgroundColor: category === 'screenshot_ui' 
                          ? 'rgba(180, 83, 9, 0.92)' 
                          : category === 'screenshot_people'
                            ? 'rgba(4, 120, 87, 0.92)' 
                            : 'rgba(28, 25, 23, 0.85)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {category === 'screenshot_ui' && '💻 App / Doc Screenshot'}
                      {category === 'screenshot_people' && '👤 Family / Video Call'}
                    </div>

                    <JunkPhotoThumbnail 
                      photo={photo} 
                      rootDirHandle={rootDirHandle} 
                    />

                    <div className="reviewed-info" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <p className="file-name" title={photo.name}>{photo.name}</p>
                      
                      <p className="file-meta">
                        {photo.width ? `${photo.width} × ${photo.height} px` : 'Unknown res'} • {photo.size ? `${(photo.size / 1024).toFixed(0)} KB` : ''}
                      </p>

                      {photo.relativePath && (
                        <p className="file-folder-meta text-xs text-muted" title={photo.relativePath} style={{ marginTop: '2px' }}>
                          📁 {photo.relativePath}
                        </p>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                        <label className="checkbox-label" style={{ marginTop: '0', cursor: 'pointer' }}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(photo.id)}
                          />
                          <span style={{ fontSize: '12px' }}>Move to Review</span>
                        </label>

                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
                          onClick={() => onIgnoreJunk && onIgnoreJunk(photo)}
                          title="Keep this photo and never flag it for cleanup again"
                        >
                          <ShieldCheck size={12} />
                          <span>Keep (Never Flag)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCandidates.length > visibleLimit && (
                <div style={{ textAlign: 'center', padding: '16px 0', gridColumn: '1 / -1' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setVisibleLimit(prev => prev + 48)}
                  >
                    Load Next 48 Photos ({filteredCandidates.length - visibleLimit} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="text-sm font-semibold">
              Selected {selectedCount} photo{selectedCount !== 1 ? 's' : ''}
            </span>
            {selectedCount > 0 && (
              <span className="text-xs text-muted ml-8">({formattedSelectedBytes} to clean)</span>
            )}
          </div>

          <div className="flex items-center gap-10">
            <button onClick={onClose} disabled={isMoving} className="btn btn-secondary">
              Close
            </button>
            <button
              onClick={handleBulkMove}
              disabled={selectedCount === 0 || isMoving}
              className="btn btn-warning-action"
            >
              {isMoving ? (
                <>
                  <span className="spinner-sm" style={{ borderTopColor: '#fff', width: '16px', height: '16px' }}></span>
                  <span>Moving {moveProgress?.current || 0} / {selectedCount}...</span>
                </>
              ) : (
                <>
                  <FolderCheck size={18} />
                  <span>Move Selected ({selectedCount}) to Review Folder</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

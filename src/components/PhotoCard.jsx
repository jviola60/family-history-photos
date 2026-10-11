import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, Calendar, MapPin, Users, AlertCircle, Folder, Image as ImageIcon, FolderCheck, Undo2 } from 'lucide-react';
import { detectFacesInImage } from '../lib/faceEngine';

export default function PhotoCard({ 
  photo, 
  onOpenMetadata, 
  onOpenEnhancer, 
  onRestorePhoto,
  onFacesDetected,
  onDimensionsDetected 
}) {
  const [imgSrc, setImgSrc] = useState(photo.enhancedUrl || photo.objectUrl || null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let active = true;

    if (photo.enhancedUrl) {
      setImgSrc(photo.enhancedUrl);
      setImgFailed(false);
      return;
    }

    if (photo.objectUrl && !photo.objectUrl.startsWith('blob:null')) {
      setImgSrc(photo.objectUrl);
      setImgFailed(false);
      return;
    }

    // Lazy load from handle if available
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      photo.handle.getFile().then((file) => {
        if (active) {
          const url = URL.createObjectURL(file);
          photo.objectUrl = url;
          setImgSrc(url);
          setImgFailed(false);
        }
      }).catch(() => {
        if (active) setImgFailed(true);
      });
    } else {
      setImgFailed(true);
    }

    return () => {
      active = false;
    };
  }, [photo.id, photo.enhancedUrl, photo.objectUrl, photo.handle]);

  const handleImageLoaded = (imgEl) => {
    if ((!photo.width || !photo.height) && imgEl.naturalWidth > 0 && onDimensionsDetected) {
      onDimensionsDetected(photo.id, imgEl.naturalWidth, imgEl.naturalHeight);
    }

    // Auto-detect faces or re-validate existing detections with the cascade detector
    if (!photo.noPeople && !photo.facesCascadeVerified && imgEl.naturalWidth > 20) {
      detectFacesInImage(imgEl).then(faces => {
        const curCount = (photo.faces || []).length;
        const newCount = (faces || []).length;
        if (onFacesDetected && (!photo.facesScanned || curCount !== newCount || curCount > 1)) {
          onFacesDetected(photo.id, faces || [], true);
        }
      }).catch(() => {
        if (onFacesDetected && !photo.facesScanned) onFacesDetected(photo.id, [], true);
      });
    }
  };

  const isLowRes = !photo.enhanced && !photo.enhancedUrl && (
    (photo.width > 0 && (photo.width < 800 || (photo.height > 0 && photo.height < 800))) ||
    (photo.size && photo.size < 75 * 1024)
  );
  const hasDetectedFaces = !photo.noPeople && photo.faces && photo.faces.length > 0;
  const isTagged = (photo.people && photo.people.length > 0) || photo.relationship || photo.story;
  const folderPath = photo.relativePath && photo.relativePath.includes('/') 
    ? photo.relativePath.substring(0, photo.relativePath.lastIndexOf('/')) 
    : '';

  return (
    <div className={`photo-card ${photo.isMarkedDuplicate ? 'photo-card-duplicate' : ''}`}>
      <div className="photo-card-media-wrapper" onClick={() => onOpenMetadata(photo)}>
        {imgSrc && !imgFailed ? (
          <img 
            src={imgSrc} 
            alt={photo.name} 
            className="photo-card-img"
            loading="lazy"
            onLoad={(e) => handleImageLoaded(e.target)}
            onError={() => setImgFailed(true)} 
          />
        ) : (
          <div className="photo-card-placeholder">
            <ImageIcon size={38} className="placeholder-icon" />
            <span className="placeholder-filename">{photo.name}</span>
            <span className="placeholder-sub">
              {photo.width > 0 ? `${photo.width}×${photo.height}` : 'Photo Preview'}
            </span>
          </div>
        )}
        
        {/* Quality / Resolution Badge */}
        <div className="card-top-badges">
          {photo.isMarkedDuplicate && (
            <span className="badge badge-warning" title="In _Duplicates_Review folder">
              <FolderCheck size={12} /> In Review
            </span>
          )}

          {photo.enhancedUrl && (
            <span className="badge badge-success">
              <Sparkles size={12} /> 4K Restored
            </span>
          )}

          {hasDetectedFaces && (
            <span 
              className="badge badge-neutral" 
              style={{ backgroundColor: 'rgba(4, 120, 87, 0.88)', color: '#fff', border: 'none' }} 
              title={`${photo.faces.length} person/people recognized in photo`}
            >
              <Users size={12} /> {photo.faces.length === 1 ? '1 Person' : `${photo.faces.length} People`}
            </span>
          )}

          {isLowRes && !photo.enhancedUrl && (
            <span className="badge badge-warning" title="Vintage / small resolution photo. Ready for 4K restoration!">
              <Sparkles size={12} /> Low-Res ({photo.width > 0 ? `${photo.width}×${photo.height}` : `${Math.round((photo.size || 0)/1024)} KB`})
            </span>
          )}

          {!isLowRes && !photo.enhancedUrl && photo.width > 0 && (
            <span className="badge badge-neutral">
              {photo.width}×{photo.height}
            </span>
          )}

          {photo.decade && (
            <span className="badge badge-decade">
              <Calendar size={12} /> {photo.decade}
            </span>
          )}
        </div>

        {/* Untagged indicator */}
        {!isTagged && (
          <div className="untagged-banner">
            <Tag size={13} />
            <span>{hasDetectedFaces ? '👤 People recognized! Click to name' : 'Click to add names & memories'}</span>
          </div>
        )}
      </div>

      <div className="photo-card-content">
        {folderPath && (
          <div className="photo-subfolder-badge" title={`Located in subfolder: ${folderPath}`}>
            <Folder size={12} />
            <span>{folderPath}</span>
          </div>
        )}
        <h4 className="photo-card-title" title={photo.name}>
          {photo.name}
        </h4>

        {/* Tagged people list */}
        {photo.people && photo.people.length > 0 ? (
          <div className="people-pills">
            {photo.people.map((p, idx) => {
              const rel = photo.personRelationships?.[p];
              return (
                <span key={idx} className="person-pill" title={rel ? `${p} (${rel})` : p}>
                  <Users size={12} />
                  <span>{p}</span>
                  {rel && <span style={{ opacity: 0.8, fontSize: '11px', marginLeft: '3px', fontWeight: '500' }}>({rel})</span>}
                </span>
              );
            })}
          </div>
        ) : hasDetectedFaces ? (
          <div className="people-pills">
            <span className="person-pill" style={{ backgroundColor: 'rgba(4, 120, 87, 0.12)', color: '#047857' }}>
              <Users size={12} />
              <span>{photo.faces.length === 1 ? '1 Person Detected' : `${photo.faces.length} People Detected`}</span>
            </span>
          </div>
        ) : null}

        {/* Relationship or branch */}
        {(photo.relationship || photo.familyBranch) && (
          <div className="photo-meta-subrow">
            {photo.relationship && <span className="relationship-tag">{photo.relationship}</span>}
            {photo.familyBranch && <span className="branch-tag">{photo.familyBranch}</span>}
          </div>
        )}

        {/* Memory story snippet */}
        {photo.story ? (
          <p className="photo-card-story" title={photo.story}>
            "{photo.story}"
          </p>
        ) : null}

        {/* Location or date */}
        {photo.location ? (
          <div className="photo-location-row">
            <MapPin size={12} />
            <span>{photo.location}</span>
          </div>
        ) : null}

        {/* Card Actions Footer */}
        <div className="photo-card-actions">
          {photo.isMarkedDuplicate && onRestorePhoto ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestorePhoto(photo);
              }}
              className="btn btn-warning btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              title="Restore this photo back to your main album"
            >
              <Undo2 size={14} />
              <span>Restore to Library</span>
            </button>
          ) : (
            <>
              <button 
                onClick={() => onOpenMetadata(photo)} 
                className="btn btn-tag-primary btn-sm"
                title="Add names, relationships, and memories"
              >
                <Tag size={15} />
                <span>{isTagged ? 'Edit Memories' : (hasDetectedFaces ? 'Name People' : 'Add Names')}</span>
              </button>

              <button 
                onClick={() => onOpenEnhancer(photo)} 
                className={`btn ${isLowRes ? 'btn-enhance-highlight' : 'btn-secondary'} btn-sm`}
                style={isLowRes ? { 
                  fontWeight: '700',
                  boxShadow: '0 1px 3px rgba(194, 65, 12, 0.25)'
                } : {}}
                title="Restore vintage photo quality to 1080p or 4K"
              >
                <Sparkles size={15} className={isLowRes ? 'text-accent' : ''} />
                <span>{isLowRes ? 'Make 4K' : 'Restore'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

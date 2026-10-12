import React from 'react';
import { X, Users, Heart, Image as ImageIcon, Filter, FolderOpen, Sparkles } from 'lucide-react';

export default function PeopleDirectoryModal({
  peopleDirectory,
  photos = [],
  savedCatalog = [],
  pendingResumeSession = null,
  currentFolderName = '',
  onResumeAlbum = null,
  onClose,
  onSelectPersonFilter
}) {
  const peopleList = Object.values(peopleDirectory || {});
  const albumName = currentFolderName || pendingResumeSession?.info?.folderName || '';
  const isAlbumLoaded = Array.isArray(photos) && photos.length > 0;

  // Retrieve all tagged photos for a given person across both live memory and persisted database catalog
  const getTaggedPhotosForPerson = (name) => {
    if (!name) return [];
    const list = [];
    const seen = new Set();

    // 1. Live loaded photos in memory
    if (isAlbumLoaded) {
      photos.forEach(p => {
        if (p.people && Array.isArray(p.people) && p.people.includes(name)) {
          const key = p.relativePath || p.name || p.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            list.push(p);
          }
        }
      });
    }

    // 2. Saved photos in IndexedDB catalog
    if (Array.isArray(savedCatalog) && savedCatalog.length > 0) {
      savedCatalog.forEach(p => {
        if (p.people && Array.isArray(p.people) && p.people.includes(name)) {
          const key = p.relativePath || p.name || p.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            list.push(p);
          }
        }
      });
    }

    return list;
  };

  const handlePersonClick = (personName) => {
    if (onSelectPersonFilter) {
      onSelectPersonFilter(personName);
    }
  };

  return (
    <div className="modal-backdrop">
      <div 
        className="people-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#FFFFFF' }}>
          <div className="modal-header-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1C1917' }}>
                  Family Directory & Relatives ({peopleList.length})
                </h3>
                <p className="modal-subtitle" style={{ fontSize: '13px', color: '#57534E', margin: '2px 0 0 0' }}>
                  Everyone you have identified and labeled across your family albums
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="btn-icon-close" 
            title="Close Family Directory"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #E7DDD2', background: '#FFFFFF', cursor: 'pointer', color: '#57534E' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="people-modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#FAF7F2' }}>
          {/* Reconnect Helper Banner if album isn't currently open */}
          {!isAlbumLoaded && (
            <div style={{
              backgroundColor: '#FEF3C7',
              border: '1.5px solid #F59E0B',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={24} style={{ color: '#B45309', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#92400E' }}>
                    {albumName ? `Saved Album: "${albumName}"` : 'All 11 Family Members Preserved'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#78350F', marginTop: '2px', lineHeight: 1.4 }}>
                    {pendingResumeSession
                      ? `Click "Open Album & See Photos" on any relative to reconnect "${albumName}" and jump straight to their pictures.`
                      : 'All names, relationships, and face tags are safely preserved in your private database.'}
                  </div>
                </div>
              </div>

              {pendingResumeSession && onResumeAlbum && (
                <button
                  type="button"
                  onClick={() => {
                    onResumeAlbum();
                    onClose();
                  }}
                  className="btn btn-primary btn-sm"
                  style={{
                    backgroundColor: '#D97706',
                    borderColor: '#B45309',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FolderOpen size={16} />
                  <span>Reconnect "{albumName}"</span>
                </button>
              )}
            </div>
          )}

          {peopleList.length === 0 ? (
            <div className="empty-people-state" style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E7DDD2' }}>
              <Users size={48} style={{ color: '#A8A29E', margin: '0 auto 12px auto' }} />
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#1C1917', margin: '0 0 6px 0' }}>No family members tagged yet</h4>
              <p style={{ fontSize: '14px', color: '#57534E', margin: 0 }}>Click on any photo in your album to name relatives and record stories!</p>
            </div>
          ) : (
            <div className="people-grid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {peopleList.map((person) => {
                const taggedPhotos = getTaggedPhotosForPerson(person.name);
                // True count from photos or saved database catalog
                const count = taggedPhotos.length || person.photoCount || (person.photos ? person.photos.length : 1);
                
                // Avatar fallback
                const samplePhoto = taggedPhotos[0] || (isAlbumLoaded ? photos.find(p => p.people && p.people.includes(person.name)) : null);
                const avatar = person.avatarUrl || (samplePhoto ? (samplePhoto.enhancedUrl || samplePhoto.objectUrl) : null);

                // Photo names list preview
                const photoNames = taggedPhotos.map(p => p.name || p.relativePath).filter(Boolean);

                return (
                  <div 
                    key={person.id || person.name} 
                    className="person-directory-card"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1.5px solid #E7DDD2',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 2px 4px rgba(28, 25, 23, 0.05)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div className="person-avatar-wrap" style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: '#FAF6F0', border: '2px solid #E7DDD2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avatar ? (
                          <img src={avatar} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontSize: '22px', fontWeight: 700, color: '#B45309' }}>
                            {person.name ? person.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                      </div>

                      <div className="person-card-info" style={{ flex: 1, minWidth: 0 }}>
                        <h4 className="person-name" style={{ fontSize: '18px', fontWeight: 700, color: '#1C1917', margin: '0 0 4px 0' }}>
                          {person.name}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          {person.relationship && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                              <Heart size={12} /> {person.relationship}
                            </span>
                          )}
                          {person.branch && (
                            <span style={{ fontSize: '12px', color: '#57534E', backgroundColor: '#F5EFEB', padding: '3px 8px', borderRadius: '6px' }}>
                              {person.branch}
                            </span>
                          )}
                        </div>

                        <p className="person-photo-count" style={{ fontSize: '13px', fontWeight: 600, color: '#047857', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <ImageIcon size={14} />
                          <span>Appears in {count} {count === 1 ? 'photo' : 'photos'}</span>
                          {albumName && <span style={{ color: '#78716C', fontWeight: 400 }}>in {albumName}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Photo filenames preview if available */}
                    {photoNames.length > 0 && (
                      <div style={{ backgroundColor: '#FAF6F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#57534E' }}>
                        <div style={{ fontWeight: 600, color: '#78716C', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase' }}>Tagged Photos:</div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {photoNames.slice(0, 3).join(', ')}
                          {photoNames.length > 3 ? ` + ${photoNames.length - 3} more` : ''}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handlePersonClick(person.name)}
                      className="btn btn-primary btn-sm"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '14px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: isAlbumLoaded ? '#B45309' : (pendingResumeSession ? '#D97706' : '#57534E'),
                        borderColor: isAlbumLoaded ? '#92400E' : (pendingResumeSession ? '#B45309' : '#44403C'),
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      title={`View photos of ${person.name}`}
                    >
                      {isAlbumLoaded ? (
                        <>
                          <Filter size={15} />
                          <span>See Photos of {person.name} ({count})</span>
                        </>
                      ) : pendingResumeSession ? (
                        <>
                          <FolderOpen size={15} />
                          <span>Open Album & See Photos ({count})</span>
                        </>
                      ) : (
                        <>
                          <Filter size={15} />
                          <span>Filter When Folder Opens ({count})</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary"
            style={{ fontWeight: 600, padding: '10px 22px' }}
          >
            Close Directory
          </button>
        </div>

      </div>
    </div>
  );
}

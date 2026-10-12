import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Heart, 
  Image as ImageIcon, 
  Filter, 
  FolderOpen, 
  Sparkles, 
  Calendar, 
  MapPin, 
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function PeopleDirectoryModal({
  peopleDirectory,
  photos = [],
  savedCatalog = [],
  pendingResumeSession = null,
  currentFolderName = '',
  savedFolderHandles = {},
  onResumeAlbum = null,
  onOpenFolderByName = null,
  onClose,
  onSelectPersonFilter
}) {
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState(null);
  const [expandedPersonId, setExpandedPersonId] = useState(null);

  const peopleList = Object.values(peopleDirectory || {});
  const activeAlbumName = currentFolderName || '';
  const isAlbumLoaded = Array.isArray(photos) && photos.length > 0;

  // Retrieve all tagged photos for a person across both active album and saved database catalog
  const getTaggedPhotosForPerson = (name) => {
    if (!name) return [];
    const map = new Map();

    // 1. Live loaded photos in memory
    if (isAlbumLoaded) {
      photos.forEach(p => {
        if (p.people && Array.isArray(p.people) && p.people.includes(name)) {
          const key = (p.folderName ? p.folderName + '/' : '') + (p.relativePath || p.name || p.id);
          map.set(key, {
            ...p,
            folderName: p.folderName || activeAlbumName || 'Current Album'
          });
        }
      });
    }

    // 2. Saved photos in IndexedDB catalog
    if (Array.isArray(savedCatalog) && savedCatalog.length > 0) {
      savedCatalog.forEach(p => {
        if (p.people && Array.isArray(p.people) && p.people.includes(name)) {
          const key = (p.folderName ? p.folderName + '/' : '') + (p.relativePath || p.name || p.id);
          if (!map.has(key)) {
            map.set(key, {
              ...p,
              folderName: p.folderName || (activeAlbumName ? activeAlbumName : 'Saved Album')
            });
          }
        }
      });
    }

    return Array.from(map.values());
  };

  // Group a person's photos by folder
  const getPhotosByFolder = (taggedPhotos) => {
    const groups = {};
    taggedPhotos.forEach(p => {
      const fName = p.folderName || activeAlbumName || pendingResumeSession?.info?.folderName || 'Family Album';
      if (!groups[fName]) {
        groups[fName] = [];
      }
      groups[fName].push(p);
    });
    return groups;
  };

  const handleOpenFolder = (fName, personName) => {
    if (onOpenFolderByName) {
      onOpenFolderByName(fName, personName);
    } else if (onSelectPersonFilter) {
      onSelectPersonFilter(personName);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="people-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '860px', 
          width: '94%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}
      >
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #E7DDD2', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1C1917' }}>
                Family Directory & Relatives ({peopleList.length})
              </h3>
              <p style={{ fontSize: '13px', color: '#57534E', margin: '2px 0 0 0' }}>
                All family members you have tagged and organized across your albums
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            title="Close Family Directory"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #E7DDD2', background: '#FAF7F2', cursor: 'pointer', color: '#57534E' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="people-modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#FAF7F2' }}>
          
          {/* Informational Guidance Banner */}
          <div style={{
            backgroundColor: '#FEF3C7',
            border: '1.5px solid #F59E0B',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Sparkles size={22} style={{ color: '#B45309', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.4 }}>
              <strong>All 11 Family Members Preserved:</strong> Each person below shows the exact folders where their photos are stored. Click any folder button to immediately open that album and view their pictures.
            </div>
          </div>

          {peopleList.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E7DDD2' }}>
              <Users size={48} style={{ color: '#A8A29E', margin: '0 auto 12px auto' }} />
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#1C1917', margin: '0 0 6px 0' }}>No family members tagged yet</h4>
              <p style={{ fontSize: '14px', color: '#57534E', margin: 0 }}>Click on any photo in your album to name relatives and record stories!</p>
            </div>
          ) : (
            <div className="people-grid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
              {peopleList.map((person) => {
                const taggedPhotos = getTaggedPhotosForPerson(person.name);
                const count = taggedPhotos.length || person.photoCount || 1;
                const folderGroups = getPhotosByFolder(taggedPhotos);
                const folderNames = Object.keys(folderGroups);
                const isExpanded = expandedPersonId === (person.id || person.name);

                // Sample avatar from first photo with a thumbnail/image
                const photoWithImg = taggedPhotos.find(p => p.thumbnailUrl || p.enhancedUrl || p.objectUrl);
                const avatar = person.avatarUrl || (photoWithImg ? (photoWithImg.thumbnailUrl || photoWithImg.enhancedUrl || photoWithImg.objectUrl) : null);

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
                      gap: '14px',
                      boxSizing: 'border-box',
                      minWidth: 0,
                      width: '100%',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(28, 25, 23, 0.05)'
                    }}
                  >
                    {/* Top Identity Row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: 0, width: '100%' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: '#FEF3C7', border: '2px solid #E7DDD2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avatar ? (
                          <img src={avatar} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#B45309' }}>
                            {person.name ? person.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#1C1917', margin: '0 0 4px 0', wordBreak: 'break-word', lineHeight: 1.25 }}>
                          {person.name}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          {person.relationship && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                              <Heart size={12} /> {person.relationship}
                            </span>
                          )}
                          {person.branch && (
                            <span style={{ fontSize: '12px', color: '#57534E', backgroundColor: '#F5EFEB', padding: '3px 8px', borderRadius: '6px', fontWeight: 500 }}>
                              {person.branch}
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#047857', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <ImageIcon size={14} />
                          <span>Appears in {count} {count === 1 ? 'photo' : 'photos'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Folders List & Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, width: '100%' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Albums & Folders ({folderNames.length}):
                      </div>

                      {folderNames.map((fName) => {
                        const folderPhotos = folderGroups[fName] || [];
                        const isCurrent = isAlbumLoaded && (activeAlbumName === fName || activeAlbumName === '');

                        return (
                          <div 
                            key={fName} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              gap: '10px',
                              backgroundColor: '#FAF7F2',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #E7DDD2',
                              minWidth: 0,
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <FolderOpen size={16} style={{ color: '#B45309', flexShrink: 0 }} />
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {fName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#78716C' }}>
                                  {folderPhotos.length} {folderPhotos.length === 1 ? 'photo' : 'photos'}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleOpenFolder(fName, person.name);
                                onClose();
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                flexShrink: 0,
                                backgroundColor: isCurrent ? '#047857' : '#B45309',
                                color: '#FFFFFF',
                                whiteSpace: 'nowrap'
                              }}
                              title={`Open ${fName} to see photos of ${person.name}`}
                            >
                              {isCurrent ? (
                                <>
                                  <Filter size={13} />
                                  <span>View Photos ({folderPhotos.length})</span>
                                </>
                              ) : (
                                <>
                                  <FolderOpen size={13} />
                                  <span>Open Folder ({folderPhotos.length})</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tagged Photos Preview Strip */}
                    {taggedPhotos.length > 0 && (
                      <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedPersonId(isExpanded ? null : (person.id || person.name))}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px 0',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#B45309',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{isExpanded ? 'Hide Photo Details' : `Preview Photos & Stories (${taggedPhotos.length})`}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div style={{
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            backgroundColor: '#FAF7F2',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid #E7DDD2',
                            maxHeight: '180px',
                            overflowY: 'auto'
                          }}>
                            {taggedPhotos.map((p, idx) => (
                              <div
                                key={p.id || idx}
                                onClick={() => setSelectedPhotoForPreview(p)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: '6px',
                                  border: '1px solid #E7DDD2',
                                  cursor: 'pointer',
                                  minWidth: 0
                                }}
                                title="Click to view photo details"
                              >
                                {p.thumbnailUrl || p.enhancedUrl || p.objectUrl ? (
                                  <img 
                                    src={p.thumbnailUrl || p.enhancedUrl || p.objectUrl} 
                                    alt={p.name} 
                                    style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} 
                                  />
                                ) : (
                                  <div style={{ width: 32, height: 32, backgroundColor: '#F5EFEB', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#78716C' }}>
                                    <ImageIcon size={16} />
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#78716C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.date || p.decade || 'Date not recorded'} {p.story ? `• "${p.story.slice(0, 30)}..."` : ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E7DDD2', display: 'flex', justifyContent: 'flex-end' }}>
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

      {/* Inline Photo Details Viewer Popup */}
      {selectedPhotoForPreview && (
        <div 
          onClick={(e) => { e.stopPropagation(); setSelectedPhotoForPreview(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>Photo Details</h4>
              <button 
                type="button" 
                onClick={() => setSelectedPhotoForPreview(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#78716C' }}
              >
                <X size={20} />
              </button>
            </div>

            {(selectedPhotoForPreview.thumbnailUrl || selectedPhotoForPreview.enhancedUrl || selectedPhotoForPreview.objectUrl) && (
              <img 
                src={selectedPhotoForPreview.thumbnailUrl || selectedPhotoForPreview.enhancedUrl || selectedPhotoForPreview.objectUrl} 
                alt={selectedPhotoForPreview.name}
                style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', backgroundColor: '#FAF7F2' }}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#57534E' }}>
              <div><strong>File Name:</strong> {selectedPhotoForPreview.name}</div>
              <div><strong>Folder:</strong> {selectedPhotoForPreview.folderName || 'Family Album'}</div>
              {selectedPhotoForPreview.date && <div><strong>Date:</strong> {selectedPhotoForPreview.date}</div>}
              {selectedPhotoForPreview.decade && <div><strong>Decade:</strong> {selectedPhotoForPreview.decade}</div>}
              {selectedPhotoForPreview.location && <div><strong>Location:</strong> {selectedPhotoForPreview.location}</div>}
              {selectedPhotoForPreview.familyBranch && <div><strong>Family Branch:</strong> {selectedPhotoForPreview.familyBranch}</div>}
              {selectedPhotoForPreview.people && (
                <div><strong>People in Photo:</strong> {selectedPhotoForPreview.people.join(', ')}</div>
              )}
              {selectedPhotoForPreview.story && (
                <div style={{ marginTop: '6px', padding: '10px', backgroundColor: '#FAF7F2', borderRadius: '8px', border: '1px solid #E7DDD2' }}>
                  <strong>Memory / Story:</strong>
                  <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#1C1917' }}>"{selectedPhotoForPreview.story}"</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const fName = selectedPhotoForPreview.folderName;
                setSelectedPhotoForPreview(null);
                handleOpenFolder(fName, selectedPhotoForPreview.people?.[0]);
                onClose();
              }}
              style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#B45309',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FolderOpen size={16} />
              <span>Open Folder "{selectedPhotoForPreview.folderName || 'Family Album'}"</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

import React from 'react';
import { X, Users, Heart, Image as ImageIcon, Filter } from 'lucide-react';

export default function PeopleDirectoryModal({
  peopleDirectory,
  photos,
  onClose,
  onSelectPersonFilter
}) {
  const peopleList = Object.values(peopleDirectory || {});

  // Calculate photo count per person
  const getPhotoCountForPerson = (name) => {
    return photos.filter(p => p.people && p.people.includes(name)).length;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="people-modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title">Family Directory & Relations</h3>
            <p className="modal-subtitle">
              Everyone you have named across your photo albums
            </p>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="people-modal-body">
          {peopleList.length === 0 ? (
            <div className="empty-people-state">
              <Users size={48} className="text-muted" />
              <h4>No family members tagged yet</h4>
              <p>Click on any photo to start naming your family members and recording memories!</p>
            </div>
          ) : (
            <div className="people-grid-list">
              {peopleList.map((person) => {
                const count = getPhotoCountForPerson(person.name);
                // Find a sample photo of this person
                const samplePhoto = photos.find(p => p.people && p.people.includes(person.name));
                const avatar = person.avatarUrl || (samplePhoto ? (samplePhoto.enhancedUrl || samplePhoto.objectUrl) : null);

                return (
                  <div key={person.id || person.name} className="person-directory-card">
                    <div className="person-avatar-wrap">
                      {avatar ? (
                        <img src={avatar} alt={person.name} className="person-avatar-img" />
                      ) : (
                        <div className="person-avatar-fallback">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="person-card-info">
                      <h4 className="person-name">{person.name}</h4>
                      {person.relationship && (
                        <span className="person-relationship-pill">
                          <Heart size={12} /> {person.relationship}
                        </span>
                      )}
                      {person.branch && (
                        <p className="person-branch-text">{person.branch}</p>
                      )}
                      <p className="person-photo-count">
                        <ImageIcon size={13} /> Appears in {count} {count === 1 ? 'photo' : 'photos'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onSelectPersonPerson(person.name);
                        onClose();
                      }}
                      className="btn btn-secondary btn-sm btn-filter-person"
                      title={`View all photos with ${person.name}`}
                    >
                      <Filter size={14} /> See Photos
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Close Directory
          </button>
        </div>

      </div>
    </div>
  );

  function onSelectPersonPerson(name) {
    if (onSelectPersonFilter) {
      onSelectPersonFilter(name);
    }
  }
}

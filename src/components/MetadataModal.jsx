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
  UserX
} from 'lucide-react';
import { detectFacesInImage, extractFaceEmbedding, findMatchingPerson } from '../lib/faceEngine';

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
  'Mother',
  'Father',
  'Sister',
  'Brother',
  'Grandmother',
  'Grandfather',
  'Great-Grandmother',
  'Great-Grandfather',
  'Aunt',
  'Uncle',
  'Niece / Nephew',
  'Cousin',
  'Son-in-Law / Daughter-in-Law',
  'In-Law (Brother / Sister)',
  'In-Law (Parent)',
  'Close Family Friend',
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
  onOpenEnhancer
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
  
  // Face detection states
  const [detectedFaces, setDetectedFaces] = useState(photo.faces || []);
  const [isScanningFaces, setIsScanningFaces] = useState(false);
  const [faceSuggestion, setFaceSuggestion] = useState(null);
  const imgRef = useRef(null);

  // Sync state when photo changes (e.g. Next/Prev button)
  useEffect(() => {
    setPeople(photo.people || []);
    setCurrentNameInput('');
    setRelationship(photo.relationship || '');
    setDecade(photo.decade || '');
    setDate(photo.date || '');
    setStory(photo.story || '');
    setLocation(photo.location || '');
    setFamilyBranch(photo.familyBranch || '');
    setDetectedFaces(photo.faces || []);
    setFaceSuggestion(null);

    // Initialize person-specific relationships
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
  }, [photo, peopleDirectory]);

  // Run strict face scan when image loads & auto-clean past false detections
  const handleImageLoad = async () => {
    if (!imgRef.current) return;
    
    // If user already marked this photo as having no people, honor that
    if (photo.noPeople) {
      setDetectedFaces([]);
      return;
    }

    setIsScanningFaces(true);
    try {
      const faces = await detectFacesInImage(imgRef.current);
      setDetectedFaces(faces || []);

      // If photo had old false detections (e.g. 6 boxes) or count changed, auto-save clean detections!
      const oldFacesCount = (photo.faces || []).length;
      const newFacesCount = (faces || []).length;
      if (oldFacesCount !== newFacesCount || !photo.facesCascadeVerified) {
        onSave(photo.id, { faces: faces || [], facesCascadeVerified: true });
      }

      // Check if any genuine face matches registered people
      if (faces && faces.length > 0) {
        for (const face of faces) {
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
        return { ...f, name };
      }
      return f;
    }));
    if (name && !people.includes(name)) {
      setPeople(prev => [...prev, name]);
    }
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
      handleAddPerson(faceSuggestion.match.name);
      if (faceSuggestion.match.relationship) {
        handleSetPersonRelationship(faceSuggestion.match.name, faceSuggestion.match.relationship);
      }
      setFaceSuggestion(null);
    }
  };

  const handleSave = () => {
    onSave(photo.id, {
      people,
      relationship,
      personRelationships,
      decade,
      date,
      story,
      location,
      familyBranch,
      faces: detectedFaces
    });

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

    onClose();
  };

  // Known family member list for quick click tags
  const knownPeople = peopleDirectory ? Object.values(peopleDirectory).map(p => p.name) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="metadata-modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title">Family History & Memories</h3>
            <p className="modal-subtitle">{photo.name}</p>
          </div>

          <div className="modal-header-actions">
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

            <button onClick={onClose} className="btn-icon-close" title="Close dialog">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Photo, Right Form */}
        <div className="metadata-modal-body">
          
          {/* Photo Display Column */}
          <div className="modal-photo-column">
            <div className="photo-display-container">
              <img
                ref={imgRef}
                src={photo.enhancedUrl || photo.objectUrl}
                alt={photo.name}
                className="modal-photo-img"
                onLoad={handleImageLoad}
              />

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
                    {people.length > 0 ? (
                      <select
                        value={f.name || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleAssignFaceName(idx, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          background: '#1c1917',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.6)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '2px 4px',
                          cursor: 'pointer',
                          pointerEvents: 'auto'
                        }}
                        title="Click to assign which family member this face is"
                      >
                        <option value="">{f.name ? `✓ ${f.name}` : `Person ${idx + 1} (Click to Assign...)`}</option>
                        {people.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{f.name || `Person ${idx + 1}`}</span>
                    )}
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
                <button
                  type="button"
                  onClick={() => onOpenEnhancer(photo)}
                  className="btn btn-warning btn-sm"
                  style={{ fontWeight: '700', flexShrink: 0 }}
                  title="Open 4K Photo Restorer"
                >
                  <Sparkles size={14} />
                  <span>{photo.enhancedUrl ? 'Re-Enhance / Add Pass' : 'Make 4K'}</span>
                </button>
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
                <button onClick={handleAcceptSuggestion} className="btn btn-primary btn-sm">
                  <Check size={14} /> Yes, that's {faceSuggestion.match.name}
                </button>
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
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="modal-form-column">
            
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
                          onChange={(e) => handleSetPersonRelationship(p, e.target.value)}
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
                          {COMMON_RELATIONSHIPS.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
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
                  onChange={(e) => setRelationship(e.target.value)}
                >
                  <option value="">Select group category or leave blank...</option>
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
                  <option value="Solo Portrait">Solo Portrait</option>
                  <option value="Friends & Social">Friends & Social</option>
                  {COMMON_RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
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
              <label className="form-label">
                <BookOpen size={16} />
                <span>Family Story & Memories</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="What do you remember about this day? Any funny memories, who was visiting, or what was happening?"
              />
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {onMoveToReview ? (
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
              <span>Move Photo to Review</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-10">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary btn-save">
              <Check size={18} />
              <span>Save Memories & Close</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  CloudUpload, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  ExternalLink, 
  X, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  Loader2,
  Check,
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';
import { 
  startFamilySearchLogin, 
  clearFamilySearchToken, 
  getFamilySearchCurrentUser,
  getFamilySearchConfig,
  setStoredRedirectUriOverride
} from '../lib/familySearchAuth';
import { 
  uploadPhotoToFamilySearchMemories, 
  searchFamilySearchPersons, 
  attachPersonTagsToMemory,
  KNOWN_SEEDS,
  resolvePersonMapping
} from '../lib/familySearchMemories';
import { getFamilySearchPersonMappings, saveFamilySearchPersonMapping } from '../lib/db';
import { generateFamilySearchFilename } from '../lib/photoMetadata';

export default function FamilySearchModal({
  photo,
  metadata,
  isOpen,
  onClose
}) {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [personMappings, setPersonMappings] = useState({});
  const [activeSearchPerson, setActiveSearchPerson] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | tagging | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadedResult, setUploadedResult] = useState(null);
  const [taggingSummary, setTaggingSummary] = useState([]);
  const [activeRedirectUri, setActiveRedirectUri] = useState(() => getFamilySearchConfig().redirectUri);
  const [showPolicyGuidelines, setShowPolicyGuidelines] = useState(false);

  // Initialize data on modal open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setAuthChecking(true);
    setUploadStatus('idle');
    setStatusMessage('');
    setUploadedResult(null);
    setTaggingSummary([]);
    setActiveSearchPerson(null);
    setSearchResults([]);
    setActiveRedirectUri(getFamilySearchConfig().redirectUri);

    // 1. Load saved Person ID mappings
    getFamilySearchPersonMappings().then(saved => {
      if (active) {
        setPersonMappings({ ...KNOWN_SEEDS, ...(saved || {}) });
      }
    });

    // 2. Check login state
    const token = getStoredFamilySearchToken();
    if (!token) {
      setUser(null);
      setAuthChecking(false);
      return;
    }

    getFamilySearchCurrentUser().then(u => {
      if (active) {
        setUser(u);
        setAuthChecking(false);
        // Automatically link user if treePersonId is present
        if (u?.treePersonId) {
          setPersonMappings(prev => ({
            ...prev,
            'Jeff Viola': prev['Jeff Viola'] || { id: u.treePersonId, name: u.contactName || 'Myself' },
            'Jeffrey Alan Viola': prev['Jeffrey Alan Viola'] || { id: u.treePersonId, name: u.contactName || 'Myself' }
          }));
        }
      }
    }).catch(() => {
      if (active) {
        setUser(null);
        setAuthChecking(false);
      }
    });

    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const targetFilename = generateFamilySearchFilename(photo, metadata);
  // Combine people and faces
  const peopleList = metadata?.people || [];
  const facesList = metadata?.faces || [];
  const allPeopleNames = Array.from(new Set([
    ...peopleList,
    ...facesList.map(f => f.name).filter(Boolean)
  ]));

  const handleLogin = async () => {
    try {
      await startFamilySearchLogin(activeRedirectUri);
    } catch (err) {
      alert(err.message || 'Could not start FamilySearch login');
    }
  };

  const handleLogout = () => {
    clearFamilySearchToken();
    setUser(null);
    setActiveSearchPerson(null);
    setSearchResults([]);
  };

  const startPersonSearch = (name) => {
    setActiveSearchPerson(name);
    setSearchQuery(name);
    setSearchResults([]);
    // Immediately run search
    searchFamilySearchPersons(name).then(setSearchResults).catch(() => {});
  };

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchFamilySearchPersons(searchQuery);
      setSearchResults(results);
    } catch (err) {
      alert(err.message || 'Failed to search Family Tree');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkPerson = (personName, fsPerson) => {
    const updated = {
      ...personMappings,
      [personName]: {
        id: fsPerson.id?.trim().toUpperCase(),
        name: fsPerson.name || personName,
        lifespan: fsPerson.lifespan || ''
      }
    };
    setPersonMappings(updated);
    saveFamilySearchPersonMapping(personName, fsPerson);
    setActiveSearchPerson(null);
    setSearchResults([]);
  };

  const handleUnlinkPerson = (personName) => {
    const updated = { ...personMappings };
    delete updated[personName];
    setPersonMappings(updated);
    saveFamilySearchPersonMapping(personName, null);
  };

  const handleUploadAndAttach = async () => {
    try {
      setUploadStatus('uploading');
      setStatusMessage(`Preparing "${targetFilename}"...`);

      // 1. Resolve image blob
      let blob = null;
      if (photo.enhancedUrl && photo.enhancedUrl.startsWith('data:')) {
        const res = await fetch(photo.enhancedUrl);
        blob = await res.blob();
      } else if (photo.handle && typeof photo.handle.getFile === 'function') {
        const file = await photo.handle.getFile();
        blob = file;
      } else if (photo.objectUrl) {
        const res = await fetch(photo.objectUrl);
        blob = await res.blob();
      }

      if (!blob) {
        throw new Error('Unable to read photo file data from disk or cache.');
      }

      // Determine primary matched Tree person (e.g. Jeff Viola) to attach directly upon upload
      const primaryMapping = allPeopleNames.length > 0 ? resolvePersonMapping(allPeopleNames[0], personMappings) : null;
      const primaryPersonId = primaryMapping ? primaryMapping.id : null;

      // 2. Upload image to FamilySearch Memories (directly attaching to primary person if known)
      const res = await uploadPhotoToFamilySearchMemories(
        photo,
        metadata,
        blob,
        ({ message }) => setStatusMessage(message),
        primaryPersonId
      );

      // 3. Automatically construct Face Tags and Family Tree attachments
      const tagsToAttach = [];
      const usedFaces = new Set();

      // First pass: Match people to face boxes
      for (const name of allPeopleNames) {
        let matchingFace = facesList.find((f, idx) => f.name === name && !usedFaces.has(idx));
        if (matchingFace) {
          const idx = facesList.indexOf(matchingFace);
          usedFaces.add(idx);
        } else {
          // If no face box was explicitly labeled with this person's name,
          // assign the next available detected face box so a visual bounding box is sent!
          const unassignedIdx = facesList.findIndex((f, idx) => (!f.name || f.name.startsWith('Person ')) && !usedFaces.has(idx));
          if (unassignedIdx !== -1) {
            matchingFace = facesList[unassignedIdx];
            usedFaces.add(unassignedIdx);
          }
        }
        const mapped = resolvePersonMapping(name, personMappings);
        tagsToAttach.push({
          name,
          faceBox: matchingFace ? matchingFace.box : null,
          treePersonId: mapped ? mapped.id : null
        });
      }

      // Second pass: Any unnamed face boxes
      facesList.forEach((face, idx) => {
        if (!usedFaces.has(idx) && face.box) {
          const mapped = face.name ? resolvePersonMapping(face.name, personMappings) : null;
          tagsToAttach.push({
            name: face.name || `Person ${idx + 1}`,
            faceBox: face.box,
            treePersonId: mapped ? mapped.id : null
          });
        }
      });

      // 4. Batch submit tags to FamilySearch
      if (tagsToAttach.length > 0 && res.memoryId) {
        setUploadStatus('tagging');
        setStatusMessage(`Creating ${tagsToAttach.length} face tags on FamilySearch...`);
        const tagResults = await attachPersonTagsToMemory(
          res.memoryId, 
          tagsToAttach, 
          ({ message }) => setStatusMessage(message)
        );
        setTaggingSummary(tagResults);

        const hasTagErrors = tagResults.some(t => !t.success);
        setUploadStatus('success');
        setUploadedResult(res);
        if (hasTagErrors) {
          setStatusMessage('Photo uploaded to FamilySearch, but some tags could not be attached.');
        } else {
          setStatusMessage('✓ Successfully sent and tagged on FamilySearch Memories!');
        }
      } else {
        setUploadStatus('success');
        setUploadedResult(res);
        setStatusMessage('✓ Successfully uploaded to FamilySearch Memories!');
      }
    } catch (err) {
      console.error('FamilySearch upload error:', err);
      setUploadStatus('error');
      setStatusMessage(err.message || 'Upload failed. Please check your connection and try again.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050 }}>
      <div 
        className="metadata-modal-dialog" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CloudUpload className="text-primary" size={22} />
              <span>Send to FamilySearch Memories</span>
            </h3>
            <p className="modal-subtitle">
              Target file: <strong>{targetFilename}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Authentication State Card */}
          {authChecking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: '#f3f4f6', borderRadius: '10px' }}>
              <Loader2 className="animate-spin text-primary" size={20} />
              <span style={{ fontSize: '14px' }}>Connecting to FamilySearch...</span>
            </div>
          ) : !user ? (
            <div style={{
              padding: '18px 20px',
              backgroundColor: 'rgba(37, 99, 235, 0.05)',
              border: '1.5px solid rgba(37, 99, 235, 0.25)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LogIn className="text-primary" size={24} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Sign in with FamilySearch</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    Connect to your FamilySearch account (Beta Sandbox) to upload memories and link photos to relatives.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleLogin}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontWeight: '700', padding: '12px' }}
              >
                Sign In to FamilySearch
              </button>
              <div style={{ 
                fontSize: '11px', 
                color: 'var(--text-subtle)', 
                background: '#f8fafc', 
                padding: '10px 12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>OAuth Redirect URI:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeRedirectUri.endsWith('/') ? activeRedirectUri.slice(0, -1) : activeRedirectUri;
                        setActiveRedirectUri(target);
                        setStoredRedirectUriOverride(target);
                      }}
                      style={{ 
                        background: !activeRedirectUri.endsWith('/') ? '#2563eb' : '#e2e8f0', 
                        color: !activeRedirectUri.endsWith('/') ? '#ffffff' : '#334155',
                        border: 'none', 
                        borderRadius: '4px',
                        padding: '2px 8px',
                        cursor: 'pointer', 
                        fontWeight: 700,
                        fontSize: '11px'
                      }}
                      title="Set redirect URI without a trailing slash"
                    >
                      No Slash
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeRedirectUri.endsWith('/') ? activeRedirectUri : `${activeRedirectUri}/`;
                        setActiveRedirectUri(target);
                        setStoredRedirectUriOverride(target);
                      }}
                      style={{ 
                        background: activeRedirectUri.endsWith('/') ? '#2563eb' : '#e2e8f0', 
                        color: activeRedirectUri.endsWith('/') ? '#ffffff' : '#334155',
                        border: 'none', 
                        borderRadius: '4px',
                        padding: '2px 8px',
                        cursor: 'pointer', 
                        fontWeight: 700,
                        fontSize: '11px'
                      }}
                      title="Set redirect URI with a trailing slash"
                    >
                      With Slash (/)
                    </button>
                  </div>
                </div>
                <code style={{ wordBreak: 'break-all', display: 'block', background: '#e2e8f0', padding: '4px 6px', borderRadius: '4px', color: '#0f172a' }}>
                  {activeRedirectUri}
                </code>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>
                  Connected as: <strong>{user.contactName}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-xs"
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <LogOut size={12} /> Disconnect
              </button>
            </div>
          )}

          {/* FamilySearch Content & Photo Policies Checklist */}
          {user && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '12px'
            }}>
              <div 
                onClick={() => setShowPolicyGuidelines(!showPolicyGuidelines)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer', 
                  userSelect: 'none' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', color: '#1e293b' }}>
                  <ShieldAlert size={15} style={{ color: '#d97706' }} />
                  <span>FamilySearch Photo Guidelines & Content Rules</span>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{showPolicyGuidelines ? 'Hide Rules' : 'Review Rules'}</span>
                  {showPolicyGuidelines ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showPolicyGuidelines && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.55 }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: '600', color: '#0f172a' }}>
                    FamilySearch actively screens all uploaded photos. To prevent photos from being flagged or restricted:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>No Kissing:</strong> FamilySearch strictly prohibits photos showing people kissing or about to kiss on the mouth (even wedding or affectionate family photos).</li>
                    <li><strong>Modesty:</strong> Clothing must be modest, buttoned, and zipped. No immodesty or nudity.</li>
                    <li><strong>Reverence:</strong> Sacred religious rites, temple ceremonies, or sacred clothing must not be depicted irreverently.</li>
                    <li><strong>No Vulgarity:</strong> No offensive hand gestures, obscene words, or hate speech in images or notes.</li>
                    <li><strong>No Violence / Illegal Acts:</strong> No depiction of unlawful acts, illegal drugs, or graphic violence.</li>
                    <li><strong>Copyright & Commercial:</strong> No advertisements, commercial brand logos, or copyrighted studio portraits unless you own the rights.</li>
                    <li><strong>Living People Privacy:</strong> Living relatives are kept private to your account in FamilySearch to protect family privacy.</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Automatic Face Tagging & Person Mapping Section */}
          {user && uploadStatus !== 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={15} style={{ color: '#2563eb' }} />
                  <span>Auto Face Tags & Family Tree Links:</span>
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Tags and face boxes transfer automatically
                </span>
              </div>

              {allPeopleNames.length === 0 ? (
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No people tagged in this photo yet. You can still upload the photo to your general Memories Gallery.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {allPeopleNames.map(name => {
                    const hasFaceBox = facesList.some(f => f.name === name) || facesList.length > 0;
                    const mapped = resolvePersonMapping(name, personMappings);
                    const isSearchingThis = activeSearchPerson === name;

                    return (
                      <div 
                        key={name}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: mapped ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border)',
                          backgroundColor: mapped ? 'rgba(34, 197, 94, 0.04)' : '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '13px' }}>{name}</strong>
                            {hasFaceBox ? (
                              <span style={{ 
                                fontSize: '10.5px', 
                                background: '#fef3c7', 
                                color: '#b45309', 
                                border: '1px solid #fde68a', 
                                borderRadius: '4px', 
                                padding: '1px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <Sparkles size={10} /> Face Box Ready
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', color: 'var(--text-subtle)' }}>
                                (Text tag only)
                              </span>
                            )}
                          </div>

                          {/* Mapping badge or Link Button */}
                          {mapped ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                fontSize: '11.5px', 
                                color: '#15803d', 
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Check size={14} /> Tree: <strong>{mapped.name}</strong> <code>({mapped.id})</code>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUnlinkPerson(name)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                                title="Unlink"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startPersonSearch(name)}
                              className="btn btn-secondary btn-xs"
                              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Search size={12} /> Match in Tree...
                            </button>
                          )}
                        </div>

                        {/* Search / PID Input for this Person */}
                        {isSearchingThis && (
                          <div style={{
                            padding: '10px',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                className="form-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Enter Tree PID (e.g. BM6T-QXX) or name..."
                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                                autoFocus
                              />
                              <button 
                                type="submit" 
                                disabled={isSearching || !searchQuery.trim()} 
                                className="btn btn-secondary btn-xs"
                              >
                                {isSearching ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
                                <span>Search</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSearchPerson(null)}
                                className="btn btn-secondary btn-xs"
                              >
                                Cancel
                              </button>
                            </form>

                            {/* Search Results list */}
                            {searchResults.length > 0 && (
                              <div style={{
                                maxHeight: '180px',
                                overflowY: 'auto',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                background: '#ffffff',
                                display: 'flex',
                                flexDirection: 'column'
                              }}>
                                {searchResults.map(p => {
                                  const details = [
                                    p.birthDate ? `Born: ${p.birthDate}` : '',
                                    p.birthPlace ? p.birthPlace : '',
                                    p.deathDate ? `Died: ${p.deathDate}` : ''
                                  ].filter(Boolean).join(' • ');

                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => handleLinkPerson(name, p)}
                                      style={{
                                        padding: '7px 10px',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        fontSize: '11.5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                      title={`Link ${name} to ${p.name} (${p.id})`}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <strong style={{ color: '#0f172a' }}>{p.name}</strong>
                                          {p.lifespan && (
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                              ({p.lifespan})
                                            </span>
                                          )}
                                        </div>
                                        {details && (
                                          <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {details}
                                          </div>
                                        )}
                                      </div>
                                      <span style={{ fontSize: '10.5px', background: '#e2e8f0', color: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>
                                        {p.id}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {!isSearching && searchResults.length === 0 && searchQuery.trim() && (
                              <div style={{
                                padding: '10px 12px',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px dashed #cbd5e1',
                                fontSize: '11.5px',
                                color: '#475569',
                                lineHeight: 1.45
                              }}>
                                <strong style={{ color: '#1e293b', display: 'block', marginBottom: '3px' }}>
                                  No matches found in Family Tree for "{searchQuery}".
                                </strong>
                                <span>
                                  • If {name} is a <strong>living relative</strong> (like nieces or in-laws), living people in FamilySearch are kept private to your account and cannot be found via public search until you add them to your Tree on FamilySearch.<br/>
                                  • <strong>You can still proceed:</strong> {name} will be tagged by name directly on this photo in FamilySearch Memories even without a Tree link!
                                </span>
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
          )}

          {/* Success View */}
          {uploadStatus === 'success' && (
            <div style={{
              padding: '18px',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1.5px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '700', fontSize: '16px' }}>
                <CheckCircle size={22} />
                <span>Memory & Face Tags Successfully Created!</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.5 }}>
                Your photo and note details have been uploaded to FamilySearch Memories, and face tags have been linked directly to relatives in your Family Tree.
              </p>

              {taggingSummary.length > 0 && (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px', color: '#166534' }}>
                    Tagged People in FamilySearch:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {taggingSummary.map((t, idx) => (
                      <li key={idx} style={{ color: t.success ? '#15803d' : '#b91c1c' }}>
                        <strong>{t.name}</strong>
                        {t.treePersonId && <span> — Attached to Tree PID: <code>{t.treePersonId}</code></span>}
                        {t.success ? ' ✓' : ` (${t.error})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {uploadedResult?.memoryUrl && (
                  <a 
                    href={uploadedResult.memoryUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                  >
                    <span>View Memory on FamilySearch</span>
                    <ExternalLink size={14} />
                  </a>
                )}
                {uploadedResult?.galleryUrl && (
                  <a 
                    href={uploadedResult.galleryUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Open Memories Gallery</span>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadStatus === 'error' && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Upload Progress Status */}
          {(uploadStatus === 'uploading' || uploadStatus === 'tagging') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <Loader2 className="animate-spin text-primary" size={18} />
              <span style={{ fontSize: '13px', color: '#15803d', fontWeight: '600' }}>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#15803d' }}>
            <ShieldCheck size={14} />
            <span>FamilySearch Beta Integration</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {uploadStatus === 'success' ? 'Close' : 'Cancel'}
            </button>
            {uploadStatus !== 'success' && (
              <button
                type="button"
                onClick={handleUploadAndAttach}
                disabled={!user || uploadStatus === 'uploading' || uploadStatus === 'tagging'}
                className="btn btn-primary"
                style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CloudUpload size={16} />
                <span>Upload & Auto-Tag in FamilySearch</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { 
  Cloud, 
  UploadCloud, 
  FolderArchive, 
  FolderOpen, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  X, 
  Sparkles, 
  Download, 
  Key,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { 
  extractPhotosFromZip, 
  processImportedFiles, 
  launchOneDrivePicker, 
  launchGooglePicker,
  getMicrosoftClientId
} from '../lib/cloudStorage';

export default function CloudStorageModal({ isOpen, onClose, onImportPhotos }) {
  const [activeTab, setActiveTab] = useState('onedrive'); // 'onedrive' | 'google' | 'apple' | 'zip'
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successCount, setSuccessCount] = useState(null);

  // Google client id is entered by the user. OneDrive uses the build-time env var only.
  const oneDriveClientId = getMicrosoftClientId();
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  if (!isOpen) return null;

  const handleZipFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Reading files...');

    try {
      let allFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.zip')) {
          setStatusMessage(`Unpacking ZIP archive: ${file.name}...`);
          const extracted = await extractPhotosFromZip(file, (curr, total, name) => {
            setStatusMessage(`Unpacking ${file.name} (${curr}/${total}): ${name}`);
          });
          allFiles.push(...extracted);
        } else if (file.type.startsWith('image/')) {
          allFiles.push(file);
        }
      }

      if (allFiles.length === 0) {
        setErrorMessage('No image files were found in the selected file(s) or ZIP archive.');
        setIsProcessing(false);
        return;
      }

      setStatusMessage(`Processing ${allFiles.length} photos and reading metadata...`);
      const photoItems = await processImportedFiles(allFiles, (curr, total, name) => {
        setStatusMessage(`Analyzing photo ${curr}/${total}: ${name}`);
      });

      setSuccessCount(photoItems.length);
      setStatusMessage(`Successfully imported ${photoItems.length} photos!`);
      
      setTimeout(() => {
        onImportPhotos(photoItems, `Cloud Import (${activeTab.toUpperCase()})`);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error importing cloud photos:', err);
      setErrorMessage(`Failed to process photos: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLaunchOneDrive = () => {
    if (!oneDriveClientId) {
      setErrorMessage('OneDrive import is turned off. This app no longer includes a demo Microsoft client ID. Add your own VITE_MS_CLIENT_ID (see the OneDrive setup guide), or drop a downloaded ZIP below.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Opening Microsoft OneDrive Picker in a popup...');

    launchOneDrivePicker({
      clientId: oneDriveClientId,
      onFilesPicked: async (files) => {
        setStatusMessage(`Processing ${files.length} photos from OneDrive...`);
        try {
          const photoItems = await processImportedFiles(files, (curr, total, name) => {
            setStatusMessage(`Importing ${curr}/${total}: ${name}`);
          });
          setSuccessCount(photoItems.length);
          setTimeout(() => {
            onImportPhotos(photoItems, 'Microsoft OneDrive');
            onClose();
          }, 1200);
        } catch (err) {
          setErrorMessage(`Error importing OneDrive photos: ${err.message}`);
        } finally {
          setIsProcessing(false);
        }
      },
      onCancel: () => {
        setIsProcessing(false);
        setStatusMessage('');
      },
      onError: (err) => {
        setIsProcessing(false);
        setErrorMessage(
          err.message?.includes('popup') || err.message?.includes('blocked')
            ? 'Pop-up blocked. Please allow pop-ups for this site to log into OneDrive.'
            : `OneDrive connection note: If popup login is restricted, you can download your album as a ZIP or select your local OneDrive folder below. (${err.message || ''})`
        );
      }
    });
  };

  const handleLaunchGoogle = () => {
    if (!googleClientId.trim() || !googleApiKey.trim()) {
      setShowConfig(true);
      setErrorMessage('Please provide your Google API Key and Client ID to open Google Picker directly, or use the 1-click Google Photos Download & ZIP import below.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Connecting to Google Photos & Drive...');

    launchGooglePicker({
      apiKey: googleApiKey.trim(),
      clientId: googleClientId.trim(),
      onFilesPicked: async (files) => {
        setStatusMessage(`Processing ${files.length} Google photos...`);
        try {
          const photoItems = await processImportedFiles(files);
          setSuccessCount(photoItems.length);
          setTimeout(() => {
            onImportPhotos(photoItems, 'Google Photos');
            onClose();
          }, 1200);
        } catch (err) {
          setErrorMessage(`Error processing Google photos: ${err.message}`);
        } finally {
          setIsProcessing(false);
        }
      },
      onCancel: () => {
        setIsProcessing(false);
        setStatusMessage('');
      },
      onError: (err) => {
        setIsProcessing(false);
        setErrorMessage(`Google connection error: ${err.message || JSON.stringify(err)}`);
      }
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleZipFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="modal-backdrop">
      <div 
        className="cloud-modal-dialog" 
        style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7' }}>
              <Cloud size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>Connect & Import Cloud Photos</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#57534E' }}>
                Import photos from OneDrive, Google Photos, or Apple iCloud (even if not synced)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-icon-close"
            title="Close Cloud Import"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #E7DDD2', background: '#FFFFFF', cursor: 'pointer', color: '#57534E' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }}>
          {/* Cloud Provider Tabs */}
          <div className="cloud-tabs-nav">
            <button
              type="button"
              onClick={() => { setActiveTab('onedrive'); setErrorMessage(''); }}
              className={`cloud-tab-btn ${activeTab === 'onedrive' ? 'active' : ''}`}
            >
              <Cloud size={16} style={{ color: activeTab === 'onedrive' ? '#0284C7' : '#57534E' }} />
              <span>Microsoft OneDrive</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('google'); setErrorMessage(''); }}
              className={`cloud-tab-btn ${activeTab === 'google' ? 'active' : ''}`}
            >
              <Cloud size={16} style={{ color: activeTab === 'google' ? '#DC2626' : '#57534E' }} />
              <span>Google Photos / Drive</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('apple'); setErrorMessage(''); }}
              className={`cloud-tab-btn ${activeTab === 'apple' ? 'active' : ''}`}
            >
              <Cloud size={16} style={{ color: activeTab === 'apple' ? '#059669' : '#57534E' }} />
              <span>Apple iCloud</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('zip'); setErrorMessage(''); }}
              className={`cloud-tab-btn ${activeTab === 'zip' ? 'active' : ''}`}
            >
              <FolderArchive size={16} style={{ color: activeTab === 'zip' ? '#D97706' : '#57534E' }} />
              <span>Unpack Cloud ZIP</span>
            </button>
          </div>

          {/* Tab 1: Microsoft OneDrive */}
          {activeTab === 'onedrive' && (
            <div>
              <div className="cloud-info-box onedrive">
                <h4>
                  <Cloud size={18} />
                  <span>Pull from Microsoft OneDrive (Web)</span>
                </h4>
                <p>
                  Select pictures directly from your personal or family Microsoft OneDrive account without needing them downloaded beforehand.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!oneDriveClientId && (
                  <div style={{ padding: '12px 14px', backgroundColor: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '10px', color: '#9A3412', fontSize: '13px', lineHeight: 1.45 }}>
                    <strong>OneDrive import is off.</strong> There is no built-in Microsoft client ID. Add your own app id as <code>VITE_MS_CLIENT_ID</code> and rebuild. Until then, drop a OneDrive ZIP or photos below. Setup steps are in <code>docs/ONEDRIVE_SETUP.md</code>.
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLaunchOneDrive}
                  disabled={isProcessing || !oneDriveClientId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '14px 20px',
                    fontSize: '15px',
                    fontWeight: 600,
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: oneDriveClientId ? 'pointer' : 'not-allowed',
                    opacity: oneDriveClientId ? 1 : 0.55,
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0369A1'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0284C7'}
                >
                  <Cloud size={20} />
                  <span>Launch Microsoft OneDrive File Picker</span>
                </button>

                <div style={{ textAlign: 'center', color: '#78716C', fontSize: '12px', fontWeight: 600, margin: '6px 0' }}>
                  — OR IMPORT NON-SYNCED DOWNLOADS —
                </div>

                {/* Drag and Drop Zone */}
                <div 
                  className="cloud-dropzone"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => zipInputRef.current?.click()}
                >
                  <UploadCloud size={38} style={{ color: '#0284C7' }} />
                  <div className="cloud-dropzone-title">
                    Drop OneDrive Downloaded Photos or ZIP Here
                  </div>
                  <div className="cloud-dropzone-subtitle">
                    If you clicked "Download" on onedrive.live.com, drop that .zip or photos here to auto-unpack
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Google Photos & Drive */}
          {activeTab === 'google' && (
            <div>
              <div className="cloud-info-box google">
                <h4>
                  <Cloud size={18} />
                  <span>Pull from Google Photos & Google Drive</span>
                </h4>
                <p>
                  Google keeps your albums safe in the cloud. You can either drop an album download (.zip) or connect directly with Google Picker.
                </p>
              </div>

              {/* Quick 2-Step Guide */}
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E7DDD2', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1C1917', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} style={{ color: '#D97706' }} />
                  <span>Easiest Way: Download an Album from Google Photos</span>
                </div>
                <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: '12px', lineHeight: 1.6, color: '#374151' }}>
                  <li>
                    Open{' '}
                    <a href="https://photos.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'underline' }}>
                      Google Photos <ExternalLink size={11} style={{ display: 'inline' }} />
                    </a>{' '}
                    and select your family album.
                  </li>
                  <li>Click the three dots (⋮) in the top corner and choose <strong>"Download all"</strong> (gives a .zip).</li>
                  <li>Drop that .zip file directly into the box below!</li>
                </ol>
              </div>

              {/* Drag and drop ZIP */}
              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => zipInputRef.current?.click()}
                style={{ marginBottom: '16px' }}
              >
                <FolderArchive size={38} style={{ color: '#DC2626' }} />
                <div className="cloud-dropzone-title">
                  Drop Google Photos ZIP or Image Files Here
                </div>
                <div className="cloud-dropzone-subtitle">
                  Click to browse or drag & drop. Automatically extracts and reads embedded dates & people.
                </div>
              </div>

              {/* Optional Direct Google Picker */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#57534E' }}
                >
                  <Key size={13} />
                  <span>{showConfig ? 'Hide Direct Google Picker Settings' : 'Advanced: Connect with Google OAuth Client ID'}</span>
                </button>

                {showConfig && (
                  <div style={{ marginTop: '10px', padding: '14px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '12px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontWeight: 600, color: '#1C1917', marginBottom: '4px' }}>Google OAuth Client ID:</label>
                      <input 
                        type="text" 
                        value={googleClientId} 
                        onChange={(e) => setGoogleClientId(e.target.value)} 
                        placeholder="e.g. 12345-abc.apps.googleusercontent.com"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px', backgroundColor: '#FFFFFF', color: '#111827' }}
                      />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontWeight: 600, color: '#1C1917', marginBottom: '4px' }}>Google API Developer Key:</label>
                      <input 
                        type="text" 
                        value={googleApiKey} 
                        onChange={(e) => setGoogleApiKey(e.target.value)} 
                        placeholder="AIzaSy..."
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px', backgroundColor: '#FFFFFF', color: '#111827' }}
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleLaunchGoogle} 
                      className="btn btn-primary btn-sm"
                      disabled={isProcessing}
                    >
                      Open Google Picker
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Apple iCloud */}
          {activeTab === 'apple' && (
            <div>
              <div className="cloud-info-box apple">
                <h4>
                  <Cloud size={18} />
                  <span>Pull from Apple iCloud Photos</span>
                </h4>
                <p>
                  Apple restricts external websites from directly reading private iCloud accounts for security. Here is the easiest 1-minute way to pull them in:
                </p>
              </div>

              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E7DDD2', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#1C1917' }}>Step 1: Open your iCloud Photos</span>
                  <a 
                    href="https://www.icloud.com/photos" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-xs"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#047857', fontWeight: 600 }}
                  >
                    <ExternalLink size={13} />
                    <span>Open iCloud.com Photos</span>
                  </a>
                </div>
                <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  Select the photos you want, then click the <strong>Cloud Download icon</strong> at the top of the Apple screen. Apple will download them as <code>iCloud Photos.zip</code>.
                </p>

                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1C1917', marginTop: '12px', marginBottom: '4px' }}>Step 2: Drop the ZIP file here</div>
                <p style={{ fontSize: '12px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                  Drop the downloaded file right below. The app will unpack all images automatically without uploading anything to the internet.
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => zipInputRef.current?.click()}
              >
                <UploadCloud size={38} style={{ color: '#059669' }} />
                <div className="cloud-dropzone-title">
                  Drop <code>iCloud Photos.zip</code> or Photos Here
                </div>
                <div className="cloud-dropzone-subtitle">
                  Click to select file or drag & drop from your Downloads folder
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Universal Cloud ZIP Unpacker */}
          {activeTab === 'zip' && (
            <div>
              <div className="cloud-info-box zip">
                <h4>
                  <FolderArchive size={18} />
                  <span>Universal Cloud ZIP & Photo Unpacker</span>
                </h4>
                <p>
                  Works with ZIP archives downloaded from <strong>Google Takeout, OneDrive, iCloud, Dropbox, or Box</strong>. Automatically uncompresses directly on your computer.
                </p>
              </div>

              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => zipInputRef.current?.click()}
                style={{ padding: '36px 20px' }}
              >
                <FolderArchive size={42} style={{ color: '#D97706' }} />
                <div className="cloud-dropzone-title" style={{ fontSize: '16px' }}>
                  Click to Select or Drop Any Cloud ZIP File
                </div>
                <div className="cloud-dropzone-subtitle">
                  Supports .zip files containing JPEG, PNG, WEBP, and digitized family scans.
                </div>
              </div>
            </div>
          )}

          {/* Hidden File / ZIP Inputs */}
          <input 
            type="file" 
            ref={zipInputRef} 
            style={{ display: 'none' }} 
            accept=".zip,image/*" 
            multiple 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleZipFiles(Array.from(e.target.files));
              }
            }} 
          />

          {/* Status / Progress Banner */}
          {isProcessing && (
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2, borderColor: '#0284C7', borderTopColor: 'transparent' }}></div>
              <div style={{ fontSize: '13px', color: '#1E40AF', fontWeight: 600 }}>
                {statusMessage || 'Loading cloud photos...'}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successCount !== null && (
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Check size={20} style={{ color: '#16A34A' }} />
              <div style={{ fontSize: '13px', color: '#15803D', fontWeight: 700 }}>
                {statusMessage}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: '#991B1B', fontWeight: 500 }}>
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', backgroundColor: '#FAF7F2', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#57534E' }}>
            <ShieldCheck size={16} style={{ color: '#16A34A' }} />
            <span><strong>Privacy:</strong> Files you drop here are unpacked in this browser. OneDrive and Google only download pictures you pick. They are not uploaded to this app.</span>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 600, padding: '8px 18px', backgroundColor: '#FFFFFF', borderColor: '#D1D5DB', color: '#1C1917' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

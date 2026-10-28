import { useState, useRef } from 'react';
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
  HardDrive,
  Key,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { 
  extractPhotosFromZip, 
  processImportedFiles, 
  launchOneDrivePicker, 
  launchGooglePicker 
} from '../lib/cloudStorage';

export default function CloudStorageModal({ isOpen, onClose, onImportPhotos }) {
  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'onedrive' | 'apple' | 'zip'
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successCount, setSuccessCount] = useState(null);

  // Optional custom developer client IDs
  const [msClientId, setMsClientId] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('fhp_google_client_id') || '');
  const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem('fhp_google_api_key') || '');
  const [showConfig, setShowConfig] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Reading photos into browser memory...');

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
        } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp|tiff)$/i.test(file.name)) {
          allFiles.push(file);
        }
      }

      if (allFiles.length === 0) {
        setErrorMessage('No image files were found in the selected files or ZIP archive.');
        setIsProcessing(false);
        return;
      }

      setStatusMessage(`Analyzing and reading metadata for ${allFiles.length} photos...`);
      const photoItems = await processImportedFiles(allFiles, (curr, total, name) => {
        setStatusMessage(`Reading photo ${curr}/${total}: ${name}`);
      });

      setSuccessCount(photoItems.length);
      setStatusMessage(`Successfully loaded ${photoItems.length} photos! Zero hard drive space used.`);
      
      const tabNames = {
        google: 'Google Photos & Drive',
        onedrive: 'Microsoft OneDrive',
        apple: 'Apple iCloud',
        zip: 'Cloud Archive'
      };

      setTimeout(() => {
        onImportPhotos(photoItems, tabNames[activeTab] || 'Cloud Photos');
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
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Opening Microsoft OneDrive Picker in a popup...');

    launchOneDrivePicker({
      clientId: msClientId.trim() || undefined,
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
          'Could not connect directly via Microsoft popup. Please use the "Select Photos from OneDrive" button above or drag your downloaded photos/ZIP directly into the box.'
        );
      }
    });
  };

  const handleLaunchGoogle = () => {
    const clientId = googleClientId.trim();
    const apiKey = googleApiKey.trim();

    if (!clientId || !apiKey) {
      setShowConfig(true);
      setErrorMessage('To use direct Google Picker, please enter your Google Client ID and API Key, or use the 1-click "Select Photos from Google Drive" button above.');
      return;
    }

    // Save for next time
    localStorage.setItem('fhp_google_client_id', clientId);
    localStorage.setItem('fhp_google_api_key', apiKey);

    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Connecting to Google Photos & Drive...');

    launchGooglePicker({
      apiKey,
      clientId,
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
        setErrorMessage(`Google connection note: ${err.message || 'Pop-up was closed or authentication failed. You can use the "Select Photos" button above instead.'}`);
      }
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const triggerNativePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="cloud-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '700px', width: '92%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '10px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7' }}>
              <Cloud size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>Connect &amp; Improve Cloud Photos</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#57534E' }}>
                Google Photos, Microsoft OneDrive, &amp; Apple iCloud — Zero Hard Drive Space Required
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
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }}>
          {/* Senior-Friendly Hard Drive Guarantee Banner */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            backgroundColor: 'rgba(4, 120, 87, 0.08)', 
            border: '1px solid rgba(4, 120, 87, 0.25)', 
            borderRadius: '10px', 
            padding: '12px 16px',
            marginBottom: '16px'
          }}>
            <HardDrive size={22} style={{ color: '#047857', flexShrink: 0 }} />
            <div style={{ fontSize: '12.5px', color: '#064E3B', lineHeight: 1.4 }}>
              <strong>Zero Hard Drive Space Needed:</strong> Photos are streamed and held in browser memory. When you finish enhancing them to 4K or naming people, you can export them back to your cloud with 1 click.
            </div>
          </div>

          {/* Cloud Provider Tabs */}
          <div className="cloud-tabs-nav" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('google'); setErrorMessage(''); }}
              className={`cloud-tab-btn ${activeTab === 'google' ? 'active' : ''}`}
            >
              <Cloud size={16} style={{ color: activeTab === 'google' ? '#DC2626' : '#57534E' }} />
              <span>Google Photos &amp; Drive</span>
            </button>
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

          {/* Tab 1: Google Photos & Drive */}
          {activeTab === 'google' && (
            <div>
              <div className="cloud-info-box google" style={{ marginBottom: '16px' }}>
                <h4>
                  <Cloud size={18} />
                  <span>Google Photos &amp; Google Drive</span>
                </h4>
                <p>
                  Work on your family pictures in the cloud. Name loved ones, restore vintage scans to 4K, and download the improved album when done.
                </p>
              </div>

              {/* Primary 1-Click Action */}
              <button
                type="button"
                onClick={triggerNativePicker}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '13px 18px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                  marginBottom: '14px',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
              >
                <FolderOpen size={19} />
                <span>Select Photos from Google Drive / Cloud</span>
              </button>

              {/* Step-by-Step for Google Photos Web */}
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E7DDD2', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1C1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} style={{ color: '#D97706' }} />
                    <span>How to import an entire album from Google Photos Web:</span>
                  </div>
                  <a 
                    href="https://photos.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-xs"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#DC2626', fontWeight: 600, padding: '4px 10px' }}
                  >
                    <ExternalLink size={12} />
                    <span>Open Google Photos</span>
                  </a>
                </div>
                <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: '12px', lineHeight: 1.6, color: '#374151' }}>
                  <li>Open your album on <strong>photos.google.com</strong>.</li>
                  <li>Click the three dots (<strong>⋮</strong>) in the top-right and choose <strong>"Download all"</strong> (gives a fast ZIP).</li>
                  <li>Drop that ZIP file right into the box below — it unpacks automatically into browser memory!</li>
                </ol>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerNativePicker}
                style={{ marginBottom: '14px' }}
              >
                <UploadCloud size={36} style={{ color: '#DC2626' }} />
                <div className="cloud-dropzone-title">
                  Drop Google Photos or Downloaded Album ZIP Here
                </div>
                <div className="cloud-dropzone-subtitle">
                  Click to browse or drag and drop. Automatically extracts and reads embedded dates &amp; people.
                </div>
              </div>

              {/* Optional Developer Direct Google Picker */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#78716C', fontSize: '11.5px' }}
                >
                  <Key size={12} />
                  <span>{showConfig ? 'Hide Direct Google Sign-In Settings' : 'Advanced: Connect with Google OAuth Client ID'}</span>
                </button>

                {showConfig && (
                  <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontWeight: 600, color: '#1C1917', marginBottom: '3px' }}>Google OAuth Client ID:</label>
                      <input 
                        type="text" 
                        value={googleClientId} 
                        onChange={(e) => setGoogleClientId(e.target.value)} 
                        placeholder="e.g. 12345-abc.apps.googleusercontent.com"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontWeight: 600, color: '#1C1917', marginBottom: '3px' }}>Google API Developer Key:</label>
                      <input 
                        type="text" 
                        value={googleApiKey} 
                        onChange={(e) => setGoogleApiKey(e.target.value)} 
                        placeholder="AIzaSy..."
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleLaunchGoogle} 
                      className="btn btn-primary btn-sm"
                      disabled={isProcessing}
                    >
                      Sign In with Google Picker
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Microsoft OneDrive */}
          {activeTab === 'onedrive' && (
            <div>
              <div className="cloud-info-box onedrive" style={{ marginBottom: '16px' }}>
                <h4>
                  <Cloud size={18} />
                  <span>Microsoft OneDrive</span>
                </h4>
                <p>
                  Select photos from your personal or family OneDrive account without having to sync gigabytes to your computer.
                </p>
              </div>

              {/* Primary 1-Click Action */}
              <button
                type="button"
                onClick={triggerNativePicker}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '13px 18px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                  marginBottom: '14px',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0369A1'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0284C7'}
              >
                <FolderOpen size={19} />
                <span>Select Photos from Microsoft OneDrive</span>
              </button>

              {/* Drag and Drop Zone */}
              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerNativePicker}
                style={{ marginBottom: '14px' }}
              >
                <UploadCloud size={36} style={{ color: '#0284C7' }} />
                <div className="cloud-dropzone-title">
                  Drop OneDrive Photos or ZIP Here
                </div>
                <div className="cloud-dropzone-subtitle">
                  If you selected and downloaded photos on onedrive.live.com, drop them here to unpack directly in memory.
                </div>
              </div>

              {/* Optional OneDrive Picker SDK button */}
              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleLaunchOneDrive}
                  disabled={isProcessing}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#0284C7', fontWeight: 600, fontSize: '12px' }}
                >
                  <Cloud size={14} />
                  <span>Or Launch Microsoft Account Login Popup</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Apple iCloud */}
          {activeTab === 'apple' && (
            <div>
              <div className="cloud-info-box apple" style={{ marginBottom: '16px' }}>
                <h4>
                  <Cloud size={18} />
                  <span>Apple iCloud Photos</span>
                </h4>
                <p>
                  Apple keeps your original photos in the cloud. You can easily pull them in without filling up your local drive.
                </p>
              </div>

              {/* Primary 1-Click Action */}
              <button
                type="button"
                onClick={triggerNativePicker}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '13px 18px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                  marginBottom: '14px',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              >
                <FolderOpen size={19} />
                <span>Select Photos from Apple iCloud Photos</span>
              </button>

              {/* iCloud Web Helper */}
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #E7DDD2', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#1C1917' }}>From a Computer Browser:</span>
                  <a 
                    href="https://www.icloud.com/photos" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-xs"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#047857', fontWeight: 600, padding: '4px 10px' }}
                  >
                    <ExternalLink size={12} />
                    <span>Open iCloud.com Photos</span>
                  </a>
                </div>
                <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  Select the photos on <strong>icloud.com</strong>, click the <strong>Cloud Download icon</strong> (gives <code>iCloud Photos.zip</code>), and drop it directly below!
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerNativePicker}
              >
                <UploadCloud size={36} style={{ color: '#059669' }} />
                <div className="cloud-dropzone-title">
                  Drop <code>iCloud Photos.zip</code> or Photos Here
                </div>
                <div className="cloud-dropzone-subtitle">
                  Click to browse or drag &amp; drop from your Downloads folder.
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Universal Cloud ZIP Unpacker */}
          {activeTab === 'zip' && (
            <div>
              <div className="cloud-info-box zip" style={{ marginBottom: '16px' }}>
                <h4>
                  <FolderArchive size={18} />
                  <span>Universal Cloud ZIP &amp; Archive Unpacker</span>
                </h4>
                <p>
                  Works with archives from <strong>Google Takeout, OneDrive, iCloud, Dropbox, or Box</strong>. Automatically uncompresses in browser memory.
                </p>
              </div>

              <div 
                className="cloud-dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={triggerNativePicker}
                style={{ padding: '34px 20px' }}
              >
                <FolderArchive size={40} style={{ color: '#D97706' }} />
                <div className="cloud-dropzone-title" style={{ fontSize: '16px' }}>
                  Click to Select or Drop Any Cloud ZIP File
                </div>
                <div className="cloud-dropzone-subtitle">
                  Supports .zip files containing JPEG, PNG, WEBP, and digitized family scans.
                </div>
              </div>
            </div>
          )}

          {/* Hidden File / ZIP Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*,.zip,.heic" 
            multiple 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(Array.from(e.target.files));
              }
            }} 
          />

          {/* Status / Progress Banner */}
          {isProcessing && (
            <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: '#0284C7', borderTopColor: 'transparent' }}></div>
              <div style={{ fontSize: '13px', color: '#1E40AF', fontWeight: 600 }}>
                {statusMessage || 'Loading cloud photos...'}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successCount !== null && (
            <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Check size={18} style={{ color: '#16A34A' }} />
              <div style={{ fontSize: '13px', color: '#15803D', fontWeight: 700 }}>
                {statusMessage}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12.5px', color: '#991B1B', fontWeight: 500 }}>
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', backgroundColor: '#FAF7F2', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#57534E' }}>
            <ShieldCheck size={16} style={{ color: '#16A34A' }} />
            <span><strong>100% Private &amp; Client-Side:</strong> Files stay in your browser and are never sent to external servers</span>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 600, padding: '7px 16px', backgroundColor: '#FFFFFF', borderColor: '#D1D5DB', color: '#1C1917' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

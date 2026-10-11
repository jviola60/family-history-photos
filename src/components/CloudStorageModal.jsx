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
  launchGooglePicker 
} from '../lib/cloudStorage';

export default function CloudStorageModal({ isOpen, onClose, onImportPhotos }) {
  const [activeTab, setActiveTab] = useState('onedrive'); // 'onedrive' | 'google' | 'apple' | 'zip'
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successCount, setSuccessCount] = useState(null);

  // Custom client IDs (optional for users with their own developer apps)
  const [msClientId, setMsClientId] = useState('');
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
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Cloud size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Connect & Import Cloud Photos</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Import photos from OneDrive, Google Photos, or Apple iCloud (even if not synced)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary btn-xs"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cloud Provider Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('onedrive'); setErrorMessage(''); }}
            className={`btn btn-sm ${activeTab === 'onedrive' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Microsoft OneDrive</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('google'); setErrorMessage(''); }}
            className={`btn btn-sm ${activeTab === 'google' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Google Photos / Drive</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('apple'); setErrorMessage(''); }}
            className={`btn btn-sm ${activeTab === 'apple' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Apple iCloud</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('zip'); setErrorMessage(''); }}
            className={`btn btn-sm ${activeTab === 'zip' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderArchive size={15} />
            <span>Unpack Cloud ZIP</span>
          </button>
        </div>

        {/* Tab 1: Microsoft OneDrive */}
        {activeTab === 'onedrive' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} />
                <span>Pull from Microsoft OneDrive (Web)</span>
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                Select pictures directly from your personal or family Microsoft OneDrive account without needing them downloaded beforehand.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={handleLaunchOneDrive}
                disabled={isProcessing}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '14px' }}
              >
                <Cloud size={18} />
                <span>Launch Microsoft OneDrive File Picker</span>
              </button>

              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>— OR IMPORT NON-SYNCED DOWNLOADS —</div>

              {/* Drag and Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => zipInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                <UploadCloud size={36} style={{ color: '#3b82f6', margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                  Drop OneDrive Downloaded Photos or ZIP Here
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  If you clicked "Download" on onedrive.live.com, drop that .zip or photos here to auto-unpack
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Google Photos & Drive */}
        {activeTab === 'google' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ backgroundColor: 'rgba(234, 67, 53, 0.05)', border: '1px solid rgba(234, 67, 53, 0.2)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} />
                <span>Pull from Google Photos & Google Drive</span>
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                Google keeps your albums safe in the cloud. You can either drop an album download (.zip) or connect directly with Google Picker.
              </p>
            </div>

            {/* Quick 2-Step Guide for Mom */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} className="text-accent" />
                <span>Easiest Way: Download an Album from Google Photos</span>
              </div>
              <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                <li>
                  Open{' '}
                  <a href="https://photos.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
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
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => zipInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                marginBottom: '14px'
              }}
            >
              <FolderArchive size={36} style={{ color: '#ea4335', margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                Drop Google Photos ZIP or Image Files Here
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click to browse or drag & drop. Automatically extracts and reads embedded dates & people.
              </div>
            </div>

            {/* Optional Direct Google Picker */}
            <div>
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="btn btn-secondary btn-xs"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}
              >
                <Key size={13} />
                <span>{showConfig ? 'Hide Direct Google Picker Settings' : 'Advanced: Connect with Google OAuth Client ID'}</span>
              </button>

              {showConfig && (
                <div style={{ marginTop: '10px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Google OAuth Client ID:</label>
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
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Google API Developer Key:</label>
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
                    Open Google Picker
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Apple iCloud */}
        {activeTab === 'apple' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} />
                <span>Pull from Apple iCloud Photos</span>
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                Apple restricts external websites from directly reading private iCloud accounts for security. Here is the easiest 1-minute way to pull them in:
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Step 1: Open your iCloud Photos</span>
                <a 
                  href="https://www.icloud.com/photos" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#047857' }}
                >
                  <ExternalLink size={13} />
                  <span>Open iCloud.com Photos</span>
                </a>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Select the photos you want, then click the <strong>Cloud Download icon</strong> at the top of the Apple screen. Apple will download them as <code>iCloud Photos.zip</code>.
              </p>

              <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '12px', marginBottom: '6px' }}>Step 2: Drop the ZIP file here</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Drop the downloaded file right below. The app will unpack all images automatically without uploading anything to the internet.
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => zipInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <UploadCloud size={36} style={{ color: '#10b981', margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                Drop <code>iCloud Photos.zip</code> or Photos Here
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click to select file or drag & drop from your Downloads folder
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Universal Cloud ZIP Unpacker */}
        {activeTab === 'zip' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderArchive size={18} />
                <span>Universal Cloud ZIP & Photo Unpacker</span>
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                Works with ZIP archives downloaded from <strong>Google Takeout, OneDrive, iCloud, Dropbox, or Box</strong>. Automatically uncompresses in memory.
              </p>
            </div>

            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => zipInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '10px',
                padding: '36px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <FolderArchive size={42} style={{ color: '#f59e0b', margin: '0 auto 10px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                Click to Select or Drop Any Cloud ZIP File
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Supports .zip files containing JPEG, PNG, WEBP, and scans.
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
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
            <div style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: 500 }}>
              {statusMessage || 'Loading cloud photos...'}
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successCount !== null && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Check size={20} style={{ color: '#16a34a' }} />
            <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
              {statusMessage}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#b91c1c' }}>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} style={{ color: '#16a34a' }} />
            <span>100% Private & Local: Cloud files are processed entirely in your browser</span>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary btn-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

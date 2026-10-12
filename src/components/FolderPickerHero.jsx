import React, { useRef } from 'react';
import { FolderOpen, Sparkles, ShieldCheck, Heart, UserCheck, Zap, Cloud, BookOpen } from 'lucide-react';

export default function FolderPickerHero({ 
  onPickFolder, 
  onFilesSelected, 
  onOpenCloudModal, 
  onOpenHelpGuide, 
  pendingResumeSession,
  onResumeAlbum,
  onDismissResume,
  isScanning, 
  scanProgress 
}) {
  const fileInputRef = useRef(null);

  const handleFallbackFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="hero-container">
      {/* 1-Click Resume Album Banner */}
      {pendingResumeSession && (
        <div className="resume-session-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'rgba(217, 119, 6, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <FolderOpen size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>
                Welcome back! Continue album: "{pendingResumeSession.info?.folderName || 'Previous Album'}"
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-subtle)' }}>
                Resume right where you left off ({pendingResumeSession.info?.photoCount || 0} photos)
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={onResumeAlbum} 
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>▶️ Resume Album (1-Click)</span>
            </button>
            <button 
              type="button" 
              onClick={onDismissResume} 
              className="btn btn-secondary btn-sm"
            >
              Choose Another Folder
            </button>
          </div>
        </div>
      )}

      <div className="hero-card">
        <div className="hero-heart-badge">
          <Heart size={24} className="heart-icon" />
          <span>Made for Mom's Precious Memories</span>
        </div>

        <h2 className="hero-title">Preserve, Organize & Enhance Your Family Photos</h2>
        <p className="hero-description">
          Organize your albums, name loved ones in your photos, eliminate clutter and duplicates, 
          and upscale tiny or vintage pictures into gorgeous 1080p and 4K quality—all right here on your computer.
        </p>

        {isScanning ? (
          <div className="scanning-box">
            <div className="spinner"></div>
            <p className="scanning-title">Scanning your photos...</p>
            <p className="scanning-subtitle">{scanProgress || 'Reading image files and organizing memories...'}</p>
          </div>
        ) : (
          <div className="hero-action-buttons">
            {/* Primary folder picker */}
            <button 
              onClick={onPickFolder} 
              className="btn btn-hero-primary"
            >
              <FolderOpen size={24} />
              <div className="btn-label-group">
                <span className="btn-title">Open My Photos Folder</span>
                <span className="btn-subtitle">Select pictures from your computer</span>
              </div>
            </button>

            {/* Cloud Storage Picker */}
            <button 
              onClick={onOpenCloudModal} 
              className="btn btn-hero-secondary"
              style={{ borderColor: 'rgba(59, 130, 246, 0.45)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
              title="Import photos from OneDrive, Google Photos, or Apple iCloud"
            >
              <Cloud size={24} style={{ color: '#2563eb' }} />
              <div className="btn-label-group">
                <span className="btn-title" style={{ color: '#1d4ed8' }}>Import from Cloud</span>
                <span className="btn-subtitle">OneDrive, Google Photos, Apple iCloud</span>
              </div>
            </button>

            {/* Fallback hidden file input if needed */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              webkitdirectory="true" 
              directory="true" 
              multiple 
              onChange={handleFallbackFileChange} 
            />

            {/* Help & User Guide button */}
            <button 
              onClick={onOpenHelpGuide} 
              className="btn btn-hero-secondary"
              title="Learn how all features work"
            >
              <BookOpen size={24} style={{ color: 'var(--primary)' }} />
              <div className="btn-label-group">
                <span className="btn-title">Help & User Guide</span>
                <span className="btn-subtitle">Step-by-step features & tips</span>
              </div>
            </button>
          </div>
        )}

        <div className="hero-features-list">
          <div className="feature-pill">
            <ShieldCheck size={18} className="feature-icon" />
            <span>100% Private (No Cloud Upload)</span>
          </div>
          <div className="feature-pill">
            <Zap size={18} className="feature-icon" />
            <span>Cleans Duplicates Safely</span>
          </div>
          <div className="feature-pill">
            <UserCheck size={18} className="feature-icon" />
            <span>Smart Face Scan & Recognition</span>
          </div>
          <div className="feature-pill">
            <Sparkles size={18} className="feature-icon" />
            <span>Restores Old Photos to 4K</span>
          </div>
        </div>

        {onOpenHelpGuide && (
          <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onOpenHelpGuide}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '13px', borderRadius: '999px', backgroundColor: 'var(--bg-subtle)' }}
            >
              <BookOpen size={16} className="text-primary" />
              <span>Want to learn how everything works? <strong>Open Complete User Guide</strong></span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

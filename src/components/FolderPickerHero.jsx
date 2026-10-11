import React, { useRef } from 'react';
import { FolderOpen, Sparkles, ShieldCheck, Heart, UserCheck, Zap, Cloud, BookOpen } from 'lucide-react';

export default function FolderPickerHero({ onPickFolder, onFilesSelected, onLoadSample, onOpenCloudModal, onOpenHelpGuide, isScanning, scanProgress }) {
  const fileInputRef = useRef(null);

  const handleFallbackFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="hero-container">
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

            {/* Sample album button for instant preview */}
            <button 
              onClick={onLoadSample} 
              className="btn btn-hero-secondary"
            >
              <Sparkles size={24} />
              <div className="btn-label-group">
                <span className="btn-title">Try Sample Album</span>
                <span className="btn-subtitle">Explore with test vintage family photos</span>
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

import { 
  FolderOpen, 
  Copy, 
  Users, 
  HelpCircle, 
  Download, 
  HeartHandshake,
  FolderX,
  Sparkles,
  FolderCheck,
  Settings,
  Cloud,
  BookOpen
} from 'lucide-react';

export default function Header({ 
  folderName, 
  onPickFolder, 
  onOpenCloudModal,
  onOpenHelpGuide,
  onOpenDuplicates, 
  duplicateCount, 
  onOpenJunkCleaner,
  junkCount,
  onOpenReviewFolder,
  reviewCount = 0,
  onOpenRestoration,
  lowResCount = 0,
  onOpenPeople, 
  peopleCount, 
  onOpenSettings,
  onToggleHelp, 
  showHelp, 
  onExportCatalog,
  onClearAlbum,
  photoCount
}) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-icon-wrap">
          <HeartHandshake className="logo-icon" size={28} />
        </div>
        <div>
          <h1 className="app-title">Family History Photos</h1>
          <p className="app-subtitle">Family Photo Album & Memory Keeper</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Folder picker button */}
        <button 
          onClick={onPickFolder} 
          className="btn btn-secondary header-btn"
          title="Open a photo folder from your computer"
        >
          <FolderOpen size={18} />
          <span>{folderName ? `Folder: ${folderName}` : 'Open Folder'}</span>
        </button>

        {/* Cloud Import button */}
        <button 
          onClick={onOpenCloudModal} 
          className="btn btn-secondary header-btn"
          title="Import photos from OneDrive, Google Photos, or Apple iCloud"
        >
          <Cloud size={18} style={{ color: '#2563eb' }} />
          <span>Cloud Import</span>
        </button>

        {/* Duplicates button with badge */}
        <button 
          onClick={onOpenDuplicates} 
          className={`btn ${duplicateCount > 0 ? 'btn-warning-badge' : 'btn-secondary'} header-btn`}
          title="Find and clean duplicate photos"
        >
          <Copy size={18} />
          <span>Duplicates</span>
          {duplicateCount > 0 && <span className="counter-pill">{duplicateCount}</span>}
        </button>

        {/* Smart Junk & Screenshot Cleaner button */}
        {photoCount > 0 && junkCount > 0 && (
          <button 
            onClick={onOpenJunkCleaner} 
            className="btn btn-secondary header-btn"
            title="Clean computer app and desktop screenshots"
          >
            <FolderCheck size={18} />
            <span>Clean Screenshots</span>
            <span className="counter-pill">{junkCount}</span>
          </button>
        )}

        {/* 4K Restoration Hub button with badge */}
        {photoCount > 0 && lowResCount > 0 && (
          <button 
            onClick={onOpenRestoration} 
            className="btn btn-secondary header-btn"
            title="Enhance vintage photos and small thumbnails to 4K"
            style={{ 
              borderColor: 'rgba(194, 65, 12, 0.45)', 
              backgroundColor: 'rgba(194, 65, 12, 0.08)',
              color: 'var(--accent)'
            }}
          >
            <Sparkles size={18} className="text-accent" />
            <span>Restore to 4K</span>
            <span className="counter-pill" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {lowResCount}
            </span>
          </button>
        )}

        {/* Review Folder button with badge */}
        {reviewCount > 0 && (
          <button 
            onClick={onOpenReviewFolder} 
            className="btn btn-warning-badge header-btn"
            title="View photos waiting in your _Duplicates_Review folder"
            style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)', borderColor: 'rgba(217, 119, 6, 0.4)' }}
          >
            <FolderCheck size={18} className="text-warning" />
            <span>Review Folder</span>
            <span className="counter-pill">{reviewCount}</span>
          </button>
        )}

        {/* People Directory */}
        <button 
          onClick={onOpenPeople} 
          className="btn btn-secondary header-btn"
          title="View family members and relations"
        >
          <Users size={18} />
          <span>Family ({peopleCount})</span>
        </button>

        {/* Export / Save Catalog */}
        {photoCount > 0 && (
          <>
            <button 
              onClick={onExportCatalog} 
              className="btn btn-secondary header-btn"
              title="Download or save your notes and album catalog"
            >
              <Download size={18} />
              <span>Save Album</span>
            </button>

            {onClearAlbum && (
              <button 
                onClick={onClearAlbum} 
                className="btn btn-secondary header-btn"
                title="Close this album and start fresh"
              >
                <FolderX size={18} />
                <span>Close Album</span>
              </button>
            )}
          </>
        )}

        {/* Settings modal button */}
        <button 
          onClick={onOpenSettings} 
          className="btn btn-secondary header-btn"
          title="App settings & AI photo restoration providers"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        {/* Complete Help Menu & User Guide Modal */}
        <button 
          onClick={onOpenHelpGuide} 
          className="btn btn-secondary header-btn"
          title="Open complete User Guide explaining all features"
          style={{ borderColor: 'rgba(217, 119, 6, 0.45)', backgroundColor: 'rgba(217, 119, 6, 0.08)' }}
        >
          <BookOpen size={18} className="text-primary" />
          <span>User Guide</span>
        </button>

        {/* Help & Guided Tour toggle */}
        <button 
          onClick={onToggleHelp} 
          className={`btn ${showHelp ? 'btn-primary' : 'btn-outline'} header-btn-help`}
          title="Show guided instructions and tips"
        >
          <HelpCircle size={18} />
          <span>{showHelp ? 'Hide Tips' : 'Quick Tips'}</span>
        </button>
      </div>
    </header>
  );
}

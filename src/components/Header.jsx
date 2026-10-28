import { useState, useRef, useEffect } from 'react';
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
  BookOpen,
  ChevronDown,
  Wrench,
  CheckCircle2
} from 'lucide-react';

export default function Header({ 
  folderName, 
  onPickFolder, 
  onOpenCloudModal,
  onOpenHelpGuide,
  onOpenDuplicates, 
  duplicateCount = 0, 
  onOpenJunkCleaner,
  junkCount = 0,
  onOpenReviewFolder,
  reviewCount = 0,
  onOpenRestoration,
  lowResCount = 0,
  onOpenPeople, 
  peopleCount = 0, 
  onOpenSettings,
  onToggleHelp, 
  showHelp, 
  onExportCatalog,
  onClearAlbum,
  photoCount = 0
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const headerRef = useRef(null);

  // Total actionable items in Tools
  const totalToolsBadge = (duplicateCount > 0 ? duplicateCount : 0) + 
                          (junkCount > 0 ? junkCount : 0) + 
                          (lowResCount > 0 ? lowResCount : 0) + 
                          (reviewCount > 0 ? reviewCount : 0);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleMenu = (menuName) => {
    setOpenMenu(current => (current === menuName ? null : menuName));
  };

  const handleAction = (callback) => {
    setOpenMenu(null);
    if (callback) callback();
  };

  return (
    <header className="app-header" ref={headerRef}>
      {/* Brand Identity */}
      <div className="header-brand">
        <div className="logo-icon-wrap" aria-hidden="true">
          <HeartHandshake className="logo-icon" size={26} />
        </div>
        <div className="brand-text">
          <h1 className="app-title">Family History Photos</h1>
          <p className="app-subtitle">Family Photo Album &amp; Memory Keeper</p>
        </div>
      </div>

      {/* Modern Navigation & Menus */}
      <nav className="header-actions" aria-label="Main application toolbar">
        {/* 1. Primary Source Selector: Folder */}
        <button 
          type="button"
          onClick={onPickFolder} 
          className="btn btn-secondary header-btn header-btn-primary-source"
          title="Open a photo folder from your computer"
        >
          <FolderOpen size={17} className="text-primary" />
          <span className="folder-btn-label">
            {folderName ? `Folder: ${folderName}` : 'Open Folder'}
          </span>
        </button>

        {/* 2. Cloud Import */}
        <button 
          type="button"
          onClick={onOpenCloudModal} 
          className="btn btn-secondary header-btn"
          title="Import photos from OneDrive, Google Photos, or Apple iCloud"
        >
          <Cloud size={17} style={{ color: '#2563eb' }} />
          <span>Cloud Import</span>
        </button>

        {/* 3. Family Directory */}
        <button 
          type="button"
          onClick={onOpenPeople} 
          className="btn btn-secondary header-btn"
          title="View family members and relations"
        >
          <Users size={17} className="text-primary" />
          <span>Family ({peopleCount})</span>
        </button>

        {/* 4. Modern Tools Menu (Duplicates, 4K Restoration, Screenshots, Review Folder) */}
        <div className="menu-container">
          <button
            type="button"
            onClick={() => toggleMenu('tools')}
            className={`btn btn-secondary header-btn menu-trigger ${openMenu === 'tools' ? 'is-active' : ''}`}
            aria-expanded={openMenu === 'tools'}
            aria-haspopup="menu"
            title="Photo clean-up and AI restoration tools"
          >
            <Sparkles size={17} className="text-accent" />
            <span>Tools</span>
            {totalToolsBadge > 0 && (
              <span className="counter-pill counter-pill-tools">
                {totalToolsBadge > 999 ? `${(totalToolsBadge / 1000).toFixed(1)}k` : totalToolsBadge}
              </span>
            )}
            <ChevronDown size={14} className={`menu-chevron ${openMenu === 'tools' ? 'is-open' : ''}`} />
          </button>

          {openMenu === 'tools' && (
            <div className="modern-dropdown modern-dropdown-tools" role="menu">
              <div className="dropdown-header">PHOTO TOOLS &amp; AI</div>

              {/* Restore to 4K */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenRestoration)}
              >
                <div className="dropdown-item-icon icon-restore">
                  <Sparkles size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Restore to 4K</div>
                  <div className="dropdown-item-desc">Enhance vintage photos and small thumbnails</div>
                </div>
                {lowResCount > 0 && (
                  <span className="counter-pill counter-pill-accent">
                    {lowResCount.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Duplicates Finder */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenDuplicates)}
              >
                <div className="dropdown-item-icon icon-duplicates">
                  <Copy size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Find Duplicates</div>
                  <div className="dropdown-item-desc">Detect identical and similar photos</div>
                </div>
                {duplicateCount > 0 && (
                  <span className="counter-pill counter-pill-warning">
                    {duplicateCount.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Screenshot & Junk Cleaner */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenJunkCleaner)}
              >
                <div className="dropdown-item-icon icon-cleaner">
                  <FolderCheck size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Clean Screenshots</div>
                  <div className="dropdown-item-desc">Filter computer app and desktop screenshots</div>
                </div>
                {junkCount > 0 && (
                  <span className="counter-pill counter-pill-danger">
                    {junkCount.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Review Folder */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenReviewFolder)}
              >
                <div className="dropdown-item-icon icon-review">
                  <FolderOpen size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Review Folder</div>
                  <div className="dropdown-item-desc">View photos waiting in _Duplicates_Review</div>
                </div>
                {reviewCount > 0 && (
                  <span className="counter-pill counter-pill-warning">
                    {reviewCount.toLocaleString()}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 5. Modern Album Menu (Save & Close) - only if photos loaded */}
        {photoCount > 0 && (
          <div className="menu-container">
            <button
              type="button"
              onClick={() => toggleMenu('album')}
              className={`btn btn-secondary header-btn menu-trigger ${openMenu === 'album' ? 'is-active' : ''}`}
              aria-expanded={openMenu === 'album'}
              aria-haspopup="menu"
              title="Album management and export"
            >
              <Download size={17} />
              <span>Album</span>
              <ChevronDown size={14} className={`menu-chevron ${openMenu === 'album' ? 'is-open' : ''}`} />
            </button>

            {openMenu === 'album' && (
              <div className="modern-dropdown" role="menu">
                <div className="dropdown-header">ALBUM MANAGEMENT</div>

                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => handleAction(onExportCatalog)}
                >
                  <div className="dropdown-item-icon icon-export">
                    <Download size={18} />
                  </div>
                  <div className="dropdown-item-body">
                    <div className="dropdown-item-title">Save &amp; Export Improved Album</div>
                    <div className="dropdown-item-desc">Download 4K restored photos &amp; tags (ready for cloud)</div>
                  </div>
                </button>

                {onClearAlbum && (
                  <>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item item-danger"
                      role="menuitem"
                      onClick={() => handleAction(onClearAlbum)}
                    >
                      <div className="dropdown-item-icon icon-danger">
                        <FolderX size={18} />
                      </div>
                      <div className="dropdown-item-body">
                        <div className="dropdown-item-title">Close Album</div>
                        <div className="dropdown-item-desc">Exit current album and start fresh</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. Settings & Help Menu */}
        <div className="menu-container">
          <button
            type="button"
            onClick={() => toggleMenu('settings')}
            className={`btn btn-secondary header-btn menu-trigger ${openMenu === 'settings' ? 'is-active' : ''}`}
            aria-expanded={openMenu === 'settings'}
            aria-haspopup="menu"
            title="App settings, user guide, and helpful tips"
          >
            <Settings size={17} />
            <span>Settings</span>
            <ChevronDown size={14} className={`menu-chevron ${openMenu === 'settings' ? 'is-open' : ''}`} />
          </button>

          {openMenu === 'settings' && (
            <div className="modern-dropdown" role="menu">
              <div className="dropdown-header">PREFERENCES &amp; HELP</div>

              {/* App Settings */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenSettings)}
              >
                <div className="dropdown-item-icon icon-settings">
                  <Settings size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">App Settings</div>
                  <div className="dropdown-item-desc">AI photo restoration keys &amp; cloud preferences</div>
                </div>
              </button>

              {/* User Guide */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onOpenHelpGuide)}
              >
                <div className="dropdown-item-icon icon-guide">
                  <BookOpen size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Complete User Guide</div>
                  <div className="dropdown-item-desc">Step-by-step illustrated guide for all features</div>
                </div>
              </button>

              <div className="dropdown-divider" />

              {/* Quick Tips Toggle */}
              <button
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => handleAction(onToggleHelp)}
              >
                <div className="dropdown-item-icon icon-tips">
                  <HelpCircle size={18} />
                </div>
                <div className="dropdown-item-body">
                  <div className="dropdown-item-title">Quick Tips Tour</div>
                  <div className="dropdown-item-desc">
                    {showHelp ? 'Guided tour is currently active' : 'Turn on guided tour tips'}
                  </div>
                </div>
                <span className={`toggle-status-pill ${showHelp ? 'status-active' : ''}`}>
                  {showHelp ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

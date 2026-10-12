import React, { useState, useMemo } from 'react';
import { 
  X, 
  BookOpen, 
  Sparkles, 
  FolderOpen, 
  Copy, 
  Search, 
  Users, 
  ShieldCheck, 
  ZoomIn, 
  Cloud, 
  Download, 
  Printer, 
  Heart, 
  FolderCheck, 
  Settings, 
  Clock, 
  Layers, 
  FileText 
} from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    id: 'quickstart',
    icon: FolderOpen,
    title: '1. Quick Start Guide',
    badge: 'Basics',
    summary: 'How to open your photos, start an album, or connect cloud pictures.',
    content: (
      <div className="help-section-body">
        <h4>Getting Started in 3 Simple Steps</h4>
        <p>
          <strong>Family History Photos</strong> is designed specifically to help you and your family name loved ones,
          record stories, clean up duplicate files, and restore vintage photos to 4K quality—safely and privately.
        </p>

        <div className="help-card-grid">
          <div className="help-step-box">
            <div className="help-step-num">Step 1</div>
            <h5>Open Your Photos</h5>
            <p>Click <strong>"Open My Photos Folder"</strong> to choose a folder of pictures from your computer hard drive, external drive, or USB flash drive.</p>
          </div>

          <div className="help-step-box">
            <div className="help-step-num">Step 2</div>
            <h5>Or Import from the Cloud</h5>
            <p>Click <strong>"Import from Cloud"</strong> to pull pictures from OneDrive, Google Photos, or Apple iCloud archives.</p>
          </div>

          <div className="help-step-box">
            <div className="help-step-num">Step 3</div>
            <h5>Click Any Photo to Inspect</h5>
            <p>Click any picture to zoom in, tag who is in the photo, write the year, and record your family memories.</p>
          </div>
        </div>

        <div className="help-callout-info">
          <ShieldCheck size={20} className="text-success" />
          <div>
            <strong>100% Private & Safe:</strong> Your photos stay right on your computer. Nothing is uploaded to public servers or external companies without your permission.
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'tagging',
    icon: BookOpen,
    title: '2. Tagging People & Stories',
    badge: 'Core Feature',
    summary: 'Naming family members, choosing relationships (like Great-Grandmother), and recording stories.',
    content: (
      <div className="help-section-body">
        <h4>How to Record Family History on Photos</h4>
        <p>When you click on any photo in your album, the <strong>Photo Memory Inspector</strong> opens:</p>

        <div className="help-feature-list">
          <div className="help-feature-item">
            <div className="help-icon-circle"><Users size={18} /></div>
            <div>
              <h5>Naming People in the Photo</h5>
              <p>Type the name of each person (e.g., <em>Arthur Viola</em>) and press <strong>Add</strong>. You can add as many people as appear in the photo.</p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><Heart size={18} /></div>
            <div>
              <h5>Choosing Family Relationships</h5>
              <p>
                Select how they are related to you from the relationship menu. Options include:
                <strong> Great-Grandmother, Great-Grandfather, Great-Granddaughter, Great-Grandson, Grandparent, Parent, Child, Spouse, Sibling, In-Laws</strong>, and more.
              </p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><Clock size={18} /></div>
            <div>
              <h5>Dates and Decades</h5>
              <p>
                If you know the exact date (e.g., <em>July 4, 1968</em>), enter it in the Date box. If you only know approximately when it was taken, select the <strong>Decade</strong> (e.g., <em>1960s</em>).
              </p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><BookOpen size={18} /></div>
            <div>
              <h5>Family Story & Memories Box</h5>
              <p>
                Write down what is happening in the picture, where it took place, funny stories, or family lore. These memories are permanently preserved with the photo!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'magnification',
    icon: ZoomIn,
    title: '3. Zoom & Magnification',
    badge: 'Senior-Friendly',
    summary: 'Using mouse wheel zoom and pan to examine faces, jewelry, and tiny details.',
    content: (
      <div className="help-section-body">
        <h4>Inspecting Photos Up-Close</h4>
        <p>Vintage photos are often small or have tiny faces. We built high-powered magnification so you can see every detail comfortably:</p>

        <div className="help-tip-card">
          <h5>🔍 3 Ways to Zoom and Enlarge:</h5>
          <ul>
            <li><strong>Mouse Wheel:</strong> Scroll your mouse wheel forward to zoom in smoothly up to <strong>1000% (10x zoom)</strong>, and scroll backward to zoom out.</li>
            <li><strong>Zoom Buttons:</strong> Click the <strong>Zoom In (+)</strong> or <strong>Zoom Out (-)</strong> buttons at the bottom of the photo.</li>
            <li><strong>Reset View:</strong> Click <strong>"Reset View"</strong> or double-click to snap the photo back to its normal size.</li>
          </ul>
        </div>

        <div className="help-tip-card" style={{ marginTop: '14px' }}>
          <h5>✋ Panning and Moving Around:</h5>
          <p>
            When zoomed in, simply <strong>click and drag</strong> with your mouse to slide the picture around so you can inspect faces on the left, right, top, or bottom.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'familysearch',
    icon: FileText,
    title: '4. FamilySearch.org Integration',
    badge: 'Genealogy',
    summary: '1-click copy for FamilySearch Memories, permanent metadata embedding, and smart filenames.',
    content: (
      <div className="help-section-body">
        <h4>Effortless Uploading to FamilySearch Memories</h4>
        <p>
          FamilySearch.org is the premier genealogy service. We built custom tools so your photos and stories transfer to FamilySearch in seconds:
        </p>

        <div className="help-card-grid">
          <div className="help-step-box">
            <div className="help-step-num">Tool 1</div>
            <h5>📋 1-Click "Copy for FamilySearch"</h5>
            <p>
              Right above the Story box (and in the footer), click <strong>"📋 Copy for FamilySearch"</strong>.
              This copies a perfectly formatted summary of People, Date, Location, and Story to your clipboard.
              When uploading to FamilySearch Memories, simply paste (<strong>Ctrl+V</strong>) into the Description box!
            </p>
          </div>

          <div className="help-step-box">
            <div className="help-step-num">Tool 2</div>
            <h5>🏷️ Smart Descriptive Filenames</h5>
            <p>
              When you download or save a photo, it automatically names the file: 
              <code>Arthur_Viola_and_Rose_Viola_1974.jpg</code>.
              FamilySearch has a checkbox <em>"Use file names as titles"</em> that will automatically title your memory!
            </p>
          </div>

          <div className="help-step-box">
            <div className="help-step-num">Tool 3</div>
            <h5>🏛️ Permanent XMP/IPTC Embedding</h5>
            <p>
              Every time you click <strong>Save</strong>, your tags are written directly into the JPEG file header using international Family History Working Group standards.
              Even if you email the photo to relatives, the stories and people stay inside the file!
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'duplicates',
    icon: Copy,
    title: '5. Duplicates & Junk Cleaning',
    badge: 'Organization',
    summary: 'Finding duplicate photos, cleaning screenshot clutter, and the safe Review folder.',
    content: (
      <div className="help-section-body">
        <h4>Eliminating Clutter Without Losing Anything</h4>
        <p>Over the years, family photo collections collect multiple copies of the same picture and random screen grabs. Here is how we keep them organized:</p>

        <div className="help-feature-list">
          <div className="help-feature-item">
            <div className="help-icon-circle"><Copy size={18} /></div>
            <div>
              <h5>Duplicate Detection</h5>
              <p>
                Click <strong>"Duplicates"</strong> in the top header. The app compares photos by digital signature and visual appearance.
                It automatically identifies higher-resolution originals versus small thumbnail copies.
              </p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><FolderCheck size={18} /></div>
            <div>
              <h5>The Safe Review Folder (_Duplicates_Review)</h5>
              <p>
                When you choose to clean duplicates, the app <strong>never permanently deletes them immediately</strong>.
                Instead, it safely moves them into a <code>_Duplicates_Review</code> folder on your drive. You can inspect or restore them at any time!
              </p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><Layers size={18} /></div>
            <div>
              <h5>Clean Screenshots & App Junk</h5>
              <p>
                Click <strong>"Clean Screenshots"</strong> in the header to find receipts, website captures, and desktop screenshots that accidentally got mixed in with family pictures.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'enhancer',
    icon: Sparkles,
    title: '6. 4K Photo Restoration',
    badge: 'Enhancement',
    summary: 'Restoring old, faded, or blurry photos to high-definition 1080p and 4K quality.',
    content: (
      <div className="help-section-body">
        <h4>Transforming Vintage & Blurry Photos</h4>
        <p>Have tiny thumbnails from old cameras or faded vintage scans? The <strong>4K Photo Enhancer</strong> restores them:</p>

        <div className="help-tip-card">
          <h5>✨ How to Restore a Photo:</h5>
          <ol style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
            <li>Click on any photo to open it, then click the orange <strong>"Enhance to 4K"</strong> button.</li>
            <li>Choose your preferred resolution (1080p Full HD, 2K, or 4K Ultra HD).</li>
            <li>Click <strong>"Start AI Restoration"</strong>.</li>
            <li>Use the interactive <strong>Before / After slider</strong> to compare the original with the restored version.</li>
            <li>Zoom in with your mouse wheel to inspect restored eyelashes, skin details, and colors!</li>
            <li>Click <strong>"Save Enhanced Photo"</strong> to keep the restored masterpiece.</li>
          </ol>
        </div>

        <div className="help-callout-info" style={{ marginTop: '14px' }}>
          <Settings size={18} />
          <div>
            <strong>AI Settings:</strong> Under <strong>Settings</strong> in the top header, you can choose between the built-in local fast enhancer or professional cloud AI engines like Fal.ai.
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'cloud',
    icon: Cloud,
    title: '7. Cloud Storage Import',
    badge: 'Cloud Sync',
    summary: 'Importing photos from Microsoft OneDrive, Google Photos, Apple iCloud, and ZIP files.',
    content: (
      <div className="help-section-body">
        <h4>Pulling Photos from OneDrive, Google & Apple</h4>
        <p>Even if your photos are not synced to your computer's hard drive, you can pull them into the app easily:</p>

        <div className="help-card-grid">
          <div className="help-step-box">
            <h5>🔷 Microsoft OneDrive</h5>
            <p>
              Click <strong>"Import from Cloud"</strong> and choose <strong>Microsoft OneDrive</strong>.
              Launch the Microsoft File Picker to sign in and choose photos directly from your OneDrive web account!
            </p>
          </div>

          <div className="help-step-box">
            <h5>🔴 Google Photos</h5>
            <p>
              Open Google Photos in your browser, select an album, and click <strong>"Download all"</strong> (downloads a .zip).
              Then drop that ZIP file right into the Google Photos tab in the app!
            </p>
          </div>

          <div className="help-step-box">
            <h5>🍏 Apple iCloud Photos</h5>
            <p>
              Click the link to open <strong>icloud.com/photos</strong>, select your pictures, and click Apple's Download icon.
              Drop the downloaded <code>iCloud Photos.zip</code> into our Apple tab to automatically unpack and load every photo.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'search',
    icon: Search,
    title: '8. Search, Filter & Family Directory',
    badge: 'Browsing',
    summary: 'Finding pictures by person, decade, relationship, or story keywords.',
    content: (
      <div className="help-section-body">
        <h4>Finding Any Photo in Seconds</h4>
        <p>Once your album has hundreds of photos, finding the exact memory is instantaneous:</p>

        <div className="help-feature-list">
          <div className="help-feature-item">
            <div className="help-icon-circle"><Search size={18} /></div>
            <div>
              <h5>Global Search Bar</h5>
              <p>Type any family name (e.g. <em>Rose</em>), a year or decade (<em>1950s</em>), a city (<em>Brooklyn</em>), or any keyword in your story.</p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><Users size={18} /></div>
            <div>
              <h5>Family Directory ("Family" button in Header)</h5>
              <p>
                Click <strong>"Family"</strong> in the top header to see a complete directory of all recognized family members,
                their relationship to you, and how many photos they appear in. Click any person to view all their photos!
              </p>
            </div>
          </div>

          <div className="help-feature-item">
            <div className="help-icon-circle"><Layers size={18} /></div>
            <div>
              <h5>Filter Pills</h5>
              <p>
                Quickly filter by: <strong>All Photos</strong>, <strong>Needs Tagging</strong> (photos that haven't been named yet),
                or <strong>Needs 4K Enhancement</strong> (low-res or thumbnail photos).
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'saving',
    icon: Download,
    title: '9. Saving & Backups',
    badge: 'Preservation',
    summary: 'Saving your album catalog, offline preservation, and safety guarantees.',
    content: (
      <div className="help-section-body">
        <h4>Keeping Your Hard Work Safe Forever</h4>
        <p>We believe family memories should last for generations. Here is how your work is preserved:</p>

        <div className="help-tip-card">
          <h5>💾 3 Layers of Safety:</h5>
          <ul>
            <li>
              <strong>Automatic In-Browser Database:</strong> Everything you tag or write is immediately saved to your browser's private database (IndexedDB).
              If you accidentally close the browser, your work is still right there when you reopen the page!
            </li>
            <li>
              <strong>Direct File Embedding:</strong> When working with local JPEG files, your tags are written directly into the file's metadata header.
            </li>
            <li>
              <strong>"Save Album" Button:</strong> Click <strong>"Save Album"</strong> in the header to download or save a full <code>.family_memories_catalog.json</code> backup file.
            </li>
          </ul>
        </div>
      </div>
    )
  }
];

export default function HelpGuideModal({ isOpen, onClose }) {
  const [activeSectionId, setActiveSectionId] = useState('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sections based on search query - ALWAYS call hooks unconditionally
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return GUIDE_SECTIONS;
    const q = searchQuery.toLowerCase();
    return GUIDE_SECTIONS.filter(s => 
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.badge.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeSection = GUIDE_SECTIONS.find(s => s.id === activeSectionId) || filteredSections[0] || GUIDE_SECTIONS[0];

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div 
        className="modal-content help-modal-container"
        style={{ maxWidth: '960px', width: '94%', height: '88vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        {/* Modal Header */}
        <div className="help-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="help-header-icon-wrap">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
                Help Center & Complete User Guide
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-subtle)' }}>
                Learn how to organize, tag, enhance, and preserve your precious family photos
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button" 
              onClick={handlePrint} 
              className="btn btn-secondary btn-sm"
              title="Print user guide for reference"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} />
              <span>Print Guide</span>
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-icon-close"
              title="Close Guide"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Search Bar */}
        <div className="help-search-bar">
          <Search size={18} className="help-search-icon" />
          <input 
            type="text" 
            placeholder="Search help topics (e.g., 'FamilySearch', 'zoom', 'duplicates', 'OneDrive', '4K')..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="help-search-input"
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')}
              className="btn-clear-search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Main 2-Column Layout */}
        <div className="help-modal-layout">
          {/* Left Sidebar Topics List */}
          <div className="help-sidebar">
            <div className="help-sidebar-title">Topics & Features</div>
            <div className="help-topics-list">
              {filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection.id === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`help-topic-item ${isActive ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon size={18} className={isActive ? 'text-primary' : 'text-subtle'} />
                      <span className="help-topic-label">{sec.title}</span>
                    </div>
                    <span className="help-topic-badge">{sec.badge}</span>
                  </button>
                );
              })}

              {filteredSections.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>
                  No help topics match "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Right Main Content Pane */}
          <div className="help-content-pane">
            <div className="help-content-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="help-badge-lg">{activeSection.badge}</span>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{activeSection.title}</h3>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--text-subtle)' }}>
                {activeSection.summary}
              </p>
            </div>

            <div className="help-content-scrollable">
              {activeSection.content}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="help-modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-subtle)' }}>
            <Heart size={15} style={{ color: '#e11d48' }} />
            <span>Built with care for families, mothers, and grandmothers preserving their history.</span>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 20px' }}
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
}

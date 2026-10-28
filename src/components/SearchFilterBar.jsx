import { 
  Search, 
  ArrowUpDown, 
  Folder, 
  X, 
  RotateCcw, 
  Calendar, 
  Users, 
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';

const DECADES = [
  '1920s', '1930s', '1940s', '1950s', '1960s', 
  '1970s', '1980s', '1990s', '2000s'
];

export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  totalPhotos,
  untaggedCount,
  lowResCount,
  screenshotCount = 0,
  reviewCount = 0,
  peopleDetectedCount = 0,
  subfolders = [],
  selectedSubfolder = 'all',
  onSubfolderChange
}) {
  const isDecadeActive = /^\d{4}s$/.test(activeFilter);
  const isRelationActive = ['grandparents', 'group'].includes(activeFilter);
  const isStandardFilter = [
    'all', 'untagged', 'needs_enhancement', 'screenshots', 
    'review_folder', 'with_people', 'grandparents', 'group'
  ].includes(activeFilter) || isDecadeActive;

  const isPersonFilterActive = Boolean(activeFilter && !isStandardFilter);

  const hasActiveFilter = Boolean(
    (activeFilter && activeFilter !== 'all') || 
    searchQuery || 
    (selectedSubfolder && selectedSubfolder !== 'all')
  );

  const handleResetAll = () => {
    onSearchChange('');
    onFilterChange('all');
    if (onSubfolderChange) onSubfolderChange('all');
  };

  return (
    <div className="search-filter-wrapper compact-filter-bar">
      {/* Top Row: Search Input + Subfolder + Sort + Reset */}
      <div className="search-input-row compact-search-row">
        {/* Search Field */}
        <div className="search-field compact-field">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input compact-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, decade, memories, or subfolder..."
          />
          {searchQuery && (
            <button 
              type="button"
              className="search-clear-btn" 
              onClick={() => onSearchChange('')}
              title="Clear search query"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Subfolder Dropdown */}
        {subfolders && subfolders.length > 0 && (
          <div className="subfolder-field compact-field">
            <Folder size={15} className="subfolder-icon text-primary" />
            <select
              value={selectedSubfolder}
              onChange={(e) => onSubfolderChange && onSubfolderChange(e.target.value)}
              className="subfolder-select compact-select"
              aria-label="Filter by subfolder"
            >
              <option value="all">All Subfolders ({subfolders.length})</option>
              {subfolders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort Dropdown */}
        <div className="sort-field compact-field">
          <ArrowUpDown size={15} className="sort-icon text-muted" />
          <select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select compact-select"
            aria-label="Sort photos"
          >
            <option value="date_asc">Oldest first (Timeline)</option>
            <option value="date_desc">Newest first</option>
            <option value="name_asc">Name: A to Z</option>
            <option value="resolution_asc">Smallest (Thumbnails)</option>
            <option value="resolution_desc">Highest quality</option>
          </select>
        </div>

        {/* Quick Reset Button if any filter/search is active */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleResetAll}
            className="btn-reset-filters"
            title="Reset all filters and search query"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Bottom Row: Streamlined Single-Row Filter Chips & Dropdown Pills */}
      <div className="filter-chips-row compact-chips-row">
        <div className="chips-container compact-chips-container">
          {/* Active Individual Person Pill (if clicked on a photo) */}
          {isPersonFilterActive && (
            <button
              type="button"
              onClick={() => onFilterChange('all')}
              className="filter-chip active chip-person"
              title="Click to clear person filter"
            >
              <span>👤 {activeFilter}</span>
              <X size={13} className="chip-remove-icon" />
            </button>
          )}

          {/* All Photos */}
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
          >
            <span>All Photos</span>
            <span className="chip-count">{totalPhotos.toLocaleString()}</span>
          </button>

          {/* Untagged */}
          <button
            type="button"
            onClick={() => onFilterChange(activeFilter === 'untagged' ? 'all' : 'untagged')}
            className={`filter-chip ${activeFilter === 'untagged' ? 'active' : ''} ${untaggedCount > 0 ? 'chip-highlight' : ''}`}
          >
            <span>Untagged</span>
            <span className="chip-count">{untaggedCount.toLocaleString()}</span>
          </button>

          {/* 4K Restoration */}
          <button
            type="button"
            onClick={() => onFilterChange(activeFilter === 'needs_enhancement' ? 'all' : 'needs_enhancement')}
            className={`filter-chip ${activeFilter === 'needs_enhancement' ? 'active' : ''} ${lowResCount > 0 ? 'chip-accent' : ''}`}
          >
            <Sparkles size={13} className="chip-icon-inline" />
            <span>Restore to 4K</span>
            <span className="chip-count">{lowResCount.toLocaleString()}</span>
          </button>

          {/* Review Folder (if any) */}
          {reviewCount > 0 && (
            <button
              type="button"
              onClick={() => onFilterChange(activeFilter === 'review_folder' ? 'all' : 'review_folder')}
              className={`filter-chip ${activeFilter === 'review_folder' ? 'active' : ''} chip-warning`}
            >
              <span>Review Folder</span>
              <span className="chip-count">{reviewCount.toLocaleString()}</span>
            </button>
          )}

          {/* Screenshots (if any) */}
          {screenshotCount > 0 && (
            <button
              type="button"
              onClick={() => onFilterChange(activeFilter === 'screenshots' ? 'all' : 'screenshots')}
              className={`filter-chip ${activeFilter === 'screenshots' ? 'active' : ''} chip-danger`}
            >
              <span>Screenshots</span>
              <span className="chip-count">{screenshotCount.toLocaleString()}</span>
            </button>
          )}

          {/* People Detected */}
          {peopleDetectedCount > 0 && (
            <button
              type="button"
              onClick={() => onFilterChange(activeFilter === 'with_people' ? 'all' : 'with_people')}
              className={`filter-chip ${activeFilter === 'with_people' ? 'active' : ''}`}
            >
              <Users size={13} className="chip-icon-inline" />
              <span>With People</span>
              <span className="chip-count">{peopleDetectedCount.toLocaleString()}</span>
            </button>
          )}

          <div className="filter-chip-divider" />

          {/* Compact Decade Dropdown Pill */}
          <div className={`filter-select-pill ${isDecadeActive ? 'active' : ''}`}>
            <Calendar size={13} className="pill-icon" />
            <select
              value={isDecadeActive ? activeFilter : ''}
              onChange={(e) => onFilterChange(e.target.value || 'all')}
              className="pill-select"
              aria-label="Filter by decade"
            >
              <option value="">Decade...</option>
              {DECADES.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {isDecadeActive && (
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                className="pill-clear-btn"
                title="Clear decade filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Compact Relations Dropdown Pill */}
          <div className={`filter-select-pill ${isRelationActive ? 'active' : ''}`}>
            <Users size={13} className="pill-icon" />
            <select
              value={isRelationActive ? activeFilter : ''}
              onChange={(e) => onFilterChange(e.target.value || 'all')}
              className="pill-select"
              aria-label="Filter by relationship"
            >
              <option value="">Relations...</option>
              <option value="grandparents">👵 Grandparents</option>
              <option value="group">👥 Group Photos (2+)</option>
            </select>
            {isRelationActive && (
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                className="pill-clear-btn"
                title="Clear relations filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

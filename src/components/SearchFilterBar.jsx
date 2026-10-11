import React from 'react';
import { Search, ArrowUpDown, Folder } from 'lucide-react';

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
  const filterChips = [
    { id: 'all', label: `All Photos (${totalPhotos.toLocaleString()})` },
    ...(reviewCount > 0 ? [{
      id: 'review_folder',
      label: `📁 Review Folder (${reviewCount.toLocaleString()})`,
      highlight: true
    }] : []),
    ...(screenshotCount > 0 ? [{
      id: 'screenshots',
      label: `📸 Screenshots (${screenshotCount.toLocaleString()})`,
      highlight: true
    }] : []),
    { 
      id: 'untagged', 
      label: `❓ Untagged (${untaggedCount.toLocaleString()})`, 
      highlight: untaggedCount > 0 
    },
    { 
      id: 'needs_enhancement', 
      label: `✨ Restore to 4K (${lowResCount.toLocaleString()})`,
      highlight: lowResCount > 0 
    },
    ...(peopleDetectedCount > 0 ? [{
      id: 'with_people',
      label: `👥 People (${peopleDetectedCount.toLocaleString()})`,
      highlight: true
    }] : []),
    { id: 'grandparents', label: '👵 Grandparents' },
    { id: '1960s', label: '1960s' },
    { id: '1970s', label: '1970s' },
    { id: '1980s', label: '1980s' },
    { id: 'group', label: '👥 Group Photos' }
  ];

  return (
    <div className="search-filter-wrapper">
      <div className="search-input-row">
        <div className="search-field">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by person's name, relationship, decade, memories, or subfolder..."
          />
          {searchQuery && (
            <button 
              className="search-clear-btn" 
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Subfolder filter if multiple subfolders exist */}
        {subfolders && subfolders.length > 0 && (
          <div className="subfolder-field">
            <Folder size={18} className="subfolder-icon" />
            <select
              value={selectedSubfolder}
              onChange={(e) => onSubfolderChange && onSubfolderChange(e.target.value)}
              className="subfolder-select"
              aria-label="Filter by subfolder"
            >
              <option value="all">📁 All Subfolders ({subfolders.length} folders)</option>
              {subfolders.map((folder) => (
                <option key={folder} value={folder}>
                  📁 {folder}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sort-field">
          <ArrowUpDown size={18} className="sort-icon" />
          <select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select"
            aria-label="Sort photos"
          >
            <option value="date_asc">Date: Oldest first (Timeline)</option>
            <option value="date_desc">Date: Newest first</option>
            <option value="name_asc">File Name: A to Z</option>
            <option value="resolution_asc">Resolution: Smallest (Thumbnails) first</option>
            <option value="resolution_desc">Resolution: Highest quality first</option>
          </select>
        </div>
      </div>

      <div className="filter-chips-row">
        <span className="filter-label">Quick Filters:</span>
        <div className="chips-container">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => onFilterChange(chip.id)}
              className={`filter-chip ${activeFilter === chip.id ? 'active' : ''} ${chip.highlight ? 'chip-highlight' : ''}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

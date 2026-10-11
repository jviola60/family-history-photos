import React, { useState, useEffect } from 'react';
import PhotoCard from './PhotoCard';
import { ImageOff, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 48;

export default function PhotoGrid({ 
  photos, 
  onOpenMetadata, 
  onOpenEnhancer, 
  onResetFilters, 
  onRestorePhoto,
  onFacesDetected,
  onDimensionsDetected
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination whenever photo list or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="empty-grid-state">
        <ImageOff size={48} className="empty-icon" />
        <h3 className="empty-title">No photos found</h3>
        <p className="empty-desc">
          None of your photos matched the current search or filter criteria.
        </p>
        <button onClick={onResetFilters} className="btn btn-secondary">
          Clear Filters and Show All
        </button>
      </div>
    );
  }

  const visiblePhotos = photos.slice(0, visibleCount);
  const hasMore = visibleCount < photos.length;

  return (
    <div className="photo-grid-wrapper">
      <div className="photo-grid-count-bar">
        <span>Showing <strong>{Math.min(visibleCount, photos.length)}</strong> of <strong>{photos.length.toLocaleString()}</strong> photos</span>
      </div>

      <div className="photo-grid-layout">
        {visiblePhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onOpenMetadata={onOpenMetadata}
            onOpenEnhancer={onOpenEnhancer}
            onRestorePhoto={onRestorePhoto}
            onFacesDetected={onFacesDetected}
            onDimensionsDetected={onDimensionsDetected}
          />
        ))}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button 
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)} 
            className="btn btn-primary btn-load-more"
          >
            <ChevronDown size={20} />
            <span>Load More Photos ({visibleCount} of {photos.length.toLocaleString()} shown)</span>
          </button>
        </div>
      )}
    </div>
  );
}

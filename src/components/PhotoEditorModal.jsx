import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Crop as CropIcon, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  FlipHorizontal, 
  Check, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Eye, 
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cropImage, inpaintImage, loadImage } from '../lib/imageEditor';
import { checkLocalAiHealth, inpaintWithLocalAi } from '../lib/localAiService';

const ASPECT_RATIOS = [
  { id: 'free', label: 'Freeform', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '4:3', label: '4:3 Standard', ratio: 4 / 3 },
  { id: '3:2', label: '3:2 (4×6)', ratio: 3 / 2 },
  { id: '16:9', label: '16:9 Wide', ratio: 16 / 9 },
  { id: '3:4', label: '3:4 Portrait', ratio: 3 / 4 },
  { id: '2:3', label: '2:3 Tall', ratio: 2 / 3 }
];

export default function PhotoEditorModal({ photo, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('crop'); // 'crop' | 'erase'
  const [isMaximized, setIsMaximized] = useState(false);

  // History stack for Undo / Redo of full image edits
  const initialImage = photo.enhancedUrl || photo.objectUrl;
  const [currentImageUrl, setCurrentImageUrl] = useState(initialImage || '');
  const [history, setHistory] = useState([initialImage || '']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Fallback to load fresh URL from file handle if objectUrl was missing or revoked
  useEffect(() => {
    if (!currentImageUrl && photo.handle && typeof photo.handle.getFile === 'function') {
      photo.handle.getFile().then((file) => {
        if (file) {
          const fresh = URL.createObjectURL(file);
          photo.objectUrl = fresh;
          setCurrentImageUrl(fresh);
          setHistory([fresh]);
        }
      }).catch(err => console.warn('Could not load image from handle in editor:', err));
    }
  }, [photo.handle, currentImageUrl]);

  // Original untouched image for "Hold to Compare"
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);

  // Natural dimensions
  const [imageSize, setImageSize] = useState({ width: photo.width || 800, height: photo.height || 600 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // 🔍 Senior Magnification & Pan
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const didPanRef = useRef(false);

  // ✂️ Crop Tool States
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 1, height: 1 }); // Normalized 0..1 (default: entire photo)
  const [hasAdjustedCrop, setHasAdjustedCrop] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState('free');
  const [activeDragHandle, setActiveDragHandle] = useState(null);
  const dragStartRef = useRef(null);

  // 🧹 Magic Eraser Tool States
  const [brushSize, setBrushSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState([]); // Array of mask canvas states for stroke-undo
  const maskCanvasRef = useRef(null);
  const displayImageRef = useRef(null);
  const containerRef = useRef(null);

  // Load image dimensions on change
  useEffect(() => {
    loadImage(currentImageUrl).then(img => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    }).catch(err => console.warn('Could not read image dimensions:', err));
  }, [currentImageUrl]);

  // Push new image to history stack
  const pushToHistory = (newUrl) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newUrl);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    setCurrentImageUrl(newUrl);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setCurrentImageUrl(history[nextIndex]);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      clearMaskCanvas();
      setStatusMessage('Undid previous edit.');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCurrentImageUrl(history[nextIndex]);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      clearMaskCanvas();
      setStatusMessage('Redid edit.');
    }
  };

  const handleResetToOriginal = () => {
    if (window.confirm('Reset this photo back to the untouched original? All rotations, crops, and object removals will be cleared.')) {
      setCurrentImageUrl(initialImage);
      setHistory([initialImage]);
      setHistoryIndex(0);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      clearMaskCanvas();
      setStatusMessage('Reset to original photo.');
    }
  };

  // --- Zoom Handlers ---
  const handleZoomTo = (level) => {
    setZoomLevel(level);
    if (level === 1) setPanOffset({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomLevel(curr => {
      const next = Math.min(3, Math.max(1, +(curr + delta).toFixed(2)));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handlePanPointerDown = (e) => {
    if (zoomLevel <= 1 || activeDragHandle || isDrawing) return;
    setIsPanning(true);
    didPanRef.current = false;
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePanPointerMove = (e) => {
    if (!isPanning || zoomLevel <= 1) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
    setPanOffset({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy
    });
  };

  const handlePanPointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  // --- ✂️ Crop Tool Handlers ---
  const applyAspectRatioToBox = useCallback((ratioId, box = cropBox) => {
    const target = ASPECT_RATIOS.find(r => r.id === ratioId);
    if (!target || !target.ratio) return box;

    let targetRatio = target.ratio;
    if (targetRatio === 'original') {
      targetRatio = imageSize.width / Math.max(1, imageSize.height);
    }

    const currentW = box.width;
    const imageRatio = imageSize.width / Math.max(1, imageSize.height);

    // Calculate normalized height that matches target aspect ratio
    let newNormH = (currentW * imageRatio) / targetRatio;
    let newNormW = currentW;

    if (box.y + newNormH > 1.0) {
      newNormH = 1.0 - box.y;
      newNormW = (newNormH * targetRatio) / imageRatio;
    }

    return {
      x: Math.min(1 - newNormW, box.x),
      y: box.y,
      width: Math.min(1, newNormW),
      height: Math.min(1, newNormH)
    };
  }, [cropBox, imageSize]);

  const handleSelectRatio = (ratioId) => {
    setSelectedRatio(ratioId);
    if (ratioId === 'free') return;
    setHasAdjustedCrop(true);
    setCropBox(prev => applyAspectRatioToBox(ratioId, prev));
  };

  const handleCropPointerDown = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox }
    };
    try { e.target.setPointerCapture(e.pointerId); } catch {}
  };

  const handleCropPointerMove = (e) => {
    if (!activeDragHandle || !dragStartRef.current || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dx = (e.clientX - dragStartRef.current.clientX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.clientY) / rect.height;
    const init = dragStartRef.current.initialBox;

    let next = { ...init };

    if (activeDragHandle === 'move') {
      next.x = Math.max(0, Math.min(1 - init.width, init.x + dx));
      next.y = Math.max(0, Math.min(1 - init.height, init.y + dy));
    } else {
      if (activeDragHandle.includes('w')) {
        const newX = Math.max(0, Math.min(init.x + init.width - 0.05, init.x + dx));
        next.width = init.width - (newX - init.x);
        next.x = newX;
      }
      if (activeDragHandle.includes('e')) {
        next.width = Math.max(0.05, Math.min(1 - init.x, init.width + dx));
      }
      if (activeDragHandle.includes('n')) {
        const newY = Math.max(0, Math.min(init.y + init.height - 0.05, init.y + dy));
        next.height = init.height - (newY - init.y);
        next.y = newY;
      }
      if (activeDragHandle.includes('s')) {
        next.height = Math.max(0.05, Math.min(1 - init.y, init.height + dy));
      }

      if (selectedRatio !== 'free') {
        next = applyAspectRatioToBox(selectedRatio, next);
      }
    }

    setCropBox(next);
    setHasAdjustedCrop(true);
  };

  const handleCropPointerUp = (e) => {
    if (activeDragHandle) {
      setActiveDragHandle(null);
      dragStartRef.current = null;
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  // 🔄 Immediate Rotation & Flipping Handlers (applies directly to canvas & history)
  const handleRotate = async (degrees) => {
    setIsProcessing(true);
    setStatusMessage(degrees < 0 ? 'Rotating 90° Left...' : 'Rotating 90° Right...');
    try {
      const res = await cropImage(currentImageUrl, { x: 0, y: 0, width: 1, height: 1 }, {
        rotation: degrees,
        flipH: false
      });
      pushToHistory(res.dataUrl);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      clearMaskCanvas();
      setStatusMessage(`✓ Rotated 90° (${res.width} × ${res.height} px)`);
    } catch (err) {
      console.warn('Rotation failed:', err);
      setStatusMessage('Could not rotate photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlipHorizontal = async () => {
    setIsProcessing(true);
    setStatusMessage('Flipping horizontally...');
    try {
      const res = await cropImage(currentImageUrl, { x: 0, y: 0, width: 1, height: 1 }, {
        rotation: 0,
        flipH: true
      });
      pushToHistory(res.dataUrl);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      clearMaskCanvas();
      setStatusMessage('✓ Photo flipped horizontally.');
    } catch (err) {
      console.warn('Flip failed:', err);
      setStatusMessage('Could not flip photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCrop = async () => {
    setIsProcessing(true);
    setStatusMessage('Applying precision crop...');
    try {
      const res = await cropImage(currentImageUrl, cropBox, {
        rotation: 0,
        flipH: false
      });
      pushToHistory(res.dataUrl);
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
      setHasAdjustedCrop(false);
      setStatusMessage(`✓ Photo cropped to ${res.width} × ${res.height} px!`);
    } catch (err) {
      console.warn('Crop failed:', err);
      setStatusMessage('Could not crop image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 🧹 Magic Eraser Painting Handlers ---
  const initMaskCanvas = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !displayImageRef.current) return;
    const rect = displayImageRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    }
  };

  const clearMaskCanvas = () => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setStrokeHistory([]);
    }
  };

  const getCanvasCoords = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePaintPointerDown = (e) => {
    if (activeTab !== 'erase' || isProcessing || zoomLevel > 1) return;
    initMaskCanvas();
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Save previous snapshot for stroke-level undo
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setStrokeHistory(prev => [...prev.slice(-15), snapshot]);

    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);

    try { e.target.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePaintPointerMove = (e) => {
    if (!isDrawing || activeTab !== 'erase') return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePaintPointerUp = (e) => {
    if (isDrawing) {
      setIsDrawing(false);
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handleUndoStroke = () => {
    if (strokeHistory.length === 0) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const prevSnapshot = strokeHistory[strokeHistory.length - 1];
    setStrokeHistory(prev => prev.slice(0, prev.length - 1));
    ctx.putImageData(prevSnapshot, 0, 0);
  };

  const handleEraseObjects = async () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    setIsProcessing(true);
    setStatusMessage('Analyzing background texture and inpainting marked area...');

    try {
      let finalDataUrl = null;
      // Check if Local AI OpenCV inpainting is active
      const health = await checkLocalAiHealth();
      if (health?.available) {
        setStatusMessage('⚡ Inpainting with Local AI OpenCV Telea Engine...');
        finalDataUrl = await inpaintWithLocalAi(currentImageUrl, maskCanvas.toDataURL('image/png'));
      } else {
        const res = await inpaintImage(currentImageUrl, maskCanvas);
        finalDataUrl = res.dataUrl;
      }

      if (finalDataUrl) {
        pushToHistory(finalDataUrl);
        clearMaskCanvas();
        setStatusMessage('✓ Erased marked scratch/object and restored authentic texture!');
      }
    } catch (err) {
      console.warn('Local inpaint fallback:', err);
      try {
        const res = await inpaintImage(currentImageUrl, maskCanvas);
        pushToHistory(res.dataUrl);
        clearMaskCanvas();
        setStatusMessage('✓ Erased marked object (Client Engine)!');
      } catch {
        setStatusMessage('Could not erase object.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Save & Commit Edits ---
  const handleSaveAndClose = async () => {
    let finalUrl = currentImageUrl;
    // If the user modified the crop boundaries in the Crop tab but didn't click "Apply Crop",
    // automatically bake the crop before saving to the album so changes aren't lost!
    const isCropped = hasAdjustedCrop && (cropBox.x > 0.005 || cropBox.y > 0.005 || cropBox.width < 0.995 || cropBox.height < 0.995);
    if (isCropped) {
      try {
        setIsProcessing(true);
        setStatusMessage('Applying crop and saving to album...');
        const res = await cropImage(currentImageUrl, cropBox, { rotation: 0, flipH: false });
        finalUrl = res.dataUrl;
      } catch (err) {
        console.warn('Auto-crop before save failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }
    onSave(photo.id, finalUrl);
    onClose();
  };

  const computedWidth = Math.round(cropBox.width * imageSize.width);
  const computedHeight = Math.round(cropBox.height * imageSize.height);

  return (
    <div className="modal-backdrop">
      <div 
        className={`enhancer-modal-dialog ${isMaximized ? 'modal-dialog-maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title flex items-center gap-8">
              <span>✂️ Photo Studio: Crop & Magic Eraser</span>
              {historyIndex > 0 && (
                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                  {historyIndex} {historyIndex === 1 ? 'Edit Applied' : 'Edits Applied'}
                </span>
              )}
            </h3>
            <p className="modal-subtitle">
              Crop away unwanted borders or paint over dust, scratches, date stamps, and unwanted distractions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="btn-header-maximize"
              title={isMaximized ? "Restore standard size" : "Expand to Big Screen"}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isMaximized ? 'Standard Size' : 'Big Screen'}</span>
            </button>
            <button onClick={onClose} className="btn-icon-close" title="Cancel and close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'crop' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('crop'); clearMaskCanvas(); }}
              style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CropIcon size={16} />
              <span>1. Crop & Straighten</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'erase' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActiveTab('erase'); }}
              style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Eraser size={16} />
              <span>2. Magic Eraser (Remove Objects)</span>
            </button>
          </div>

          {/* Quick Undo / Redo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={historyIndex <= 0 || isProcessing}
              onClick={handleUndo}
              className="btn btn-secondary btn-xs"
              title="Undo previous edit"
            >
              <Undo2 size={13} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1 || isProcessing}
              onClick={handleRedo}
              className="btn btn-secondary btn-xs"
              title="Redo edit"
            >
              <Redo2 size={13} />
              <span>Redo</span>
            </button>
            {historyIndex > 0 && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="btn btn-outline btn-xs"
                title="Discard all edits and reset to original"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <span>Reset All</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="enhancer-modal-body" style={{ minHeight: '520px' }}>
          
          {/* Main Visual Workspace Column */}
          <div className="enhancer-preview-column" style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Senior Zoom Toolbar */}
            <div className="senior-zoom-toolbar" style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomIn size={13} />
                  <span>Magnify:</span>
                </span>
                <div className="senior-zoom-group">
                  {[1, 1.5, 2, 3].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleZoomTo(level)}
                      className={`senior-zoom-btn ${zoomLevel === level ? 'active' : ''}`}
                    >
                      {level === 1 ? 'Fit (100%)' : `${Math.round(level * 100)}%`}
                    </button>
                  ))}
                </div>
              </div>

              {zoomLevel > 1 && (
                <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600' }}>
                  ✋ Drag photo to pan around
                </span>
              )}
            </div>

            {/* Viewport Frame */}
            <div 
              ref={containerRef}
              style={{
                position: 'relative',
                flex: 1,
                minHeight: '440px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111827',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                userSelect: 'none',
                touchAction: 'none',
                cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : (activeTab === 'erase' ? 'crosshair' : 'default')
              }}
              onWheel={handleWheelZoom}
              onPointerDown={handlePanPointerDown}
              onPointerMove={(e) => {
                handlePanPointerMove(e);
                handleCropPointerMove(e);
              }}
              onPointerUp={(e) => {
                handlePanPointerUp(e);
                handleCropPointerUp(e);
              }}
            >
              {/* Working Photo Image */}
              <div 
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out'
                }}
              >
                <img
                  ref={displayImageRef}
                  src={isComparingOriginal ? initialImage : currentImageUrl}
                  alt={photo.name}
                  draggable={false}
                  onLoad={initMaskCanvas}
                  style={{
                    maxHeight: '62vh',
                    maxWidth: '100%',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                />

                {/* ✂️ Crop Bounding Box Overlay */}
                {activeTab === 'crop' && !isComparingOriginal && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      pointerEvents: 'none'
                    }}
                  >
                    {/* Dark Dim Backdrop Outside Crop */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${cropBox.y * 100}%`,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)'
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: `${(cropBox.y + cropBox.height) * 100}%`,
                      left: 0,
                      width: '100%',
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)'
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: `${cropBox.y * 100}%`,
                      left: 0,
                      width: `${cropBox.x * 100}%`,
                      height: `${cropBox.height * 100}%`,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)'
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: `${cropBox.y * 100}%`,
                      left: `${(cropBox.x + cropBox.width) * 100}%`,
                      right: 0,
                      height: `${cropBox.height * 100}%`,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)'
                    }} />

                    {/* Active Crop Frame */}
                    <div 
                      onPointerDown={(e) => handleCropPointerDown('move', e)}
                      style={{
                        position: 'absolute',
                        left: `${cropBox.x * 100}%`,
                        top: `${cropBox.y * 100}%`,
                        width: `${cropBox.width * 100}%`,
                        height: `${cropBox.height * 100}%`,
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                        cursor: 'move',
                        pointerEvents: 'auto'
                      }}
                      title="Drag to reposition crop box"
                    >
                      {/* Rule of Thirds Grid Lines */}
                      <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />

                      {/* 8 Resize Handles */}
                      {['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'].map(handle => {
                        const style = {
                          position: 'absolute',
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#ffffff',
                          border: '2px solid #000000',
                          borderRadius: '2px',
                          zIndex: 10
                        };
                        if (handle === 'nw') { style.top = '-6px'; style.left = '-6px'; style.cursor = 'nwse-resize'; }
                        if (handle === 'ne') { style.top = '-6px'; style.right = '-6px'; style.cursor = 'nesw-resize'; }
                        if (handle === 'se') { style.bottom = '-6px'; style.right = '-6px'; style.cursor = 'nwse-resize'; }
                        if (handle === 'sw') { style.bottom = '-6px'; style.left = '-6px'; style.cursor = 'nesw-resize'; }
                        if (handle === 'n') { style.top = '-6px'; style.left = 'calc(50% - 6px)'; style.cursor = 'ns-resize'; }
                        if (handle === 's') { style.bottom = '-6px'; style.left = 'calc(50% - 6px)'; style.cursor = 'ns-resize'; }
                        if (handle === 'w') { style.left = '-6px'; style.top = 'calc(50% - 6px)'; style.cursor = 'ew-resize'; }
                        if (handle === 'e') { style.right = '-6px'; style.top = 'calc(50% - 6px)'; style.cursor = 'ew-resize'; }

                        return (
                          <div
                            key={handle}
                            onPointerDown={(e) => handleCropPointerDown(handle, e)}
                            style={style}
                            title={`Drag to resize crop (${handle})`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 🧹 Magic Eraser Paint Mask Canvas */}
                {activeTab === 'erase' && !isComparingOriginal && (
                  <canvas
                    ref={maskCanvasRef}
                    onPointerDown={handlePaintPointerDown}
                    onPointerMove={handlePaintPointerMove}
                    onPointerUp={handlePaintPointerUp}
                    onPointerCancel={handlePaintPointerUp}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'crosshair',
                      touchAction: 'none'
                    }}
                    title="Paint directly over scratches, dates, or objects to erase them"
                  />
                )}
              </div>

              {/* Comparing Original Overlay Notice */}
              {isComparingOriginal && (
                <div style={{
                  position: 'absolute',
                  top: '14px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Eye size={14} /> Showing Original Untouched Photo
                </div>
              )}
            </div>

            {/* Status Feedback Notice */}
            {statusMessage && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: statusMessage.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                color: statusMessage.startsWith('✓') ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{statusMessage}</span>
                <button
                  type="button"
                  onClick={() => setStatusMessage('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Controls Sidebar Column */}
          <div className="enhancer-controls-column" style={{ width: '340px' }}>
            
            {/* TAB 1: ✂️ Crop Controls */}
            {activeTab === 'crop' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CropIcon size={16} color="#2563eb" />
                    <span>Aspect Ratio Frame:</span>
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                    Choose a standard photo shape or drag the box handles freely.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {ASPECT_RATIOS.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectRatio(item.id)}
                        className={`btn btn-xs ${selectedRatio === item.id ? 'btn-primary' : 'btn-outline'}`}
                        style={{ justifyContent: 'center' }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rotate & Flip */}
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(28, 25, 23, 0.03)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
                    Rotate & Straighten:
                  </h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRotate(-90)}
                      className="btn btn-secondary btn-xs"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Rotate 90 degrees counter-clockwise"
                    >
                      <RotateCcw size={13} /> 90° Left
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRotate(90)}
                      className="btn btn-secondary btn-xs"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Rotate 90 degrees clockwise"
                    >
                      <RotateCw size={13} /> 90° Right
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleFlipHorizontal}
                      className="btn btn-secondary btn-xs"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Mirror / flip horizontally"
                    >
                      <FlipHorizontal size={13} /> Flip
                    </button>
                  </div>
                </div>

                {/* Crop Dimensions readout */}
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-main)'
                }}>
                  <span>Result Resolution:</span>
                  <strong style={{ color: '#047857' }}>{computedWidth} × {computedHeight} px</strong>
                </div>

                {/* Apply Crop Action Button */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleApplyCrop}
                  className="btn btn-primary"
                  style={{ fontWeight: '800', width: '100%', padding: '10px' }}
                >
                  <Check size={16} />
                  <span>Apply Crop</span>
                </button>
              </div>
            )}

            {/* TAB 2: 🧹 Magic Eraser Controls */}
            {activeTab === 'erase' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eraser size={16} color="#ef4444" />
                    <span>Object & Blemish Eraser:</span>
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    Paint over dust specks, film scratches, date stamps, or unwanted photobombers.
                  </p>

                  {/* Brush Size Range Slider */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                      <span>Brush Size:</span>
                      <span style={{ color: 'var(--accent)' }}>{brushSize} px</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="80"
                      step="2"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {[
                        { label: 'Fine (10px)', size: 10 },
                        { label: 'Medium (26px)', size: 26 },
                        { label: 'Broad (55px)', size: 55 }
                      ].map(b => (
                        <button
                          key={b.size}
                          type="button"
                          onClick={() => setBrushSize(b.size)}
                          className={`btn btn-xs ${brushSize === b.size ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, fontSize: '10px' }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mask Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={strokeHistory.length === 0 || isProcessing}
                      onClick={handleUndoStroke}
                      className="btn btn-secondary btn-xs"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Undo the last brush stroke"
                    >
                      <Undo2 size={12} /> Undo Stroke
                    </button>
                    <button
                      type="button"
                      onClick={clearMaskCanvas}
                      className="btn btn-secondary btn-xs"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      title="Clear all painted mask strokes"
                    >
                      <Trash2 size={12} /> Clear Paint
                    </button>
                  </div>
                </div>

                {/* Big Erase Action Button */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleEraseObjects}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#dc2626',
                    borderColor: '#b91c1c',
                    color: '#ffffff',
                    fontWeight: '800',
                    width: '100%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" />
                      <span>Inpainting Background...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Erase Marked Area</span>
                    </>
                  )}
                </button>

                {/* Hold to Compare Original */}
                <button
                  type="button"
                  onPointerDown={() => setIsComparingOriginal(true)}
                  onPointerUp={() => setIsComparingOriginal(false)}
                  onPointerCancel={() => setIsComparingOriginal(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Press and hold to view untouched original"
                >
                  <Eye size={14} />
                  <span>Hold to See Untouched Original</span>
                </button>

                {/* Helpful Tip */}
                <div style={{
                  padding: '8px 10px',
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  color: 'var(--text-subtle)',
                  lineHeight: 1.4
                }}>
                  💡 <strong>How it works:</strong> The AI inpainter analyzes the authentic surrounding photo colors and film grain to seamlessly fill in the erased spot!
                </div>
              </div>
            )}

            {/* Bottom Finalize Button */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSaveAndClose}
                className="btn btn-primary"
                style={{ width: '100%', padding: '11px', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Check size={18} />
                <span>{isProcessing ? 'Processing & Saving...' : 'Save to Album & Close'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

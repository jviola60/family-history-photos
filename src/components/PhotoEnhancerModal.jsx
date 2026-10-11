import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  Check, 
  RefreshCw,
  Palette,
  SunMedium,
  Columns,
  Eye,
  Sliders,
  RotateCcw,
  Zap,
  Layers,
  Settings,
  ShieldCheck,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { enhanceImage, analyzeImageLuminance, runExtraPass } from '../lib/imageEnhancer';
import { getAiSettings, restoreWithCloudAi, FAL_MODELS } from '../lib/aiSettings';

export default function PhotoEnhancerModal({ photo, onClose, onSaveEnhanced, onOpenSettings }) {
  const [aiSettings, setAiSettings] = useState(getAiSettings());
  const activeFalModel = FAL_MODELS.find(m => m.id === (aiSettings.falModel || 'fal-ai/clarity-upscaler')) || FAL_MODELS[0];
  const [cloudError, setCloudError] = useState(null);
  const [targetRes, setTargetRes] = useState('4k'); // Default to 4K
  const [styleMode, setStyleMode] = useState(photo.faces && photo.faces.length > 0 ? 'portrait' : 'portrait'); // 'portrait' | 'natural' | 'shadow'
  const [passCount, setPassCount] = useState(1); // 1 clean pass by default to prevent overprocessing
  const [appliedPassesCount, setAppliedPassesCount] = useState(1);
  const [passProgressMessage, setPassProgressMessage] = useState('');
  const [baseSource, setBaseSource] = useState(photo.enhancedUrl ? 'enhanced' : 'original');
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);

  // Calibrated, natural defaults (avoids crunchy over-sharpening & white halos)
  const [skinSmoothing, setSkinSmoothing] = useState(0.55); // Flattering edge-preserving skin smoothing
  const [shadowLift, setShadowLift] = useState(0.12); // Subtle shadow lift
  const [brightnessBoost, setBrightnessBoost] = useState(0.02);
  const [sharpenAmount, setSharpenAmount] = useState(0.50); // Natural anti-ringing sharpening
  const [contrastBoost, setContrastBoost] = useState(1.01); // Soft studio contrast
  const [restoreColors, setRestoreColors] = useState(false); // Preserve authentic warm tones
  const [denoise, setDenoise] = useState(true);
  const [showManualControls, setShowManualControls] = useState(true);

  const [enhancedResultUrl, setEnhancedResultUrl] = useState(photo.enhancedUrl || null);
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);
  const [isCloudProcessing, setIsCloudProcessing] = useState(false);
  const isProcessing = isLocalProcessing || isCloudProcessing;
  const [sliderPosition, setSliderPosition] = useState(50); // Start at 50% for 50/50 balance
  const [viewMode, setViewMode] = useState('side_by_side'); // Start in side_by_side for clear comparison
  const [isDarkDetected, setIsDarkDetected] = useState(false);
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  // 🔍 Interactive Zoom & Synchronized Loupe
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = Fit, 2 = 2x, 3 = 3x
  const [panOrigin, setPanOrigin] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, originX: 50, originY: 50 });
  const didPanRef = useRef(false);

  const handleImageClick = (e) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(5, Math.min(95, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const clickY = Math.max(5, Math.min(95, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    if (zoomLevel === 1) {
      setPanOrigin({ x: clickX, y: clickY });
      setZoomLevel(2);
    } else {
      setZoomLevel(1);
      setPanOrigin({ x: 50, y: 50 });
    }
  };

  const handleZoomPointerDown = (e) => {
    if (zoomLevel === 1) return;
    setIsPanning(true);
    didPanRef.current = false;
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: panOrigin.x,
      originY: panOrigin.y
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleZoomPointerMove = (e) => {
    if (!isPanning || zoomLevel === 1) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didPanRef.current = true;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const deltaPercentX = (dx / rect.width) * 50;
    const deltaPercentY = (dy / rect.height) * 50;

    const newX = Math.max(5, Math.min(95, panStartRef.current.originX - deltaPercentX));
    const newY = Math.max(5, Math.min(95, panStartRef.current.originY - deltaPercentY));
    setPanOrigin({ x: newX, y: newY });
  };

  const handleZoomPointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const getZoomStyle = () => {
    if (zoomLevel > 1) {
      return {
        transform: `scale(${zoomLevel})`,
        transformOrigin: `${panOrigin.x}% ${panOrigin.y}%`,
        transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform-origin 0.15s ease',
        cursor: isPanning ? 'grabbing' : 'grab',
        touchAction: 'none'
      };
    }
    return {
      cursor: 'zoom-in',
      transition: 'transform 0.2s ease',
      transform: 'scale(1)'
    };
  };

  // Run enhancement with current or overridden settings
  const runEnhancementWith = useCallback(async (overrides = {}) => {
    setIsLocalProcessing(true);
    const chosenRes = overrides.targetRes ?? targetRes;
    const chosenPasses = overrides.passes ?? passCount;
    const chosenStyle = overrides.style ?? styleMode;
    const chosenBase = overrides.baseImage || (baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : photo.objectUrl);

    const config = {
      targetRes: chosenRes,
      passes: chosenPasses,
      style: chosenStyle,
      skinSmoothing: overrides.skinSmoothing ?? skinSmoothing,
      sharpenAmount: overrides.sharpenAmount ?? sharpenAmount,
      contrastBoost: overrides.contrastBoost ?? contrastBoost,
      shadowLift: overrides.shadowLift ?? shadowLift,
      brightnessBoost: overrides.brightnessBoost ?? brightnessBoost,
      restoreColors: overrides.restoreColors ?? restoreColors,
      denoise: overrides.denoise ?? denoise,
      onProgress: (passNum, total, msg) => {
        setPassProgressMessage(msg);
      }
    };

    try {
      const result = await enhanceImage(chosenBase, config);
      setEnhancedResultUrl(result);
      setAppliedPassesCount(chosenPasses);
    } catch (err) {
      console.error('Enhancement failed:', err);
    } finally {
      setIsLocalProcessing(false);
      setIsLiveUpdating(false);
      setPassProgressMessage('');
    }
  }, [photo.objectUrl, photo.enhancedUrl, baseSource, targetRes, passCount, styleMode, skinSmoothing, sharpenAmount, contrastBoost, shadowLift, brightnessBoost, restoreColors, denoise]);

  // Apply one of the 3 calibrated restoration styles
  const applyRestorationStyle = useCallback((style) => {
    setStyleMode(style);
    let newSmooth = 0.55;
    let newSharpen = 0.50;
    let newShadow = 0.12;
    let newBright = 0.02;
    let newContrast = 1.01;
    let newColors = false;

    if (style === 'portrait') {
      newSmooth = 0.60;
      newSharpen = 0.45;
      newShadow = 0.10;
      newBright = 0.02;
      newContrast = 1.01;
      newColors = false;
    } else if (style === 'natural') {
      newSmooth = 0.0;
      newSharpen = 0.45;
      newShadow = 0.0;
      newBright = 0.0;
      newContrast = 1.0;
      newColors = false;
    } else if (style === 'shadow') {
      newSmooth = 0.20;
      newSharpen = 0.70;
      newShadow = 0.70;
      newBright = 0.10;
      newContrast = 1.04;
      newColors = true;
    }

    setSkinSmoothing(newSmooth);
    setSharpenAmount(newSharpen);
    setShadowLift(newShadow);
    setBrightnessBoost(newBright);
    setContrastBoost(newContrast);
    setRestoreColors(newColors);

    runEnhancementWith({
      style,
      skinSmoothing: newSmooth,
      sharpenAmount: newSharpen,
      shadowLift: newShadow,
      brightnessBoost: newBright,
      contrastBoost: newContrast,
      restoreColors: newColors,
      passes: 1
    });
  }, [runEnhancementWith]);

  // Automatic 1-Click Action
  const handleAutoEnhance = useCallback(async (res = '4k', forcedStyle = 'portrait') => {
    setTargetRes(res);
    setIsLocalProcessing(true);

    const chosenBase = baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : photo.objectUrl;

    try {
      const analysis = await analyzeImageLuminance(chosenBase);
      const isDark = analysis.isDark;
      setIsDarkDetected(isDark);

      // Default to portrait for family photos, or shadow if low lighting
      const style = isDark ? 'shadow' : (typeof forcedStyle === 'string' ? forcedStyle : 'portrait');
      setStyleMode(style);

      const newSmooth = style === 'portrait' ? 0.60 : (style === 'shadow' ? 0.20 : 0.0);
      const newSharpen = style === 'shadow' ? 0.70 : (style === 'portrait' ? 0.50 : 0.45);
      const newShadow = style === 'shadow' ? 0.70 : (style === 'portrait' ? 0.12 : 0.0);
      const newBright = style === 'shadow' ? 0.10 : (style === 'portrait' ? 0.02 : 0.0);
      const newContrast = style === 'shadow' ? 1.04 : (style === 'portrait' ? 1.01 : 1.0);
      const newColors = style === 'shadow';

      setSkinSmoothing(newSmooth);
      setShadowLift(newShadow);
      setBrightnessBoost(newBright);
      setContrastBoost(newContrast);
      setSharpenAmount(newSharpen);
      setRestoreColors(newColors);

      const result = await enhanceImage(chosenBase, {
        targetRes: res,
        passes: 1,
        style,
        skinSmoothing: newSmooth,
        shadowLift: newShadow,
        brightnessBoost: newBright,
        contrastBoost: newContrast,
        sharpenAmount: newSharpen,
        restoreColors: newColors,
        denoise: true,
        onProgress: (passNum, total, msg) => {
          setPassProgressMessage(msg);
        }
      });
      setEnhancedResultUrl(result);
      setAppliedPassesCount(1);
    } catch (err) {
      console.error('Auto enhance failed:', err);
    } finally {
      setIsLocalProcessing(false);
      setIsLiveUpdating(false);
      setPassProgressMessage('');
    }
  }, [photo.objectUrl, photo.enhancedUrl, baseSource]);

  // Instant Extra Pass (+1 Pass) stacked directly onto current result
  const handleAddExtraPass = async () => {
    if (!enhancedResultUrl || isProcessing) return;
    setIsLocalProcessing(true);
    setPassProgressMessage(`Applying extra 4K reconstruction pass (${appliedPassesCount + 1})...`);
    try {
      const newResult = await runExtraPass(enhancedResultUrl, {
        sharpenAmount,
        contrastBoost,
        shadowLift: shadowLift * 0.7,
        brightnessBoost: 0.02
      });
      setEnhancedResultUrl(newResult);
      setAppliedPassesCount(prev => prev + 1);
    } catch (err) {
      console.error('Failed to add extra pass:', err);
    } finally {
      setIsLocalProcessing(false);
      setPassProgressMessage('');
    }
  };

  // Live interactive debounced auto-update on slider movements
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsLiveUpdating(true);
    debounceTimerRef.current = setTimeout(() => {
      runEnhancementWith();
    }, 240);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [shadowLift, brightnessBoost, sharpenAmount, contrastBoost, restoreColors, denoise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run optimal enhancement when modal opens
  useEffect(() => {
    handleAutoEnhance('4k', 'portrait');
  }, [photo.objectUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSliderPos = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(2, Math.min(98, pos)));
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateSliderPos(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateSliderPos(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      // Keep dragging flag briefly to prevent trailing backdrop click from closing
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 200);
    }
  };

  const handleBackdropClick = (e) => {
    // Only close if user clicked directly on background backdrop AND was not dragging
    if (e.target === e.currentTarget && !isDraggingRef.current) {
      onClose();
    }
  };

  // Sync with AI settings changes
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      if (e.detail) setAiSettings(e.detail);
      else setAiSettings(getAiSettings());
    };
    window.addEventListener('ai_settings_changed', handleSettingsUpdate);
    return () => window.removeEventListener('ai_settings_changed', handleSettingsUpdate);
  }, []);

  // Fal.ai Cloud AI Restoration Action
  const handleFalAiRestoration = async () => {
    const currentSettings = getAiSettings();
    if (!currentSettings.falApiKey) {
      if (onOpenSettings) onOpenSettings();
      return;
    }
    const currentModel = FAL_MODELS.find(m => m.id === (currentSettings.falModel || 'fal-ai/clarity-upscaler')) || FAL_MODELS[0];
    setIsCloudProcessing(true);
    setCloudError(null);
    setPassProgressMessage(`⚡ Connecting to Fal.ai cloud GPU (${currentModel.name})...`);
    try {
      const chosenBase = baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : photo.objectUrl;
      const res = await restoreWithCloudAi(chosenBase, currentSettings, (msg) => {
        setPassProgressMessage(msg);
      });
      if (res && res.url) {
        setEnhancedResultUrl(res.url);
        setAppliedPassesCount(1);
        setStyleMode('fal_ai');
      }
    } catch (err) {
      console.error('Fal.ai restoration failed:', err);
      setCloudError(err.message || 'Fal.ai restoration failed. Please check your API key and connection.');
    } finally {
      setIsCloudProcessing(false);
      setPassProgressMessage('');
    }
  };

  const handleApply = async () => {
    if (!enhancedResultUrl) return;
    setIsLocalProcessing(true);
    setPassProgressMessage('Saving enhanced photo to album...');
    try {
      let finalUrl = enhancedResultUrl;
      // Convert remote URL to permanent local dataURL for offline IndexedDB storage
      if (finalUrl.startsWith('http')) {
        try {
          const resp = await fetch(finalUrl);
          const blob = await resp.blob();
          finalUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          console.warn('Could not convert remote URL to dataURL, saving remote URL directly:', fetchErr);
        }
      }
      onSaveEnhanced(photo.id, finalUrl);
      onClose();
    } catch (err) {
      console.error('Failed to save enhanced image:', err);
      onSaveEnhanced(photo.id, enhancedResultUrl);
      onClose();
    } finally {
      setIsLocalProcessing(false);
      setPassProgressMessage('');
    }
  };

  const handleDownload = async () => {
    if (!enhancedResultUrl) return;
    try {
      if (enhancedResultUrl.startsWith('http')) {
        const resp = await fetch(enhancedResultUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `Enhanced_4K_${photo.name || 'photo.jpg'}`;
        link.href = blobUrl;
        link.click();
        URL.revokeObjectURL(blobUrl);
      } else {
        const link = document.createElement('a');
        link.download = `Enhanced_4K_${photo.name || 'photo.jpg'}`;
        link.href = enhancedResultUrl;
        link.click();
      }
    } catch {
      const link = document.createElement('a');
      link.download = `Enhanced_4K_${photo.name || 'photo.jpg'}`;
      link.href = enhancedResultUrl;
      link.target = '_blank';
      link.click();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div 
        className="enhancer-modal-dialog" 
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title-wrap">
            <h3 className="modal-title flex items-center gap-8">
              <span>✨ Photo Restorer & 4K Super-Resolution Upscaler</span>
            </h3>
            <p className="modal-subtitle">
              Progressive multi-octave AI upscaling to 3840×2160 (4K Ultra HD) with shadow detail recovery.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div className="enhancer-modal-body">
          
          {/* Main Comparison Area with Split Slider or Side-by-Side */}
          <div className="enhancer-preview-column">
            
            {/* View Mode Bar */}
            <div className="enhancer-view-mode-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div className="enhancer-mode-pills">
                <button
                  type="button"
                  className={`enhancer-mode-btn ${viewMode === 'slider' ? 'active' : ''}`}
                  onClick={() => setViewMode('slider')}
                  title="Compare with sliding before/after divider"
                >
                  <Columns size={14} />
                  <span>Split Slider</span>
                </button>
                <button
                  type="button"
                  className={`enhancer-mode-btn ${viewMode === 'side_by_side' ? 'active' : ''}`}
                  onClick={() => setViewMode('side_by_side')}
                  title="View original and enhanced photos side by side"
                >
                  <span>◫ Side-by-Side</span>
                </button>
                <button
                  type="button"
                  className={`enhancer-mode-btn ${viewMode === 'original' ? 'active' : ''}`}
                  onClick={() => setViewMode('original')}
                  title="View full Original photo"
                >
                  <Eye size={14} />
                  <span>Original</span>
                </button>
                <button
                  type="button"
                  className={`enhancer-mode-btn ${viewMode === 'enhanced' ? 'active' : ''}`}
                  onClick={() => setViewMode('enhanced')}
                  title="View full Enhanced photo"
                >
                  <Sparkles size={14} />
                  <span>Enhanced ({targetRes.toUpperCase()})</span>
                </button>
              </div>

              {/* 🔍 Zoom & Synchronized Detail Inspector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 4px',
                  border: '1px solid var(--border-light)'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ZoomIn size={12} />
                    <span>Zoom:</span>
                  </span>
                  <button
                    type="button"
                    className={`btn-xs ${zoomLevel === 1 ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', border: 'none', cursor: 'pointer', fontWeight: zoomLevel === 1 ? '700' : '500' }}
                    onClick={() => { setZoomLevel(1); setPanOrigin({ x: 50, y: 50 }); }}
                    title="Fit image to window (1x)"
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    className={`btn-xs ${zoomLevel === 2 ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', border: 'none', cursor: 'pointer', fontWeight: zoomLevel === 2 ? '700' : '500' }}
                    onClick={() => { setZoomLevel(2); setPanOrigin({ x: 50, y: 35 }); }}
                    title="Zoom in 2x to inspect face details"
                  >
                    2x
                  </button>
                  <button
                    type="button"
                    className={`btn-xs ${zoomLevel === 3 ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', border: 'none', cursor: 'pointer', fontWeight: zoomLevel === 3 ? '700' : '500' }}
                    onClick={() => { setZoomLevel(3); setPanOrigin({ x: 50, y: 35 }); }}
                    title="Zoom in 3x for close-up pixel inspection"
                  >
                    3x
                  </button>
                </div>

                {viewMode === 'slider' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setSliderPosition(50)}
                    title="Reset slider to 50/50 center"
                  >
                    <RotateCcw size={12} />
                    <span>50/50</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mode 1: Split Slider View */}
            {viewMode === 'slider' && (
              <>
                <div 
                  ref={containerRef}
                  className="split-comparison-container"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{ touchAction: 'none' }}
                >
                  {/* Original (Left side) */}
                  <img 
                    src={photo.objectUrl} 
                    alt="Original" 
                    className="comparison-slide-img original-img" 
                    style={getZoomStyle()}
                    draggable={false}
                  />
                  <span className="slide-label label-before">
                    Original ({photo.width > 0 ? `${photo.width}×${photo.height}` : 'Before'})
                  </span>

                  {/* Enhanced (Right clipped foreground) */}
                  {enhancedResultUrl && (
                    <div 
                      className="enhanced-clip-overlay"
                      style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                    >
                      <img 
                        src={enhancedResultUrl} 
                        alt="Enhanced" 
                        className="comparison-slide-img enhanced-img" 
                        style={getZoomStyle()}
                        draggable={false}
                      />
                      <span className="slide-label label-after">
                        ✨ Enhanced ({targetRes.toUpperCase()})
                      </span>
                    </div>
                  )}

                  {/* Slider Handle Divider */}
                  <div 
                    className="split-slider-divider"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className="slider-handle-circle" title="Drag left or right to compare">
                      <span style={{ fontSize: '9px', fontWeight: 'bold' }}>◀ ▶</span>
                    </div>
                  </div>
                </div>

                {/* Resolution Comparison Badge */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '6px 12px', 
                  fontSize: '11px', 
                  backgroundColor: 'rgba(28, 25, 23, 0.04)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '8px',
                  color: 'var(--text-subtle)'
                }}>
                  <span>Original: <strong>{photo.width || 320} × {photo.height || 240} px</strong></span>
                  <span>Enhanced: <strong style={{ color: 'var(--accent)' }}>3840 × 2160 px (4K Ultra HD • {appliedPassesCount} {appliedPassesCount === 1 ? 'Pass' : 'Passes'} Applied)</strong></span>
                </div>

                {/* Helpful Instruction for Seniors */}
                <div 
                  style={{
                    backgroundColor: zoomLevel > 1 ? 'rgba(37, 99, 235, 0.08)' : 'rgba(28, 25, 23, 0.05)',
                    border: zoomLevel > 1 ? '1px solid rgba(37, 99, 235, 0.25)' : 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '10px',
                    fontSize: '12px',
                    color: zoomLevel > 1 ? '#1d4ed8' : 'var(--text-subtle)',
                    textAlign: 'center'
                  }}
                >
                  {zoomLevel > 1 ? (
                    <span>🔍 <strong>{zoomLevel}x Zoom:</strong> Drag the slider left/right to compare up-close details. Click 'Fit' above to zoom out.</span>
                  ) : (
                    <span><strong>Left side</strong> is Original • <strong>Right side</strong> is Enhanced. Drag slider ◀ LEFT or ▶ RIGHT to compare.</span>
                  )}
                </div>
              </>
            )}

            {/* Mode 2: Side-by-Side View */}
            {viewMode === 'side_by_side' && (
              <>
                <div className="side-by-side-comparison">
                  <div 
                    className="side-by-side-box"
                    onClick={handleImageClick}
                    onPointerDown={handleZoomPointerDown}
                    onPointerMove={handleZoomPointerMove}
                    onPointerUp={handleZoomPointerUp}
                    onPointerCancel={handleZoomPointerUp}
                    style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
                    title={zoomLevel > 1 ? "Drag to pan both sides • Click to zoom out" : "Click anywhere to zoom in 2x and inspect faces"}
                  >
                    <img 
                      src={photo.objectUrl} 
                      alt="Original" 
                      className="comparison-slide-img" 
                      style={getZoomStyle()}
                      draggable={false}
                    />
                    <span className="slide-label label-before">Original</span>
                  </div>
                  <div 
                    className="side-by-side-box"
                    onClick={handleImageClick}
                    onPointerDown={handleZoomPointerDown}
                    onPointerMove={handleZoomPointerMove}
                    onPointerUp={handleZoomPointerUp}
                    onPointerCancel={handleZoomPointerUp}
                    style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
                    title={zoomLevel > 1 ? "Drag to pan both sides • Click to zoom out" : "Click anywhere to zoom in 2x and inspect faces"}
                  >
                    {enhancedResultUrl ? (
                      <img 
                        src={enhancedResultUrl} 
                        alt="Enhanced" 
                        className="comparison-slide-img" 
                        style={getZoomStyle()}
                        draggable={false}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                        Processing...
                      </div>
                    )}
                    <span className="slide-label label-after">✨ Enhanced ({targetRes.toUpperCase()} • {appliedPassesCount} Passes)</span>
                  </div>
                </div>

                {/* Helpful Instruction / Synchronized Zoom Status */}
                <div 
                  style={{
                    backgroundColor: zoomLevel > 1 ? 'rgba(37, 99, 235, 0.08)' : 'rgba(28, 25, 23, 0.05)',
                    border: zoomLevel > 1 ? '1px solid rgba(37, 99, 235, 0.25)' : 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '10px',
                    fontSize: '12px',
                    color: zoomLevel > 1 ? '#1d4ed8' : 'var(--text-subtle)',
                    textAlign: 'center'
                  }}
                >
                  {zoomLevel > 1 ? (
                    <span>
                      🔍 <strong>{zoomLevel}x Synchronized Zoom Active:</strong> Both photos are locked together! Drag to pan around faces • Click to zoom out.
                    </span>
                  ) : (
                    <span>
                      💡 <strong>Click directly on either face</strong> to zoom in 2x and inspect eyelashes, eyes, and skin smoothness side-by-side.
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Mode 3: Original Only */}
            {viewMode === 'original' && (
              <>
                <div 
                  className="split-comparison-container" 
                  onClick={handleImageClick}
                  onPointerDown={handleZoomPointerDown}
                  onPointerMove={handleZoomPointerMove}
                  onPointerUp={handleZoomPointerUp}
                  onPointerCancel={handleZoomPointerUp}
                  style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
                >
                  <img 
                    src={photo.objectUrl} 
                    alt="Original" 
                    className="comparison-slide-img" 
                    style={getZoomStyle()}
                    draggable={false}
                  />
                  <span className="slide-label label-before">Original Photo</span>
                </div>
                {zoomLevel > 1 && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#1d4ed8', marginTop: '6px' }}>
                    🔍 {zoomLevel}x Zoom: Drag to pan • Click to reset
                  </div>
                )}
              </>
            )}

            {/* Mode 4: Enhanced Only */}
            {viewMode === 'enhanced' && (
              <>
                <div 
                  className="split-comparison-container" 
                  onClick={handleImageClick}
                  onPointerDown={handleZoomPointerDown}
                  onPointerMove={handleZoomPointerMove}
                  onPointerUp={handleZoomPointerUp}
                  onPointerCancel={handleZoomPointerUp}
                  style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
                >
                  {enhancedResultUrl && (
                    <img 
                      src={enhancedResultUrl} 
                      alt="Enhanced" 
                      className="comparison-slide-img" 
                      style={getZoomStyle()}
                      draggable={false}
                    />
                  )}
                  <span className="slide-label label-after">✨ Enhanced ({targetRes.toUpperCase()} • {appliedPassesCount} Passes)</span>
                </div>
                {zoomLevel > 1 && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#1d4ed8', marginTop: '6px' }}>
                    🔍 {zoomLevel}x Zoom: Drag to pan • Click to reset
                  </div>
                )}
              </>
            )}

            {isProcessing && (
              <div className="processing-indicator-pill">
                <RefreshCw size={16} className="spin-icon" />
                <span>
                  {isCloudProcessing 
                    ? (passProgressMessage || '⚡ Running Fal.ai CodeFormer cloud face reconstruction...')
                    : (passProgressMessage || `Enhancing in browser (100% offline & free)...`)}
                </span>
              </div>
            )}

            {isDarkDetected && (
              <div 
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <SunMedium size={16} className="text-warning" />
                <span><strong>Dark Photo Detected:</strong> Shadow Lift automatically applied to reveal eyes and hidden details.</span>
              </div>
            )}
          </div>

          {/* Controls Column */}
          <div className="enhancer-controls-column">
            
            {/* Optional Re-enhancement Base Selection for already-enhanced photos */}
            {photo.enhancedUrl && (
              <div style={{
                marginBottom: '14px',
                padding: '10px 14px',
                backgroundColor: 'rgba(217, 119, 6, 0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(217, 119, 6, 0.25)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  ✨ Enhance Base:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn btn-xs ${baseSource === 'enhanced' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      setBaseSource('enhanced');
                      runEnhancementWith({ baseImage: photo.enhancedUrl });
                    }}
                    title="Build on top of your saved 4K photo"
                  >
                    Stack on Saved 4K Photo
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${baseSource === 'original' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      setBaseSource('original');
                      runEnhancementWith({ baseImage: photo.objectUrl });
                    }}
                    title="Start fresh from the untouched original"
                  >
                    Start Fresh from Original
                  </button>
                </div>
              </div>
            )}

            {/* AI Provider Status & Fal.ai Cloud Panel */}
            {aiSettings.provider === 'fal' ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.02) 100%)',
                border: '1.5px solid rgba(37, 99, 235, 0.35)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#2563eb" />
                    <strong style={{ fontSize: '13px', color: '#1e40af' }}>
                      Fal.ai Cloud AI
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: '10px', fontWeight: '700' }}>
                      {activeFalModel.badge}
                    </span>
                    <span className="badge" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#1e40af', fontSize: '10px', fontWeight: '600' }}>
                      {activeFalModel.cost}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 8px 0' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                    Model: {activeFalModel.name}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    Change Model
                  </button>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                  {activeFalModel.desc}
                </p>

                {aiSettings.falApiKey ? (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleFalAiRestoration}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      backgroundColor: '#2563eb',
                      borderColor: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                    }}
                  >
                    <Sparkles size={16} />
                    <span>{isCloudProcessing ? (passProgressMessage || '⚡ Connecting to Fal.ai cloud GPU...') : `⚡ Restore with ${activeFalModel.name} (${activeFalModel.time})`}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️ No Fal.ai API key added yet.</span>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="btn btn-outline btn-sm"
                      style={{ borderColor: '#2563eb', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Settings size={14} />
                      <span>Add Free Fal.ai Key in Settings</span>
                    </button>
                  </div>
                )}

                {cloudError && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#dc2626',
                    lineHeight: 1.4
                  }}>
                    {cloudError}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'rgba(28, 25, 23, 0.04)',
                borderRadius: '8px',
                marginBottom: '14px',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={16} color="var(--accent)" />
                  <span>Provider: <strong>Self-Contained (100% Offline & Free)</strong></span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="btn btn-secondary btn-xs"
                  style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Configure cloud AI providers like Fal.ai"
                >
                  <Settings size={12} />
                  <span>Settings</span>
                </button>
              </div>
            )}

            {/* 1-Click Restoration Style Buttons */}
            <div className="enhancer-control-section" style={{ borderBottom: '2px solid var(--border-light)' }}>
              <label className="section-label" style={{ marginBottom: '8px' }}>
                <Zap size={16} className="text-accent" />
                <span>1-Click Restoration Style:</span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. Portrait Style (Recommended for people) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => applyRestorationStyle('portrait')}
                  className={`btn-auto-enhance ${styleMode === 'portrait' ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>
                      👤 Portrait (Smooth Skin & Natural Eyes)
                    </span>
                    {styleMode === 'portrait' && <span className="badge badge-success">Active</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Recommended for family photos: soft, natural skin smoothing with zero white halos or crunchiness.
                  </span>
                </button>

                {/* 2. Natural Clean Style */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => applyRestorationStyle('natural')}
                  className={`btn-auto-enhance ${styleMode === 'natural' ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      🍃 Natural Clean (True-to-Life 4K)
                    </span>
                    {styleMode === 'natural' && <span className="badge badge-success">Active</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Clean 4K upscale that protects authentic photo character with zero artificial filters.
                  </span>
                </button>

                {/* 3. Deep Shadow Recovery Style */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => applyRestorationStyle('shadow')}
                  className={`btn-auto-enhance ${styleMode === 'shadow' ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      🌙 Deep Shadow Recovery (For Dark Photos)
                    </span>
                    {styleMode === 'shadow' && <span className="badge badge-success">Active</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Illuminates underexposed faces, dark eyes, and dark fur hidden in deep shadows.
                  </span>
                </button>
              </div>

              {/* Target Resolution */}
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-subtle)' }}>Resolution:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn btn-xs ${targetRes === '4k' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setTargetRes('4k'); runEnhancementWith({ targetRes: '4k' }); }}
                  >
                    4K Ultra HD
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${targetRes === '1080p' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setTargetRes('1080p'); runEnhancementWith({ targetRes: '1080p' }); }}
                  >
                    1080p Full HD
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Controls Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', marginBottom: '12px' }}>
              <label className="section-label" style={{ margin: 0 }}>
                <Sliders size={16} />
                <span>Manual Adjustments (Optional):</span>
              </label>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setShowManualControls(!showManualControls)}
              >
                {showManualControls ? 'Hide Sliders' : 'Show Sliders'}
              </button>
            </div>

            {showManualControls && (
              <>
                {/* Live updating badge */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '6px 12px', 
                  backgroundColor: isLiveUpdating ? 'rgba(217, 119, 6, 0.15)' : 'rgba(28, 25, 23, 0.05)', 
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '10px',
                  fontSize: '11px',
                  color: isLiveUpdating ? 'var(--accent)' : 'var(--text-subtle)'
                }}>
                  <span>⚡ <strong>Live Preview:</strong> Adjusting sliders updates the photo automatically.</span>
                  {isLiveUpdating && <RefreshCw size={12} className="spin-icon text-warning" />}
                </div>

                {/* 1. Portrait Skin Smoothing */}
                <div className="enhancer-control-section" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div className="slider-range-group">
                    <div className="range-header">
                      <span className="flex items-center gap-6" style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                        <span>👤 Portrait Skin Smoothing:</span>
                      </span>
                      <span className="range-value">{Math.round(skinSmoothing * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={skinSmoothing}
                      onChange={(e) => setSkinSmoothing(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Softens pores, noise, and harsh texture while keeping eyes, lips, and hair sharp.
                    </p>
                  </div>
                </div>

                {/* 2. Shadow Recovery / Lighten Dark Areas */}
                <div className="enhancer-control-section" style={{ backgroundColor: 'rgba(217, 119, 6, 0.05)', padding: '12px', borderRadius: 'var(--radius-md)', marginTop: '10px' }}>
                  <div className="slider-range-group">
                    <div className="range-header">
                      <span className="flex items-center gap-6" style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                        <SunMedium size={16} className="text-warning" />
                        <span>Lighten Dark Areas & Eyes (Shadow Lift):</span>
                      </span>
                      <span className="range-value">{Math.round(shadowLift * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={shadowLift}
                      onChange={(e) => setShadowLift(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Brings out eyes, dark fur, and faces hidden in deep shadows without blowing out bright areas.
                    </p>
                  </div>

                  {/* Overall Brightness */}
                  <div className="slider-range-group" style={{ marginTop: '12px' }}>
                    <div className="range-header">
                      <span>Overall Brightness / Exposure:</span>
                      <span className="range-value">{brightnessBoost >= 0 ? `+${Math.round(brightnessBoost * 100)}%` : `${Math.round(brightnessBoost * 100)}%`}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.25"
                      max="0.45"
                      step="0.05"
                      value={brightnessBoost}
                      onChange={(e) => setBrightnessBoost(parseFloat(e.target.value))}
                      className="range-input"
                    />
                  </div>
                </div>

                {/* 3. Anti-Ringing Edge Sharpening */}
                <div className="enhancer-control-section" style={{ marginTop: '10px' }}>
                  <div className="slider-range-group">
                    <div className="range-header">
                      <span>Facial & Edge Sharpening (Anti-Ringing):</span>
                      <span className="range-value">{sharpenAmount.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.2"
                      step="0.05"
                      value={sharpenAmount}
                      onChange={(e) => setSharpenAmount(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Strict anti-ringing clamp active: enhances real contours without creating white halos.
                    </p>
                  </div>

                  {/* 4. Contrast Tuning */}
                  <div className="slider-range-group" style={{ marginTop: '12px' }}>
                    <div className="range-header">
                      <span>Contrast Tuning:</span>
                      <span className="range-value">{contrastBoost.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.9"
                      max="1.15"
                      step="0.01"
                      value={contrastBoost}
                      onChange={(e) => setContrastBoost(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Gentle contrast keeps natural studio lighting soft and realistic.
                    </p>
                  </div>
                </div>

                {/* 4. Vintage Adjustments */}
                <div className="enhancer-control-section">
                  <div className="restoration-toggle-list">
                    <label className="enhancer-toggle-row">
                      <input
                        type="checkbox"
                        checked={restoreColors}
                        onChange={(e) => setRestoreColors(e.target.checked)}
                      />
                      <div className="toggle-text">
                        <span className="toggle-title">Restore Faded Colors & Tone</span>
                        <span className="toggle-desc">Balances vintage yellow casts</span>
                      </div>
                    </label>

                    <label className="enhancer-toggle-row">
                      <input
                        type="checkbox"
                        checked={denoise}
                        onChange={(e) => setDenoise(e.target.checked)}
                      />
                      <div className="toggle-text">
                        <span className="toggle-title">Clean Film Grain & Dust</span>
                        <span className="toggle-desc">Smooths noise while keeping edges sharp</span>
                      </div>
                    </label>
                  </div>

                  <button 
                    onClick={() => runEnhancementWith()}
                    disabled={isProcessing}
                    className="btn btn-secondary btn-block"
                    style={{ marginTop: '14px' }}
                  >
                    <RefreshCw size={16} className={isProcessing ? 'spin-icon' : ''} />
                    <span>⚡ Re-Apply Custom Adjustments</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>

          <button 
            onClick={handleDownload} 
            disabled={!enhancedResultUrl || isProcessing}
            className="btn btn-secondary"
            title="Save enhanced image to your computer"
          >
            <Download size={18} />
            <span>Download High-Res Photo</span>
          </button>

          <button 
            onClick={handleApply} 
            disabled={!enhancedResultUrl || isProcessing}
            className="btn btn-primary"
            style={{ fontWeight: '700' }}
          >
            <Check size={18} />
            <span>Save Enhanced Photo to Album</span>
          </button>
        </div>

      </div>
    </div>
  );
}

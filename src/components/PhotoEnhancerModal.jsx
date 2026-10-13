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
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  Crop
} from 'lucide-react';
import { enhanceImage, analyzeImageLuminance, runExtraPass } from '../lib/imageEnhancer';
import { removeRedEyesFromImage, fixRedEyeAtCoords, loadImage } from '../lib/redEyeRemover';
import { getAiSettings, restoreWithCloudAi, FAL_MODELS } from '../lib/aiSettings';

export default function PhotoEnhancerModal({ photo, onClose, onSaveEnhanced, onOpenSettings, onOpenEditor }) {
  const [isMaximized, setIsMaximized] = useState(false);
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
  // 📷 Resilient Original Image State with Automatic File-Handle Recovery
  const [originalUrl, setOriginalUrl] = useState(photo.objectUrl || null);
  const [originalLoadFailed, setOriginalLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    if (photo.objectUrl && !photo.objectUrl.startsWith('blob:null')) {
      setOriginalUrl(photo.objectUrl);
      setOriginalLoadFailed(false);
      return;
    }

    if (photo.handle && typeof photo.handle.getFile === 'function') {
      photo.handle.getFile().then((file) => {
        if (active && file) {
          const fresh = URL.createObjectURL(file);
          photo.objectUrl = fresh;
          setOriginalUrl(fresh);
          setOriginalLoadFailed(false);
        }
      }).catch((err) => {
        console.warn('PhotoEnhancerModal: failed to load original from handle:', err);
        if (active) setOriginalLoadFailed(true);
      });
    } else {
      setOriginalLoadFailed(true);
    }

    return () => {
      active = false;
    };
  }, [photo.id, photo.objectUrl, photo.handle]);

  const handleOriginalImageError = async () => {
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        if (file) {
          const fresh = URL.createObjectURL(file);
          photo.objectUrl = fresh;
          setOriginalUrl(fresh);
          setOriginalLoadFailed(false);
          return;
        }
      } catch (err) {
        console.warn('PhotoEnhancerModal: handleOriginalImageError recovery failed:', err);
      }
    }
    setOriginalLoadFailed(true);
  };

  // 🔴 Red-Eye Removal states
  const [isRedEyeClickMode, setIsRedEyeClickMode] = useState(false);
  const [redEyeHistory, setRedEyeHistory] = useState([]);
  const [redEyeStatusMsg, setRedEyeStatusMsg] = useState('');

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

  // 🔍 Interactive Senior Zoom & Synchronized Pan
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = Fit (100%), 1.5, 2, 3, 4
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const didPanRef = useRef(false);

  const handleZoomIn = () => {
    setZoomLevel(s => Math.min(4, +(s + 0.5).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoomLevel(s => {
      const next = Math.max(1, +(s - 0.5).toFixed(1));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoomTo = (level) => {
    setZoomLevel(level);
    if (level === 1) setPanOffset({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomLevel(current => {
      const next = Math.min(4, Math.max(1, +(current + delta).toFixed(2)));
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleZoomPointerDown = (e) => {
    if (zoomLevel <= 1) return;
    setIsPanning(true);
    didPanRef.current = false;
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleZoomPointerMove = (e) => {
    if (!isPanning || zoomLevel <= 1) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didPanRef.current = true;
    }
    setPanOffset({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy
    });
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
        transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
        cursor: isPanning ? 'grabbing' : 'grab',
        touchAction: 'none'
      };
    }
    return {
      transform: 'scale(1) translate(0px, 0px)',
      transition: 'transform 0.15s ease-out',
      cursor: 'default'
    };
  };

  // Run enhancement with current or overridden settings
  const runEnhancementWith = useCallback(async (overrides = {}) => {
    setIsLocalProcessing(true);
    const chosenRes = overrides.targetRes ?? targetRes;
    const chosenPasses = overrides.passes ?? passCount;
    const chosenStyle = overrides.style ?? styleMode;
    let chosenBase = overrides.baseImage || (baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : (originalUrl || photo.objectUrl));

    if (!chosenBase && photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        if (file) {
          chosenBase = URL.createObjectURL(file);
          photo.objectUrl = chosenBase;
          setOriginalUrl(chosenBase);
        }
      } catch {}
    }

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

    let chosenBase = baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : (originalUrl || photo.objectUrl);

    if (!chosenBase && photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        if (file) {
          chosenBase = URL.createObjectURL(file);
          photo.objectUrl = chosenBase;
          setOriginalUrl(chosenBase);
        }
      } catch {}
    }

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

  // 🔴 Red-Eye Removal Handlers
  const handleAutoFixRedEyes = async () => {
    const currentSrc = enhancedResultUrl || (baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : (originalUrl || photo.objectUrl));
    if (!currentSrc || isProcessing) return;

    setIsLocalProcessing(true);
    setPassProgressMessage('Scanning facial landmarks & removing red eye reflection...');
    setRedEyeStatusMsg('');

    try {
      const res = await removeRedEyesFromImage(currentSrc, {
        faceBoxes: photo.faces || [],
        autoDetect: true
      });

      if (res.fixedCount > 0) {
        setRedEyeHistory(prev => [...prev, currentSrc]);
        setEnhancedResultUrl(res.dataUrl);
        setRedEyeStatusMsg(`✓ Corrected ${res.fixedCount} red eye${res.fixedCount === 1 ? '' : 's'} with natural pupil restoration!`);
      } else {
        setRedEyeStatusMsg('No high-intensity red eyes found automatically. Turn on "Click-to-Fix Mode" below to click directly on any eye!');
      }
    } catch (err) {
      console.warn('Auto red-eye fix failed:', err);
      setRedEyeStatusMsg('Could not process red eye removal.');
    } finally {
      setIsLocalProcessing(false);
      setPassProgressMessage('');
    }
  };

  const handleImageClickForRedEye = async (e) => {
    if (!isRedEyeClickMode || didPanRef.current || isProcessing) return;

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const currentSrc = enhancedResultUrl || (baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : photo.objectUrl);
    if (!currentSrc) return;

    try {
      const htmlImg = await loadImage(currentSrc);
      const canvas = document.createElement('canvas');
      canvas.width = htmlImg.naturalWidth;
      canvas.height = htmlImg.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(htmlImg, 0, 0);

      const pixelX = normX * canvas.width;
      const pixelY = normY * canvas.height;
      const radius = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.04));

      const fixRes = fixRedEyeAtCoords(canvas, pixelX, pixelY, radius);
      if (fixRes.success) {
        const newUrl = canvas.toDataURL('image/jpeg', 0.96);
        setRedEyeHistory(prev => [...prev, currentSrc]);
        setEnhancedResultUrl(newUrl);
        setRedEyeStatusMsg(`✓ Corrected red pupil at (${Math.round(pixelX)}, ${Math.round(pixelY)})!`);
      } else {
        setRedEyeStatusMsg('No red reflection found at click. Click directly on the red center of the pupil.');
      }
    } catch (err) {
      console.warn('Click red-eye fix error:', err);
    }
  };

  const handleUndoRedEye = () => {
    if (redEyeHistory.length === 0) return;
    const previous = redEyeHistory[redEyeHistory.length - 1];
    setRedEyeHistory(prev => prev.slice(0, prev.length - 1));
    setEnhancedResultUrl(previous);
    setRedEyeStatusMsg('Undid last red-eye correction.');
  };

  const toggleRedEyeClickMode = () => {
    const next = !isRedEyeClickMode;
    setIsRedEyeClickMode(next);
    if (next && viewMode === 'slider') {
      setViewMode('side_by_side');
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

  const handleSplitPointerDown = (e) => {
    const isDividerTarget = e.target && (
      e.target.classList?.contains('split-slider-divider') || 
      e.target.classList?.contains('slider-handle-circle') ||
      Boolean(e.target.closest?.('.split-slider-divider'))
    );

    // If zoomed in and not dragging the divider handle directly, pan the photo!
    if (zoomLevel > 1 && !isDividerTarget) {
      setIsPanning(true);
      didPanRef.current = false;
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: panOffset.x,
        originY: panOffset.y
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // Otherwise, drag the split comparison slider
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateSliderPos(e.clientX);
  };

  const handleSplitPointerMove = (e) => {
    if (isPanning && zoomLevel > 1) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didPanRef.current = true;
      }
      setPanOffset({
        x: panStartRef.current.originX + dx,
        y: panStartRef.current.originY + dy
      });
      return;
    }

    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      updateSliderPos(e.clientX);
    }
  };

  const handleSplitPointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
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
      let chosenBase = baseSource === 'enhanced' && photo.enhancedUrl ? photo.enhancedUrl : (originalUrl || photo.objectUrl);
      if (!chosenBase && photo.handle && typeof photo.handle.getFile === 'function') {
        try {
          const file = await photo.handle.getFile();
          if (file) {
            chosenBase = URL.createObjectURL(file);
            photo.objectUrl = chosenBase;
            setOriginalUrl(chosenBase);
          }
        } catch {}
      }
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
              <span>✨ Photo Restorer & 4K Super-Resolution Upscaler</span>
            </h3>
            <p className="modal-subtitle">
              Progressive multi-octave AI upscaling to 3840×2160 (4K Ultra HD) with shadow detail recovery.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenEditor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditor(photo);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Crop photo borders or erase scratches, blemishes, and unwanted objects"
              >
                <Crop size={14} />
                <span>Crop & Erase Studio</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="btn-header-maximize"
              title={isMaximized ? "Restore standard size" : "Make window full-screen to see photo much bigger"}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isMaximized ? 'Standard Size' : 'Big Screen'}</span>
            </button>
            <button onClick={onClose} className="btn-icon-close" title="Close dialog">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="enhancer-modal-body">
          
          {/* Main Comparison Area with Split Slider or Side-by-Side */}
          <div className="enhancer-preview-column">

            {/* Red Eye Click Mode Active Banner */}
            {isRedEyeClickMode && (
              <div style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '8px',
                marginBottom: '10px',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                fontWeight: '700'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Crosshair size={18} />
                  <span>🎯 Click Directly on Eyes: Click on any red pupil to neutralize red flash!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRedEyeClickMode(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Done with Eye Tool
                </button>
              </div>
            )}
            
            {/* View Mode Bar */}
            <div className="enhancer-view-mode-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
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
                  <span>Original Only</span>
                </button>
                <button
                  type="button"
                  className={`enhancer-mode-btn ${viewMode === 'enhanced' ? 'active' : ''}`}
                  onClick={() => setViewMode('enhanced')}
                  title="View full Enhanced photo at maximum size"
                >
                  <Sparkles size={14} />
                  <span>✨ Big View (Enhanced)</span>
                </button>
              </div>

              {viewMode === 'slider' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setSliderPosition(50)}
                  title="Reset slider to 50/50 center"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RotateCcw size={12} />
                  <span>Reset 50/50</span>
                </button>
              )}
            </div>

            {/* Senior-Friendly Magnification Toolbar */}
            <div className="senior-zoom-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ZoomIn size={13} />
                  <span>Magnify:</span>
                </span>
                <div className="senior-zoom-group">
                  <button 
                    type="button"
                    onClick={handleZoomOut}
                    className="senior-zoom-btn senior-zoom-btn-action"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={13} />
                    <span>-</span>
                  </button>

                  {[1, 1.5, 2, 3, 4].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleZoomTo(level)}
                      className={`senior-zoom-btn ${zoomLevel === level ? 'active' : ''}`}
                      title={`Magnify to ${Math.round(level * 100)}%`}
                    >
                      {level === 1 ? 'Fit (100%)' : `${Math.round(level * 100)}%`}
                    </button>
                  ))}

                  <button 
                    type="button"
                    onClick={handleZoomIn}
                    className="senior-zoom-btn senior-zoom-btn-action"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={13} />
                    <span>+</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {zoomLevel > 1 && (
                  <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600' }}>
                    ✋ Click & drag photo to pan
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="senior-zoom-btn senior-zoom-btn-action"
                  style={{ backgroundColor: isMaximized ? '#2563eb' : 'rgba(255,255,255,0.12)' }}
                  title={isMaximized ? "Return to standard size" : "Expand photo window to full screen"}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isMaximized ? 'Standard Size' : 'Big Screen'}</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Split Slider View */}
            {viewMode === 'slider' && (
              <>
                <div 
                  ref={containerRef}
                  className="split-comparison-container"
                  onWheel={handleWheelZoom}
                  onPointerDown={handleSplitPointerDown}
                  onPointerMove={handleSplitPointerMove}
                  onPointerUp={handleSplitPointerUp}
                  onPointerCancel={handleSplitPointerUp}
                  style={{ 
                    touchAction: 'none',
                    cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'ew-resize'
                  }}
                  title={zoomLevel > 1 ? "Drag to pan • Mouse wheel to zoom • Drag white center circle to slide comparison" : "Drag slider left/right to compare • Mouse wheel to zoom in"}
                >
                  {/* Original (Left side) */}
                  <img 
                    src={originalUrl || photo.objectUrl} 
                    alt="Original" 
                    className="comparison-slide-img original-img" 
                    style={getZoomStyle()}
                    onError={handleOriginalImageError}
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
                        style={{
                          ...getZoomStyle(),
                          cursor: isRedEyeClickMode ? 'crosshair' : (zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default')
                        }}
                        draggable={false}
                        onClick={isRedEyeClickMode ? handleImageClickForRedEye : undefined}
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
                    <span>🔍 <strong>{Math.round(zoomLevel * 100)}% Zoom:</strong> Mouse wheel to zoom • Drag photo to pan around • Drag white center circle to slide comparison.</span>
                  ) : (
                    <span>💡 <strong>Mouse wheel zooms in & out.</strong> Drag slider ◀ LEFT or ▶ RIGHT to compare.</span>
                  )}
                </div>
              </>
            )}

            {/* Mode 2: Side-by-Side View */}
            {viewMode === 'side_by_side' && (
              <>
                <div 
                  className="side-by-side-comparison"
                  onWheel={handleWheelZoom}
                >
                  <div 
                    className="side-by-side-box"
                    onWheel={handleWheelZoom}
                    onPointerDown={handleZoomPointerDown}
                    onPointerMove={handleZoomPointerMove}
                    onPointerUp={handleZoomPointerUp}
                    onPointerCancel={handleZoomPointerUp}
                    style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
                    title={zoomLevel > 1 ? "Drag to pan both sides • Mouse wheel to zoom" : "Use Magnify buttons or mouse wheel to zoom in"}
                  >
                    <img 
                      src={originalUrl || photo.objectUrl} 
                      alt="Original" 
                      className="comparison-slide-img" 
                      style={getZoomStyle()}
                      onError={handleOriginalImageError}
                      draggable={false}
                    />
                    <span className="slide-label label-before">Original</span>
                  </div>
                  <div 
                    className="side-by-side-box"
                    onWheel={handleWheelZoom}
                    onPointerDown={handleZoomPointerDown}
                    onPointerMove={handleZoomPointerMove}
                    onPointerUp={handleZoomPointerUp}
                    onPointerCancel={handleZoomPointerUp}
                    style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
                    title={zoomLevel > 1 ? "Drag to pan both sides • Mouse wheel to zoom" : "Use Magnify buttons or mouse wheel to zoom in"}
                  >
                    {enhancedResultUrl ? (
                      <img 
                        src={enhancedResultUrl} 
                        alt="Enhanced" 
                        className="comparison-slide-img" 
                        style={{
                          ...getZoomStyle(),
                          cursor: isRedEyeClickMode ? 'crosshair' : (zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default')
                        }}
                        draggable={false}
                        onClick={isRedEyeClickMode ? handleImageClickForRedEye : undefined}
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
                      🔍 <strong>{Math.round(zoomLevel * 100)}% Synchronized Zoom Active:</strong> Both photos move together! Drag to pan • Scroll wheel to zoom.
                    </span>
                  ) : (
                    <span>
                      💡 <strong>Roll mouse wheel</strong> or use Magnify buttons above to zoom both photos side-by-side in sync.
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
                  onWheel={handleWheelZoom}
                  onPointerDown={handleZoomPointerDown}
                  onPointerMove={handleZoomPointerMove}
                  onPointerUp={handleZoomPointerUp}
                  onPointerCancel={handleZoomPointerUp}
                  style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
                  title={zoomLevel > 1 ? "Drag to pan • Mouse wheel to zoom" : "Use Magnify buttons or mouse wheel to zoom in"}
                >
                  <img 
                    src={originalUrl || photo.objectUrl} 
                    alt="Original" 
                    className="comparison-slide-img" 
                    style={getZoomStyle()}
                    onError={handleOriginalImageError}
                    draggable={false}
                  />
                  <span className="slide-label label-before">Original Photo</span>
                </div>
                {zoomLevel > 1 && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#1d4ed8', marginTop: '6px' }}>
                    🔍 {Math.round(zoomLevel * 100)}% Zoom: Drag to pan • Mouse wheel to zoom
                  </div>
                )}
              </>
            )}

            {/* Mode 4: Enhanced Only */}
            {viewMode === 'enhanced' && (
              <>
                <div 
                  className="split-comparison-container" 
                  onWheel={handleWheelZoom}
                  onPointerDown={handleZoomPointerDown}
                  onPointerMove={handleZoomPointerMove}
                  onPointerUp={handleZoomPointerUp}
                  onPointerCancel={handleZoomPointerUp}
                  style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
                  title={zoomLevel > 1 ? "Drag to pan • Mouse wheel to zoom" : "Use Magnify buttons or mouse wheel to zoom in"}
                >
                    {enhancedResultUrl && (
                      <img 
                        src={enhancedResultUrl} 
                        alt="Enhanced" 
                        className="comparison-slide-img" 
                        style={{
                          ...getZoomStyle(),
                          cursor: isRedEyeClickMode ? 'crosshair' : (zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default')
                        }}
                        draggable={false}
                        onClick={isRedEyeClickMode ? handleImageClickForRedEye : undefined}
                      />
                    )}
                  <span className="slide-label label-after">✨ Enhanced ({targetRes.toUpperCase()} • {appliedPassesCount} Passes)</span>
                </div>
                {zoomLevel > 1 && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#1d4ed8', marginTop: '6px' }}>
                    🔍 {Math.round(zoomLevel * 100)}% Zoom: Drag to pan • Mouse wheel to zoom
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
                      runEnhancementWith({ baseImage: originalUrl || photo.objectUrl });
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

                {/* 🔴 Red-Eye Removal Tool */}
                <div className="enhancer-control-section" style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: isRedEyeClickMode ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px' }}>🔴</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        Red-Eye Removal
                      </strong>
                    </div>
                    {redEyeHistory.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={handleUndoRedEye}
                        title="Undo last red-eye fix"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RotateCcw size={12} />
                        <span>Undo Last Eye</span>
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    Removes camera flash red reflections while keeping natural catchlight reflections and pupil depth.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleAutoFixRedEyes}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: '700',
                        backgroundColor: '#ffffff',
                        borderColor: 'rgba(239, 68, 68, 0.4)'
                      }}
                      title="Automatically scan faces and remove red eyes"
                    >
                      <Sparkles size={14} className="text-accent" />
                      <span>Auto-Remove Red Eyes (1-Click)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={toggleRedEyeClickMode}
                      className={`btn btn-xs ${isRedEyeClickMode ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: '700',
                        backgroundColor: isRedEyeClickMode ? '#dc2626' : undefined,
                        borderColor: '#dc2626',
                        color: isRedEyeClickMode ? '#ffffff' : '#dc2626'
                      }}
                      title="Click directly on any red eye to fix it"
                    >
                      <Crosshair size={13} />
                      <span>{isRedEyeClickMode ? '🎯 Click Mode ON: Click on pupil' : '🎯 Click-to-Fix Mode (Click on Eyes)'}</span>
                    </button>
                  </div>

                  {redEyeStatusMsg && (
                    <div style={{
                      marginTop: '8px',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: redEyeStatusMsg.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                      color: redEyeStatusMsg.startsWith('✓') ? '#15803d' : '#b45309'
                    }}>
                      {redEyeStatusMsg}
                    </div>
                  )}
                </div>

                {/* 1. Photo & Edge Sharpness */}
                <div className="enhancer-control-section" style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.25)', marginBottom: '10px' }}>
                  <div className="slider-range-group">
                    <div className="range-header">
                      <span className="flex items-center gap-6" style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                        <Sparkles size={16} className="text-primary" />
                        <span>Photo & Edge Sharpness:</span>
                      </span>
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
                      Sharpens authentic photo focus and eye/fabric contours (works directly on real pixels, zero fake AI).
                    </p>
                  </div>
                </div>

                {/* 2. Portrait Skin Smoothing */}
                <div className="enhancer-control-section" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '10px' }}>
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

                {/* 3. Shadow Recovery & Lighting */}
                <div className="enhancer-control-section" style={{ backgroundColor: 'rgba(217, 119, 6, 0.05)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '10px' }}>
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

                  {/* Contrast Tuning */}
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

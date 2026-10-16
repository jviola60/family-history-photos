import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  Key, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { getAiSettings, saveAiSettings, testFalConnection, FAL_MODELS } from '../lib/aiSettings';
import { checkLocalAiHealth } from '../lib/localAiService';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(getAiSettings());
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { loading: bool, success: bool, message: string }
  const [savedMessage, setSavedMessage] = useState(false);

  // Local AI Engine status
  const [localHealth, setLocalHealth] = useState(null);
  const [isCheckingLocal, setIsCheckingLocal] = useState(false);

  const checkLocal = async () => {
    setIsCheckingLocal(true);
    try {
      const res = await checkLocalAiHealth(true);
      setLocalHealth(res);
    } finally {
      setIsCheckingLocal(false);
    }
  };

  useEffect(() => {
    setSettings(getAiSettings());
    checkLocal();
  }, []);

  const updateSetting = (key, val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleProviderChange = (provider) => {
    const updated = { ...settings, provider };
    setSettings(updated);
    saveAiSettings(updated);
    setTestStatus(null);
  };

  const handleKeyChange = (val) => {
    const updated = { ...settings, falApiKey: val };
    setSettings(updated);
    saveAiSettings(updated);
    setTestStatus(null);
  };

  const handleModelChange = (falModel) => {
    const updated = { ...settings, falModel };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleResemblanceChange = (val) => {
    const updated = { ...settings, falResemblance: val };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleCreativityChange = (val) => {
    const updated = { ...settings, falCreativity: val };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleFidelityChange = (val) => {
    const updated = { ...settings, falFidelity: val };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleTestKey = async () => {
    setTestStatus({ loading: true, message: 'Testing connection to Fal.ai...' });
    const res = await testFalConnection(settings.falApiKey);
    if (res.success) {
      saveAiSettings(settings);
      setSavedMessage(true);
    }
    setTestStatus({ loading: false, success: res.success, message: res.message });
  };

  const handleClose = () => {
    saveAiSettings(settings);
    onClose();
  };

  const handleSaveAndClose = () => {
    saveAiSettings(settings);
    setSavedMessage(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div 
        className="settings-modal-dialog" 
        style={{ maxWidth: '640px', width: '92%', backgroundColor: '#FFFFFF' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 88, 12, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Settings size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>App Settings & AI Providers</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Choose how photos are enhanced: 100% offline or with fast cloud AI
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="modal-close-btn" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px' }}>
          
          <label className="section-label" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} className="text-accent" />
            <span>Photo Enhancement Provider:</span>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            
            {/* Option 1: Self-Contained (Default) */}
            <div 
              onClick={() => handleProviderChange('self_contained')}
              style={{
                border: settings.provider === 'self_contained' ? '2px solid #16a34a' : '1px solid var(--border-medium)',
                backgroundColor: settings.provider === 'self_contained' ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card)',
                borderRadius: '10px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={20} color={settings.provider === 'self_contained' ? '#16a34a' : 'var(--text-muted)'} />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                      Self-Contained (100% Offline & Free)
                    </strong>
                    <span className="badge badge-success" style={{ marginLeft: '8px', fontSize: '10px' }}>Default</span>
                  </div>
                </div>
                <input 
                  type="radio" 
                  name="provider" 
                  checked={settings.provider === 'self_contained'} 
                  onChange={() => handleProviderChange('self_contained')} 
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 30px', lineHeight: 1.45 }}>
                100% private and offline on your machine. Zero photos or data leave your computer. Includes local CodeFormer face restoration, OpenCV scratch/fold repair, color de-fading, and Real-ESRGAN 4K.
              </p>

              {/* Local AI Engine Configuration (visible when self_contained is selected) */}
              {settings.provider === 'self_contained' && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  style={{
                    marginTop: '14px',
                    padding: '14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Status Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#16a34a'
                      }} />
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        In-Browser Engine: Active & Ready (Zero Setup Required)
                      </strong>
                    </div>
                    {localHealth?.available ? (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>
                        ⚡ CodeFormer Server Active
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>
                        100% In-Browser
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>
                    ✓ 100% In-Browser Scratch Repair &bull; Color De-Fading &bull; Super-Resolution &bull; Likeness Preservation
                  </div>

                  {/* Likeness Preservation */}
                  <div style={{ backgroundColor: 'var(--bg-card-subtle, #f9fafb)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Facial Likeness Fidelity (Preserve original facial identity):</span>
                      <span style={{ fontWeight: '700' }}>{Math.round((settings.localFidelity ?? 0.75) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={settings.localFidelity ?? 0.75}
                      onChange={(e) => updateSetting('localFidelity', parseFloat(e.target.value))}
                      className="range-input"
                      style={{ height: '4px', marginTop: '6px' }}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Protects against artificial alterations and faithfully preserves the authentic face of your ancestor.
                    </p>
                  </div>

                  {/* Scratch & Fold Repair */}
                  <div style={{ backgroundColor: 'var(--bg-card-subtle, #f9fafb)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.localRepairScratches ?? true}
                        onChange={(e) => updateSetting('localRepairScratches', e.target.checked)}
                      />
                      <span>Auto-Repair Scratches & Fold Creases</span>
                    </label>
                    {(settings.localRepairScratches ?? true) && (
                      <div style={{ paddingLeft: '24px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Healing & Inpainting Intensity:</span>
                          <span style={{ fontWeight: '700' }}>{Math.round((settings.localScratchStrength ?? 0.75) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="1.0"
                          step="0.05"
                          value={settings.localScratchStrength ?? 0.75}
                          onChange={(e) => updateSetting('localScratchStrength', parseFloat(e.target.value))}
                          className="range-input"
                          style={{ height: '4px', marginTop: '4px' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Color Restoration & De-Fading */}
                  <div style={{ backgroundColor: 'var(--bg-card-subtle, #f9fafb)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.localRestoreColor ?? true}
                        onChange={(e) => updateSetting('localRestoreColor', e.target.checked)}
                      />
                      <span>Color Restoration & De-Fading (Neutralize yellow casts & lift washed-out tone)</span>
                    </label>
                    {(settings.localRestoreColor ?? true) && (
                      <div style={{ paddingLeft: '24px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Dynamic Range & Contrast Recovery:</span>
                          <span style={{ fontWeight: '700' }}>{Math.round((settings.localDefadeStrength ?? 0.70) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="1.0"
                          step="0.05"
                          value={settings.localDefadeStrength ?? 0.70}
                          onChange={(e) => updateSetting('localDefadeStrength', parseFloat(e.target.value))}
                          className="range-input"
                          style={{ height: '4px', marginTop: '4px' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Super-Resolution & Clarity */}
                  <div style={{ backgroundColor: 'var(--bg-card-subtle, #f9fafb)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.localUpscale ?? true}
                        onChange={(e) => updateSetting('localUpscale', e.target.checked)}
                      />
                      <span>High-Definition Super-Resolution & Clarity (Up to 4K)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Option 2: Fal.ai (Cloud AI - CodeFormer) */}
            <div 
              onClick={() => handleProviderChange('fal')}
              style={{
                border: settings.provider === 'fal' ? '2px solid #2563eb' : '1px solid var(--border-medium)',
                backgroundColor: settings.provider === 'fal' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                borderRadius: '10px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color={settings.provider === 'fal' ? '#2563eb' : 'var(--text-muted)'} />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                      Fal.ai (Cloud AI - Studio Restoration)
                    </strong>
                    <span className="badge" style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: 'rgba(37, 99, 235, 0.15)', color: '#2563eb' }}>
                      Highest Quality
                    </span>
                  </div>
                </div>
                <input 
                  type="radio" 
                  name="provider" 
                  checked={settings.provider === 'fal'} 
                  onChange={() => handleProviderChange('fal')} 
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0 30px', lineHeight: 1.45 }}>
                Connects to Fal.ai cloud GPUs (<strong>Clarity Ultra-HD, CCSR, or CodeFormer</strong>). Each photo is sent to fal.ai, a third-party server, only after you confirm that upload by name. The local engine stays the default and does not upload.
              </p>
            </div>
          </div>

          {/* Fal.ai Configuration Panel (shown when Fal.ai is active) */}
          {settings.provider === 'fal' && (
            <div style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} className="text-accent" />
                  <span>Fal.ai API Key:</span>
                </label>
                <a 
                  href="https://fal.ai/dashboard/keys" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <span>Get Free Key at Fal.ai</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* API Key Input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="form-input"
                    value={settings.falApiKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder="Paste your Fal.ai key here (kept for this tab only)"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={!settings.falApiKey || (testStatus && testStatus.loading)}
                  className="btn btn-secondary"
                  style={{ minWidth: '100px' }}
                >
                  {testStatus && testStatus.loading ? 'Testing...' : 'Test Key'}
                </button>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
                This key is kept in memory for this browser tab only. It is not stored in localStorage. Closing the tab clears it. An older copy saved in localStorage is deleted when the app loads.
              </p>

              {/* Test Status feedback */}
              {testStatus && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: testStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: testStatus.success ? '#059669' : '#dc2626',
                  marginBottom: '14px'
                }}>
                  {testStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{testStatus.message}</span>
                </div>
              )}

              {/* Model Selection Selector */}
              <div style={{ marginTop: '16px', marginBottom: '14px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Sparkles size={14} className="text-accent" />
                  <span>Choose Fal.ai AI Model:</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {FAL_MODELS.map((model) => {
                    const isSelected = (settings.falModel || 'fal-ai/clarity-upscaler') === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border-medium)',
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '13px', color: isSelected ? '#1d4ed8' : 'var(--text-main)' }}>
                              {model.name}
                            </strong>
                            <span className="badge" style={{
                              fontSize: '9px',
                              backgroundColor: isSelected ? '#2563eb' : 'var(--bg-hover)',
                              color: isSelected ? '#ffffff' : 'var(--text-muted)'
                            }}>
                              {model.badge}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-subtle)' }}>
                              {model.cost}
                            </span>
                            <input
                              type="radio"
                              name="falModel"
                              checked={isSelected}
                              onChange={() => handleModelChange(model.id)}
                            />
                          </div>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                          {model.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sliders tailored to the selected model */}
              {(settings.falModel || 'fal-ai/clarity-upscaler') === 'fal-ai/clarity-upscaler' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sliders size={13} />
                        <span>Facial Resemblance / Original Likeness:</span>
                      </label>
                      <span style={{ fontSize: '12px', fontWeight: '700' }}>{Math.round((settings.falResemblance ?? 0.75) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={settings.falResemblance ?? 0.75}
                      onChange={(e) => handleResemblanceChange(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      <span>50% (More AI Freedom)</span>
                      <span>75% (Recommended)</span>
                      <span>95% (Strict Likeness)</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sliders size={13} />
                        <span>Texture & Pore Detail (Creativity):</span>
                      </label>
                      <span style={{ fontSize: '12px', fontWeight: '700' }}>{Math.round((settings.falCreativity ?? 0.30) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.15"
                      max="0.50"
                      step="0.05"
                      value={settings.falCreativity ?? 0.30}
                      onChange={(e) => handleCreativityChange(parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      <span>15% (Gentle Polish)</span>
                      <span>30% (Recommended)</span>
                      <span>50% (Max Micro-Textures)</span>
                    </div>
                  </div>
                </div>
              )}

              {settings.falModel === 'fal-ai/codeformer' && (
                <div style={{ marginTop: '12px', backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={13} />
                      <span>CodeFormer Facial Fidelity:</span>
                    </label>
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{Math.round((settings.falFidelity ?? 0.75) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="0.95"
                    step="0.05"
                    value={settings.falFidelity ?? 0.75}
                    onChange={(e) => handleFidelityChange(parseFloat(e.target.value))}
                    className="range-input"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    <span>0.4 (Strongest AI Detail)</span>
                    <span>0.75 (Recommended)</span>
                    <span>0.95 (Maximum Likeness)</span>
                  </div>
                </div>
              )}

              {settings.falModel === 'fal-ai/ccsr' && (
                <div style={{
                  marginTop: '12px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45
                }}>
                  💡 <strong>CCSR Mode:</strong> Applies continuous contrastive 4K super-resolution across the entire image (foreground & background), preserving facial structure while enhancing optical focus.
                </div>
              )}

              {/* Quick 3-Step Guide */}
              <div style={{
                marginTop: '14px',
                padding: '10px 12px',
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                borderLeft: '3px solid #2563eb',
                borderRadius: '0 6px 6px 0',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                <strong>How to try Fal.ai in 60 seconds:</strong>
                <ol style={{ margin: '4px 0 0 16px', padding: 0, lineHeight: 1.5 }}>
                  <li>Go to <a href="https://fal.ai" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>fal.ai</a> and sign in with Google or GitHub (includes free trial credits).</li>
                  <li>Click <strong>Keys</strong> in the sidebar, click <strong>Create Key</strong>, and copy it.</li>
                  <li>Paste the key into the box above and click <strong>Test Key</strong>.</li>
                </ol>
              </div>

            </div>
          )}

          {/* Privacy Note */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--text-subtle)',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '10px 12px',
            borderRadius: '6px'
          }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Your API key is saved only in your personal browser's local storage. It is never stored on external databases or shared between users. Each family member uses their own setting.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
            {savedMessage ? '✓ Settings Saved!' : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleSaveAndClose} className="btn btn-primary">
              Save Settings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

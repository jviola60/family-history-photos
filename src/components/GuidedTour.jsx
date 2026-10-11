import React from 'react';
import { FolderOpen, Copy, Tag, Sparkles, X, CheckCircle, ShieldCheck } from 'lucide-react';

export default function GuidedTour({ onClose, onSampleClick, hasPhotos }) {
  const steps = [
    {
      num: 1,
      icon: <FolderOpen className="step-icon" size={24} />,
      title: '1. Choose Photos',
      desc: 'Click "Open Folder" to pick your pictures from your hard drive, or click "Sample Album" below to try it out first.'
    },
    {
      num: 2,
      icon: <Copy className="step-icon" size={24} />,
      title: '2. Clear Duplicates',
      desc: 'We automatically find duplicate and small thumbnail copies. We safely move extras into a review folder so nothing is lost.'
    },
    {
      num: 3,
      icon: <Tag className="step-icon" size={24} />,
      title: '3. Record Family History',
      desc: 'Click on any photo! A dialogue box opens for you to type who it is, how they are related to you, and any story you remember.'
    },
    {
      num: 4,
      icon: <Sparkles className="step-icon" size={24} />,
      title: '4. Make Photos 4K',
      desc: 'Have blurry or tiny thumbnail photos? Click "Enhance 4K" to restore colors, sharpen faces, and make them crystal clear.'
    }
  ];

  return (
    <div className="guided-tour-card">
      <div className="guided-tour-header">
        <div className="tour-badge">
          <ShieldCheck size={18} />
          <span>Family History Photos — Easy Step-by-Step Guide</span>
        </div>
        <button onClick={onClose} className="btn-icon-close" title="Close Guide">
          <X size={18} />
        </button>
      </div>

      <div className="guided-steps-grid">
        {steps.map((s) => (
          <div key={s.num} className="step-card">
            <div className="step-card-header">
              <span className="step-number">{s.num}</span>
              {s.icon}
            </div>
            <h4 className="step-title">{s.title}</h4>
            <p className="step-desc">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="guided-footer-bar">
        <div className="tour-safety-note">
          <CheckCircle size={16} className="text-success" />
          <span><strong>100% Private & Safe:</strong> Everything stays on your computer. No photos are sent to the internet.</span>
        </div>

        {!hasPhotos && (
          <button onClick={onSampleClick} className="btn btn-primary btn-sm">
            Load Sample Family Album to Try Now
          </button>
        )}
      </div>
    </div>
  );
}

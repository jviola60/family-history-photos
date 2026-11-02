/**
 * Family History Photos - Interactive Workflow Help & Tutorial
 * Comprehensive in-app guide and step-by-step workflow tutorial
 * with live app interactions, dockable walkthrough mode, and searchable FAQ.
 */
(() => {
  'use strict';

  const STEPS = [
    {
      step: 1,
      badge: 'Step 1 of 7 • Getting Started',
      title: 'Meet Your Archival Workspace & Demo Data',
      shortTitle: 'Workspace & Demo Data',
      desc: 'Family History Photos comes pre-loaded with a 200-print demo archive (the Gill & Costello family collection) so you can test every feature risk-free before opening your own photos.',
      bullets: [
        '<strong>Left Sidebar:</strong> Access your photo subfolders, cleanup queues (like <em>Needs 4K restore</em> or <em>Duplicate scans</em>), and decade filters.',
        '<strong>Top Search Bar:</strong> Instantly search by relative name, place, filename, or FamilySearch PID.',
        '<strong>100% Private in Browser:</strong> Zero cloud uploads needed for cataloging. All indexing and metadata editing happen directly on your computer.'
      ],
      tip: 'You can freely edit, pin, and restore these demo photos. When ready, click "✕ Clear Demo" to start with your real photos.',
      actionText: '📁 View Demo Photos & Sidebar',
      actionId: 'action-step-1',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.setLayout) app.setLayout('ledger');
        highlightElement('#sidebar');
      }
    },
    {
      step: 2,
      badge: 'Step 2 of 7 • Archival Inspector',
      title: 'Inspect Photo Records & Uncover Memories',
      shortTitle: 'Inspect Photo Records',
      desc: 'Clicking any row in the Ledger or tile in the Contact Sheet opens the Archival Inspector on the right side of the screen.',
      bullets: [
        '<strong>Catalog Title & Date:</strong> Keep original filenames safe while giving photos meaningful historical titles and ISO dates (YYYY-MM-DD).',
        '<strong>Back-of-Print Memory:</strong> Type or read handwritten notes from the back of vintage physical prints so precious stories are never forgotten.',
        '<strong>Image Metrics:</strong> Automatically displays dimensions, aspect ratio, file size, and preservation status.'
      ],
      tip: 'All notes and metadata you enter are permanently saved in your browser and baked into the JPEG file when you click "Save to File".',
      actionText: '🔍 Inspect Grandma\'s Photo (FH-001)',
      actionId: 'action-step-2',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.selectPhoto) app.selectPhoto('FH-001');
        highlightElement('#inspector');
      }
    },
    {
      step: 3,
      badge: 'Step 3 of 7 • Geographic History',
      title: 'Bring Photos to Life on the Global Map',
      shortTitle: 'Interactive Global Map',
      desc: 'Every family memory happened in a real place. The interactive Global Map pinpoints where your ancestors lived, celebrated, and traveled.',
      bullets: [
        '<strong>Automatic Geocoding:</strong> Type any historical address in the inspector (e.g. <em>"1633 W Wooster St, Bowling Green, OH"</em> or <em>"South Oakley Ave, Chicago, IL"</em>) and click "Drop Pin" to auto-detect GPS coordinates.',
        '<strong>Manual Pinning:</strong> You can also click anywhere directly on the world map to place a pin manually.',
        '<strong>Interactive Pin Popups:</strong> Click any camera pin to view the photo thumbnail, location, and jump straight into Photo Lab or the Ledger.'
      ],
      tip: 'Photos with existing GPS tags from smartphones or modern cameras are mapped automatically on import!',
      actionText: '🗺️ Switch to Global Map View',
      actionId: 'action-step-3',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.setLayout) app.setLayout('map');
        highlightElement('#catalog-center');
      }
    },
    {
      step: 4,
      badge: 'Step 4 of 7 • Family Tree Link',
      title: 'Tag Relatives & Auto-Sync Tree Person IDs (PIDs)',
      shortTitle: 'Tag Relatives & FamilySearch',
      desc: 'Connect the faces in your photos directly to your family tree records on FamilySearch Beta.',
      bullets: [
        '<strong>Tag People & Relationships:</strong> Type a relative\'s name (e.g. <em>"Patricia Josephine Gill"</em>) and choose their relationship (e.g. <em>"Mother"</em>).',
        '<strong>Live FamilySearch Tree Query:</strong> As you type, the app live-queries <code>beta.familysearch.org</code> to find matching tree ancestors.',
        '<strong>Automated PID Binding:</strong> Select the matching relative from the dropdown to automatically bind their unique Person ID (e.g. <em>"BM6T-WQ5"</em>) with a verified emerald checkmark.'
      ],
      tip: 'PIDs prevent generational confusion by distinguishing between ancestors who shared the same first and last names across different centuries.',
      actionText: '🏷️ Show Relative Tagging Form',
      actionId: 'action-step-4',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.selectPhoto) app.selectPhoto('FH-001');
        highlightElement('#insp-relatives');
      }
    },
    {
      step: 5,
      badge: 'Step 5 of 7 • Photo Restoration',
      title: 'Enhance & Repair in the 6-Tool Photo Lab',
      shortTitle: 'AI Photo Lab Studio',
      desc: 'Restore aged, torn, blurry, or faded prints non-destructively with 6 specialized restoration engines:',
      bullets: [
        '<strong>✨ 4K Face Restore:</strong> Neural super-resolution reconstructs facial details, eyes, and expressions.',
        '<strong>🎨 Auto Colorize:</strong> Converts black & white or sepia photographs into natural, vibrant colors.',
        '<strong>🪄 Magic Eraser (LaMa):</strong> Deep-learning inpainting removes creases, scratches, tape stains, and tears.',
        '<strong>⚖️ Tone & Contrast:</strong> Calibrated archival curve corrects faded highlights and crushed shadows.',
        '<strong>👁️ Red-Eye Removal:</strong> Removes flash artifacts common in 1980s–2000s prints.',
        '<strong>✂️ Lossless Smart Crop:</strong> Reframes portraits cleanly without degrading image resolution.'
      ],
      tip: 'Use the Split Curtain slider in Photo Lab to inspect before-and-after results side-by-side in real time.',
      actionText: '✨ Open Photo Lab Studio',
      actionId: 'action-step-5',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('lab');
        highlightElement('#section-lab');
      }
    },
    {
      step: 6,
      badge: 'Step 6 of 7 • Archival Preservation',
      title: 'One-Click "Save to File" Preserves Everything',
      shortTitle: 'Unified Save to File',
      desc: 'Never worry about keeping database backups or losing your work. The single <strong>💾 Save to File</strong> button accomplishes three essential preservation tasks at once:',
      bullets: [
        '<strong>1. Local Catalog Persistence:</strong> Saves the record permanently in your browser\'s local storage so all metadata, pins, and tags reload automatically.',
        '<strong>2. JPEG Header Metadata Baking:</strong> Embeds XMP (Dublin Core), IPTC, and EXIF tags directly inside the downloaded JPEG image file. Person names, PIDs, GPS coordinates, dates, and historical stories now travel inside the photo forever.',
        '<strong>3. FamilySearch Memories Sync:</strong> Uploads the photo artifact directly to FamilySearch Beta Memories linked to the tagged relative\'s PID.'
      ],
      tip: 'Because the metadata is baked into the JPEG file, anyone who opens the photo in Windows, Mac, Photoshop, or Google Photos can read the full family history.',
      actionText: '💾 View "Save to File" Button',
      actionId: 'action-step-6',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.selectPhoto) app.selectPhoto('FH-001');
        highlightElement('#btn-insp-save-file');
      }
    },
    {
      step: 7,
      badge: 'Step 7 of 7 • Real Photo Workflow',
      title: 'Clear Demo Data & Load Your Real Photos',
      shortTitle: 'Start with Real Photos',
      desc: 'Once you are comfortable with the demo archive, you are ready to start preserving your actual family photo collection!',
      bullets: [
        '<strong>Click "✕ Clear Demo":</strong> Located in the top bar and sidebar, this button empties the sample archive so you have a fresh workspace.',
        '<strong>Click "Choose Photo Folder...":</strong> Select your folder of scanned photos on your hard drive. The app reads all subfolders and extracts existing dates and GPS tags.',
        '<strong>Practice Anytime:</strong> You can click "Reload Demo Photos" anytime if you want to test new features or show friends how the app works.'
      ],
      tip: 'Your family photos never leave your device. The app uses the secure Web File System API for fast, private, 100% offline-ready archiving.',
      actionText: '📂 Show Clear & Choose Folder Buttons',
      actionId: 'action-step-7',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        highlightElement('#btn-choose-folder');
        highlightElement('#btn-top-clear-demo');
      }
    }
  ];

  const FAQS = [
    {
      q: 'How do I drop a pin on the map if my photo has no GPS?',
      a: 'In the Archival Inspector on the right side of the screen, find the "Location & Map Pin" field. Type any street address, city, or state (e.g. <em>1633 W Wooster St, Bowling Green, OH</em>) and click <strong>Drop Pin</strong> or <strong>Auto-Geocode Address & EXIF</strong>. The app will look up the coordinates and drop an interactive pin on the map. You can also switch to the Global Map view and click directly anywhere on the map to place a pin manually.'
    },
    {
      q: 'How does FamilySearch Beta tree sync work?',
      a: 'Click "Sign in: FamilySearch" in the top bar to connect via OAuth2 to <code>beta.familysearch.org</code>. When you add or edit a relative\'s name on a photo, the app live-queries your tree and auto-fills their Person ID (PID, such as <code>BM6T-WQ5</code>). If multiple relatives share that name, a dropdown lets you pick the right ancestor. You can also paste or type a PID manually at any time.'
    },
    {
      q: 'Where is my information saved? Will I lose it on refresh?',
      a: 'No! All changes are automatically persisted in your browser\'s local storage (<code>fhp_saved_metadata_catalog</code>). Furthermore, clicking the unified <strong>💾 Save to File</strong> button bakes all people, PIDs, dates, GPS coordinates, and historical notes directly into the JPEG file\'s XMP and EXIF headers, so the information stays permanently with the image file itself.'
    },
    {
      q: 'How do the 6 AI Photo Lab restoration tools work?',
      a: 'All 6 tools are non-destructive: <strong>4K Face Restore</strong> reconstructs blurry facial features with neural super-resolution; <strong>Auto Colorize</strong> converts sepia/B&W to vibrant color; <strong>Magic Eraser (LaMa)</strong> allows you to brush over tears and scratches to erase them; <strong>Tone & Contrast</strong> balances archival levels; <strong>Red-Eye</strong> cleans flash glare; and <strong>Crop</strong> focuses on portraits without loss of quality.'
    },
    {
      q: 'Is my family data safe and private?',
      a: 'Yes, 100%. Family History Photos runs entirely in your web browser. No photos, scans, names, or locations are ever uploaded to any third-party server or cloud database. Even folder indexing runs locally via your browser\'s File System Access API.'
    },
    {
      q: 'How do I switch back and forth between demo photos and my real photos?',
      a: 'Click "✕ Clear Demo" (in the top bar or sidebar) to clear the sample archive. Then click "Choose Photo Folder..." to open your family pictures on disk. If you ever want to reload the demo archive to practice or test, just click "Reload Demo" in the sidebar.'
    },
    {
      q: 'Can I export all my restored photos and metadata at once?',
      a: 'Yes! Click "Export 4K ZIP" in the top right header to download a complete archive package containing all 4K restored prints with embedded archival EXIF/XMP metadata and citation sheets ready for Ancestry.com and MyHeritage.'
    }
  ];

  let currentStep = 0;
  let activeTab = 'tour'; // 'tour' | 'faq'
  let isDocked = false;
  let appBridge = null;

  function highlightElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tutorial-highlight');
      setTimeout(() => el.classList.remove('tutorial-highlight'), 3500);
    } catch (e) {
      console.warn('Could not highlight:', selector, e);
    }
  }

  function injectStyles() {
    if (document.getElementById('tutorial-styles')) return;
    const style = document.createElement('style');
    style.id = 'tutorial-styles';
    style.textContent = `
      .tutorial-overlay {
        position: fixed;
        inset: 0;
        background: rgba(17, 17, 16, 0.75);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 200ms ease, visibility 200ms ease;
      }
      .tutorial-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      .tutorial-modal {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #dfdeda);
        border-radius: 14px;
        box-shadow: 0 28px 72px rgba(0, 0, 0, 0.45);
        max-width: 840px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
        color: var(--text, #111110);
      }
      .tutorial-header {
        padding: 18px 24px 14px;
        border-bottom: 1px solid var(--border, #dfdeda);
        background: var(--raised, #f0efec);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tutorial-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tutorial-title-box {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tutorial-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #1d5fbf;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 700;
      }
      .tutorial-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text, #111110);
      }
      .tutorial-subtitle {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--muted, #575653);
      }
      .tutorial-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tutorial-btn-icon {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #dfdeda);
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        color: var(--text, #111110);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 120ms ease;
      }
      .tutorial-btn-icon:hover {
        background: var(--active, #e4e3de);
        border-color: var(--control, #c8c7c2);
      }
      .tutorial-tabs {
        display: flex;
        gap: 8px;
      }
      .tutorial-tab-btn {
        background: none;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--muted, #575653);
        cursor: pointer;
        transition: all 120ms ease;
      }
      .tutorial-tab-btn.active {
        background: var(--surface, #ffffff);
        color: var(--accent, #1d5fbf);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      .tutorial-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
      }
      .step-progress-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--rule, #ecebe7);
      }
      .step-badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--pill-info-bg, #e8f0fe);
        color: var(--pill-info-ink, #164388);
        padding: 4px 10px;
        border-radius: 9999px;
      }
      .step-dots {
        display: flex;
        gap: 6px;
      }
      .step-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--border, #dfdeda);
        cursor: pointer;
        transition: all 150ms ease;
      }
      .step-dot.active {
        background: var(--accent, #1d5fbf);
        transform: scale(1.25);
      }
      .step-dot.done {
        background: var(--positive, #1f7a4c);
      }
      .step-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: var(--text, #111110);
      }
      .step-desc {
        font-size: 14px;
        line-height: 1.6;
        color: var(--muted, #575653);
        margin-bottom: 16px;
      }
      .step-bullets {
        background: var(--raised, #f0efec);
        border: 1px solid var(--border, #dfdeda);
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 18px;
      }
      .step-bullets ul {
        margin: 0;
        padding-left: 20px;
      }
      .step-bullets li {
        font-size: 13px;
        line-height: 1.65;
        color: var(--text, #111110);
        margin-bottom: 8px;
      }
      .step-bullets li:last-child {
        margin-bottom: 0;
      }
      .step-action-card {
        background: rgba(29, 95, 191, 0.06);
        border: 1px solid rgba(29, 95, 191, 0.3);
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }
      .step-action-desc {
        font-size: 13px;
        color: var(--text, #111110);
      }
      .step-action-btn {
        background: #1d5fbf;
        color: #ffffff;
        border: 1px solid #164388;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 120ms ease;
      }
      .step-action-btn:hover {
        background: #164388;
      }
      .step-tip {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        background: var(--pill-warning-bg, #fffbeb);
        border: 1px solid rgba(146, 64, 14, 0.2);
        color: var(--pill-warning-ink, #92400e);
        font-size: 12px;
        line-height: 1.5;
      }
      .tutorial-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border, #dfdeda);
        background: var(--raised, #f0efec);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tutorial-footer-left {
        display: flex;
        gap: 10px;
      }
      .tutorial-footer-right {
        display: flex;
        gap: 10px;
      }
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .faq-item {
        background: var(--raised, #f0efec);
        border: 1px solid var(--border, #dfdeda);
        border-radius: 10px;
        padding: 14px 18px;
      }
      .faq-q {
        font-size: 14px;
        font-weight: 600;
        color: var(--text, #111110);
        margin: 0 0 6px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .faq-a {
        font-size: 13px;
        color: var(--muted, #575653);
        line-height: 1.55;
        margin: 0;
      }
      /* Floating Docked Assistant */
      .tutorial-docked {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        width: 390px;
        max-width: calc(100vw - 32px);
        background: var(--surface, #ffffff);
        border: 2px solid var(--accent, #1d5fbf);
        border-radius: 12px;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.35);
        padding: 16px;
        display: none;
        flex-direction: column;
        gap: 10px;
        font-family: inherit;
        animation: tutorialSlideUp 200ms ease;
      }
      .tutorial-docked.active {
        display: flex;
      }
      @keyframes tutorialSlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .docked-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .docked-badge {
        font-size: 11px;
        font-weight: 700;
        color: var(--accent, #1d5fbf);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .docked-actions {
        display: flex;
        gap: 6px;
      }
      .docked-btn {
        background: none;
        border: none;
        color: var(--muted, #575653);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
      }
      .docked-btn:hover {
        background: var(--active, #e4e3de);
        color: var(--text, #111110);
      }
      .docked-title {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        color: var(--text, #111110);
      }
      .docked-desc {
        font-size: 12px;
        color: var(--muted, #575653);
        line-height: 1.45;
        margin: 0;
      }
      .docked-action-btn {
        background: #1d5fbf;
        color: #ffffff;
        border: 1px solid #164388;
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
      }
      .docked-action-btn:hover {
        background: #164388;
      }
      .docked-nav-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 6px;
        border-top: 1px solid var(--rule, #ecebe7);
      }
      .tutorial-highlight {
        outline: 3px solid #1d5fbf !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 24px rgba(29, 95, 191, 0.5) !important;
        animation: tutorialPulse 1.8s infinite alternate !important;
      }
      @keyframes tutorialPulse {
        from { outline-color: #1d5fbf; box-shadow: 0 0 16px rgba(29, 95, 191, 0.4); }
        to { outline-color: #10b981; box-shadow: 0 0 28px rgba(16, 185, 129, 0.6); }
      }
    `;
    document.head.appendChild(style);
  }

  function renderModalContent() {
    const body = document.getElementById('tutorial-modal-body');
    if (!body) return;

    if (activeTab === 'faq') {
      body.innerHTML = `
        <div class="faq-list">
          <div style="margin-bottom:8px;">
            <p style="font-size:13px; color:var(--muted); margin:0 0 12px;">Frequently asked questions and direct answers for family archivists:</p>
          </div>
          ${FAQS.map((item, idx) => `
            <div class="faq-item">
              <h4 class="faq-q"><span>❓</span> ${item.q}</h4>
              <p class="faq-a">${item.a}</p>
            </div>
          `).join('')}
        </div>
      `;
      return;
    }

    const s = STEPS[currentStep];
    body.innerHTML = `
      <div class="step-progress-row">
        <span class="step-badge">${s.badge}</span>
        <div class="step-dots">
          ${STEPS.map((_, i) => `
            <div class="step-dot ${i === currentStep ? 'active' : (i < currentStep ? 'done' : '')}" data-step="${i}" title="${STEPS[i].shortTitle}"></div>
          `).join('')}
        </div>
      </div>

      <h3 class="step-title">${s.title}</h3>
      <p class="step-desc">${s.desc}</p>

      <div class="step-bullets">
        <ul>
          ${s.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>

      <div class="step-action-card">
        <div class="step-action-desc">
          <strong>Interactive Action:</strong> Navigate directly to this feature in the app.
        </div>
        <button class="step-action-btn" type="button" id="btn-run-step-action">
          ${s.actionText}
        </button>
      </div>

      <div class="step-tip">
        <span>💡</span>
        <div>${s.tip}</div>
      </div>
    `;

    // Wire action button
    const actionBtn = document.getElementById('btn-run-step-action');
    if (actionBtn) {
      actionBtn.onclick = () => {
        dockTutorial();
        s.runAction(appBridge);
      };
    }

    // Wire step dots
    body.querySelectorAll('.step-dot').forEach(dot => {
      dot.onclick = () => {
        const stepNum = parseInt(dot.getAttribute('data-step'), 10);
        goToStep(stepNum);
      };
    });

    // Update footer buttons
    const prevBtn = document.getElementById('tutorial-btn-prev');
    const nextBtn = document.getElementById('tutorial-btn-next');
    if (prevBtn) {
      prevBtn.disabled = currentStep === 0;
      prevBtn.style.opacity = currentStep === 0 ? '0.4' : '1';
    }
    if (nextBtn) {
      if (currentStep === STEPS.length - 1) {
        nextBtn.textContent = 'Finish Tour ✓';
      } else {
        nextBtn.textContent = 'Next Step →';
      }
    }
  }

  function renderDockedContent() {
    const s = STEPS[currentStep];
    const docked = document.getElementById('tutorial-docked-assistant');
    if (!docked) return;

    docked.innerHTML = `
      <div class="docked-header">
        <span class="docked-badge">Step ${s.step} of 7 • ${s.shortTitle}</span>
        <div class="docked-actions">
          <button class="docked-btn" id="docked-expand" title="Expand full guide">⤢ Expand</button>
          <button class="docked-btn" id="docked-close" title="Close tutorial">✕</button>
        </div>
      </div>
      <p class="docked-desc">${s.desc.substring(0, 110)}...</p>
      <button class="docked-action-btn" id="docked-action">${s.actionText}</button>
      <div class="docked-nav-row">
        <button class="tutorial-btn-icon" id="docked-prev" ${currentStep === 0 ? 'disabled style="opacity:0.4"' : ''}>← Prev</button>
        <span style="font-size:11px; color:var(--muted);">${currentStep + 1} / ${STEPS.length}</span>
        <button class="tutorial-btn-icon" id="docked-next">${currentStep === STEPS.length - 1 ? 'Finish ✓' : 'Next →'}</button>
      </div>
    `;

    document.getElementById('docked-expand').onclick = expandTutorial;
    document.getElementById('docked-close').onclick = closeTutorial;
    document.getElementById('docked-action').onclick = () => s.runAction(appBridge);
    document.getElementById('docked-prev').onclick = () => {
      if (currentStep > 0) goToStep(currentStep - 1);
    };
    document.getElementById('docked-next').onclick = () => {
      if (currentStep < STEPS.length - 1) {
        goToStep(currentStep + 1);
      } else {
        closeTutorial();
      }
    };
  }

  function goToStep(idx) {
    currentStep = Math.max(0, Math.min(STEPS.length - 1, idx));
    renderModalContent();
    renderDockedContent();
  }

  function openTutorial(tab = 'tour') {
    injectStyles();
    buildDOM();
    activeTab = tab;
    isDocked = false;

    const overlay = document.getElementById('tutorial-overlay');
    const docked = document.getElementById('tutorial-docked-assistant');
    if (overlay) overlay.classList.add('active');
    if (docked) docked.classList.remove('active');

    // Update tab header styles
    const tabTour = document.getElementById('tab-btn-tour');
    const tabFaq = document.getElementById('tab-btn-faq');
    if (tabTour) tabTour.classList.toggle('active', activeTab === 'tour');
    if (tabFaq) tabFaq.classList.toggle('active', activeTab === 'faq');

    renderModalContent();
  }

  function closeTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    const docked = document.getElementById('tutorial-docked-assistant');
    if (overlay) overlay.classList.remove('active');
    if (docked) docked.classList.remove('active');
  }

  function dockTutorial() {
    isDocked = true;
    const overlay = document.getElementById('tutorial-overlay');
    const docked = document.getElementById('tutorial-docked-assistant');
    if (overlay) overlay.classList.remove('active');
    if (docked) {
      renderDockedContent();
      docked.classList.add('active');
    }
  }

  function expandTutorial() {
    isDocked = false;
    openTutorial(activeTab);
  }

  function buildDOM() {
    if (document.getElementById('tutorial-overlay')) return;

    // Create Modal Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-modal-title">
        <div class="tutorial-header">
          <div class="tutorial-header-top">
            <div class="tutorial-title-box">
              <div class="tutorial-icon">FH</div>
              <div>
                <h2 class="tutorial-title" id="tutorial-modal-title">Family History Photos Guide &amp; Workflow Tutorial</h2>
                <p class="tutorial-subtitle">Step-by-step interactive workflow tutorial with the pre-loaded demo archive</p>
              </div>
            </div>
            <div class="tutorial-header-actions">
              <button class="tutorial-btn-icon" id="tutorial-btn-dock" title="Minimize and interact with the app">
                <span>⤢ Dock &amp; Explore App</span>
              </button>
              <button class="tutorial-btn-icon" id="tutorial-btn-close" title="Close guide">
                <span>✕ Close</span>
              </button>
            </div>
          </div>

          <div class="tutorial-tabs">
            <button class="tutorial-tab-btn active" id="tab-btn-tour" type="button">🎯 Guided Workflow (7 Steps)</button>
            <button class="tutorial-tab-btn" id="tab-btn-faq" type="button">💡 Help Topics &amp; FAQ</button>
          </div>
        </div>

        <div class="tutorial-body" id="tutorial-modal-body">
          <!-- Dynamic Step or FAQ Content -->
        </div>

        <div class="tutorial-footer" id="tutorial-modal-footer">
          <div class="tutorial-footer-left">
            <button class="tutorial-btn-icon" id="tutorial-btn-prev" type="button">← Previous Step</button>
          </div>
          <div class="tutorial-footer-right">
            <button class="tutorial-btn-icon" id="tutorial-btn-dock-footer" type="button">⤢ Try on Screen</button>
            <button class="step-action-btn" id="tutorial-btn-next" type="button">Next Step →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Create Floating Docked Assistant
    const docked = document.createElement('div');
    docked.id = 'tutorial-docked-assistant';
    docked.className = 'tutorial-docked';
    document.body.appendChild(docked);

    // Event Listeners
    document.getElementById('tutorial-btn-close').onclick = closeTutorial;
    document.getElementById('tutorial-btn-dock').onclick = dockTutorial;
    document.getElementById('tutorial-btn-dock-footer').onclick = () => {
      dockTutorial();
      STEPS[currentStep].runAction(appBridge);
    };

    document.getElementById('tab-btn-tour').onclick = () => {
      activeTab = 'tour';
      document.getElementById('tab-btn-tour').classList.add('active');
      document.getElementById('tab-btn-faq').classList.remove('active');
      document.getElementById('tutorial-modal-footer').style.display = 'flex';
      renderModalContent();
    };

    document.getElementById('tab-btn-faq').onclick = () => {
      activeTab = 'faq';
      document.getElementById('tab-btn-faq').classList.add('active');
      document.getElementById('tab-btn-tour').classList.remove('active');
      document.getElementById('tutorial-modal-footer').style.display = 'none';
      renderModalContent();
    };

    document.getElementById('tutorial-btn-prev').onclick = () => {
      if (currentStep > 0) goToStep(currentStep - 1);
    };

    document.getElementById('tutorial-btn-next').onclick = () => {
      if (currentStep < STEPS.length - 1) {
        goToStep(currentStep + 1);
      } else {
        closeTutorial();
      }
    };

    // Close on backdrop click
    overlay.onclick = (e) => {
      if (e.target === overlay) closeTutorial();
    };

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeTutorial();
      }
    });
  }

  // Public API
  window.FamilyHistoryTutorial = {
    open: (tab = 'tour') => openTutorial(tab),
    close: () => closeTutorial(),
    goToStep: (i) => goToStep(i),
    setAppBridge: (bridge) => { appBridge = bridge; },
    init: (bridge) => {
      if (bridge) appBridge = bridge;
      injectStyles();
      buildDOM();
    }
  };
})();


/**
 * Family History Photos - Interactive Workflow Guide & Visual Tutorial
 * Designed for 60+ family archivists with large high-contrast text,
 * clear 4-step roadmap, real screen pictures (click to enlarge),
 * dockable follow-along mode, and plain-English answers.
 */
(() => {
  'use strict';

  const ROADMAP = [
    { num: 1, label: 'Gather Photos' },
    { num: 2, label: 'Identify & Tag' },
    { num: 3, label: 'Restore' },
    { num: 4, label: 'Save & Share' }
  ];

  const STEPS = [
    {
      step: 1,
      stageNum: 1,
      badge: 'Lesson 1 of 6 • Step 1: Gather',
      title: 'Step 1: Bring In Your Photos & PAF Family Tree',
      shortTitle: '1. Gather Photos & Tree',
      desc: 'Start in <strong>1. Gather Photos</strong> to bring pictures onto the screen. You can load a few favorite pictures, a whole computer folder, Google Drive albums, or your exported PAF / GEDCOM (<code>.ged</code>) family tree file.',
      bullets: [
        '<strong>Pick Photo(s) or Scan Folder:</strong> Opens pictures from your computer or camera right away without copying them to any cloud server.',
        '<strong>Load PAF / GEDCOM (.ged):</strong> Reads all names, birth/death dates, notes, and matches old PAF photo filenames to pictures you already loaded.',
        '<strong>Stays Saved Automatically:</strong> Once you load your <code>.ged</code> file, the app remembers it — you will not have to reload it next time you visit.'
      ],
      tip: 'Your photos stay privately on your own computer during Step 1. Nothing is sent to FamilySearch until you choose to upload in Step 4.',
      screenshot: './help-screenshots/step-1-gather.png',
      screenshotCaption: 'Step 1 Gather screen: choose photos, a folder, your PAF/GEDCOM tree, or Cloud storage.',
      actionText: '📁 Go to Step 1: Gather Photos',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('gather');
        highlightElement('#section-gather');
      }
    },
    {
      step: 2,
      stageNum: 2,
      badge: 'Lesson 2 of 6 • Step 2: Identify Photos',
      title: 'Step 2 (Photos): Name Faces, Dates & Stories',
      shortTitle: '2A. Name Faces & Stories',
      desc: 'In <strong>2. Identify &amp; Tag</strong>, click any photo row in the table (or switch to <strong>Contact sheet</strong> for big picture tiles) to view and edit its details on the right side.',
      bullets: [
        '<strong>Blow Up &amp; Tag Faces:</strong> Zooms in large on group photos, draws face boxes, and remembers faces so it helps recognize relatives in later photos.',
        '<strong>Pull from PAF / GEDCOM:</strong> Links a tagged person straight to their <code>🌳 PAF</code> record, copying birth/death dates, places, and notes.',
        '<strong>Save Locally First:</strong> Enter the date, address, and story from the back of the print, then click the blue <strong>✓ Save Changes to Catalog</strong> button.'
      ],
      tip: 'Need to switch views? Notice the 4 buttons near the top right: Ledger, Contact sheet, People / Tree, and Global Map.',
      screenshot: './help-screenshots/step-2-identify.png',
      screenshotCaption: 'Step 2 Photo Ledger: click any photo row on the left to tag people and edit details on the right.',
      actionText: '🏷️ Go to Step 2: Photo Ledger',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.setLayout) app.setLayout('ledger');
        highlightElement('#catalog-center');
      }
    },
    {
      step: 3,
      stageNum: 2,
      badge: 'Lesson 3 of 6 • Step 2: People / Tree',
      title: 'Step 2 (People / Tree): Add or Link Photos to Any Relative',
      shortTitle: '2B. Add Photos to PAF People',
      desc: 'Want to start from a person in your family tree and attach photos directly to them? Click the <strong>People / Tree</strong> button inside Step 2.',
      bullets: [
        '<strong>See Matched Relatives First:</strong> Automatically shows people from your PAF / GEDCOM file who already have matched photos — click any thumbnail to edit or tag it on the right.',
        '<strong>➕ Add Photo from Computer:</strong> Pick new photo file(s) from your computer for any relative. Those photos are added to your collection and automatically linked to their PAF/GEDCOM record!',
        '<strong>🔗 Link Existing Photo:</strong> Already loaded a folder or Google Drive batch? Click this to attach any loaded photo directly to that person.'
      ],
      tip: 'Use the "With Photos", "Needs a Photo", and "All People" buttons at the top of People / Tree — or search any ancestor by name.',
      screenshot: './help-screenshots/step-2-people.png',
      screenshotCaption: 'Step 2 People / Tree view: attach computer photos or existing batch photos straight to any relative.',
      actionText: '🌳 Open Step 2: People / Tree View',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.setLayout) app.setLayout('people');
        highlightElement('#catalog-center');
      }
    },
    {
      step: 4,
      stageNum: 2,
      badge: 'Lesson 4 of 6 • Step 2: Map Pins',
      title: 'Step 2 (Global Map): Pin Where Memories Happened',
      shortTitle: '2C. Interactive Family Map',
      desc: 'Bring family history to life geographically! Every photo with an address or camera GPS appears as a camera pin on the interactive <strong>Global Map</strong>.',
      bullets: [
        '<strong>Easy Address Lookup:</strong> Type any address or town (for example, <em>"1633 W Wooster St, Bowling Green, OH"</em>) in the right panel and click <strong>Drop Pin</strong>.',
        '<strong>Filter by Family Line or Decade:</strong> Show just one side of the family (like Costello, Gill, or Viola) or one decade at a time.',
        '<strong>Click Any Pin:</strong> Opens a popup preview of that photo right on the map.'
      ],
      tip: 'Smartphones and modern digital cameras often save GPS coordinates inside JPEG files — we map those for you automatically when loaded!',
      screenshot: './help-screenshots/step-2-map.png',
      screenshotCaption: 'Step 2 Global Map: filter pins by family branch or decade and click any pin to preview.',
      actionText: '🗺️ Open Step 2: Global Map',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('catalog');
        if (app && app.setLayout) app.setLayout('map');
        highlightElement('#catalog-center');
      }
    },
    {
      step: 5,
      stageNum: 3,
      badge: 'Lesson 5 of 6 • Step 3: Restore (Optional)',
      title: 'Step 3 (Optional): Clean & Sharpen Old Photos',
      shortTitle: '3. Photo Lab Repairs',
      desc: 'Have faded, blurry, black-and-white, or scratched prints? Step 3 (<strong>Restore Photos</strong>) lets you gently clean them up before saving or sharing.',
      bullets: [
        '<strong>6 Easy Repair Tabs:</strong> 4K Restore (sharpens faces), Color &amp; Cast (colorizes B&amp;W prints), Light &amp; Tone, Crop &amp; Tilt, Magic Eraser (paint over creases), and Red-Eye removal.',
        '<strong>Compare Before &amp; After:</strong> Drag the yellow center line left and right across the photo to compare the original with your repaired version.',
        '<strong>Safe Undo &amp; Reset:</strong> Your original picture is never harmed — you can Undo a change or click Reset anytime.'
      ],
      tip: 'Step 3 is completely optional! If your photo already looks great, click the green "Next: Step 4 — Save & Share →" button to move on.',
      screenshot: './help-screenshots/step-3-restore.png',
      screenshotCaption: 'Step 3 Photo Lab: drag the center line to compare Before & After and choose repairs on the right.',
      actionText: '✨ Open Step 3: Photo Lab',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('lab');
        highlightElement('#section-lab');
      }
    },
    {
      step: 6,
      stageNum: 4,
      badge: 'Lesson 6 of 6 • Step 4: Save & Share',
      title: 'Step 4: Sync to FamilySearch & Save Permanent Backups',
      shortTitle: '4. Sync, Resume & Back Up',
      desc: 'When your photos and people are ready, open <strong>4. Save &amp; Share</strong> to upload to FamilySearch Beta or download permanent JPEG copies with names and stories stored inside the file.',
      bullets: [
        '<strong>▶ Pick Up Where You Left Off:</strong> Card 1 remembers every relative you already synced to FamilySearch Beta (<code>✓ Synced</code>) and keeps the rest ready under <strong>Not Synced Yet</strong> so you never repeat work.',
        '<strong>⚖️ Compare First Before Updating:</strong> Review side-by-side what is already on FamilySearch Beta versus your PAF/GEDCOM notes, check what you want to add, and apply cleanly.',
        '<strong>💾 Save JPEGs, 4K ZIP &amp; Drive Verify:</strong> Download JPEGs with embedded EXIF/IPTC stories inside the photo, copy Ancestry/MyHeritage citations, or verify your Google Drive backup folder.'
      ],
      tip: 'If someone in your photo is not on FamilySearch yet (like a new spouse or grandchild), use "+ Add to FS" in Step 2 or "+ Not a Match? Create New Person" during Compare to add them and link them to their spouse, parents, or children!',
      screenshot: './help-screenshots/step-4-save.png',
      screenshotCaption: 'Step 4 Save & Share: resume FamilySearch syncing, upload Memories, export JPEGs, and verify Drive backups.',
      actionText: '💾 Go to Step 4: Save & Share',
      runAction: (app) => {
        if (app && app.setMode) app.setMode('sync');
        highlightElement('#section-sync');
      }
    }
  ];

  const FAQS = [
    {
      q: 'How do I add new photos straight to someone in my PAF / GEDCOM tree?',
      a: 'Go to <strong>Step 2: Identify &amp; Tag</strong> and click the <strong>People / Tree</strong> view tab (top right of the table). Search or scroll to the relative you want, then click <strong>➕ Add Photo from Computer</strong> (to pick picture files from your PC) or <strong>🔗 Link Existing Photo</strong> (to pick a photo already open in this app). It links that photo directly to their PAF record!'
    },
    {
      q: 'If I tag someone on a photo first, does it connect to my PAF / GEDCOM tree?',
      a: 'Yes! When a <code>.ged</code> file is loaded, typing a relative\'s name in the right panel under <strong>Tag an Individual</strong> shows matching PAF tree suggestions you can click to link immediately, and tagging a face in <strong>Blow Up &amp; Tag Faces</strong> also auto-links matching PAF records. Linked people display a green <code>🌳 PAF</code> badge.'
    },
    {
      q: 'Will I lose my PAF file or FamilySearch progress when I close the browser?',
      a: 'No! Both your loaded <code>.ged</code> tree and the list of people you already synced to FamilySearch Beta are saved automatically on your computer. Next time you open the app and go to <strong>Step 4: Save &amp; Share</strong>, click <strong>▶ Pick Up Where I Left Off</strong> to continue with the next unsynced person.'
    },
    {
      q: 'What if someone in my photo is not on FamilySearch yet (like an in-law)?',
      a: 'In Step 2\'s right panel under <em>Relatives in print</em>, click the blue <strong>+ Add to FS</strong> pill next to their name (or click <strong>+ Create on FamilySearch</strong> inside Face Tagger or Search Tree). You can create their record AND choose how they connect to someone already in the photo (Spouse, Child, Parent, or Sibling) in one step.'
    },
    {
      q: 'Will Photo Lab edits ruin or overwrite my original picture files?',
      a: 'Never. Photo Lab works non-destructively in the browser. You can click <strong>Undo</strong> or <strong>Reset</strong> at any time, and your original file on your hard drive is never modified.'
    },
    {
      q: 'How do I switch between practice Demo photos and my real family photos?',
      a: 'In Step 1 (or the top bar), click the red <strong>✕ Clear Current Photos</strong> button (or <strong>Clear Demo</strong>) to start clean, then pick photos or scan your folder. Want to practice again later? Click <strong>↺ Load Practice Demo Photos</strong> anytime.'
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
        background: rgba(15, 23, 42, 0.56);
        backdrop-filter: blur(2px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 180ms ease, visibility 180ms ease;
      }
      .tutorial-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      .tutorial-modal {
        background: #ffffff;
        border: 2px solid #93c5fd;
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.38);
        max-width: 720px;
        width: 100%;
        max-height: 92vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
        color: #0f172a;
      }
      .tutorial-roadmap {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-bottom: 14px;
      }
      .tutorial-road-step {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 9px;
        border-radius: 8px;
        background: #f1f5f9;
        border: 1.5px solid #cbd5e1;
        font-size: 12.5px;
        font-weight: 700;
        color: #334155;
      }
      .tutorial-road-step.is-done {
        background: #dcfce7;
        border-color: #86efac;
        color: #166534;
      }
      .tutorial-road-step.is-active {
        background: #1d4ed8;
        border-color: #1e40af;
        color: #ffffff;
      }
      .tutorial-road-num {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: rgba(255,255,255,0.85);
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        flex-shrink: 0;
      }
      .tutorial-road-step.is-active .tutorial-road-num {
        background: #ffffff;
        color: #1d4ed8;
      }
      .step-screenshot {
        margin: 12px 0 14px;
        border: 2px solid #93c5fd;
        border-radius: 12px;
        overflow: hidden;
        background: #f8fafc;
      }
      .step-screenshot img {
        display: block;
        width: 100%;
        max-height: 280px;
        object-fit: cover;
        object-position: top center;
        cursor: zoom-in;
      }
      .step-screenshot figcaption {
        padding: 8px 12px;
        font-size: 13px;
        color: #1e293b;
        background: #eff6ff;
        border-top: 1px solid #bfdbfe;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn-enlarge-shot {
        background: #1d4ed8;
        color: #ffffff;
        border: 1px solid #1e40af;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }
      .btn-enlarge-shot:hover {
        background: #1e40af;
      }
      .tutorial-lightbox {
        position: fixed;
        inset: 0;
        z-index: 100025;
        background: rgba(15, 23, 42, 0.88);
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        gap: 12px;
      }
      .tutorial-lightbox.active {
        display: flex;
      }
      .tutorial-lightbox img {
        max-width: 95vw;
        max-height: 82vh;
        object-fit: contain;
        border-radius: 10px;
        border: 2px solid #93c5fd;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
        background: #ffffff;
      }
      .tutorial-lightbox-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        max-width: 95vw;
        width: 100%;
        max-width: 1120px;
        color: #ffffff;
        font-size: 15px;
        font-weight: 600;
      }
      .tutorial-header {
        padding: 16px 22px 12px;
        border-bottom: 1.5px solid #cbd5e1;
        background: #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tutorial-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .tutorial-title-box {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .tutorial-icon {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: #1d4ed8;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        font-weight: 800;
        flex-shrink: 0;
      }
      .tutorial-title {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        color: #0f172a;
      }
      .tutorial-subtitle {
        margin: 2px 0 0;
        font-size: 13.5px;
        color: #334155;
      }
      .tutorial-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tutorial-btn-icon {
        background: #e2e8f0;
        border: 1.5px solid #64748b;
        border-radius: 8px;
        padding: 7px 13px;
        cursor: pointer;
        font-size: 13.5px;
        font-weight: 700;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 120ms ease;
      }
      .tutorial-btn-icon:hover {
        background: #cbd5e1;
        border-color: #1e293b;
      }
      #tutorial-btn-close,
      #docked-close,
      #tutorial-lightbox-close {
        background: #dc2626 !important;
        color: #ffffff !important;
        border: 2px solid #991b1b !important;
        font-weight: 800 !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 6px rgba(185, 28, 28, 0.35) !important;
        cursor: pointer !important;
      }
      #tutorial-btn-close,
      #tutorial-lightbox-close {
        padding: 8px 15px !important;
        font-size: 14px !important;
      }
      #docked-close {
        padding: 4px 10px !important;
        font-size: 13px !important;
      }
      #tutorial-btn-close:hover,
      #docked-close:hover,
      #tutorial-lightbox-close:hover {
        background: #b91c1c !important;
        border-color: #7f1d1d !important;
      }
      .tutorial-tabs {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .tutorial-tab-btn {
        background: #e2e8f0;
        border: 1.5px solid #cbd5e1;
        padding: 7px 15px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        color: #334155;
        cursor: pointer;
        transition: all 120ms ease;
      }
      .tutorial-tab-btn.active {
        background: #1d4ed8;
        color: #ffffff;
        border-color: #1e40af;
      }
      .tutorial-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
      }
      .step-progress-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e2e8f0;
        gap: 8px;
        flex-wrap: wrap;
      }
      .step-badge {
        font-size: 12.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #dbeafe;
        color: #1e40af;
        padding: 5px 12px;
        border-radius: 9999px;
      }
      .step-dots {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .step-dot {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #cbd5e1;
        cursor: pointer;
        border: 1.5px solid #94a3b8;
        transition: all 150ms ease;
      }
      .step-dot.active {
        background: #1d4ed8;
        border-color: #1e40af;
        transform: scale(1.25);
      }
      .step-dot.done {
        background: #16a34a;
        border-color: #15803d;
      }
      .step-title {
        font-size: 21px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: #0f172a;
        line-height: 1.25;
      }
      .step-desc {
        font-size: 15.5px;
        line-height: 1.6;
        color: #1e293b;
        margin: 0 0 12px 0;
      }
      .step-bullets {
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 14px;
      }
      .step-bullets ul {
        margin: 0;
        padding-left: 20px;
      }
      .step-bullets li {
        font-size: 14.5px;
        line-height: 1.6;
        color: #0f172a;
        margin-bottom: 8px;
      }
      .step-bullets li:last-child {
        margin-bottom: 0;
      }
      .step-action-card {
        background: #eff6ff;
        border: 1.5px solid #93c5fd;
        border-radius: 10px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }
      .step-action-desc {
        font-size: 14.5px;
        color: #0f172a;
      }
      .step-action-btn {
        background: #15803d;
        color: #ffffff;
        border: 1.5px solid #166534;
        padding: 9px 16px;
        border-radius: 8px;
        font-size: 14.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: background 120ms ease;
      }
      .step-action-btn:hover {
        background: #166534;
      }
      .step-action-btn.primary-nav {
        background: #1d4ed8;
        border-color: #1e40af;
      }
      .step-action-btn.primary-nav:hover {
        background: #1e40af;
      }
      .step-tip {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 15px;
        border-radius: 10px;
        background: #fefce8;
        border: 1.5px solid #fde047;
        color: #713f12;
        font-size: 14px;
        line-height: 1.55;
      }
      .tutorial-footer {
        padding: 14px 22px;
        border-top: 1.5px solid #cbd5e1;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      .tutorial-footer-left,
      .tutorial-footer-right {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .faq-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .faq-item {
        background: #f8fafc;
        border: 1.5px solid #cbd5e1;
        border-radius: 10px;
        padding: 15px 18px;
      }
      .faq-q {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 6px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .faq-a {
        font-size: 14.5px;
        color: #1e293b;
        line-height: 1.6;
        margin: 0;
      }
      /* Floating Docked Assistant */
      .tutorial-docked {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        width: 410px;
        max-width: calc(100vw - 32px);
        background: #ffffff;
        border: 2.5px solid #1d4ed8;
        border-radius: 14px;
        box-shadow: 0 18px 46px rgba(15, 23, 42, 0.35);
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
        gap: 8px;
      }
      .docked-badge {
        font-size: 12px;
        font-weight: 800;
        color: #1e40af;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .docked-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .docked-btn {
        background: #e2e8f0;
        border: 1px solid #64748b;
        color: #0f172a;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12.5px;
        font-weight: 700;
      }
      .docked-btn:hover {
        background: #cbd5e1;
      }
      .docked-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }
      .docked-desc {
        font-size: 14px;
        color: #334155;
        line-height: 1.5;
        margin: 0;
      }
      .docked-action-btn {
        background: #15803d;
        color: #ffffff;
        border: 1.5px solid #166534;
        padding: 9px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
      }
      .docked-action-btn:hover {
        background: #166534;
      }
      .docked-nav-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      }
      .tutorial-highlight {
        outline: 3px solid #1d4ed8 !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 24px rgba(29, 78, 216, 0.5) !important;
        animation: tutorialPulse 1.8s infinite alternate !important;
      }
      @keyframes tutorialPulse {
        from { outline-color: #1d4ed8; box-shadow: 0 0 16px rgba(29, 78, 216, 0.4); }
        to { outline-color: #16a34a; box-shadow: 0 0 28px rgba(22, 163, 74, 0.6); }
      }
      @media (max-width: 640px) {
        .tutorial-modal {
          max-height: 94vh;
          border-radius: 12px;
        }
        .tutorial-roadmap {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .tutorial-header {
          padding: 12px 14px;
        }
        .tutorial-body {
          padding: 14px;
        }
        .tutorial-title {
          font-size: 17px;
        }
        .tutorial-footer {
          padding: 10px 14px;
          flex-direction: column;
          align-items: stretch;
        }
        .tutorial-footer-left,
        .tutorial-footer-right {
          width: 100%;
          justify-content: space-between;
        }
        .tutorial-docked {
          bottom: 74px;
          left: 10px;
          right: 10px;
          width: auto;
          max-width: none;
          padding: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function openScreenshotLightbox(src, caption) {
    let lb = document.getElementById('tutorial-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'tutorial-lightbox';
      lb.className = 'tutorial-lightbox';
      lb.innerHTML = `
        <div class="tutorial-lightbox-bar">
          <span id="tutorial-lightbox-caption"></span>
          <button type="button" id="tutorial-lightbox-close">✕ Close Picture</button>
        </div>
        <img id="tutorial-lightbox-img" src="" alt="">
      `;
      document.body.appendChild(lb);
      lb.querySelector('#tutorial-lightbox-close').onclick = () => lb.classList.remove('active');
      lb.onclick = (e) => {
        if (e.target === lb) lb.classList.remove('active');
      };
    }
    lb.querySelector('#tutorial-lightbox-img').src = src;
    lb.querySelector('#tutorial-lightbox-img').alt = caption || '';
    lb.querySelector('#tutorial-lightbox-caption').textContent = caption || 'Full Screen Picture';
    lb.classList.add('active');
  }

  function renderModalContent() {
    const body = document.getElementById('tutorial-modal-body');
    if (!body) return;

    if (activeTab === 'faq') {
      body.innerHTML = `
        <div class="faq-list">
          <div style="margin-bottom:4px;">
            <p style="font-size:15px;color:#1e293b;margin:0 0 8px;font-weight:600;">Plain-English answers to common questions:</p>
          </div>
          ${FAQS.map((item) => `
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
      <div class="tutorial-roadmap" aria-label="4-step workflow overview">
        ${ROADMAP.map((r) => `
          <div class="tutorial-road-step ${r.num === s.stageNum ? 'is-active' : (r.num < s.stageNum ? 'is-done' : '')}">
            <span class="tutorial-road-num">${r.num}</span>
            <span>${r.label}</span>
          </div>
        `).join('')}
      </div>

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

      ${s.screenshot ? `
        <figure class="step-screenshot" id="step-screenshot-fig" title="Click to enlarge screenshot">
          <img src="${s.screenshot}" alt="${s.title}">
          <figcaption>
            <span>${s.screenshotCaption || s.title}</span>
            <button type="button" class="btn-enlarge-shot" id="btn-enlarge-shot">🔍 Enlarge Picture</button>
          </figcaption>
        </figure>
      ` : ''}

      <div class="step-bullets">
        <ul>
          ${s.bullets.map((b) => `<li>${b}</li>`).join('')}
        </ul>
      </div>

      <div class="step-action-card">
        <div class="step-action-desc">
          <strong>Try it yourself:</strong> Jump straight to this screen while keeping this guide handy in the corner.
        </div>
        <button class="step-action-btn" type="button" id="btn-run-step-action">
          ${s.actionText}
        </button>
      </div>

      <div class="step-tip">
        <span style="font-size:18px;">💡</span>
        <div>${s.tip}</div>
      </div>
    `;

    const actionBtn = document.getElementById('btn-run-step-action');
    if (actionBtn) {
      actionBtn.onclick = () => {
        dockTutorial();
        if (s.runAction) s.runAction(appBridge);
      };
    }

    const figEl = document.getElementById('step-screenshot-fig');
    if (figEl && s.screenshot) {
      figEl.onclick = () => openScreenshotLightbox(s.screenshot, s.screenshotCaption || s.title);
    }

    body.querySelectorAll('.step-dot').forEach((dot) => {
      dot.onclick = () => {
        const stepNum = parseInt(dot.getAttribute('data-step'), 10);
        goToStep(stepNum);
      };
    });

    const prevBtn = document.getElementById('tutorial-btn-prev');
    const nextBtn = document.getElementById('tutorial-btn-next');
    if (prevBtn) {
      prevBtn.disabled = currentStep === 0;
      prevBtn.style.opacity = currentStep === 0 ? '0.45' : '1';
    }
    if (nextBtn) {
      nextBtn.textContent = currentStep === STEPS.length - 1 ? 'Finish Guide ✓' : 'Next Lesson →';
    }
  }

  function renderDockedContent() {
    const s = STEPS[currentStep];
    const docked = document.getElementById('tutorial-docked-assistant');
    if (!docked) return;

    docked.innerHTML = `
      <div class="docked-header">
        <span class="docked-badge">Lesson ${s.step} of ${STEPS.length} • ${s.shortTitle}</span>
        <div class="docked-actions">
          <button class="docked-btn" id="docked-expand" title="Return to large guide with pictures">⤢ Big Guide</button>
          <button class="docked-btn" id="docked-close" title="Close guide">✕ Close</button>
        </div>
      </div>
      <h4 class="docked-title">${s.title}</h4>
      <p class="docked-desc">${s.desc.replace(/<[^>]+>/g, '')}</p>
      <button class="docked-action-btn" id="docked-action">${s.actionText}</button>
      <div class="docked-nav-row">
        <button class="tutorial-btn-icon" id="docked-prev" ${currentStep === 0 ? 'disabled style="opacity:0.45"' : ''}>← Back</button>
        <span style="font-size:13px;font-weight:700;color:#334155;">${currentStep + 1} of ${STEPS.length}</span>
        <button class="tutorial-btn-icon" id="docked-next">${currentStep === STEPS.length - 1 ? 'Done ✓' : 'Next →'}</button>
      </div>
    `;

    document.getElementById('docked-expand').onclick = expandTutorial;
    document.getElementById('docked-close').onclick = closeTutorial;
    document.getElementById('docked-action').onclick = () => {
      if (s.runAction) s.runAction(appBridge);
    };
    document.getElementById('docked-prev').onclick = () => {
      if (currentStep > 0) goToStep(currentStep - 1);
    };
    document.getElementById('docked-next').onclick = () => {
      if (currentStep < STEPS.length - 1) goToStep(currentStep + 1);
      else closeTutorial();
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

    const tabTour = document.getElementById('tab-btn-tour');
    const tabFaq = document.getElementById('tab-btn-faq');
    if (tabTour) tabTour.classList.toggle('active', activeTab === 'tour');
    if (tabFaq) tabFaq.classList.toggle('active', activeTab === 'faq');
    const footer = document.getElementById('tutorial-modal-footer');
    if (footer) footer.style.display = activeTab === 'faq' ? 'none' : 'flex';

    renderModalContent();
  }

  function closeTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    const docked = document.getElementById('tutorial-docked-assistant');
    const lb = document.getElementById('tutorial-lightbox');
    if (overlay) overlay.classList.remove('active');
    if (docked) docked.classList.remove('active');
    if (lb) lb.classList.remove('active');
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
                <h2 class="tutorial-title" id="tutorial-modal-title">Easy Step-by-Step Guide &amp; Help</h2>
                <p class="tutorial-subtitle">Clear pictures and plain-English instructions for every step (1 → 2 → 3 → 4)</p>
              </div>
            </div>
            <div class="tutorial-header-actions">
              <button class="tutorial-btn-icon" id="tutorial-btn-dock" title="Shrink to corner so you can practice on the screen">
                <span>⤢ Dock to Corner</span>
              </button>
              <button class="tutorial-btn-icon" id="tutorial-btn-close" title="Close guide">
                <span>✕ Close</span>
              </button>
            </div>
          </div>

          <div class="tutorial-tabs">
            <button class="tutorial-tab-btn active" id="tab-btn-tour" type="button">📖 Picture Walkthrough (6 Lessons)</button>
            <button class="tutorial-tab-btn" id="tab-btn-faq" type="button">❓ Common Questions &amp; Answers</button>
          </div>
        </div>

        <div class="tutorial-body" id="tutorial-modal-body"></div>

        <div class="tutorial-footer" id="tutorial-modal-footer">
          <div class="tutorial-footer-left">
            <button class="tutorial-btn-icon" id="tutorial-btn-prev" type="button">← Previous Lesson</button>
          </div>
          <div class="tutorial-footer-right">
            <button class="tutorial-btn-icon" id="tutorial-btn-dock-footer" type="button">⤢ Try on Screen</button>
            <button class="step-action-btn primary-nav" id="tutorial-btn-next" type="button">Next Lesson →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const docked = document.createElement('div');
    docked.id = 'tutorial-docked-assistant';
    docked.className = 'tutorial-docked';
    document.body.appendChild(docked);

    document.getElementById('tutorial-btn-close').onclick = closeTutorial;
    document.getElementById('tutorial-btn-dock').onclick = dockTutorial;
    document.getElementById('tutorial-btn-dock-footer').onclick = () => {
      dockTutorial();
      if (STEPS[currentStep].runAction) STEPS[currentStep].runAction(appBridge);
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
      if (currentStep < STEPS.length - 1) goToStep(currentStep + 1);
      else closeTutorial();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) closeTutorial();
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const lb = document.getElementById('tutorial-lightbox');
        if (lb && lb.classList.contains('active')) {
          lb.classList.remove('active');
        } else if (overlay.classList.contains('active')) {
          closeTutorial();
        }
      }
    });
  }

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

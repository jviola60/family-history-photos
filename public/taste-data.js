/* Shared archival dataset & SVG icon helpers for tasteskill v2 interactive mockups.
   Every count, queue badge, chart series, and table total is computed from this single array. */
(() => {
  const ITEMS = [
    {
      id: 'FH-001', file: '2003-07-19_gill-reunion-table.jpg', subfolder: '2003 Gill Reunion',
      title: 'Grandma Josephine at the picnic table',
      people: [{ name: 'Josephine Helen Costello', rel: 'Grandmother', branch: 'Costello' }],
      unnamedFaces: 0, branch: 'Costello', decade: '2000s', isoDate: '2003-07-19',
      place: 'Swallow Cliff Woods, Palos Park, IL', lat: 41.6706, lng: -87.8631,
      width: 2400, height: 1800, kb: 918, aspect: '4 / 3',
      restored4k: false, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-4K2',
      crop: '67% 32%', scale: 1.05, filter: 'none',
      story: 'Every July the Gill cousins met at Swallow Cliff Grove. Grandma wore her woven white sunhat and held court at the end bench all afternoon.'
    },
    {
      id: 'FH-002', file: '1968-06-14_porch-portrait-scan.jpg', subfolder: 'Shoebox Batch 1',
      title: 'Back porch before Sunday dinner',
      people: [],
      unnamedFaces: 2, branch: 'Gill', decade: '1960s', isoDate: '1968-06-14',
      place: 'South Oakley Ave, Chicago, IL', lat: 41.8544, lng: -87.6836,
      width: 640, height: 480, kb: 58, aspect: '4 / 3',
      restored4k: false, inReview: false, screenshot: false, fsSynced: false, fsId: '',
      crop: '64% 26%', scale: 1.65, filter: 'sepia(0.55) contrast(1.06) brightness(0.97)',
      story: ''
    },
    {
      id: 'FH-003', file: '1954-09-11_st-rita-steps.jpg', subfolder: 'Grandma Album',
      title: 'Outside St. Rita parish steps',
      people: [
        { name: 'Thomas Patrick Gill', rel: 'Grandfather', branch: 'Gill' },
        { name: 'Josephine Helen Costello', rel: 'Grandmother', branch: 'Costello' }
      ],
      unnamedFaces: 0, branch: 'Gill', decade: '1950s', isoDate: '1954-09-11',
      place: 'St. Rita Parish, Chicago, IL', lat: 41.7786, lng: -87.6908,
      width: 3840, height: 2880, kb: 1840, aspect: '3 / 4',
      restored4k: true, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-1A8',
      crop: '84% 28%', scale: 2.35, filter: 'grayscale(1) contrast(1.15)',
      story: 'Taken by Uncle Arthur on his Rolleiflex right after the morning mass. Restored from a 520px wallet scan.'
    },
    {
      id: 'FH-004', file: '1976-08-04_lake-geneva-bench.jpg', subfolder: '1976 Lake Trip',
      title: 'Cousins at the picnic grove',
      people: [{ name: 'Daniel Joseph Gill', rel: 'Uncle', branch: 'Gill' }],
      unnamedFaces: 1, branch: 'Gill', decade: '1970s', isoDate: '1976-08-04',
      place: 'Williams Bay, Lake Geneva, WI', lat: 42.5761, lng: -88.5445,
      width: 720, height: 540, kb: 64, aspect: '4 / 3',
      restored4k: false, inReview: false, screenshot: false, fsSynced: false, fsId: '',
      crop: '32% 38%', scale: 2.4, filter: 'sepia(0.28) saturate(1.18) contrast(1.05)',
      story: ''
    },
    {
      id: 'FH-005', file: '1984-07-22_park-pavilion.jpg', subfolder: 'Shoebox Batch 1',
      title: 'Afternoon walk past the oaks',
      people: [{ name: 'Margaret Rose Costello', rel: 'Great-Aunt', branch: 'Costello' }],
      unnamedFaces: 1, branch: 'Costello', decade: '1980s', isoDate: '1984-07-22',
      place: 'Marquette Park, Chicago, IL', lat: 41.7678, lng: -87.7011,
      width: 1920, height: 1440, kb: 640, aspect: '16 / 10',
      restored4k: false, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-8P1',
      crop: '49% 28%', scale: 2.5, filter: 'saturate(0.88) contrast(1.08)',
      story: 'Aunt Marge always brought two tin pans of lemon bars wrapped in wax paper.'
    },
    {
      id: 'FH-006', file: '1962-05-20_communion-lunch.jpg', subfolder: 'Grandma Album',
      title: 'First Communion backyard table',
      people: [{ name: 'Claire Marie Russo', rel: 'Mother', branch: 'Russo' }],
      unnamedFaces: 0, branch: 'Russo', decade: '1960s', isoDate: '1962-05-20',
      place: 'Elmwood Park, IL', lat: 41.9214, lng: -87.8170,
      width: 3840, height: 2880, kb: 2110, aspect: '4 / 3',
      restored4k: true, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-3C9',
      crop: '22% 76%', scale: 2.1, filter: 'grayscale(0.92) sepia(0.14) contrast(1.12)',
      story: 'Nonna ironed the white tablecloth at six in the morning so they could set the folding tables under the maple tree.'
    },
    {
      id: 'FH-007', file: 'scan_0041_unlabelled.jpg', subfolder: 'Shoebox Batch 2',
      title: 'Summer grove gathering (undated)',
      people: [],
      unnamedFaces: 1, branch: 'Russo', decade: '', isoDate: '',
      place: '', lat: null, lng: null,
      width: 580, height: 435, kb: 49, aspect: '4 / 3',
      restored4k: false, inReview: false, screenshot: false, fsSynced: false, fsId: '',
      crop: '52% 30%', scale: 1.28, filter: 'sepia(0.42) contrast(0.96)',
      story: ''
    },
    {
      id: 'FH-008', file: '2003-07-19_gill-reunion-copy2.jpg', subfolder: '_Duplicates_Review',
      title: 'Near-duplicate print of picnic bench',
      people: [{ name: 'Josephine Helen Costello', rel: 'Grandmother', branch: 'Costello' }],
      unnamedFaces: 0, branch: 'Costello', decade: '2000s', isoDate: '2003-07-19',
      place: 'Swallow Cliff Woods, Palos Park, IL', lat: 41.6706, lng: -87.8631,
      width: 1200, height: 900, kb: 312, aspect: '4 / 3',
      restored4k: false, inReview: true, screenshot: false, fsSynced: false, fsId: '',
      crop: '68% 36%', scale: 1.04, filter: 'brightness(0.98)',
      story: 'Smaller Walgreens CD copy moved safely to _Duplicates_Review.'
    },
    {
      id: 'FH-009', file: '1993-08-15_golden-anniversary.jpg', subfolder: '1993 Anniversary',
      title: '50th wedding anniversary toast',
      people: [
        { name: 'Josephine Helen Costello', rel: 'Grandmother', branch: 'Costello' },
        { name: 'Thomas Patrick Gill', rel: 'Grandfather', branch: 'Gill' }
      ],
      unnamedFaces: 0, branch: 'Costello', decade: '1990s', isoDate: '1993-08-15',
      place: 'Martinique Banquet Hall, Evergreen Park, IL', lat: 41.7206, lng: -87.6978,
      width: 2048, height: 1536, kb: 790, aspect: '4 / 3',
      restored4k: false, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-9T4',
      crop: '63% 33%', scale: 1.22, filter: 'contrast(1.04) saturate(1.06)',
      story: 'All fourteen grandchildren stood on chairs to sing Danny Boy at the end of dinner.'
    },
    {
      id: 'FH-010', file: '1979-06-30_little-league-bleachers.jpg', subfolder: 'Shoebox Batch 2',
      title: 'Bleachers after the championship game',
      people: [{ name: 'Patrick Owen Gill', rel: 'Father', branch: 'Gill' }],
      unnamedFaces: 0, branch: 'Gill', decade: '1970s', isoDate: '1979-06-30',
      place: 'Kennedy Park, Chicago, IL', lat: 41.6870, lng: -87.6775,
      width: 680, height: 510, kb: 69, aspect: '3 / 4',
      restored4k: false, inReview: false, screenshot: false, fsSynced: false, fsId: '',
      crop: '34% 34%', scale: 1.5, filter: 'sepia(0.22) contrast(1.1)',
      story: ''
    },
    {
      id: 'FH-011', file: '1958-11-27_thanksgiving-kitchen.jpg', subfolder: 'Grandma Album',
      title: 'Carving turkey on Hubbard Street',
      people: [{ name: 'Salvatore Russo', rel: 'Great-Grandfather', branch: 'Russo' }],
      unnamedFaces: 0, branch: 'Russo', decade: '1950s', isoDate: '1958-11-27',
      place: 'West Hubbard St, Chicago, IL', lat: 41.8899, lng: -87.6534,
      width: 3840, height: 2880, kb: 1960, aspect: '4 / 3',
      restored4k: true, inReview: false, screenshot: false, fsSynced: true, fsId: 'MM9R-6V0',
      crop: '12% 35%', scale: 1.48, filter: 'grayscale(1) contrast(1.18)',
      story: 'Bisnonno insisted on slicing the bread himself before anyone sat down.'
    },
    {
      id: 'FH-012', file: 'IMG_4410_scanner-settings.png', subfolder: '_Duplicates_Review',
      title: 'Epson Scan dialog screenshot',
      people: [],
      unnamedFaces: 0, branch: 'Gill', decade: '2000s', isoDate: '2003-07-20',
      place: '', lat: null, lng: null,
      width: 1024, height: 768, kb: 142, aspect: '4 / 3',
      restored4k: false, inReview: true, screenshot: true, fsSynced: false, fsId: '',
      crop: '45% 75%', scale: 1.7, filter: 'grayscale(0.6) contrast(1.2)',
      story: 'Desktop screenshot flagged by Junk Cleaner and staged in _Duplicates_Review.'
    }
  ];

  function stats(list = ITEMS) {
    const active = list.filter((p) => !p.inReview);
    const inReview = list.filter((p) => p.inReview);
    const unnamedPhotos = active.filter((p) => p.unnamedFaces > 0);
    const unnamedFacesTotal = active.reduce((s, p) => s + p.unnamedFaces, 0);
    const lowRes = active.filter((p) => !p.restored4k && (p.width < 800 || p.height < 800 || p.kb < 75));
    const restored = active.filter((p) => p.restored4k);
    const withStory = active.filter((p) => p.story && p.story.trim().length > 0);
    const namedOnly = active.filter((p) => (!p.story || !p.story.trim()) && p.people.length > 0 && p.unnamedFaces === 0);
    const untagged = active.filter((p) => (!p.story || !p.story.trim()) && (p.people.length === 0 || p.unnamedFaces > 0));
    const fsSynced = active.filter((p) => p.fsSynced);
    const undated = active.filter((p) => !p.decade);

    console.assert(active.length + inReview.length === list.length, 'Active + review must equal total catalog');
    console.assert(withStory.length + namedOnly.length + untagged.length === active.length, 'Preservation tiers must reconcile');

    return {
      totalCatalog: list.length,
      activeCount: active.length,
      reviewCount: inReview.length,
      unnamedPhotoCount: unnamedPhotos.length,
      unnamedFacesTotal,
      lowResCount: lowRes.length,
      restoredCount: restored.length,
      storyCount: withStory.length,
      namedOnlyCount: namedOnly.length,
      untaggedCount: untagged.length,
      fsSyncedCount: fsSynced.length,
      undatedCount: undated.length
    };
  }

  /* Clean 16px outline SVG icons (1.5px stroke, zero emoji) */
  const ICONS = {
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M12 7.5v4.5M12 12H6v3.5M12 12h6v3.5"/></svg>'
  };

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function notify(msg) {
    let el = document.getElementById('ts-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ts-notice';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:80;padding:10px 14px;border-radius:8px;background:var(--primary,#141414);color:var(--primary-ink,#fff);font-size:13px;line-height:18px;opacity:0;pointer-events:none;transition:opacity 150ms ease;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
  }

  window.TasteArchive = {
    cloneItems: () => JSON.parse(JSON.stringify(ITEMS)),
    stats,
    ICONS,
    esc,
    notify,
    branches: {
      Costello: { bg: '#e8f3f1', ink: '#144943' },
      Gill:     { bg: '#eef1f8', ink: '#1e3a6d' },
      Russo:    { bg: '#f6ecf0', ink: '#61213b' }
    }
  };
})();


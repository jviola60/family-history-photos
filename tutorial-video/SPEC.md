# Technical Specification: Family History Photos Tutorial

```text
GOAL:    Empower family archivists to organize, map, restore, and sync their vintage photos with complete privacy and zero technical friction.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    36 seconds x 30 fps = 1080 frames; pacing ~75 BPM (24 frames per beat)
LOOK:    ground: #0b0f17 (obsidian slate with 2% fine grain noise), card surface: #161f30 (1px border #2a3a54);
         ink: #f8fafc (primary text), #94a3b8 (secondary metadata labels);
         accents: #38bdf8 (cyan UI focus), #10b981 (emerald FamilySearch sync check), #f59e0b (warm amber badge);
         display face: "Inter", sans-serif, 56px, weight 700, tracking -0.025em;
         body face: "Inter", sans-serif, 24px, weight 400, line-height 1.45;
         code/PID face: "SF Mono", "Fira Code", monospace, 22px, weight 600;
         the medium: Archival photographic workstation. Tactile photo cards with 24px corner radius, 
         deep layered shadows (0px 20px 48px rgba(0, 0, 0, 0.65)), glass-subtle borders, interactive Leaflet map tiles;
         light and depth: key light upper center, soft rim light, 4% vignette at screen boundaries.
OBJECTS: 1. Vintage Photo Card: High-resolution portrait scan of Patricia Josephine Gill in warm wooden frame card.
         2. Interactive Leaflet Map: Cartographic vector tile map of Ohio / Chicago with active animated SVG pin marker.
         3. FamilySearch Beta Tree Badge: Distinctive tree emblem with live PID status pill ("BM6T-WQ5 • Verified").
         4. Photo Lab Slider: Crisp interactive vertical brass curtain bar showing before (vintage faded) vs after (4K restored).
         5. Unified "Save to File" Action Button: Pulsing emerald pill with embedded metadata badge (XMP + EXIF).
MOTION:  enter: power3.out (duration: 18-24 frames);
         move / slider: power2.inOut (duration: 36 frames);
         exit: power2.in (duration: 14 frames);
         springs: damping 0.62 on pin drop and badge confirmation pop;
         curtain wipe: linear scrubber tween across 45 frames.
SHOTS:   Shot 1 (Frames 0-210, 0.0s-7.0s):
           Hero move: Vintage photo slides into workspace; folder drop area illuminates.
           Viewer reads: "Private In-Browser Archiving — Zero Cloud Uploads for Indexing."
           Sound: Tactile card slide, gentle acoustic intro chord.
           Handoff: Photo card shrinks into active inspection sidebar.
         
         Shot 2 (Frames 210-420, 7.0s-14.0s):
           Hero move: Map sweeps in from right; address auto-geocodes to Bowling Green, OH; map pin drops with elastic bounce.
           Viewer reads: "Interactive Global Map — Pin your ancestors where memories happened."
           Sound: Quick keystrokes, soft pin-drop chime.
           Handoff: Focus moves to relative tagging form.

         Shot 3 (Frames 420-630, 14.0s-21.0s):
           Hero move: Tag "Patricia Josephine Gill (Mother)" typed; FamilySearch Beta auto-queries; PID dropdown selects "BM6T-WQ5".
           Viewer reads: "Live FamilySearch Tree Sync — Connect people and PIDs instantly."
           Sound: Selection pop, emerald sync chime.
           Handoff: Photo expands into the Photo Lab workspace.

         Shot 4 (Frames 630-840, 21.0s-28.0s):
           Hero move: Curtain divider wipes left-to-right across face; vintage blur transforms into razor-sharp 4K restored detail.
           Viewer reads: "AI Photo Lab — 4K Face Restore, Colorize, Tone, and Magic Eraser."
           Sound: Camera shutter click, smooth whoosh on curtain wipe.
           Handoff: Camera pulls back to reveal the finished photo with action bar.

         Shot 5 (Frames 840-1080, 28.0s-36.0s):
           Hero move: Cursor clicks "💾 Save to File"; dual checkmarks flash: "Metadata Embedded in JPEG" and "Uploaded to FamilySearch Memories".
           Viewer reads: "Preserved Forever — Safe in your local files. Connected in your tree."
           Sound: Resonant confirmation bell, acoustic outro cadence.
           Handoff: Final card holds with live URL: jviola60.github.io/family-history-photos.

BANNED:  1. Blank dark void with isolated floating icons.
         2. Purple neon glow and abstract particles.
         3. Monotone slides of bullet points.
         4. Shaky drifting camera on text while reading.
         5. Artificial generic AI stock avatars.

QA:      Frame 60: Folder drop zone active with real photo metadata pill visible.
         Frame 315: Bowling Green map pin at [41.37, -83.67] with thumbnail popup open.
         Frame 525: FamilySearch PID badge "BM6T-WQ5" illuminated in verified emerald.
         Frame 735: Photo Lab curtain slider at 50% split with visible before/after contrast.
         Frame 960: "💾 Save to File" confirmation toast showing XMP/IPTC/EXIF tags embedded.
         Frame 1050: Clean outro title card with URL and GitHub open-source badge.
```


# Wockhardt Hospitals — *Re-Engineered*

A 106-second technology brand film for Wockhardt Hospitals, built entirely in code:
every frame is drawn procedurally (Canvas2D vector layer + WebGL2 post pipeline) and the
score and sound design are synthesised from scratch. No stock footage, no stock music,
no templates. The machines are the hospital's own, cut out of the supplied photography.

**Final film:** `out/wockhardt_reengineered_1080p.mp4` (1920×1080, 30 fps, H.264 + AAC)
**Creative treatment:** [`docs/TREATMENT.md`](docs/TREATMENT.md)

## The idea

One continuous line runs through the whole film — the patient's life signal. Technology
never replaces it; each chapter extends it into a new dimension: pulse → trace → a field of
signals → the topography of a body → a scan ring → cross-sections → a surgical plan → a
robotic path scaled 3:1 → converging treatment vectors → a restored rhythm → neural pathways
→ the wiring of a hospital → a network → and finally the contour of a newborn's hand around a
parent's finger.

## Repository layout

```
film/
  index.html            player (real-time preview with the score) + offline render hooks
  src/
    main.js             runtime: asset loading, master camera, motion blur, capture API
    timeline.js         master clock: chapter times + the shared heart track
    look.js             the grade over time (background field, bloom, lens, grain, fades)
    palette.js          brand-derived colour system
    anatomy.js          procedural supine body (signed-distance anatomy) + axial slicer
    knee.js thorax.js brain.js   detailed anatomy for each chapter
    signals.js          ECG / pleth / ABP / respiration / EEG / capnography
    engine/             camera, line renderer, typography, annotations, SDF slicer, WebGL post
    scenes/             s01 … s09, one module per chapter (+ common.js)
  assets/
    machines/           cut-outs + vector line drawings of the supplied machines
    source/             the supplied images (inputs to the cut-out pipeline)
    human/grip.json     hand-authored line art for the human moment
    fonts/              Inter Display (OFL) + Geist Mono (OFL)
  audio/
    score.py            synthesiser: score + sound design, frame-locked via cues.json
    score.wav           rendered soundtrack
tools/
  render.mjs            headless Chromium → raw RGBA → ffmpeg (video or stills)
  render_all.sh         parallel full render + mux
  export_cues.mjs       timeline → cues.json for the synthesiser
  contact.py            contact sheets for review passes
  audio_report.py       spectrogram + loudness audit
  assets/prep_machines.py   local background removal (BiRefNet ONNX) + edge tracing
docs/TREATMENT.md
```

## Preview in a browser

```bash
npx serve film          # or any static server rooted at film/
# open http://localhost:3000 — Play / scrub; the score plays in sync
```

## Render

Requirements: Node 18+, Playwright with Chromium, ffmpeg, Python 3 with numpy, scipy,
soundfile, pyloudnorm.

```bash
tools/render_all.sh out/wockhardt_reengineered_1080p.mp4 3     # 3 parallel workers
node tools/render.mjs stills --times 5,22.8,49,84.6 --out out/stills   # review frames
```

Rendering is deterministic (no clocks, no unseeded randomness): any frame can be re-rendered
identically. Motion blur is 180° temporal supersampling (up to 5 sub-frames on camera moves).

## Brand note

The end card uses a **typographic stand-in** for the Wockhardt Hospitals lockup. Drop the
official logo at `film/assets/brand/logo.png` (transparent PNG) and the end card uses it
automatically. Copy lines live in the scene modules (`statement(...)` calls) and can be
changed in one place each.

## Machines used (from the supplied images)

Philips Ingenia 3.0T Evolution · MAKO robotic-arm system · da Vinci Surgical System ·
Olympus OTV-S700 4K · BenQ Trimax 650 NS · CREA OR integration · GE Giraffe incubator ·
GE Lullaby warmer · SLE 6000 · B. Braun Infusomat Compact Plus. Named in the platform
sequence: 128-slice dual-energy CT, ZEISS neurosurgical microscope, Mindray A9, Sanhar
paperless HIS, STERRAD 100NX, DBS stereotactic system, dedicated liver transplant ICU.
Cut-outs are produced locally (`tools/assets/prep_machines.py`, BiRefNet via onnxruntime);
no image was uploaded to any third-party service.

# WOCKHARDT HOSPITALS — *RE-ENGINEERED*

A 106-second motion film. Code-generated frame by frame (Canvas2D vector layer + WebGL2
post pipeline) with an original synthesized score. No stock footage, no stock music.

---

## 1. The idea in one sentence

**One line runs through the entire film — the Healwave**, Wockhardt's brand ribbon of many fine
coloured strands. It is the patient's life signal. Technology never replaces it. Every chapter
*extends* the same line into a new dimension:

| The line becomes… | Dimension | Chapter |
|---|---|---|
| a pulse | a moment | THE HUMAN |
| a waveform | time | SIGNAL |
| a field of signals → the topography of a body | space | THE INVISIBLE |
| a scan ring → cross-sections → a reconstructed volume | depth | DIAGNOSE |
| a cut plane, a boundary, a millimetre | intent | PLAN · PRECISION (MAKO) |
| a hand's path, scaled 3:1 and filtered | control | HUMAN + MACHINE (da Vinci) |
| a coordinate that many vectors converge on | focus | ONCOLOGY |
| a rhythm restored | time again | CARDIAC |
| a pathway, a trajectory, a stimulation field | the mind | NEURO · DBS |
| the wiring of a hospital, then of a network | scale | THE PLATFORM |
| the contour of a newborn's hand around a finger | life | THE HUMAN, AGAIN |

The film is therefore one continuous transformation, never a sequence of scenes.
A luminous **write-head** leads the line in every chapter; the eye follows it across every
transition. It is the **Healwave** when it is human — the heartbeat, the surgeon's hand, the
patient's journey — and **white-blue** when technology carries it.

## 2. Emotional arc

Curiosity (darkness, one pulse) → Awe (the body becomes data, the data becomes a body) →
Understanding (each technology shown by *what it enables*) → Confidence (the hospital as one
connected system) → Human connection (everything collapses back into one human moment).

## 3. Visual system

* **Night** (inside the body, deep blue-black `#030814 → #0A1B3A`) and **Day** (the hospital and
  the human, clinical white `#F4F7FB`). The film breathes between them.
* **Lines** are hairlines: 1.0 / 1.4 / 2.0 px. Ice `#DCE8FF`, steel `#6E8BB8`, Wockhardt blue
  `#0B3D91`. **The Healwave is reserved for life** (the pulse, the patient node, the newborn,
  the line under the name): 12 strands in the brand's order — pink, magenta, orchid, violet,
  indigo, blue, sky, green, gold, orange, coral — sampled from the brand artwork, pushed to full
  luminance on night scenes and deepened on white. It fans on every heartbeat, like the crests of
  the brand wave, and twists like a flat tape. Red remains only for clinical alerts (irregular
  rhythm, the stenosis) and the blood in the coronaries.
* **Everything is reconstructed from slices** — anatomy is never a stock 3D model; it is drawn
  as stacked contour slices of procedural signed-distance anatomy, exactly how imaging builds it.
* **Machines** appear as themselves (cut out from the supplied photography), but always
  *arrive through the line*: silhouette traced → photograph resolved by a scan → two precise
  callouts. Never a slideshow; each machine is a beat inside its chapter.
* **Post**: controlled bloom only on emitters, fine animated grain, subtle lens aberration,
  vignette, 4-sample temporal motion blur on camera moves.

## 4. Typography and copy

* Headlines — *Inter Display* SemiBold, caps, 64–96 px, near-zero tracking, revealed from a
  baseline mask. Whispers — *Inter Display* Light, 32 px, 0.34 em tracking.
* **Technology nameplates** — every benefit is signed by the machine that delivers it, as a
  lower third: a tracked mono category, the system's name in Inter Display SemiBold 50 px, a
  hairline, and one proof line taken from Wockhardt's own spec sheets.
* Data — *Geist Mono*, 11–15 px caps, tracked, "decoded" in. Numbers as typography: the
  heartbeat counter, coordinates and millimetres set large.
* Copy rule: no line a competitor could run unchanged. Each headline is a specific benefit, and
  each number on screen comes from the supplied material.

| Chapter | Headline (benefit) | Nameplate (technology) · proof | Source |
|---|---|---|---|
| Opening | `YOUR HEART BEATS 100,000 TIMES A DAY.` / `WE’RE BUILT FOR THE ONE THAT DOESN’T.` | — | — |
| Signals | — | PHILIPS PATIENT MONITORING · ECG, SpO2, NIBP/IBP, respiration, temperature, continuous | Liver Transplant ICU sheet |
| Imaging | `MORE DETAIL. LESS RADIATION.` | 128-SLICE DUAL-ENERGY CT · low-dose imaging, 70 cm gantry, metal-artifact reduction | 128-slice CT sheet |
| Imaging | `LESS TIME IN THE SCANNER. MORE IN THE IMAGE.` | PHILIPS INGENIA 3.0T EVOLUTION · SmartSpeed AI, up to 3× faster, up to 65% higher resolution | Philips SmartPath 3T flyer |
| Knee | `YOUR KNEE, REBUILT IN 3D BEFORE THE FIRST CUT.` / `THE CUT STAYS INSIDE THE PLAN. TO THE MILLIMETRE.` | MAKO SMARTROBOTICS · CT-based 3D plan, haptic boundary, Stryker | hero image + Mako system |
| Robotic surgery | `STEADIER THAN ANY HAND. GUIDED BY ONE.` | DA VINCI SURGICAL SYSTEM · 3D HD vision, wristed instruments, motion scaling, tremor filtration | hero image + da Vinci system |
| Cancer | `CAUGHT AT 6 MM.` / `THE TUMOUR, TARGETED. THE HEART, SPARED.` | DUAL-ENERGY CT · 128 slices, low dose, tissue characterisation | 128-slice CT sheet |
| Cardiac | `FOUND BEFORE IT BECAME A HEART ATTACK.` | 128-SLICE CARDIAC CT · non-invasive, coronary arteries in 3D | 128-slice CT sheet |
| Neuro | `THREE NUMBERS. ONE STEADY HAND.` | MEDTRONIC DBS SYSTEM · Integra Mayfield 3-pin fixation, stereotactic localiser | DBS sheet |
| Connected hospital | roll call: `WOCKHARDT HOSPITALS · OUR TECHNOLOGY` (17 systems) | CREA OR INTEGRATION · Olympus VISERA ELITE III 4K, ZEISS microscope, Mindray A9, BenQ Trimax 650 NS; one digital record on SANHAR PAPERLESS HIS | all supplied sheets |
| Climax | `ALL OF THIS, FOR ONE HEARTBEAT.` | — | — |
| Human | `EVEN THE SMALLEST.` | NICU credit: GE Giraffe · GE Lullaby · SLE 6000 · SLE5000 HFOV | NICU sheets |
| Identity | **WOCKHARDT HOSPITALS — TECHNOLOGY FIRST. LIFE ALWAYS.** | — | brief |

The story the copy tells: a heart beats 100,000 times a day and the hospital is built for the one
beat that fails; every chapter names the machine that finds or fixes it; the roll call shows the
whole arsenal; *all of this, for one heartbeat* — and the one heartbeat is a newborn's.

Open item: the radiotherapy beam sequence has no machine named yet (no linac model in the
supplied material).

## 5. Shot list (as built — 120 BPM grid: 1 bar = 2 s)

| Time | Chapter | What happens |
|---|---|---|
| 0–2 | THE HUMAN | Darkness, room tone, one breath. A point breathes inside a slowly turning rainbow rim — the Healwave, wound tight. |
| 2–10 | | First heartbeat. A hairline baseline opens; the write-head records a single trace over a precision time-ruler (40 ms ticks, labelled seconds). `YOUR HEART BEATS 100,000 TIMES A DAY.` — the number counts up like a register — then `WE’RE BUILT FOR THE ONE THAT DOESN’T.` R-peaks, RR intervals and live readouts begin to annotate each beat. |
| 10–15 | SIGNAL | The trace peels into 84 physiological signals (ECG leads, pleth, arterial pressure, respiration, capnography, EEG) that fan into a 3D field breathing with the heart. Nameplate: Philips patient monitoring (Liver Transplant ICU). |
| 15–18 | THE INVISIBLE | The paper slows to a stop; the signals' amplitudes become the topography of a reclining body (structured-light scan lines). The Healwave migrates into the chest and keeps beating there. |
| 18–21.6 | DIAGNOSE | A 70 cm gantry ring with a rotating source and fan beam travels the body; every slice it passes closes into a full cross-section with organs and bone. Slice counter `SLICE 064 / 128`. `MORE DETAIL. LESS RADIATION.` — 128-slice dual-energy CT. |
| 21.6–24.6 | | The camera pulls back until the ring is exactly the size of the bore in the photograph: the Philips Ingenia resolves around it, registered frame by frame — the vector patient now lies on the real scanner's table. `LESS TIME IN THE SCANNER. MORE IN THE IMAGE.` — Philips Ingenia 3.0T Evolution, SmartSpeed AI. |
| 24.6–27 | | Log-scale dive into the knee. |
| 27–36 | PLAN · PRECISION | Femur, tibia, patella and fibula reconstructed from dense slices and labelled. Mechanical axes, distal (9.0 mm) and tibial (8.5 mm, 3° slope) resection planes. `YOUR KNEE, REBUILT IN 3D BEFORE THE FIRST CUT.` The haptic boundary appears; a robotic arm (technical illustration) mills only inside it while bone clears under the burr; a millimetre ruler counts the depth; the implant resurfaces in white. `THE CUT STAYS INSIDE THE PLAN. TO THE MILLIMETRE.` — Mako SmartRobotics. |
| 36–44 | HUMAN + MACHINE | Up the body to the abdomen. A four-arm overhead boom docks through ports; instruments converge on the operative site; an endoscope's viewing cone. The surgeon's hand path (red, with physiological tremor) drives the instrument tip, which draws the same suture scaled 3:1 and filtered (white). `STEADIER THAN ANY HAND. GUIDED BY ONE.` — da Vinci Surgical System. |
| 44–52 | ONCOLOGY | Anterior view: lungs reconstruct, the bronchial tree grows. A reticle hunts and locks on a nodule (`NODULE DETECTED`); dual-energy characterisation panel; the nodule becomes a coordinate; twelve vectors from the upper hemisphere converge — paths through the heart and spinal cord are excluded and both are labelled SPARED; 95% / 50% isodose rings; a response curve falls week by week. `CAUGHT AT 6 MM.` (dual-energy CT) · `THE TUMOUR, TARGETED. THE HEART, SPARED.` |
| 52–60 | CARDIAC | The Healwave returns and winds itself helically around the heart (as myocardial fibres do), forming it. Coronary tree with flowing blood; an irregular run on the ECG strip; LAD 70% stenosis found; a stent expands and flow resumes; sinus rhythm restored. `FOUND BEFORE IT BECAME A HEART ATTACK.` — 128-slice cardiac CT. |
| 60–68.6 | NEURO · DBS | A scan plane rises through the head and the axial slices stack up; out of them the cortex resolves — the lateral silhouette draws on, then the Sylvian fissure and central sulcus, then the gyri fold outward from the insula (grown by reaction-diffusion on the brain's real 3D surface), the cerebellum with its folia tucked beneath. The camera rolls into a true lateral view; tractography and travelling signals inside. Stereotactic frame with N-localisers and a centre-of-arc; the focus racks from the cortex to the target. Target coordinates set as huge numerals: `12.0 / −2.5 / −4.0 MM` relative to the mid-commissural point. Planned trajectory → electrode → four contacts → a 130 Hz stimulation field → macro dive to **one cell** firing. `THREE NUMBERS. ONE STEADY HAND.` — Medtronic DBS with Integra Mayfield fixation. |
| 68.6–84.4 | THE PLATFORM | One continuous log-scale pull-out: one cell → its fibres → the whole brain → the patient → the operating-room blueprint (BenQ Trimax table, Mindray A9, ZEISS microscope, Olympus 4K, CREA integration; surgeons, anaesthetist and scrub nurse as nodes; every device wired to the integration hub) → the hospital floor, its departments wired to a digital core, the machines arriving one by one in their departments (Ingenia, MAKO, da Vinci, BenQ, Olympus, CREA, GE Giraffe, GE Lullaby, SLE 6000, Infusomat), the patient's journey as a Healwave through imaging → theatre → ICU (one digital record on Sanhar HIS) → the Wockhardt network (Mumbai Central, Mira Road, Nagpur, Rajkot) on a lat/long graticule. While the floor builds, the roll call runs down the left: seventeen named systems. `ALL OF THIS, / FOR ONE HEARTBEAT.` The network implodes into a single point with a Healwave rim. |
| 84.45 | — | Hard cut to white. Silence. |
| 84.5–96 | THE HUMAN, AGAIN | The point draws — in the Healwave's own strands, like the brand's calligraphy — a newborn's fist around a parent's finger, then rests on the baby's wrist, pulsing with the baby's own heartbeat. Two heartbeats, adult and newborn. The first major chord of the film. `EVEN THE SMALLEST.` — ink on white, over the NICU's technology: GE Giraffe, GE Lullaby, SLE 6000, SLE5000 HFOV. |
| 96–106 | IDENTITY | The opening gesture returns on white — the point, then the Healwave as the line under the name — and it opens into **WOCKHARDT HOSPITALS** · `TECHNOLOGY FIRST. LIFE ALWAYS.` A D–A–F♯ sonic logo; the point gives one last heartbeat. |

## 6. Sound

Starts almost silent: room tone, one breath, one heartbeat. The score is in D minor at 120 BPM,
locked to the heart (60 BPM = every other beat). It grows from the body's own sounds:
data clicks; the rhythmic gradient knock of an MRI becomes the rhythm section; servo whirs and
precision ticks for robotics; neural crackle and a pure **130 Hz** tone for DBS (the
stimulation frequency); converging glissandi that resolve into a unison when the oncology
vectors converge; the heart becomes the kick. At the climax: human heartbeat + machine pulse.
Then a hard cut to silence — two heartbeats (adult, newborn) — and the first major chord of the
film (D major) under the identity. A three-note sonic logo (D–A–F♯).

## 7. Machines used (from the supplied images)

Philips Ingenia 3.0T Evolution · MAKO robotic-arm system · da Vinci Surgical System ·
Olympus OTV-S700 4K (VISERA ELITE III) · BenQ Trimax 650 NS OT table · CREA OR integration ·
GE Giraffe incubator · GE Lullaby warmer · SLE 6000 · B. Braun Infusomat Compact Plus.
Named in the network layer: 128-slice dual-energy CT, ZEISS neurosurgical microscope,
Mindray A9, Sanhar paperless HIS, STERRAD 100NX, DBS system with stereotactic frame,
dedicated liver transplant ICU.

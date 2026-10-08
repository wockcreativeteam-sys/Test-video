# Every Step — World OA Day (Wockhardt)

A 60-second motion-design film, built entirely in code: every frame is drawn procedurally
(Canvas2D vector layer + an HDR particle film + a WebGL2 post pipeline) and the sound design is
synthesised from scratch. No stock footage, no AI actors, no templates, no music bed.

**One continuous move:** HAND → STEP → BODY → JOINT → TIME → MEMORY → HAND.
**The device:** a single green line — her life in motion — that is traced as a child's hand, becomes a
walking path, a tunnel, footsteps, a clock hand, a staircase, a knee, is scraped apart in the joint,
returns as a word, a hand again, and finally one step.

## Colour

| Colour | Meaning | Where |
|---|---|---|
| Purple | the world · memory · time · emotion | the field, architecture, worlds, the doctor, memories, type |
| Green | life · movement · energy · possibility | the line, her body, her footprints |
| Red | pain · resistance · interruption | almost invisible at 15.3 s; the stairs (18 s); the joint (25–29 s); then it goes out, one particle at a time (43–45 s), and returns only as the three pledge marks |

## Shot list (timecodes as built; shots overlap — every transition is drawn by both neighbours)

| # | Time | Shot | What happens | Inherits |
|---|---|---|---|---|
| 01 | 0.0–4.2 | The first line | Black; a microscopic green point; an impossible dive (×18,000) through rushing dust; the point is a particle on a child's fingertip, orbited by thousands; the line traces her hand; a mother's hand reaches; contact → a refractive shock ring crosses the frame; THE FIRST TIME stretches into a hairline, HELD locks on; the hands become a constellation → a topographic map → the line becomes a walking path; the camera comes down onto it | — |
| 02 | 3.7–7.6 | The walk | We fall into the line: a tunnel of green strands; memory fragments flash for 4 frames each, accelerating (school shoe, staircase, schoolbag, bicycle, a child's hand, a mother's hand, a footprint); SHE TAUGHT YOU floats past; HOW TO WALK. walks toward us (HOW and WALK. are the feet, TO is the body); the tunnel's light pours into a pair of particle legs | the line |
| 03 | 7.25–12.3 | A life in one walk | Every footstep grows a world out of the footprint and folds it into the next: school corridor, Mumbai street, kitchen, hospital, wedding mandap, child's bedroom, airport, rain, staircase. Her feet draw the line. WALKED travels smoothly; RAN accelerates past; KEPT GOING crosses the whole frame | the legs |
| 04 | 11.9–16.6 | Time breaks | Pull back: her whole life walks the rim of a giant clock whose numerals (5…60 — minutes and ages) are made of footprints; gears of footprints; the second hand is her green line; chronophotographic ghosts of her age as it passes 20, 30, 40, 50. The clock stutters (one frame repeats, again, again) and loses momentum. A first red particle, almost invisible. No type | her, her line |
| 05 | 16.0–20.6 | The first interruption | The clock's rings lift into an enormous spiral staircase (impossible flights hang in the haze). She climbs: easy, easy — then her line hits a red particle and the staircase bends; another — the architecture deforms. SOMEWHERE ALONG THE WAY is written along her line and kinks with it. The camera dives into her knee | the dial → the stairs |
| 06 | 20.1–24.9 | Slower | Out of the knee, back into the life walk: the world keeps its pace (100 %), her steps don't (90, 80, 70, 50, 30 %); her line stretches like elastic between her and life's pace; echoes trail her. SHE STARTED WALKING / A LITTLE SLOWER. at falling frame rates (24 → 12 → 8 → 4 fps); SLOWER. rushes in, stalls, creeps on | the knee, the worlds |
| 07 | 24.4–29.5 | Resistance | Inside the joint as architecture: condyles above, plateau below, drawn as contour sculpture, grinding in the rhythm of a step; red gathers at every approach; the green line is scraped, sheds particles, breaks into fragments. NOT BECAUSE / SHE WANTED TO STOP. moves forward and hits an invisible wall (the letters pile up); EVERY STEP / BEGAN TO HURT. — HURT once, in red | the knee |
| 08 | 29.0–33.4 | The human scale | The joint bursts; we travel backward through the particles as they rebuild an examination room — walls, window light, couch, desk, chairs, a doctor. She walks with a limp; the camera keeps to her knee; the doctor notices. OSTEOARTHRITIS assembles beside her and dissolves. The word goes; she stays | the joint's particles |
| 09 | 32.9–37.3 | The memory glitch | The doctor's eye; into the pupil — a staircase; inside it, a doorway and a hand; inside the hand, a memory: the same woman, two layers at once — clinical (lilac particles, a measured knee) and personal (green, a child's hand in hers), glitching. FOR / SOMEONE drift apart | the doctor |
| 10 | 36.9–41.2 | SHE | SHE pours in from particles and stands as 3D type; we fly through the H into her life — hundreds of tiny moving memories (walking, cooking, working, laughing, holding a child, waiting, climbing, living). SHE NEVER / STOPPED SHOWING UP. — SHOWING stretches across the frame and collapses into one green line | the memory |
| 11 | 40.8–45.6 | The loop | The line returns and becomes her hand, older; her grown child's hand reaches back; they touch — mirroring the opening — and this time the child holds HER hand. A green pulse runs between them; the red in her hand goes out, one particle at a time. THE FIRST TIME / SHE HELD YOUR HAND returns, reversed (the line gathers back into words) | the line |
| 12 | 45.2–49.8 | Now | They walk together, at her pace. The street gives itself up: buildings → lines → footsteps → green particles → stars. MAYBE NOW · NOTICE · HOW SHE WALKS. (the words step on her footfalls) | the hands |
| 13 | 49.4–56.4 | The pledge | Pure purple. One green line from the left; three red interruptions stop it, and each becomes a word on a step of the line: NOTICE. ADDRESS. KEEP MOVING. (which keeps moving) | the line |
| 14 | 56.0–60.0 | The final image | The line curves into a figure drawn in one line; it takes one final step; the step runs on into the brand line. WORLD OA DAY · EVERY STEP MATTERS. · WOCKHARDT · *Talk to your healthcare professional about osteoarthritis.* | the line |

## Voice-over (scratch)

The VO in the delivered mix is a **guide track** synthesised locally (Kokoro-82M, open weights, run
on this machine — no text was sent to a third-party service). It is placed exactly where the picture
needs it (`oa/src/timeline.js`, `VO`), so a voice artist can record to picture. The music & effects
mix without VO is delivered alongside (`…_music-and-effects.mp4`, `oa/audio/me.m4a`).

| Time | Line |
|---|---|
| 1.35 | The first time she held your hand… |
| 4.35 | …she taught you how to walk. |
| 7.75 | She walked us to school. Ran behind us. Ran ahead of us. |
| 12.55 | And somehow, always kept going. |
| 16.90 | Then, somewhere along the way… |
| 20.90 | …she started walking a little slower. |
| 25.00 | Not because she wanted to stop. |
| 27.30 | Because every step began to hurt. |
| 29.75 | For us, she may be a patient with osteoarthritis. |
| 33.90 | But for someone… |
| 37.40 | …she is the woman who never stopped showing up. |
| 41.60 | The first time she held your hand, she taught you how to walk. |
| 45.90 | Maybe now, it's time to notice how she walks. |
| 49.80 | This World OA Day, let's take a pledge. |
| 52.95 | Notice the signs. Address the pain. Keep life moving. |

## Sound

Built around movement, synthesised in `oa/audio/sound.py` from the same cue sheet as the picture:
a single breath; a soft tonal pulse at the touch; footsteps; rhythmic layers that build with the
life walk (a sonic snapshot of each world on its footfall); a clock-like granular rhythm that
stutters and sags; footsteps in a vast space that bend; the same walk slowing; compressed granular
friction in the joint; a quiet clinical room and an uneven step; the sound opening up for memory;
the touch again, warmer; two people walking; near-silence and one pure line; one clean footstep;
silence; brand. No piano bed. Mix −16 LUFS, true peak ≤ −1 dBTP.

## The muted tests

* **Visuals only:** the type carries the argument (HELD · SHE TAUGHT YOU / HOW TO WALK · WALKED / RAN /
  KEPT GOING · SOMEWHERE ALONG THE WAY · SHE STARTED WALKING A LITTLE SLOWER · NOT BECAUSE SHE WANTED
  TO STOP / EVERY STEP BEGAN TO HURT · OSTEOARTHRITIS · FOR SOMEONE · SHE NEVER STOPPED SHOWING UP ·
  THE FIRST TIME SHE HELD YOUR HAND · MAYBE NOW NOTICE HOW SHE WALKS · NOTICE ADDRESS KEEP MOVING ·
  EVERY STEP MATTERS) and the motion carries the arc (a line that never stops; slowing; breaking; held).
* **Audio only:** the VO is a complete story; the sound design follows the same arc.
* **Both muted:** green keeps moving, red arrives, slows it, breaks it, and goes out when someone holds
  her hand — a life that never stopped moving, until movement became difficult, and someone noticed.

## Brand note

The end card uses a **typographic stand-in** (WOCKHARDT set in Inter Display). The brief asks for the
final step to become the Wockhardt brand mark: supply the registered mark (SVG or transparent PNG) and
it replaces the stand-in at the end of the step line in `oa/src/shots/s14.js`.

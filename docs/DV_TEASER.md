# da Vinci Xi — launch teaser (Wockhardt Hospitals)

A 30-second launch teaser, built entirely in code: a procedural 3D model of the da Vinci Xi patient
cart is assembled on a high-tech production line, station by station, and revealed like a product.
Every frame is rendered by a WebGL2 product renderer written for this film (`dv/src/engine/r3.js`)
under the film's vector/HUD layer and HDR particle film; the score and sound design are synthesised
from scratch (`dv/audio/sound.py`). No stock footage, no photographs, no samples.

**Picture lock:** 30.0 s · 1920×1080 · 30 fps · 120 BPM — every cut, impact and type event sits on
the beat grid (`dv/src/timeline.js`).

## The machine

Modelled from the reference photographs supplied (front, three-quarter and stowed views):
charcoal base tub on the white forked sled (long legs, black bumpers, casters) · slim white column
with the black front panel · white neck with the blue light ring · the dark drum cap
("da Vinci Xi") · the overhead boom: a wide T-bar with vents · four arms, numbered 1–4: setup links
→ numbered pillar → grey joint band → shoulder → parallelogram links with blue light rings at the
joints → instrument spar (white carriage rail, dark slot) → instrument backend, 8 mm shaft through
the cannula to the remote centre of motion. Two poses: **stowed** (arms hanging under the T-bar)
and **deployed** (setup links swung out, boom extended, spars converging on the port sites).
EndoWrist-style wrist and an endoscope tip are modelled at 1:1 for the macro shots.

## Shot list

| # | Time | Station | What happens | Type / HUD |
|---|---|---|---|---|
| 01 | 0.0–4.0 | Line online | Darkness; a boot sequence types itself; a laser line races down the floor. On the downbeat the light banks strike, one per beat, then cascade down the hall; graphite assembly robots wake (cyan joint rings) | WOCKHARDT HOSPITALS // ROBOTIC SURGERY PROGRAMME · ASSEMBLY LINE 01 · **THE FUTURE OF SURGERY / IS BEING ASSEMBLED.** (letters fly in and lock like parts) |
| 02 | 4.0–8.0 | 01 · Mobile base | The pallet glides in and clamps on the beat; a torque driver seats a fixing; a laser welder stitches the seam (sparks); a laser sheet sweeps up the base leaving a point-cloud twin; the column waits overhead | BASE ASSEMBLY · TORQUE · SEAM WELD · DIGITAL TWIN SCAN ✓ |
| 03 | 8.0–12.0 | 02 · Column + boom | The column drops into the base (dust); the boom head lands and its light ring wakes; the boom extends and swings while the HUD measures the angle | COLUMN · BOOM HEAD · OVERHEAD BOOM — ROTATES · MULTI-QUADRANT ACCESS |
| 04 | 12.0–16.0 | 03 · Four arms | Four arms drop one per beat — 1, 2, 3, 4 — and lock; their rings light in sequence; each arm twitches through a joint test | **FOUR ARMS. / ONE SURGEON IN CONTROL.** |
| 05 | 16.0–20.0 | 04 · Instruments | Macro: the wrist is printed by light (wireframe → hologram → metal behind a scanning band), then articulates on the beat — pitch, yaw, open, close. The four instruments slide home | ENDOWRIST® INSTRUMENTS · seven degrees of freedom counted off · **7** |
| 06 | 20.0–23.0 | 05 · Vision + calibration | The endoscope's two lenses; left and right images fuse. A laser crosshair drops from the boom onto the calibration target; the arms deploy around it in one movement; a hand-tremor trace runs through the filter and comes out still | **3D HD VISION** · LASER TARGETING · TREMOR FILTRATION · MOTION SCALING |
| 07 | 23.0–27.5 | Hero | Blackout on the downbeat — only the light rings glow. A blade of light sweeps the shells; the cart is lit like a product and unfolds its four arms | **da Vinci Xi®** · ROBOTIC SURGICAL SYSTEM |
| 08 | 27.5–30.0 | End card | The light flares to white | **ROBOTIC SURGERY · COMING SOON** · WOCKHARDT HOSPITALS (typographic stand-in) over the Healwave · legal line |

## Sound

120 BPM, D minor: detuned-saw pads opening across the build (Dm–B♭–F–C), a pumping bass, 16th-note
FM arps, kick/snare/hats arriving station by station, a snare roll and riser into the blackout.
Over it, the mechanics, each placed on its picture cue: light-bank relays and mains hum, servo
whines whose pitch follows the motion, pneumatic clamps, a torque spindle and click, laser-weld
crackle and spark bursts, laser sweeps, heavy locks for the column, head and each arm, UI
telemetry. The blackout cuts everything to near silence; the reveal lands on a bright D major
(add9) with a sub swell; the end card resolves on Dmaj9 with a bell sting. Mix −14 LUFS
integrated, true peak ≤ −1 dBTP.

## Notes

* **Trademarks:** da Vinci, da Vinci Xi and EndoWrist are trademarks of Intuitive Surgical, Inc.;
  the end card carries the attribution line. Feature call-outs are kept to the system's published
  capabilities (four arms, overhead rotating boom, laser targeting, wristed instruments with seven
  degrees of freedom, 3D HD vision, tremor filtration, motion scaling); factory read-outs (torque,
  weld) are set dressing.
* **Brand:** WOCKHARDT HOSPITALS is a typographic stand-in for the registered mark (as in the earlier
  film); supply the logo file to replace it in `dv/src/shots/s08.js`.
* **Launch date:** the end card says COMING SOON; add a date by editing one line in `s08.js`.

## Rebuild

```
node tools/dv/export_cues.mjs && python3 -I dv/audio/sound.py dv/audio/cues.json dv/audio/
tools/dv/render_all.sh          # Chromium on Xvfb -> ANGLE -> Mesa llvmpipe, 6 chunks, then mux
```
Stills: `GL=llvm xvfb-run -a node tools/dv/render.mjs stills --times 3.9,15.8,26.5 --out out/dv/stills`.

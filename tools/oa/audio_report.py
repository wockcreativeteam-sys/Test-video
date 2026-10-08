"""Visual audit of the "Every Step" soundtrack: log-frequency spectrogram + short-term loudness, with
the shot windows, VO lines and key events read from cues.json (nothing hard-coded).

usage: python3 -I tools/oa/audio_report.py <wav> <cues.json> <out.png> [t0 t1]
"""
import json
import sys

import numpy as np
import scipy.signal as ss
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

KEY_EVENTS = ["breath", "touch", "tunnelIn", "clockPull", "stutter", "redHits", "kneeDive", "jointIn", "textStop",
              "hurt", "explode", "notices", "pupil", "memory09", "she", "collapse", "touch11", "purple", "lineIn",
              "pledge", "finalStep", "brand"]


def first(v):
    if isinstance(v, (int, float)):
        return [float(v)]
    if isinstance(v, list):
        return [float(x) for x in v if isinstance(x, (int, float))]
    return []


def kweight(x, sr):
    # BS.1770 K-weighting (48 kHz coefficients)
    assert sr == 48000
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return ss.lfilter(b2, a2, ss.lfilter(b1, a1, x, axis=0), axis=0)


def main():
    y, sr = sf.read(sys.argv[1], always_2d=True)
    cues = json.load(open(sys.argv[2]))
    t0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    t1 = float(sys.argv[5]) if len(sys.argv) > 5 else len(y) / sr
    seg = y[int(t0 * sr): int(t1 * sr)]
    mono = seg.mean(axis=1)
    span = t1 - t0
    nper = 4096 if span > 20 else (2048 if span > 5 else 1024)
    f, tt, S = ss.spectrogram(mono, sr, nperseg=nper, noverlap=nper * 7 // 8)
    S = 10 * np.log10(S + 1e-16)
    W, H = 1800, 520
    fl = np.geomspace(30, 20000, H)
    rows = np.array([np.interp(fl, f, S[:, i]) for i in range(S.shape[1])]).T[::-1]
    img = np.clip((rows + 125) / 85, 0, 1)
    img = (np.power(img, 1.15) * 255).astype(np.uint8)
    spec = Image.fromarray(img).resize((W, H))
    spec = Image.merge("RGB", (spec.point(lambda v: int(v * 0.55)), spec.point(lambda v: int(v * 0.9)), spec))
    canvas = Image.new("RGB", (W, H + 300), (12, 14, 20))
    canvas.paste(spec, (0, 0))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)

    def X(tm):
        return int((tm - t0) / span * W)

    # VO lines (shaded band under the spectrogram)
    for v in cues["VO"]:
        a, b = v["t"], v["t"] + v["dur"]
        if b < t0 or a > t1:
            continue
        d.rectangle([X(max(a, t0)), H + 2, X(min(b, t1)), H + 12], fill=(70, 120, 200))
        d.text((X(max(a, t0)) + 2, H + 13), v["key"], fill=(120, 160, 230), font=font)
    # short-term loudness (K-weighted, 400 ms momentary, 100 ms hop) of the full file
    k = kweight(seg, sr)
    hop, win = int(0.1 * sr), int(0.4 * sr)
    mom = []
    for i in range(0, max(1, len(k) - win), hop):
        p = np.sum(np.mean(k[i: i + win] ** 2, axis=0))
        mom.append(-0.691 + 10 * np.log10(p + 1e-12))
    base = H + 290
    for lv in (-60, -40, -30, -20, -14):
        yy = base - int((lv + 70) / 70 * 250)
        d.line([(0, yy), (W, yy)], fill=(45, 50, 62))
        d.text((4, yy - 13), f"{lv} LUFS", fill=(140, 140, 150), font=font)
    pts = [(int((i * 0.1 + 0.2) / span * W), base - int(np.clip((v + 70) / 70, 0, 1) * 250)) for i, v in enumerate(mom)]
    if len(pts) > 1:
        d.line(pts, fill=(240, 90, 90), width=2)
    # shots
    for name, (a, b) in cues["SHOT"].items():
        if t0 <= a <= t1:
            d.line([(X(a), 0), (X(a), H + 300)], fill=(200, 200, 200))
            d.text((X(a) + 3, 3), name, fill=(255, 255, 255), font=font)
    # key events
    ev = cues["EV"]
    for j, key in enumerate(KEY_EVENTS):
        for tm in first(ev.get(key)):
            if t0 <= tm <= t1:
                d.line([(X(tm), 18), (X(tm), H)], fill=(250, 200, 60))
                d.text((X(tm) + 2, 20 + (j % 6) * 13), key, fill=(250, 210, 90), font=font)
    for hz in (50, 100, 200, 500, 1000, 2000, 5000, 10000):
        yy = int(H - np.log(hz / 30) / np.log(20000 / 30) * H)
        d.text((W - 50, yy - 7), f"{hz}", fill=(200, 200, 120), font=font)
    canvas.save(sys.argv[3])
    print("wrote", sys.argv[3])


if __name__ == "__main__":
    main()

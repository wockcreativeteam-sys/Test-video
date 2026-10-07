"""Visual audit of the soundtrack: log-frequency spectrogram + short-term loudness, with the
film's chapter marks. usage: python3 -I tools/audio_report.py <wav> <out.png> [t0 t1]"""
import sys

import numpy as np
import scipy.signal as ss
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

MARKS = [(0, "HUMAN"), (10, "FIELD"), (18, "SCAN"), (26, "KNEE"), (36, "DA VINCI"), (44, "ONCO"), (52, "CARDIAC"),
         (60, "NEURO"), (68, "PLATFORM"), (84.45, "CUT"), (96, "END")]


def main():
    y, sr = sf.read(sys.argv[1])
    mono = y.mean(axis=1)
    t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0
    t1 = float(sys.argv[4]) if len(sys.argv) > 4 else len(mono) / sr
    seg = mono[int(t0 * sr) : int(t1 * sr)]
    f, tt, S = ss.spectrogram(seg, sr, nperseg=4096, noverlap=3072)
    S = 10 * np.log10(S + 1e-14)
    W, H = 1800, 520
    # log-frequency resample 30 Hz .. 16 kHz
    fl = np.geomspace(30, 16000, H)
    rows = np.array([np.interp(fl, f, S[:, i]) for i in range(S.shape[1])]).T
    rows = rows[::-1]
    img = np.clip((rows + 120) / 80, 0, 1)
    img = (np.power(img, 1.2) * 255).astype(np.uint8)
    spec = Image.fromarray(img).resize((W, H))
    spec = Image.merge("RGB", (spec.point(lambda v: int(v * 0.6)), spec.point(lambda v: int(v * 0.85)), spec))
    canvas = Image.new("RGB", (W, H + 260), (12, 14, 20))
    canvas.paste(spec, (0, 0))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    # loudness (RMS dBFS per 100 ms)
    hop = int(0.1 * sr)
    rms = [20 * np.log10(np.sqrt(np.mean(seg[i : i + hop] ** 2)) + 1e-9) for i in range(0, len(seg) - hop, hop)]
    pts = [(int(i / len(rms) * W), H + 250 - int(np.clip((v + 70) / 70, 0, 1) * 230)) for i, v in enumerate(rms)]
    d.line(pts, fill=(240, 80, 90), width=2)
    for db in (-60, -40, -20, -10):
        yy = H + 250 - int((db + 70) / 70 * 230)
        d.line([(0, yy), (W, yy)], fill=(50, 54, 66))
        d.text((4, yy - 14), f"{db} dB", fill=(140, 140, 150), font=font)
    for tm, name in MARKS:
        if t0 <= tm <= t1:
            x = int((tm - t0) / (t1 - t0) * W)
            d.line([(x, 0), (x, H + 260)], fill=(255, 255, 255))
            d.text((x + 3, 3), name, fill=(255, 255, 255), font=font)
    for hz in (50, 100, 200, 500, 1000, 2000, 5000, 10000):
        yy = int(H - np.log(hz / 30) / np.log(16000 / 30) * H)
        d.text((W - 60, yy - 7), f"{hz}", fill=(200, 200, 120), font=font)
    canvas.save(sys.argv[2])
    print("ok")


if __name__ == "__main__":
    main()

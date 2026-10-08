"""Scratch voice-over for the World OA Day film, synthesised locally (Kokoro-82M via kokoro-onnx).

usage: python3 -I tools/oa/vo.py <model.onnx> <voices.bin> <out_dir> [voice] [speed]

Writes one trimmed WAV per line (48 kHz mono) + durations.json. This is a guide track for timing
and emotion; the final VO is meant to be recorded by a voice artist over the M&E mix.
"""
import json
import os
import sys

import numpy as np
import scipy.signal as ss
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    ("v01", "The first time she held your hand..."),
    ("v02", "she taught you how to walk."),
    ("v03", "She walked us to school. Ran behind us. Ran ahead of us."),
    ("v04", "And somehow, always kept going."),
    ("v05", "Then, somewhere along the way..."),
    ("v06", "she started walking a little slower."),
    ("v07a", "Not because she wanted to stop."),
    ("v07b", "Because every step began to hurt."),
    ("v08", "For us, she may be a patient with osteoarthritis."),
    ("v09", "But for someone..."),
    ("v10", "she is the woman who never stopped showing up."),
    ("v11", "The first time she held your hand, she taught you how to walk."),
    ("v12", "Maybe now, it's time to notice how she walks."),
    ("v13a", "This World O. A. Day, let's take a pledge."),
    ("v13b", "Notice the signs. Address the pain. Keep life moving."),
]


def trim(x, sr, thr_db=-48, pad=0.04):
    env = np.abs(x)
    win = int(0.01 * sr)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    thr = 10 ** (thr_db / 20) * max(env.max(), 1e-9)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    y = x[a:b].copy()
    f = int(0.008 * sr)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def main():
    model, voices, out = sys.argv[1:4]
    voice = sys.argv[4] if len(sys.argv) > 4 else "af_heart"
    speed = float(sys.argv[5]) if len(sys.argv) > 5 else 0.92
    os.makedirs(out, exist_ok=True)
    k = Kokoro(model, voices)
    durs = {}
    for key, text in LINES:
        samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
        y = trim(np.asarray(samples, dtype=np.float64), sr)
        y48 = ss.resample_poly(y, 2, 1)  # 24 kHz -> 48 kHz
        sf.write(os.path.join(out, f"{key}.wav"), y48.astype(np.float32), 48000)
        durs[key] = round(len(y48) / 48000, 3)
        print(f"{key} {durs[key]:.2f}s  {text}")
    json.dump({"voice": voice, "speed": speed, "durations": durs, "lines": dict(LINES)}, open(os.path.join(out, "durations.json"), "w"), indent=1)


if __name__ == "__main__":
    main()

"""Original score + sound design for "Re-Engineered" — synthesised from scratch, frame-locked to
the film through cues.json (exported from film/src/timeline.js).

usage: python3 -I film/audio/score.py <cues.json> <out.wav>

Key: D minor at 120 BPM (heart at 60 BPM = every other beat); resolves to D major for the human
moment. Everything is generated here: no samples, no loops, no stock audio.
"""
import json
import sys

import numpy as np
import pyloudnorm as pyln
import scipy.signal as ss
import soundfile as sf

SR = 48000
DUR = 108.0
N = int(SR * DUR)
RNG = np.random.default_rng(20261006)

cues = json.load(open(sys.argv[1]))
HEART = cues["HEART"]
BABY = cues["BABY"]
CUT = 84.45  # hard cut to silence


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


# ----------------------------------------------------------------------------- buses
class Bus:
    def __init__(self, name):
        self.name = name
        self.L = np.zeros(N + SR * 4)
        self.R = np.zeros(N + SR * 4)

    def add(self, sig, t, gain=1.0, pan=0.0):
        if t >= DUR or len(sig) == 0:
            return
        i = int(round(t * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), len(self.L) - i)
        th = (pan + 1) * np.pi / 4
        self.L[i : i + n] += sig[:n] * gain * np.cos(th)
        self.R[i : i + n] += sig[:n] * gain * np.sin(th)

    def add_st(self, l, r, t, gain=1.0):
        i = int(round(t * SR))
        n = min(len(l), len(self.L) - i)
        self.L[i : i + n] += l[:n] * gain
        self.R[i : i + n] += r[:n] * gain


B = {k: Bus(k) for k in ["heart", "music", "pad", "fx", "air", "logo", "drums"]}


# ----------------------------------------------------------------------------- dsp helpers
def sos(kind, f, order=2, q=None):
    if kind == "band":
        return ss.butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype="band", output="sos")
    return ss.butter(order, min(f / (SR / 2), 0.99), btype=kind, output="sos")


def lp(x, f, o=2):
    return ss.sosfilt(sos("low", f, o), x)


def hp(x, f, o=2):
    return ss.sosfilt(sos("high", f, o), x)


def bp(x, f0, f1, o=2):
    return ss.sosfilt(sos("band", (f0, f1), o), x)


def noise(n):
    return RNG.standard_normal(n)


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.2):
    e = np.ones(n) * s
    ia, idd, ir = int(a * SR), int(d * SR), int(r * SR)
    ia = max(1, min(ia, n))
    e[:ia] = np.linspace(0, 1, ia)
    if idd > 0 and ia + idd < n:
        e[ia : ia + idd] = np.linspace(1, s, idd)
    if ir > 0:
        ir = min(ir, n)
        e[-ir:] *= np.linspace(1, 0, ir) ** 1.5
    return e


def fades(x, fi=0.005, fo=0.02):
    n = len(x)
    a, b = int(fi * SR), int(fo * SR)
    if a:
        x[: min(a, n)] *= np.linspace(0, 1, min(a, n))
    if b:
        x[-min(b, n) :] *= np.linspace(1, 0, min(b, n))
    return x


def osc(freq, n, kind="sine", phase=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,)) if np.ndim(freq) else np.full(n, float(freq))
    ph = phase + 2 * np.pi * np.cumsum(f) / SR
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "saw":
        # band-limited-ish saw: additive up to ~8 kHz
        out = np.zeros(n)
        f0 = float(np.max(f))
        kmax = int(max(1, min(40, 8000 // max(f0, 1))))
        for k in range(1, kmax + 1):
            out += np.sin(ph * k) / k * (1 if k % 2 else 1)
        return out * (2 / np.pi)
    if kind == "sq":
        out = np.zeros(n)
        f0 = float(np.max(f))
        kmax = int(max(1, min(30, 8000 // max(f0, 1))))
        for k in range(1, kmax + 1, 2):
            out += np.sin(ph * k) / k
        return out * (4 / np.pi)
    raise ValueError(kind)


# ----------------------------------------------------------------------------- instruments
def heartbeat(gain=1.0, kind="adult"):
    """lub-dub with audible harmonics (so it reads on small speakers)"""
    if kind == "adult":
        f_lub, f_dub, gap, tau, dur = (58, 40), (66, 47), 0.30, 0.075, 0.75
    else:
        f_lub, f_dub, gap, tau, dur = (86, 62), (96, 70), 0.17, 0.045, 0.42
    n = int(dur * SR)
    out = np.zeros(n)

    def thump(f0, f1, tau, amp):
        m = int(0.32 * SR)
        t = np.arange(m) / SR
        f = f1 + (f0 - f1) * np.exp(-t / 0.05)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR)
        env = (1 - np.exp(-t / 0.004)) * np.exp(-t / tau)
        x = body * env
        x = np.tanh(x * 2.6) / np.tanh(2.6)  # harmonics 100–200 Hz
        tr = lp(noise(m), 220, 2) * np.exp(-t / 0.018) * 0.35
        click = bp(noise(m), 500, 1400, 2) * np.exp(-t / 0.006) * 0.08
        return (x + tr + click) * amp

    a = thump(*f_lub, tau, 1.0)
    out[: len(a)] += a
    j = int(gap * SR)
    b = thump(*f_dub, tau * 0.8, 0.62)
    out[j : j + len(b)] += b[: n - j]
    return out * gain


def kick(gain=1.0):
    t = tt(0.42)
    f = 46 + 110 * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    x += bp(noise(len(t)), 1800, 6000) * np.exp(-t / 0.004) * 0.12
    return np.tanh(x * 1.6) * gain


def hat(gain=1.0, open_=False):
    t = tt(0.12 if not open_ else 0.3)
    x = hp(noise(len(t)), 7000, 2) * np.exp(-t / (0.018 if not open_ else 0.08))
    return x * gain


def click(freq=4000, gain=1.0, tau=0.004):
    t = tt(0.03)
    x = bp(noise(len(t)), freq * 0.7, min(freq * 1.4, 20000), 2) * np.exp(-t / tau)
    return x * gain


def blip(freq, dur=0.06, gain=1.0, kind="sine"):
    t = tt(dur)
    x = osc(freq, len(t), kind) * np.exp(-t / (dur * 0.35))
    return fades(x, 0.002, 0.01) * gain


def fm_bell(freq, dur=3.0, ratio=3.5, index=3.0, gain=1.0, tau=None):
    t = tt(dur)
    tau = tau or dur * 0.28
    idx = index * np.exp(-t / (tau * 0.35))
    mod = np.sin(2 * np.pi * freq * ratio * t)
    x = np.sin(2 * np.pi * freq * t + idx * mod) * np.exp(-t / tau)
    return fades(x, 0.002, 0.05) * gain


def fm_pluck(freq, dur=0.28, gain=1.0, bright=1.0):
    t = tt(dur)
    idx = 2.4 * bright * np.exp(-t / 0.035)
    x = np.sin(2 * np.pi * freq * t + idx * np.sin(2 * np.pi * freq * 2 * t)) * np.exp(-t / 0.11)
    return fades(x, 0.001, 0.03) * gain


def pad(midis, dur, gain=1.0, attack=1.2, release=1.6, cutoff=1400, detune=6.0, kind="saw"):
    n = int(dur * SR)
    l = np.zeros(n)
    r = np.zeros(n)
    for m in midis:
        f = mtof(m)
        for k, dc in enumerate((-detune, 0.0, detune)):
            ff = f * 2 ** (dc / 1200)
            x = osc(ff, n, kind, phase=RNG.uniform(0, 6.28))
            pan = (k - 1) * 0.6
            l += x * np.cos((pan + 1) * np.pi / 4)
            r += x * np.sin((pan + 1) * np.pi / 4)
    env = adsr(n, attack, 0.0, 1.0, release)
    l = lp(l, cutoff, 2) * env
    r = lp(r, cutoff, 2) * env
    s = gain / (len(midis) * 3) * 2.2
    return l * s, r * s


def bass_note(freq, dur, gain=1.0, cutoff=500):
    n = int(dur * SR)
    x = osc(freq, n, "saw") * 0.7 + osc(freq / 2, n, "sine") * 0.6
    x = lp(x, cutoff, 2)
    t = np.arange(n) / SR
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / (dur * 0.9))
    return fades(x * env, 0.001, 0.02) * gain


def whoosh(dur, f0, f1, gain=1.0, shape="rise"):
    """band of noise sweeping f0 -> f1 (chunked band-pass)"""
    n = int(dur * SR)
    src = noise(n)
    out = np.zeros(n)
    chunks = 24
    edges = np.linspace(0, n, chunks + 1).astype(int)
    win = 2048
    for c in range(chunks):
        a, b = edges[c], edges[c + 1]
        u = (c + 0.5) / chunks
        fc = f0 * (f1 / f0) ** u
        lo, hi = max(fc / 1.6, 30), min(fc * 1.6, 20000)
        a0, b0 = max(0, a - win), min(n, b + win)
        y = bp(src[a0:b0], lo, hi, 2)
        seg = y[a - a0 : a - a0 + (b - a)]
        out[a:b] += seg
    t = np.arange(n) / SR
    if shape == "rise":
        env = (t / dur) ** 2.2
    elif shape == "fall":
        env = (1 - t / dur) ** 2
    else:
        env = np.sin(np.pi * t / dur) ** 2
    return fades(out * env, 0.01, 0.03) * gain


def glide(f0, f1, dur, gain=1.0, kind="sine", curve=1.0):
    n = int(dur * SR)
    u = np.linspace(0, 1, n) ** curve
    f = f0 * (f1 / f0) ** u
    x = osc(f, n, kind)
    return fades(x, 0.01, 0.05) * gain


def servo(dur, f0, f1, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = 0.5 - 0.5 * np.cos(np.pi * t / dur)
    f = f0 + (f1 - f0) * u
    f = f * (1 + 0.004 * np.sin(2 * np.pi * 7 * t))
    x = osc(f, n, "saw") * 0.6 + osc(f * 2.01, n, "sine") * 0.3
    x = bp(x, 120, 1800, 2)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    ticks = np.zeros(n)
    for k in range(int(dur / 0.045)):
        j = int(k * 0.045 * SR)
        c = click(5200, 0.25, 0.002)
        ticks[j : j + len(c)] += c[: n - j]
    return fades(x * env + ticks * env, 0.01, 0.05) * gain


# ----------------------------------------------------------------------------- harmony map
CHORDS = {
    "Dm": [50, 53, 57, 60, 64],
    "Bb": [46, 50, 53, 57, 60],
    "Gm": [43, 50, 53, 57, 58],
    "C": [48, 52, 55, 59, 62],
    "F": [41, 53, 57, 60, 64],
    "Am": [45, 52, 57, 60, 64],
    "A7s": [45, 50, 52, 55, 57],
    "A": [45, 49, 52, 57, 61],
    "D": [50, 54, 57, 62, 66],
}
PROG = [  # (start, end, chord)
    (12, 24, "Dm"), (24, 30, "Bb"), (30, 34, "Gm"), (34, 36, "C"),
    (36, 40, "Dm"), (40, 42, "Bb"), (42, 44, "C"),
    (44, 48, "Gm"), (48, 50, "Bb"), (50, 52, "F"),
    (52, 54, "Dm"), (54, 56, "A7s"), (56, 57, "A"), (57, 60, "Dm"),
    (60, 62, "F"), (62, 64, "Am"), (64, 66, "Bb"), (66, 68, "C"),
    (68, 70, "Dm"), (70, 72, "Bb"), (72, 74, "F"), (74, 76, "C"),
    (76, 78, "Dm"), (78, 80, "Bb"), (80, 82, "Gm"), (82, CUT, "A"),
]


def chord_at(t):
    for a, b, c in PROG:
        if a <= t < b:
            return c
    return None


def level(t, keys):
    """piecewise-linear automation"""
    xs = [k[0] for k in keys]
    ys = [k[1] for k in keys]
    return float(np.interp(t, xs, ys))


# ============================================================================= THE SCORE
print("heart…")
# --- the heart track
for b in HEART:
    if b >= CUT:
        g = 0.3 * (0.7 + 0.3 * min(1.0, (b - 86.5) / 3.0))  # the intimate final heart (84.5+)
    else:
        g = level(b, [(0, 0.66), (10, 0.72), (14, 0.5), (18, 0.4), (26, 0.32), (51, 0.32), (52, 0.6), (60, 0.6), (61, 0.3), (68, 0.4), (76, 0.7), (84, 1.0)])
    B["heart"].add(heartbeat(g), b - 0.012, 0.9, 0.0)
for b in BABY:
    B["heart"].add(heartbeat(0.19, "baby"), b - 0.006, 0.9, 0.12)
# final heartbeat under the end-card dot
B["heart"].add(heartbeat(0.7), 101.2 - 0.012, 0.9, 0.0)

print("atmosphere…")
# --- room tone (night) and air (white)
rt = lp(noise(int(CUT * SR)), 900, 2) * 0.0016
rt += lp(noise(len(rt)), 120, 2) * 0.004
B["air"].add(fades(rt, 1.5, 0.002), 0.0)
air2 = hp(lp(noise(int(21.5 * SR)), 5000, 2), 600, 2) * 0.0012
B["air"].add(fades(air2, 2.0, 3.0), 85.4)
# breaths
for t0, g in [(0.75, 0.55), (85.3, 0.38)]:
    n = int(2.8 * SR)
    t = np.arange(n) / SR
    env = np.where(t < 1.1, (t / 1.1) ** 2, np.exp(-(t - 1.1) / 0.5))
    x = bp(noise(n), 350, 2600, 2) * env * 0.05
    B["air"].add(x, t0, g, -0.1)

# --- sub drone on D, swelling with the film
n = int((CUT - 8) * SR)
t = np.arange(n) / SR + 8
dr = np.sin(2 * np.pi * 36.71 * t) * 0.6 + np.sin(2 * np.pi * 73.42 * t) * 0.35 + np.sin(2 * np.pi * 110.0 * t) * 0.08
dr *= np.interp(t, [8, 12, 18, 26, 44, 60, 68, 78, 84, CUT], [0, 0.05, 0.06, 0.05, 0.05, 0.06, 0.05, 0.1, 0.16, 0.16])
B["music"].add(np.tanh(dr * 1.4) / 1.4, 8.0)

print("data…")
# --- data: annotation ticks then a granular cloud of clicks as the trace multiplies
for tc in [7.6, 8.1, 8.6, 9.0, 7.4, 8.4, 9.4]:
    B["fx"].add(click(5200, 0.5), tc, 1.0, 0.25)
tcur = 9.9
while tcur < 16.8:
    dens = np.interp(tcur, [9.9, 12.5, 14.5, 16.8], [6, 70, 60, 4])
    tcur += RNG.exponential(1 / dens)
    B["fx"].add(click(RNG.uniform(2200, 9000), RNG.uniform(0.12, 0.32), 0.003), tcur, 1.0, RNG.uniform(-0.8, 0.8))
# type reveals — a soft breath of air with every statement
for ts in [3.4, 17.3, 23.3, 28.2, 31.7, 38.3, 47.5, 55.7, 80.5, 91.7]:
    B["air"].add(whoosh(0.9, 1800, 7000, 0.04, "arch"), ts - 0.15, 1.0, 0.0)
# the split-flap roll SECOND -> DECISION
for k in range(6):
    B["fx"].add(click(3600 + k * 400, 0.35, 0.002), 6.6 + k * 0.07, 1.0, 0.1)

print("scan…")
# --- MRI gradient rhythm (the machine becomes the rhythm section), 18–22.2
pat = [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1]
k = 0
tcur = 18.0
while tcur < 22.2:
    if pat[k % 16]:
        m = int(0.11 * SR)
        tb = np.arange(m) / SR
        x = osc(1180, m, "sq") * 0.25 + osc(590, m, "sq") * 0.1
        x = bp(x, 700, 3200, 2) * np.exp(-tb / 0.03) * (1 - np.exp(-tb / 0.002))
        x += lp(noise(m), 160, 2) * np.exp(-tb / 0.02) * 0.4
        g = level(tcur, [(18, 0.0), (18.6, 0.16), (21.2, 0.16), (22.2, 0.0)])
        B["fx"].add(x, tcur, g, 0.35 if k % 2 else -0.35)
    tcur += 0.125
    k += 1
# CT gantry whirr + travelling sweep
n = int(4.0 * SR)
t = np.arange(n) / SR
wh = (osc(96, n, "saw") * 0.4 + osc(192.5, n, "sine") * 0.2) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.6 * t))
wh = bp(wh, 80, 900, 2) * np.sin(np.pi * t / 4.0) ** 0.8
B["fx"].add(wh * 0.06, 17.9, 1.0, 0.0)
B["fx"].add(whoosh(3.6, 3000, 700, 0.07, "arch"), 18.0, 1.0, 0.2)
# the ring locks into the bore, the scanner resolves
B["fx"].add(heartbeat(0.25)[: int(0.3 * SR)], 22.45, 1.0, 0.0)
B["logo"].add(fm_bell(mtof(81), 3.5, 3.5, 2.2, 0.12), 22.5, 1.0, 0.2)
B["logo"].add(fm_bell(mtof(88), 3.0, 3.5, 1.6, 0.06), 22.65, 1.0, -0.2)

print("music…")
# --- pads by chord
for a, b, c in PROG:
    if c is None:
        continue
    g = level(a, [(12, 0.22), (18, 0.26), (26, 0.24), (36, 0.24), (52, 0.28), (60, 0.24), (68, 0.3), (80, 0.42), (82, 0.48)])
    l, r = pad(CHORDS[c], (b - a) + 1.4, g, attack=0.9 if a > 12 else 2.5, release=1.3, cutoff=1300 if a < 76 else 2200)
    if b == CUT:
        cut = int((CUT - a) * SR)
        l[cut:] = 0
        r[cut:] = 0
    B["pad"].add_st(l, r, a)
# --- pulse bass in 8ths, sidechained to the heart/kick
for a, b, c in PROG:
    if a < 18:
        continue
    root = CHORDS[c][0]
    f = mtof(root - 12 if root >= 45 else root)
    g = level(a, [(18, 0.0), (19, 0.2), (26, 0.18), (36, 0.22), (60, 0.1), (68, 0.24), (80, 0.32), (84, 0.34)])
    cut = level(a, [(18, 260), (26, 420), (44, 520), (60, 300), (68, 500), (82, 1100)])
    tcur = a
    while tcur < b - 1e-6 and tcur < CUT:
        ph = (tcur * 2) % 1  # position within the beat
        duck = 0.45 if abs((tcur % 1.0)) < 1e-6 else 1.0
        B["music"].add(bass_note(f, 0.24, g * duck, cut), tcur, 1.0, 0.0)
        tcur += 0.25
# --- arpeggios (FM plucks, 16ths)
for a, b, c in PROG:
    if a < 19:
        continue
    notes = CHORDS[c]
    seq = [notes[i % len(notes)] + 12 * (1 + (i // len(notes)) % 2) for i in range(16)]
    seq = seq[:8] + seq[:8][::-1]
    dens = level(a, [(19, 1), (26, 2), (36, 2), (44, 2), (60, 2), (68, 1), (76, 1)])
    g = level(a, [(19, 0.0), (20, 0.08), (26, 0.06), (36, 0.07), (52, 0.07), (60, 0.05), (68, 0.08), (76, 0.1), (82, 0.12)])
    tcur = max(a, 19.5)
    k = 0
    while tcur < b - 1e-6 and tcur < CUT - 0.05:
        if dens == 1 or k % 2 == 0:
            m = seq[k % 16]
            B["music"].add(fm_pluck(mtof(m), 0.32, g, 1.0 if tcur > 68 else 0.7), tcur, 1.0, 0.45 if k % 2 else -0.45)
        tcur += 0.125
        k += 1

print("knee / robotics…")
# --- PLAN / PRECISION
for i, ts in enumerate([27.0, 27.2, 27.35, 27.5]):
    B["fx"].add(blip(mtof([74, 77, 81, 84][i]), 0.09, 0.08, "tri"), ts, 1.0, -0.4 + i * 0.27)
B["fx"].add(whoosh(1.0, 900, 5000, 0.05, "arch"), 29.1, 1.0, 0.0)
B["logo"].add(fm_bell(mtof(86), 2.0, 2.0, 1.2, 0.05), 29.3, 1.0, 0.3)
n = int(4.8 * SR)
t = np.arange(n) / SR
hum = (np.sin(2 * np.pi * 62 * t) * 0.5 + np.sin(2 * np.pi * 124 * t) * 0.2) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.2 * t))
B["fx"].add(fades(hum * 0.035, 0.5, 0.5), 30.5, 1.0, 0.0)
B["fx"].add(servo(1.1, 110, 240, 0.09), 30.9, 1.0, 0.4)
n = int(2.4 * SR)
t = np.arange(n) / SR
burr = np.sin(2 * np.pi * 2800 * t + 1.5 * np.sin(2 * np.pi * 31 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t))
burr = burr * 0.5 + bp(noise(n), 3000, 7000, 2) * 0.3
B["fx"].add(fades(burr * 0.022, 0.08, 0.15), 32.0, 1.0, 0.2)
for k in range(10):
    B["fx"].add(click(6000, 0.35, 0.0015), 32.25 + k * 0.055, 1.0, 0.3)
for k in range(8):
    B["fx"].add(blip(mtof(93), 0.03, 0.03), 32.4 + k * 0.25, 1.0, 0.3)
B["logo"].add(fm_bell(mtof(79), 1.6, 2.76, 2.5, 0.07), 34.45, 1.0, 0.1)
B["logo"].add(fm_bell(mtof(84), 2.4, 3.5, 2.0, 0.05), 31.35, 1.0, 0.5)
# --- HUMAN + MACHINE
for i in range(4):
    B["fx"].add(servo(1.3, 300 - i * 20, 120, 0.06), 36.2 + i * 0.12, 1.0, -0.6 + i * 0.4)
    B["fx"].add(kick(0.08)[: int(0.15 * SR)], 37.55 + i * 0.05, 1.0, -0.6 + i * 0.4)
    B["fx"].add(whoosh(0.5, 2500, 900, 0.03, "arch"), 37.2 + i * 0.1, 1.0, -0.6 + i * 0.4)
B["logo"].add(fm_bell(mtof(81), 2.4, 3.5, 2.0, 0.06), 36.95, 1.0, 0.5)
# the suture: hand (warm, trembling) and instrument (pure, a perfect twelfth above = 3:1)
n = int(3.4 * SR)
t = np.arange(n) / SR
trem = 1 + 0.008 * np.sin(2 * np.pi * 9.1 * t) + 0.004 * np.sin(2 * np.pi * 13.7 * t)
loops = 0.5 + 0.5 * np.cos(2 * np.pi * 4 * t / 3.4)
hand = osc(220 * trem * (1 + 0.04 * loops), n, "tri") * (0.4 + 0.6 * loops)
inst = osc(660 * (1 + 0.04 * loops), n, "sine") * (0.4 + 0.6 * loops)
B["fx"].add(fades(lp(hand, 1500), 0.3, 0.4) * 0.05, 38.2, 1.0, -0.5)
B["fx"].add(fades(inst, 0.3, 0.4) * 0.035, 38.2, 1.0, 0.5)

print("oncology / cardiac / neuro…")
# --- ONCOLOGY
tcur = 44.3
while tcur < 45.9:
    tcur += RNG.exponential(1 / 30)
    B["fx"].add(click(RNG.uniform(5000, 11000), 0.12, 0.002), tcur, 1.0, RNG.uniform(-0.7, 0.7))
for k, ts in enumerate(np.arange(44.95, 46.0, 0.19)):
    B["fx"].add(blip(1760 + (k % 3) * 120, 0.035, 0.05), ts, 1.0, np.sin(k) * 0.6)
B["fx"].add(blip(mtof(81), 0.08, 0.09), 46.02, 1.0, 0.0)
B["fx"].add(blip(mtof(88), 0.14, 0.09), 46.12, 1.0, 0.0)
B["fx"].add(glide(80, 300, 1.0, 0.03, "tri"), 46.6, 1.0, 0.4)
# twelve vectors converge: twelve glissandi resolve into one unison D5
starts = [mtof(m) for m in [46, 53, 58, 62, 65, 69, 70, 74, 77, 81, 86, 89]]
for i, f0 in enumerate(starts):
    t0 = 48.0 + i * 0.09
    dur = 49.25 - t0
    B["music"].add(glide(f0, mtof(74), dur, 0.022, "sine", 0.6), t0, 1.0, -0.8 + i * 0.145)
l, r = pad([62, 69, 74, 81], 2.2, 0.2, attack=0.02, release=1.8, cutoff=3000, kind="tri")
B["pad"].add_st(l, r, 49.25)
B["logo"].add(fm_bell(mtof(86), 2.6, 3.5, 1.4, 0.06), 49.25, 1.0, 0.0)
for k, m in enumerate([86, 83, 79, 76]):
    B["fx"].add(blip(mtof(m), 0.07, 0.06, "tri"), 49.95 + k * 0.33, 1.0, 0.4)
# --- CARDIAC
B["music"].add(glide(mtof(50), mtof(74), 2.2, 0.05, "tri", 1.0) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * np.arange(int(2.2 * SR)) / SR)), 52.2, 1.0, 0.0)
n = int(1.2 * SR)
flow = lp(noise(n), 700, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.0 * np.arange(n) / SR))
B["fx"].add(fades(flow * 0.04, 0.3, 0.4), 53.8, 1.0, -0.2)
l, r = pad([69, 74, 76, 79], 3.2, 0.16, attack=1.0, release=0.8, cutoff=4200)
n = len(l)
trem = 0.6 + 0.4 * np.sin(2 * np.pi * 7.5 * np.arange(n) / SR)
B["pad"].add_st(l * trem, r * trem, 54.0)
B["fx"].add(blip(mtof(69), 0.25, 0.05) + np.pad(blip(mtof(70), 0.25, 0.05), (0, 0)), 55.2, 1.0, 0.0)
B["fx"].add(whoosh(0.8, 300, 2400, 0.06, "rise"), 56.2, 1.0, 0.1)
B["fx"].add(click(3000, 0.6, 0.004), 57.0, 1.0, 0.1)
B["logo"].add(fm_bell(mtof(74), 2.4, 2.0, 1.2, 0.07), 57.0, 1.0, -0.2)
# --- NEURO
l, r = pad([65, 69, 72, 76], 8.0, 0.1, attack=1.6, release=2.0, cutoff=5200, kind="tri")
B["pad"].add_st(l, r, 60.3)
# the scan plane rises through the head, one soft tick per slice band
B["fx"].add(whoosh(1.7, 250, 3200, 0.03, "rise"), 60.05, 1.0, 0.0)
for k in range(30):
    B["fx"].add(click(5200 + k * 70, 0.05 + 0.1 * np.sin(np.pi * k / 29), 0.0012), 60.15 + k * 0.052, 1.0, -0.3 + 0.02 * k)
tcur = 61.6
while tcur < 67.0:
    tcur += RNG.exponential(1 / 22)
    s = click(RNG.uniform(3000, 9000), RNG.uniform(0.05, 0.16), 0.0015)
    B["fx"].add(s, tcur, 1.0, RNG.uniform(-0.9, 0.9))
for k, ts in enumerate([62.7, 63.0, 63.25, 63.55]):
    B["logo"].add(fm_bell(mtof(84 + k * 2), 0.9, 2.76, 2.0, 0.035), ts, 1.0, -0.5 + k * 0.33)
for k in range(3):
    for j in range(14):
        B["fx"].add(click(7000, 0.12, 0.0012), 63.5 + k * 0.18 + j * 0.06, 1.0, 0.6)
B["fx"].add(glide(1200, 420, 0.8, 0.025, "sine"), 63.8, 1.0, 0.2)
B["fx"].add(whoosh(1.2, 1200, 300, 0.03, "fall"), 64.6, 1.0, 0.1)
for k, m in enumerate([72, 76, 79, 84]):
    B["fx"].add(blip(mtof(m), 0.12, 0.045, "tri"), 65.6 + k * 0.12, 1.0, 0.2)
n = int(2.4 * SR)
t = np.arange(n) / SR
dbs = (np.sin(2 * np.pi * 130.0 * t) + 0.25 * np.sin(2 * np.pi * 260 * t)) * (0.75 + 0.25 * np.sin(2 * np.pi * 1.3 * t))
B["music"].add(fades(dbs * 0.05, 0.3, 0.8), 65.9, 1.0, 0.0)
B["fx"].add(whoosh(1.4, 400, 5000, 0.05, "rise"), 66.6, 1.0, 0.0)
for k in range(3):
    B["logo"].add(fm_bell(mtof(91), 0.8, 1.0, 0.5, 0.03), 67.6 + k * 0.625, 1.0, 0.2)

print("platform / climax…")
# --- THE PLATFORM: pull-out, build, heartbeat + machine pulse, riser, implosion
B["fx"].add(whoosh(2.0, 6000, 120, 0.12, "arch"), 68.5, 1.0, 0.0)
B["fx"].add(glide(220, 40, 1.8, 0.06, "sine", 0.7), 68.6, 1.0, 0.0)
for i, ts in enumerate(np.arange(70.8, 72.2, 0.2)):
    B["fx"].add(blip(mtof(86 + (i % 3) * 3), 0.05, 0.03), ts, 1.0, 0.5 - i * 0.15)
# the network boots, then the machines arrive one by one (roll call, one pluck each)
B["fx"].add(whoosh(1.6, 600, 4000, 0.04, "arch"), 73.6, 1.0, 0.0)
for i in range(10):
    m = [74, 77, 81, 84, 86, 89, 91, 93, 96, 98][i]
    B["music"].add(fm_pluck(mtof(m), 0.6, 0.075, 1.2), 74.0 + i * 0.22, 1.0, -0.7 + i * 0.155)
for k, (m, ts) in enumerate([(62, 74.4), (65, 75.45), (69, 76.5), (74, 77.55)]):
    l, r = pad([m, m + 12], 1.4, 0.09, attack=0.15, release=0.8, cutoff=2600, kind="tri")
    B["pad"].add_st(l, r, ts)
for k in range(6):
    B["fx"].add(whoosh(1.0, 800, 5000, 0.03, "arch"), 81.0 + k * 0.25, 1.0, -0.8 + k * 0.32)
# drums: the heart lands on 1 and 3 (whole seconds); the machine pulse answers on 2 and 4
tcur = 68.0
while tcur < CUT - 0.01:
    step = int(round((tcur - 68.0) / 0.125))
    g = level(tcur, [(68, 0.0), (70, 0.35), (76, 0.45), (82, 0.6), (84.4, 0.7)])
    if step % 8 == 4:
        B["drums"].add(kick(g * 0.7), tcur, 1.0, 0.0)
    if tcur > 72 and (tcur > 76 or step % 2 == 0):
        hg = level(tcur, [(72, 0.0), (74, 0.05), (80, 0.07), (84, 0.1)])
        B["drums"].add(hat(hg * (1.0 if step % 2 else 0.6)), tcur, 1.0, 0.3 if step % 2 else -0.3)
    tcur += 0.125
# riser + reverse swell into the cut
B["fx"].add(whoosh(3.0, 300, 9000, 0.14, "rise"), CUT - 3.0, 1.0, 0.0)
rs_n = int(1.2 * SR)
rs = fm_bell(mtof(57), 1.2, 1.0, 0.8, 1.0, 0.4)[::-1] * np.linspace(0, 1, rs_n) ** 2
B["music"].add(rs * 0.12, CUT - 1.2, 1.0, 0.0)
B["fx"].add(glide(160, 38, 0.8, 0.12, "sine", 2.0), CUT - 0.8, 1.0, 0.0)

print("human / identity…")
# --- THE HUMAN, AGAIN (silence, two hearts, the first major chord)
l, r = pad([50, 54, 57, 62], 9.5, 0.13, attack=3.0, release=3.0, cutoff=1500, kind="tri")
B["pad"].add_st(l, r, 88.0)
l, r = pad([74, 78], 4.5, 0.05, attack=1.5, release=2.5, cutoff=4000, kind="sine")
B["pad"].add_st(l, r, 91.7)
# --- IDENTITY: the line opens, the sonic logo D – A – F#, the last heartbeat
B["air"].add(whoosh(1.2, 900, 6000, 0.05, "arch"), 96.25, 1.0, 0.0)
B["heart"].add(heartbeat(0.55)[: int(0.35 * SR)], 96.72, 1.0, 0.0)
for k, m in enumerate([62, 69, 78]):
    B["logo"].add(fm_bell(mtof(m), 5.5, 3.5 if k < 2 else 2.0, 1.6, 0.16 - k * 0.02, 1.8), 96.75 + k * 0.3, 1.0, -0.25 + k * 0.25)
    B["logo"].add(fm_bell(mtof(m - 12), 4.0, 1.0, 0.6, 0.06, 1.5), 96.75 + k * 0.3, 1.0, 0.0)
l, r = pad([38, 50, 54, 57, 62, 66], 8.5, 0.16, attack=1.2, release=4.0, cutoff=1800, kind="tri")
B["pad"].add_st(l, r, 96.8)
B["air"].add(whoosh(1.0, 1500, 6000, 0.03, "arch"), 98.5, 1.0, 0.0)

# ============================================================================= mix
print("mix…")


def ir(seconds=2.6, seed=3, predelay=0.012, damp=6000):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        g = np.random.default_rng(seed + ch).standard_normal(n) * np.exp(-t / (seconds / 6.9))
        g = lp(g, damp, 1)
        pd = int(predelay * SR)
        g = np.concatenate([np.zeros(pd), g])[:n]
        # a few early reflections
        for d, a in [(0.019, 0.5), (0.031, 0.35), (0.047, 0.28), (0.063, 0.2)]:
            j = int((d + ch * 0.003) * SR)
            g[j] += a
        out.append(g / np.sqrt(np.sum(g ** 2)))
    return out


IRL, IRR = ir()
# the film's dynamic arc: chapters breathe, the platform builds, the human moment whispers
ARC = {
    "music": [(0, 1.0), (12, 0.55), (18, 0.6), (26, 0.48), (44, 0.5), (52, 0.62), (60, 0.42), (68, 0.6), (74, 0.8), (78, 1.0), (82, 1.3), (84.45, 1.4), (84.5, 0.5), (108, 0.5)],
    "pad": [(0, 1.0), (12, 0.6), (26, 0.5), (52, 0.62), (60, 0.5), (68, 0.6), (76, 0.85), (82, 1.25), (84.45, 1.35), (84.5, 0.55), (96, 0.7), (108, 0.7)],
    "drums": [(0, 1.0), (70, 0.8), (80, 1.1), (84.45, 1.3), (108, 1.0)],
    "fx": [(0, 1.0), (60, 0.85), (68, 1.0), (108, 1.0)],
}
for k, keys in ARC.items():
    tt_ = np.arange(len(B[k].L)) / SR
    curve = np.interp(tt_, [x[0] for x in keys], [x[1] for x in keys])
    B[k].L *= curve
    B[k].R *= curve
for b_ in B.values():
    b_.L = hp(b_.L, 32, 2)
    b_.R = hp(b_.R, 32, 2)
sends = {"heart": 0.12, "music": 0.28, "pad": 0.35, "fx": 0.3, "air": 0.2, "logo": 0.55, "drums": 0.12}
gains = {"heart": 1.0, "music": 0.9, "pad": 0.85, "fx": 0.9, "air": 1.0, "logo": 0.9, "drums": 0.8}
L = np.zeros(len(B["heart"].L))
R = np.zeros_like(L)
wetL = np.zeros_like(L)
wetR = np.zeros_like(L)
for k, b in B.items():
    L += b.L * gains[k]
    R += b.R * gains[k]
    wetL += b.L * gains[k] * sends[k]
    wetR += b.R * gains[k] * sends[k]
wL = ss.fftconvolve(wetL, IRL)[: len(L)]
wR = ss.fftconvolve(wetR, IRR)[: len(L)]
# the cut is absolute: no reverb tail survives into the white silence
cut_i = int(CUT * SR)
fade_n = int(0.012 * SR)
for arr in (L, R, wL, wR):
    seg_ = arr[cut_i - fade_n : cut_i]
    seg_ *= np.linspace(1, 0, fade_n)
# everything after the cut is muted until the human cues begin (breath at 85.3)
L[cut_i:int(84.9 * SR)] = 0
R[cut_i:int(84.9 * SR)] = 0
wL[cut_i:int(86.4 * SR)] = 0
wR[cut_i:int(86.4 * SR)] = 0
L += wL * 0.9
R += wR * 0.9

# gentle bus compression (feed-forward, RMS)
x = np.vstack([L, R])
env = np.sqrt(lp(np.mean(x ** 2, axis=0), 2.5, 1).clip(1e-12))
thr = 10 ** (-15 / 20)
ratio = 1.5
over = np.maximum(env / thr, 1.0)
gain = over ** (1 / ratio - 1)
x *= gain
# loudness to -16 LUFS, then a soft-knee limiter at -1 dBTP
meter = pyln.Meter(SR)
y = x[:, : N].T
loud = meter.integrated_loudness(y)
y = y * 10 ** ((-16.0 - loud) / 20)
peak = 10 ** (-1.2 / 20)
y = np.where(np.abs(y) > peak * 0.8, np.sign(y) * (peak * 0.8 + (peak * 0.2) * np.tanh((np.abs(y) - peak * 0.8) / (peak * 0.2))), y)
print("integrated LUFS", round(meter.integrated_loudness(y), 2), "peak dBFS", round(20 * np.log10(np.max(np.abs(y))), 2))
for a_, b_, name in [(1, 10, "human"), (11, 18, "field"), (19, 26, "scan"), (28, 36, "knee"), (38, 44, "davinci"), (45, 52, "onco"),
                     (53, 60, "cardiac"), (61, 68, "neuro"), (69, 76, "platform-a"), (77, 84.4, "platform-b"), (86, 96, "human-2"), (97, 104, "end")]:
    seg_ = y[int(a_ * SR): int(b_ * SR)]
    print(f"  {name:11s} {meter.integrated_loudness(seg_):6.1f} LUFS")
sf.write(sys.argv[2], y.astype(np.float32), SR, subtype="PCM_24")
print("wrote", sys.argv[2], y.shape[0] / SR, "s")

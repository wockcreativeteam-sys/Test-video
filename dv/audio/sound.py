#!/usr/bin/env python3
"""da Vinci Xi — launch teaser: score and sound design, synthesised from nothing.

usage:  python3 -I dv/audio/sound.py dv/audio/cues.json dv/audio/

A 120 BPM D-minor pulse (detuned-saw pads, a pumping bass, 16th-note FM arps, drums) under a layer
of mechanical sound that hangs off the picture's cue sheet (cues.json, exported from
dv/src/timeline.js): light-bank relays and mains hum, servo whines whose pitch follows the motion,
pneumatic clamps, a torque spindle, laser-weld crackle, laser sweeps, heavy locks, UI telemetry.
The blackout cuts everything; the reveal lands on a bright D major; the end card resolves on a
Dmaj9 with a bell sting.

Deterministic (every sound draws from its own named random stream). Writes 48 kHz / 24-bit stereo:
  mix.wav (-14 LUFS integrated, true peak <= -1 dBTP), mix.m4a (AAC 256k)
"""
import json
import os
import subprocess
import sys
import zlib

import numpy as np
import pyloudnorm as pyln
import scipy.signal as ss
import soundfile as sf
from scipy.ndimage import minimum_filter1d

SR = 48000
SEED = 20261009
TAU = 2 * np.pi
TARGET_LUFS = -14.0
TP_CEIL = -1.0
BEAT = 0.5


def R(name):
    return np.random.default_rng([SEED, zlib.crc32(name.encode())])


def ns(sec):
    return int(round(sec * SR))


def tv(n):
    return np.arange(n) / SR


def db(x):
    return 10.0 ** (np.asarray(x, float) / 20.0)


def fade(x, fi=0.002, fo=0.004):
    x = np.array(x, dtype=float)
    n = x.shape[-1]
    a, b = min(ns(fi), n), min(ns(fo), n)
    if a > 1:
        x[..., :a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    if b > 1:
        x[..., n - b:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, b + 1) / b)
    return x


def _w(f):
    return min(max(float(f), 2.0), SR * 0.475) / (SR / 2)


def lp(x, f, o=2):
    return ss.sosfilt(ss.butter(o, _w(f), "low", output="sos"), x, axis=-1)


def hp(x, f, o=2):
    return ss.sosfilt(ss.butter(o, _w(f), "high", output="sos"), x, axis=-1)


def bp(x, f0, f1, o=2):
    w0, w1 = _w(f0), _w(f1)
    if w1 <= w0 * 1.02:
        w0 = w1 / 1.1
    return ss.sosfilt(ss.butter(o, [w0, w1], "band", output="sos"), x, axis=-1)


def resonate(x, f, tau):
    r = np.exp(-1.0 / (tau * SR))
    w = TAU * min(f, SR * 0.45) / SR
    return ss.lfilter([np.sin(w)], [1.0, -2 * r * np.cos(w), r * r], x)


def pan2(x, p=0.0):
    if np.ndim(x) == 2:
        return x
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.vstack([x * np.cos(th), x * np.sin(th)])


def tv_lp(x, fc, nseg=256):
    """time-varying low-pass: fc is an array (per sample) — processed in short blocks with state"""
    out = np.zeros_like(x)
    zi = None
    n = x.shape[-1]
    for i in range(0, n, nseg):
        f = float(np.mean(fc[i:i + nseg]))
        sos = ss.butter(2, _w(f), "low", output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) if x.ndim == 1 else (sos.shape[0], x.shape[0], 2))
        if x.ndim == 1:
            out[i:i + nseg], zi = ss.sosfilt(sos, x[i:i + nseg], zi=zi)
        else:
            out[:, i:i + nseg], zi = ss.sosfilt(sos, x[:, i:i + nseg], axis=-1, zi=zi)
    return out


def osc_phase(f):
    """phase accumulation for a per-sample frequency array"""
    return TAU * np.cumsum(f) / SR


def saw(ph):
    return 2.0 * ((ph / TAU) % 1.0) - 1.0


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ============================================================================== mixer / space
class Mixer:
    def __init__(self, n):
        self.n = n
        self.b = {}

    def bus(self, k):
        if k not in self.b:
            self.b[k] = np.zeros((2, self.n))
        return self.b[k]

    def add(self, sig, t, gain=1.0, pan=0.0, bus="fx", rv=0.0, rvbus="rv_hall"):
        x = pan2(np.asarray(sig, dtype=float), pan) * gain
        i = int(round(t * SR))
        if i < 0:
            x, i = x[:, -i:], 0
        m = min(x.shape[1], self.n - i)
        if m <= 0:
            return
        self.bus(bus)[:, i: i + m] += x[:, :m]
        if rv > 0:
            self.bus(rvbus)[:, i: i + m] += x[:, :m] * rv


def make_ir(name, rt, pre=0.02, damp=6000.0, n_sec=None):
    rng = R("ir:" + name)
    n = ns(n_sec or min(rt * 1.3 + pre, 7.0))
    t = tv(n)
    out = []
    for ch in range(2):
        z = rng.standard_normal(n)
        acc = np.zeros(n)
        for c in (63, 125, 250, 500, 1000, 2000, 4000, 8000):
            rtc = rt / (1.0 + (c / damp) ** 1.5)
            acc += bp(z, c / np.sqrt(2), min(c * np.sqrt(2), SR * 0.46), 2) * np.exp(-6.91 * t / max(rtc, 0.05))
        acc *= 1 - np.exp(-t / 0.02)
        acc /= np.sqrt(np.sum(acc ** 2))
        p = ns(pre * (1 + 0.07 * ch))
        out.append(np.concatenate([np.zeros(p), acc])[:n])
    ir = np.vstack(out)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve_st(x, ir):
    n = x.shape[1]
    a, b = 0.8 * x[0] + 0.2 * x[1], 0.2 * x[0] + 0.8 * x[1]
    return np.vstack([ss.oaconvolve(a, ir[0])[:n], ss.oaconvolve(b, ir[1])[:n]])


def true_peak(x):
    return 20 * np.log10(np.max(np.abs(ss.resample_poly(x, 4, 1, axis=-1))) + 1e-12)


def limiter_gain(y, ceil, look=0.0015, rel=0.1):
    n = y.shape[1]
    up = np.abs(ss.resample_poly(y, 4, 1, axis=-1)).max(axis=0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = max(1, ns(look))
    g = minimum_filter1d(need, size=2 * L + 1, mode="nearest")
    g = np.minimum(g, np.convolve(g, np.ones(L) / L, mode="same"))
    hop = 32
    m = -(-n // hop)
    gb = np.pad(g, (0, m * hop - n), constant_values=1.0).reshape(m, hop).min(axis=1)
    ar = np.exp(-hop / (rel * SR))
    out, s = np.empty(m), 1.0
    for i in range(m):
        s = gb[i] if gb[i] < s else ar * s + (1 - ar) * gb[i]
        out[i] = s
    return np.minimum(g, np.interp(np.arange(n), np.arange(m) * hop + hop / 2, out))


def glue(x, thr=-18.0, ratio=2.0, att=0.01, rel=0.15):
    """gentle bus compressor"""
    hop = 64
    n = x.shape[1]
    m = -(-n // hop)
    p = np.zeros(m * hop)
    p[:n] = np.mean(x ** 2, axis=0)
    p = p.reshape(m, hop).mean(axis=1)
    lev = 10 * np.log10(p + 1e-12)
    over = np.maximum(lev - thr, 0)
    gr = over * (1 / ratio - 1)
    aa, ar = np.exp(-hop / (att * SR)), np.exp(-hop / (rel * SR))
    g, s = np.empty(m), 0.0
    for i in range(m):
        cf = aa if gr[i] < s else ar
        s = cf * s + (1 - cf) * gr[i]
        g[i] = s
    return x * db(np.interp(np.arange(n), np.arange(m) * hop + hop / 2, g))


# ============================================================================== instruments
def kick(rng, f0=52.0, dur=0.55, click=0.5):
    t = tv(ns(dur))
    f = f0 + 120 * np.exp(-t / 0.03)
    x = np.sin(osc_phase(f)) * np.exp(-t / 0.22)
    x += click * hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004)
    return np.tanh(1.6 * x) * 0.8


def snare(rng, dur=0.35):
    t = tv(ns(dur))
    body = np.sin(TAU * 185 * t) * np.exp(-t / 0.05) * 0.5
    nz = bp(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t / 0.09)
    return fade(body + nz * 0.9, 0.0005, 0.02)


def hat(rng, dur=0.08, open_=False):
    t = tv(ns(dur if not open_ else 0.3))
    x = hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t / (0.018 if not open_ else 0.09))
    return fade(x, 0.0003, 0.01)


def pluck(f, dur=0.22, bright=1.0):
    t = tv(ns(dur))
    mod = np.sin(TAU * f * 2.0 * t) * (3.5 * bright) * np.exp(-t / 0.05)
    x = np.sin(TAU * f * t + mod) * np.exp(-t / 0.09)
    return fade(x, 0.001, 0.03)


def pad_voice(freqs, dur, rng, voices=5, detune=0.12):
    """detuned saw stack for a chord"""
    n = ns(dur)
    t = tv(n)
    x = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune
            ff = f * 2 ** (d / 12)
            ph = rng.random() * TAU
            x += saw(TAU * ff * t + ph)
    return x / (len(freqs) * voices) ** 0.5


def impact(rng, f0=40.0, dur=3.0, metal=0.5, bright=0.5):
    t = tv(ns(dur))
    f = f0 + 70 * np.exp(-t / 0.05)
    sub = np.sin(osc_phase(f)) * np.exp(-t / 0.7)
    nz = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.12) * 0.6
    ring = np.zeros(len(t))
    for fr, tau in ((620, 0.5), (1170, 0.35), (2310, 0.25), (3420, 0.18)):
        ring += resonate(rng.standard_normal(len(t)) * np.exp(-t / 0.004), fr * (0.97 + 0.06 * rng.random()), tau)
    ring = ring / (np.max(np.abs(ring)) + 1e-9)
    crack = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.02) * bright
    return np.tanh(sub * 1.3) + nz + ring * metal * 0.5 + crack * 0.6


def clack(rng, pitch=1.0, dur=0.25):
    """relay / contactor slam"""
    t = tv(ns(dur))
    ex = rng.standard_normal(len(t)) * np.exp(-t / 0.0025)
    x = sum(resonate(ex, f * pitch, tau) for f, tau in ((1900, 0.03), (3300, 0.02), (5200, 0.012), (760, 0.05)))
    x = x / (np.max(np.abs(x)) + 1e-9)
    thump = np.sin(TAU * 90 * pitch * t) * np.exp(-t / 0.03)
    return fade(x * 0.8 + thump * 0.6, 0.0003, 0.02)


def hum(dur, f=100.0, buzz=0.4, rng=None):
    t = tv(ns(dur))
    x = sum(np.sin(TAU * f * k * t) / k ** 1.2 for k in range(1, 9))
    x += buzz * np.sign(np.sin(TAU * f * t)) * 0.15
    return lp(x, 1800) * 0.4


def whoosh(rng, dur, f0, f1, shape=1.0):
    n = ns(dur)
    t = tv(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** u
    x = tv_lp(rng.standard_normal(n), fc * 1.6)
    x = hp(x, 120)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** shape
    return fade(x * env, 0.01, 0.05)


def riser(rng, dur, f0=300, f1=9000):
    n = ns(dur)
    t = tv(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** (u ** 1.5)
    x = tv_lp(rng.standard_normal(n), fc)
    x = hp(x, 200)
    env = u ** 2.2
    tone = np.sin(osc_phase(200 * (4 ** u))) * 0.15 * u ** 2
    return fade(x * env + tone, 0.05, 0.003)


def servo(rng, dur, f_fn, amp_fn=None, grit=0.25):
    """electric servo whine: f_fn(u) -> fundamental (Hz) over u in 0..1"""
    n = ns(dur)
    u = np.arange(n) / max(1, n - 1)
    f = f_fn(u)
    ph = osc_phase(f)
    x = np.sin(ph) * 0.5 + np.sin(2 * ph) * 0.25 + np.sin(3.01 * ph) * 0.15 + saw(ph * 1.0) * 0.08
    x += grit * bp(rng.standard_normal(n), 2000, 7000) * 0.3
    a = amp_fn(u) if amp_fn else np.sin(np.pi * u) ** 0.6
    return fade(x * a, 0.01, 0.02)


def hiss(rng, dur=0.35, f0=3000):
    t = tv(ns(dur))
    x = bp(rng.standard_normal(len(t)), f0, 12000) * (np.exp(-t / (dur * 0.35)))
    return fade(x, 0.002, 0.05)


def blip(f, dur=0.07, f2=None):
    t = tv(ns(dur))
    ff = f if f2 is None else f * (f2 / f) ** (t / dur)
    x = np.sin(osc_phase(np.full(len(t), 1.0) * ff)) * np.exp(-t / (dur * 0.4))
    return fade(x, 0.001, 0.01)


def zap(rng, dur, f0, f1):
    t = tv(ns(dur))
    f = f0 * (f1 / f0) ** (t / dur)
    x = np.sin(osc_phase(f)) * 0.6 + 0.3 * np.sin(osc_phase(f * 1.5)) + 0.25 * bp(rng.standard_normal(len(t)), 2500, 9000)
    return fade(x * np.exp(-t / (dur * 0.7)), 0.002, 0.03)


def crackle(rng, dur, rate=180):
    n = ns(dur)
    x = np.zeros(n)
    k = int(rate * dur)
    for _ in range(k):
        i = rng.integers(0, max(1, n - 400))
        L = rng.integers(40, 300)
        x[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L * 0.25)) * rng.random()
    x = hp(x, 1500)
    sizzle = bp(rng.standard_normal(n), 3500, 9000) * 0.25
    return fade(x * 0.7 + sizzle, 0.01, 0.03)


def bell(f, dur=3.0):
    t = tv(ns(dur))
    x = np.zeros(len(t))
    for r, a, tau in ((1.0, 1.0, 1.6), (2.76, 0.5, 0.7), (5.4, 0.25, 0.35), (8.9, 0.12, 0.2), (0.5, 0.35, 1.8)):
        x += a * np.sin(TAU * f * r * t) * np.exp(-t / tau)
    return fade(x * 0.5, 0.002, 0.1)


# ============================================================================== the film
def build(C):
    EV = C["EV"]
    D = C["DURATION"]
    N = ns(D + 3.0)
    mx = Mixer(N)
    A = mx.add

    # ---------------------------------------------------------------- music
    # chords per bar (2 s): roots in MIDI
    Dm, Bb, F, Cc, Gm, Am, Dmaj = (
        [50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55], [43, 50, 55], [45, 49, 52], [50, 54, 57])
    prog = {2: Dm, 4: Dm, 6: Bb, 8: F, 10: Cc, 12: Dm, 14: Bb, 16: F, 18: Cc, 20: Gm, 22: Am}

    def chord_at(t):
        k = max([b for b in prog if b <= t], default=2)
        return prog[k]

    # pads: one voice per bar, filter opening across the build
    rp = R("pad")
    for b, ch in prog.items():
        dur = 2.0 if b < 22 else 1.0
        x = pad_voice([midi(n) for n in ch] + [midi(ch[0] - 12)], dur + 0.4, rp)
        fc = np.full(x.shape[-1], 350 + 3200 * ((b - 2) / 20) ** 1.6)
        x = tv_lp(x, fc)
        x = fade(x, 0.05, 0.35)
        A(x, b, 0.16 if b < 4 else 0.13, -0.15, "pad")
        A(x * 0.9, b + 0.011, 0.13, 0.15, "pad")
    # hero chord (D major, add9) and the end card (Dmaj9)
    for t0, notes, dur, g, fco in ((24.0, [50, 54, 57, 62, 64, 69, 74], 3.75, 0.2, 5200), (27.6, [50, 57, 61, 64, 66, 69, 73], 2.9, 0.12, 2600)):
        x = pad_voice([midi(n) for n in notes], dur, R("hero%.1f" % t0), voices=7, detune=0.1)
        x = lp(x, fco)
        env = np.minimum(1, tv(x.shape[-1]) / 0.25) * np.exp(-np.maximum(0, tv(x.shape[-1]) - dur * 0.8) / 0.6)
        A(fade(x * env, 0.01, 0.4), t0, g, -0.1, "pad", rv=0.25)
        A(fade(x * env, 0.01, 0.4), t0 + 0.013, g, 0.1, "pad", rv=0.25)
    # the hero keeps its energy under the title: a sub, a half-time pulse and a bright 8th arp
    th = tv(ns(3.6))
    sub = np.sin(TAU * 36.71 * th) * np.minimum(1, th / 0.4) * np.exp(-np.maximum(0, th - 3.0) / 0.3)
    A(fade(sub, 0.05, 0.2), 24.0, 0.3, 0, "music")
    rk = R("herokick")
    for b in np.arange(24.5, 27.5, 1.0):
        A(kick(rk, 48, 0.6, 0.3), b, 0.4, 0, "music")
    hero_notes = [74, 78, 81, 86, 81, 78, 76, 81]
    for k, b in enumerate(np.arange(25.0, 27.5, 0.25)):
        A(hp(pluck(midi(hero_notes[k % 8]), 0.3, 0.9), 400), b, 0.05 + 0.03 * (k / 10), -0.4 if k % 2 else 0.4, "music", rv=0.25, rvbus="rv_room")
    # drone in the dark
    t0 = tv(ns(2.2))
    drone = np.sin(TAU * 36.7 * t0) * 0.6 + np.sin(TAU * 73.4 * t0) * 0.25
    drone = fade(drone * np.minimum(1, t0 / 1.5), 0.3, 0.3)
    A(drone, 0.0, 0.35, 0, "music")
    # bass: whole notes 4-8, eighths 8-23
    for b in np.arange(4.0, 23.0, 0.25 if True else 0.5):
        if b < 8.0 and (b % 2) != 0:
            continue
        step = 0.25
        if b < 8.0:
            dur = 1.9
        else:
            if (round(b / step)) % 2:  # eighth notes only
                continue
            dur = 0.24
        root = chord_at(b)[0] - 24
        t = tv(ns(dur))
        f = midi(root)
        x = saw(osc_phase(np.full(len(t), f))) * 0.6 + np.sin(TAU * f * t)
        x = lp(x, 420 if b < 8 else 900) * np.exp(-t / (0.9 if b < 8 else 0.16))
        A(fade(x, 0.003, 0.03), b, 0.22, 0, "bass")
    # arps: 16ths from 4.0 (density/brightness grows)
    pat = [0, 2, 1, 2, 0, 2, 1, 3]
    i = 0
    for b in np.arange(4.0, 23.0, 0.125):
        ch = chord_at(b)
        notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
        n = notes[pat[i % len(pat)]]
        prog_u = (b - 4.0) / 19.0
        g = 0.05 + 0.07 * prog_u
        acc = 1.3 if i % 4 == 0 else 1.0
        x = pluck(midi(n), 0.2, bright=0.6 + 0.8 * prog_u)
        A(hp(x, 300), b, g * acc, -0.45 if i % 2 else 0.45, "arp", rv=0.12, rvbus="rv_room")
        i += 1
    # drums
    rd = R("drums")
    for b in np.arange(4.0, 23.0, 0.5):
        beat = int(round(b / 0.5))
        if b < 12.0:
            if beat % 2 == 0:
                A(kick(rd), b, 0.55, 0, "drums")
        else:
            A(kick(rd), b, 0.6, 0, "drums")
        if b >= 16.0 and beat % 2 == 1:
            A(snare(rd), b, 0.32, 0, "drums", rv=0.15, rvbus="rv_room")
    for b in np.arange(8.0, 23.0, 0.25):
        sixteenth = int(round(b / 0.25))
        if b < 16.0 and sixteenth % 2 == 0:
            continue
        A(hat(rd), b, 0.06 if sixteenth % 2 else 0.035, 0.3, "drums")
    # snare roll into the blackout
    for k, b in enumerate(np.arange(22.0, 23.0, 0.0625)):
        A(snare(rd, 0.15), b, 0.06 + 0.22 * k / 16, 0, "drums")
    A(riser(R("riser1"), 1.5), 21.5, 0.25, 0, "fx")

    # ---------------------------------------------------------------- impacts (on the cuts)
    for t, g, f0, metal in ((2.0, 0.85, 38, 0.8), (4.0, 0.45, 44, 0.4), (8.0, 0.4, 44, 0.5), (12.0, 0.45, 42, 0.5),
                            (16.0, 0.35, 46, 0.2), (20.0, 0.35, 46, 0.3), (24.0, 1.0, 34, 0.6), (18.7, 0.4, 48, 0.3)):
        A(impact(R("imp%.2f" % t), f0, 3.0, metal), t, g, 0, "hits", rv=0.35)

    # ---------------------------------------------------------------- opening: boot, laser, light banks
    rb = R("boot")
    for k in range(60):  # typing ticks
        t = 0.15 + k / 70.0
        if t > 0.86:
            break
        A(blip(2400 + 300 * rb.random(), 0.015), t, 0.04, rb.uniform(-0.3, 0.3), "ui")
    for t in EV["boot"]:
        A(blip(1200, 0.08), t, 0.18, 0, "ui")
    A(blip(880, 0.12, 1320), 1.75, 0.16, 0, "ui")
    A(blip(1320, 0.18), 1.83, 0.14, 0, "ui", rv=0.1, rvbus="rv_room")
    A(zap(R("laser0"), 1.05, 4200, 700), 0.95, 0.22, 0, "fx", rv=0.25)
    hall_hum = np.zeros(ns(21.2))
    for j, bk in enumerate(C["banks"]):
        t = bk["t"]
        g = 0.75 if j < 6 else 0.4 * (0.85 ** (j - 6))
        A(clack(R("bank%d" % j), 1.0 + 0.04 * (j % 3)), t, g, 0.0 if j < 6 else (0.25 * (-1) ** j), "fx", rv=0.5)
        if j < 6:
            A(impact(R("bankimp%d" % j), 50, 1.4, 0.25, 0.2), t, 0.25 * (1 - j * 0.1), 0, "hits", rv=0.3)
    h = hum(21.0)
    h = fade(h * np.minimum(1, tv(len(h)) / 1.5), 0.05, 0.02)
    A(h, 2.0, 0.02, 0, "fx")

    # ---------------------------------------------------------------- station 01
    rs = R("st1")
    A(servo(rs, 0.6, lambda u: 260 - 170 * u ** 1.5, lambda u: np.minimum(1, u * 6) * (1 - u) ** 0.4 + 0.0), 3.95, 0.16, -0.4, "fx")
    A(whoosh(rs, 0.6, 300, 1800), 3.95, 0.18, -0.5, "fx")
    A(hiss(rs, 0.45), 4.47, 0.28, 0.3, "fx", rv=0.2)
    A(clack(rs, 0.6, 0.3), 4.5, 0.6, 0, "fx", rv=0.25)
    A(servo(R("drv"), 0.45, lambda u: 420 + 260 * np.sin(np.pi * u)), 4.6, 0.08, 0.4, "fx")
    A(servo(R("drv2"), 0.3, lambda u: 520 - 200 * u), 5.0, 0.1, 0.3, "fx")
    A(servo(R("spin"), 0.32, lambda u: 700 + 1600 * u ** 0.6, lambda u: np.minimum(1, u * 10)), 5.3, 0.13, 0.2, "fx")
    A(clack(R("torque"), 1.6, 0.12), 5.6, 0.35, 0.2, "fx")
    A(blip(1760, 0.1), 5.62, 0.12, 0, "ui")
    A(servo(R("weldmove"), 0.3, lambda u: 380 + 300 * u), 5.55, 0.09, -0.3, "fx")
    A(crackle(R("weld"), 0.42), 5.85, 0.3, -0.2, "fx", rv=0.15)
    for t in (5.95, 6.12):
        A(crackle(R("spark%.2f" % t), 0.35, 420), t, 0.35, -0.25, "fx", rv=0.2)
    A(servo(R("scan"), 1.0, lambda u: 400 * 4 ** u, lambda u: np.sin(np.pi * u) ** 0.5 * (0.8 + 0.2 * np.sin(TAU * 12 * u))), 6.5, 0.07, 0, "fx", rv=0.3)
    for k, t in enumerate((7.1, 7.35, 7.6)):
        A(blip(1046 * 2 ** (k / 6), 0.09), t, 0.14, 0.2, "ui")
    A(servo(R("hyd"), 0.8, lambda u: 70 + 10 * u, lambda u: np.sin(np.pi * u) ** 0.4, grit=0.6), 7.2, 0.12, 0, "fx")

    # ---------------------------------------------------------------- station 02
    A(whoosh(R("coldrop"), 0.55, 2500, 200, 0.8), 7.98, 0.25, 0, "fx")
    A(impact(R("colthud"), 36, 2.5, 0.9, 0.3), 8.5, 0.75, 0, "hits", rv=0.35)
    A(hiss(R("dust"), 0.6, 1500), 8.52, 0.15, 0, "fx", rv=0.3)
    A(whoosh(R("headdrop"), 0.5, 2200, 250, 0.8), 9.0, 0.2, 0, "fx")
    A(impact(R("headthud"), 44, 2.0, 0.7, 0.3), 9.5, 0.5, 0, "hits", rv=0.3)
    A(blip(220, 0.4, 1320), 9.62, 0.12, 0, "ui", rv=0.4)
    A(servo(R("ext"), 0.5, lambda u: 300 + 200 * u), 10.0, 0.12, 0, "fx")
    yaw_keys = [(10.5, 0), (11.0, 0.5), (11.5, -0.42), (11.95, 0)]
    for (ta, ya), (tb, yb) in zip(yaw_keys, yaw_keys[1:]):
        sp = abs(yb - ya) / (tb - ta)
        A(servo(R("rot%.1f" % ta), tb - ta, lambda u, s=sp: 240 + 260 * s * np.sin(np.pi * u)), ta, 0.11, 0.3 * np.sign(yb - ya), "fx")

    # ---------------------------------------------------------------- station 03: four arms
    for k, t in enumerate(EV["armLock"]):
        A(whoosh(R("armw%d" % k), 0.32, 2400, 300, 0.7), t - 0.3, 0.16, -0.45 + 0.3 * k, "fx")
        A(impact(R("arm%d" % k), 46 + 4 * k, 1.8, 0.8, 0.4), t, 0.5, -0.45 + 0.3 * k, "hits", rv=0.3)
        A(clack(R("armc%d" % k), 0.8 + 0.1 * k), t, 0.45, -0.45 + 0.3 * k, "fx")
    for k in range(4):
        t = 14.0 + k * 0.14
        A(blip(midi(74 + [0, 3, 7, 12][k]), 0.35), t, 0.13, -0.45 + 0.3 * k, "ui", rv=0.3)
        A(servo(R("tw%d" % k), 0.35, lambda u: 600 + 300 * np.sin(TAU * 2 * u)), t + 0.05, 0.05, -0.45 + 0.3 * k, "fx")
    rt = R("typeticks")
    for k in range(32):
        t = 14.95 + k * 0.025 + rt.random() * 0.01
        A(blip(3000 + 800 * rt.random(), 0.012), t, 0.05, rt.uniform(-0.5, 0.5), "ui")

    # ---------------------------------------------------------------- station 04: EndoWrist macro
    A(whoosh(R("macro"), 0.9, 200, 5000, 0.6), 15.6, 0.3, 0, "fx", rv=0.2)
    A(servo(R("print"), 0.9, lambda u: 900 * 2 ** u, lambda u: np.sin(np.pi * u) ** 0.5 * (0.7 + 0.3 * np.sin(TAU * 30 * u)), grit=0.5), 16.2, 0.06, 0, "fx", rv=0.3)
    for k in range(10):
        A(blip(4000 + 400 * k, 0.05), 16.25 + k * 0.08, 0.03, (-1) ** k * 0.4, "ui", rv=0.4)
    for t, f0, f1 in ((17.38, 1400, 2400), (17.88, 1600, 2600), (18.4, 1800, 2900)):
        A(servo(R("micro%.1f" % t), 0.24, lambda u, a=f0, b=f1: a + (b - a) * np.sin(np.pi * u)), t, 0.07, 0.2, "fx")
    A(clack(R("snip"), 2.2, 0.1), 19.0, 0.45, 0.1, "fx", rv=0.2)
    for k in range(7):
        A(blip(midi(79 + [0, 2, 3, 5, 7, 8, 10][k]), 0.08), 17.2 + k * 0.21, 0.12, 0.35, "ui")
    for k, t in enumerate(EV["insert"]):
        A(whoosh(R("ins%d" % k), 0.22, 3000, 600), t - 0.22, 0.12, -0.4 + 0.27 * k, "fx")
        A(clack(R("insc%d" % k), 1.3, 0.12), t, 0.35, -0.4 + 0.27 * k, "fx")

    # ---------------------------------------------------------------- station 05: vision + calibration
    A(servo(R("focus"), 0.35, lambda u: 1200 - 500 * u), 20.0, 0.07, 0, "fx")
    A(hiss(R("lighton"), 0.5, 5000), 20.15, 0.1, 0, "fx", rv=0.3)
    t5 = tv(ns(0.55))
    stereo = np.vstack([np.sin(TAU * 523.25 * 2 ** (0.4 * (1 - t5 / 0.55)) * t5), np.sin(TAU * 523.25 * 2 ** (-0.4 * (1 - t5 / 0.55)) * t5)]) * np.sin(np.pi * t5 / 0.55) * 0.5
    A(stereo, 20.22, 0.12, 0, "ui", rv=0.3)
    A(zap(R("laser1"), 0.35, 3800, 900), 21.0, 0.25, 0, "fx", rv=0.3)
    A(blip(1567, 0.15), 21.2, 0.15, 0, "ui")
    for k in range(4):
        A(servo(R("dep%d" % k), 0.8, lambda u, kk=k: 300 + 80 * kk + 220 * np.sin(np.pi * u)), 21.05 + 0.04 * k, 0.07, -0.45 + 0.3 * k, "fx")
    rg = R("tremor")
    for k in range(26):
        t = 21.8 + k * 0.022
        A(blip(500 + 1800 * rg.random(), 0.018), t, 0.05 * (1 - k / 26), rg.uniform(-0.4, 0.4), "ui")
    A(blip(880, 0.6), 22.3, 0.08, 0, "ui", rv=0.3)

    # ---------------------------------------------------------------- blackout, blade, reveal, unfold
    t6 = tv(ns(1.0))
    pd = np.sin(osc_phase(120 * (0.25 ** (t6 / 1.0)))) * np.exp(-t6 / 0.5)
    A(fade(pd, 0.001, 0.1), 23.0, 0.3, 0, "hits")
    A(clack(R("blackout"), 0.7, 0.4), 23.0, 0.4, 0, "fx", rv=0.25)
    A(whoosh(R("blade"), 0.6, 1500, 9000, 1.2), 23.38, 0.22, 0, "fx", rv=0.4)
    A(riser(R("rev"), 0.55, 600, 12000), 23.45, 0.2, 0, "fx")
    for k in range(4):
        A(servo(R("unf%d" % k), 1.3, lambda u, kk=k: 260 + 60 * kk + 260 * np.sin(np.pi * u) ** 0.8), 24.05 + 0.08 * k, 0.08, -0.5 + 0.33 * k, "fx", rv=0.2)
    A(servo(R("boomext"), 0.8, lambda u: 220 + 120 * u), 24.0, 0.08, 0, "fx")
    for k in range(8):
        A(bell(midi(86 + [0, 2, 4, 7, 9, 12, 14, 16][k]), 1.2) * 0.3, 25.5 + k * 0.03, 0.05, (-1) ** k * 0.5, "ui", rv=0.5)

    # ---------------------------------------------------------------- flare, end card
    A(riser(R("flare"), 0.35, 1500, 14000), 27.2, 0.3, 0, "fx")
    A(impact(R("white"), 50, 2.5, 0.2, 0.1), 27.55, 0.35, 0, "hits", rv=0.6)
    for k, n in enumerate([62, 69, 74, 78]):
        A(bell(midi(n), 2.6), 28.25 + k * 0.02, 0.14, -0.3 + 0.2 * k, "ui", rv=0.5)
    A(impact(R("logo"), 36, 2.5, 0.0, 0.0) * 0.6, 28.25, 0.35, 0, "hits", rv=0.3)
    return mx, N


def master(mx, N, D):
    b = mx.b
    z = lambda k: b.get(k, np.zeros((2, N)))
    # sidechain: pads/bass pump against the kick from 12 s
    music = z("pad") + z("arp") + z("bass") * 1.0 + z("music")
    duck = np.ones(N)
    for t in np.arange(12.0, 23.0, 0.5):
        i = ns(t)
        L = ns(0.25)
        if i + L < N:
            duck[i:i + L] = np.minimum(duck[i:i + L], 0.55 + 0.45 * (np.arange(L) / L) ** 0.7)
    music = music * duck
    # the blackout: everything musical stops dead at 23.0 (tails included), returns with the reveal
    cut = np.ones(N)
    a, bb = ns(23.0), ns(24.0)
    cut[a:bb] = 0.0
    cut[bb:bb + ns(0.02)] = np.linspace(0, 1, ns(0.02))
    music *= cut
    drums = z("drums") * cut
    fx = z("fx")
    hits = z("hits")
    ui = z("ui")
    rv_hall = convolve_st(z("rv_hall"), make_ir("hall", 2.8, 0.03, 5000))
    rv_room = convolve_st(z("rv_room"), make_ir("room", 0.9, 0.012, 7000))
    rvc = np.ones(N)
    rvc[a:a + ns(0.4)] = np.linspace(1, 0.15, ns(0.4))
    rvc[a + ns(0.4):bb] = 0.15
    mix = glue(music * 0.9 + drums * 1.0, -20, 2.0) + fx * 0.9 + hits * 0.9 + ui * 0.8 + rv_hall * 0.45 * rvc + rv_room * 0.4
    mix = hp(mix, 25, 2)
    mix = mix[:, : ns(D)]
    # end: the last 0.3 s fades out
    n = mix.shape[1]
    f = ns(0.3)
    mix[:, n - f:] *= np.linspace(1, 0, f) ** 1.5
    meter = pyln.Meter(SR)
    L = meter.integrated_loudness(mix.T)
    mix = mix * db(TARGET_LUFS - L)
    g = limiter_gain(mix, db(TP_CEIL - 0.3))
    mix = mix * g
    for _ in range(4):
        L2 = meter.integrated_loudness(mix.T)
        mix *= db(TARGET_LUFS - L2)
        mix *= limiter_gain(mix, db(TP_CEIL - 0.3))
    return mix


def main():
    cues, out_dir = sys.argv[1], sys.argv[2]
    C = json.load(open(cues))
    D = C["DURATION"]
    mx, N = build(C)
    mix = master(mx, N, D)
    os.makedirs(out_dir, exist_ok=True)
    wav = os.path.join(out_dir, "mix.wav")
    sf.write(wav, mix.T, SR, subtype="PCM_24")
    meter = pyln.Meter(SR)
    print("mix: %.2f LUFS, TP %.2f dBTP, %.2f s" % (meter.integrated_loudness(mix.T), true_peak(mix), mix.shape[1] / SR))
    m4a = os.path.join(out_dir, "mix.m4a")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", m4a], check=True)
    print("wrote", wav, m4a)


if __name__ == "__main__":
    main()

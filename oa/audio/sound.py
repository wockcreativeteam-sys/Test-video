#!/usr/bin/env python3
"""Every Step - the soundtrack of the World Osteoarthritis Day film (Wockhardt).

usage:  python3 -I oa/audio/sound.py oa/audio/cues.json oa/audio/ [--debug DIR]

Built around movement and synthesised from nothing: no samples, no loops, no stock audio, no network.
Every sound hangs off a cue in cues.json (exported from oa/src/timeline.js by tools/oa/export_cues.mjs);
this file only holds offsets *relative* to those cues, so the picture editor can move events and the
soundtrack follows. The scratch VO is read from <dir of cues.json>/vo/<key>.wav.

Deterministic: every sound draws from its own named random stream (crc32(name) + SEED), so adding or
re-ordering sounds never changes the others; nothing reads a clock.

Writes into the output directory (48 kHz, 24-bit, stereo, exactly DURATION seconds):
  mix.wav      VO + music & effects: -16 LUFS integrated, true peak <= -1 dBTP
  me.wav       music & effects alone - same gain and limiter as the mix, so me + vo_stem == mix
  vo_stem.wav  the placed and processed scratch VO alone
  mix.m4a      AAC 192k of mix.wav for the browser preview (ffmpeg)

The arc, in sound only: a breath -> a touch (a soft tonal pulse) -> steps -> the rhythm of a whole life
-> a clock that stutters and sags -> steps in a vast space, bending -> the same walk slowing down ->
grinding, compressed friction -> HURT, then almost nothing -> a quiet clinical room, a limp, someone
notices -> the sound opens -> the touch again, warmer -> two people walking -> silence and one pure
line -> one footstep -> silence.
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
from scipy.ndimage import maximum_filter1d, minimum_filter1d

SR = 48000
SEED = 20261012  # World Arthritis Day
TAU = 2 * np.pi
TAIL = 6.0  # headroom past the end for reverb tails (cut at DURATION)
TARGET_LUFS = -16.0
TP_CEIL = -1.0
VO_LUFS = -18.0  # VO stem level before mastering; the M&E is balanced against it

# pitch world: D, pure (just) intervals only. Tonal material = pulses, drones and tuned grains.
D2 = 73.4162
D3, D4, D5, D6, D7 = (D2 * 2 ** k for k in range(1, 6))
A2, A3, A4, A5 = D2 * 1.5, D3 * 1.5, D4 * 1.5, D5 * 1.5
FS3, FS4, FS5 = D3 * 1.25, D4 * 1.25, D5 * 1.25
PENTA = (1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3)  # D E F# A B


# ============================================================================== basics
def R(name):
    """an independent random stream per sound"""
    return np.random.default_rng([SEED, zlib.crc32(name.encode())])


def ns(sec):
    return int(round(sec * SR))


def tv(n):
    return np.arange(n) / SR


def db(x):
    return 10.0 ** (np.asarray(x, float) / 20.0)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) if np.size(x) else 0.0
    return x * (peak / m) if m > 0 else x


def mono(x):
    return x if np.ndim(x) == 1 else x.mean(axis=0)


def fade(x, fi=0.002, fo=0.004):
    """raised-cosine fade in/out (every grain gets one: no clicks)"""
    x = np.array(x, dtype=float)
    n = x.shape[-1]
    a, b = min(ns(fi), n), min(ns(fo), n)
    if a > 1:
        x[..., :a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    if b > 1:
        x[..., n - b:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, b + 1) / b)
    return x


def hann(n):
    return 0.5 - 0.5 * np.cos(TAU * (np.arange(n) + 0.5) / n)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


# ============================================================================== filters
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


def peq(x, f0, gain, q=1.0):
    A = 10 ** (gain / 40)
    w = TAU * f0 / SR
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return ss.lfilter(b / a[0], a / a[0], x, axis=-1)


def shelf(x, f0, gain, high=True):
    A = 10 ** (gain / 40)
    w = TAU * f0 / SR
    cw, sA = np.cos(w), 2 * np.sqrt(A) * np.sin(w) / 2 * np.sqrt(2)
    if high:
        b = [A * ((A + 1) + (A - 1) * cw + sA), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sA)]
        a = [(A + 1) - (A - 1) * cw + sA, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sA]
    else:
        b = [A * ((A + 1) - (A - 1) * cw + sA), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sA)]
        a = [(A + 1) + (A - 1) * cw + sA, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sA]
    b, a = np.array(b), np.array(a)
    return ss.lfilter(b / a[0], a / a[0], x, axis=-1)


def resonate(x, f, tau):
    """two-pole resonator (unit-peak impulse response, decay time tau)"""
    r = np.exp(-1.0 / (tau * SR))
    w = TAU * min(f, SR * 0.45) / SR
    return ss.lfilter([np.sin(w)], [1.0, -2 * r * np.cos(w), r * r], x)


def comb(x, f, g):
    """feedback comb: a noise source sings at f and its harmonics"""
    d = max(2, int(round(SR / f)))
    a = np.zeros(d + 1)
    a[0], a[d] = 1.0, -g
    return ss.lfilter([1.0 - g], a, x)


def soften(x, width):
    """convolve with a short raised-cosine pulse: the contact time of a strike (longer = softer)"""
    w = ns(width)
    if w < 2:
        return x
    k = hann(w)
    return np.convolve(x, k / k.sum())[: len(x)]


# ============================================================================== noise, pan, space
def pink(rng, n):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1] if n > 1 else 1.0
    y = np.fft.irfft(X / np.sqrt(f), n)
    return y / (np.std(y) + 1e-12)


def pan2(x, p=0.0):
    """mono -> stereo, equal-power (p may be an array for moving sources)"""
    if np.ndim(x) == 2:
        return x
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.vstack([x * np.cos(th), x * np.sin(th)])


def widen(x, rng, amount=0.7, ms=7.0):
    """mono -> stereo with a decorrelated side; mono-compatible (L + R == 2x / sqrt(1+a^2))"""
    m = max(8, ns(ms / 1000))
    k = rng.standard_normal(m) * np.exp(-np.linspace(0, 6, m))
    s = np.convolve(x, k / np.sqrt(np.sum(k ** 2)))[: len(x)]
    a = np.asarray(amount, float)
    g = 1 / np.sqrt(1 + a ** 2)
    return np.vstack([(x + a * s) * g, (x - a * s) * g])


def shaped_noise(rng, dur, G_fn, nf=1024, hop=256):
    """noise with a time-varying magnitude spectrum G(F[bins,1], T[1,frames]) (STFT domain)"""
    n = ns(dur)
    x = rng.standard_normal(n + nf)
    f, t, Z = ss.stft(x, SR, nperseg=nf, noverlap=nf - hop)
    _, y = ss.istft(Z * G_fn(f[:, None], t[None, :]), SR, nperseg=nf, noverlap=nf - hop)
    return y[:n]


def noise_sweep(rng, dur, fc_fn, env_fn, bw=1.2, stereo=True):
    """a band of noise (bw octaves wide) moving along fc(T) with an envelope env(T)"""

    def G(F, T):
        oc = np.log2(np.maximum(F, 10.0) / fc_fn(T))
        return np.exp(-0.5 * (oc / (0.5 * bw)) ** 2) * env_fn(T)

    ch = [shaped_noise(rng, dur, G) for _ in range(2 if stereo else 1)]
    return norm(fade(np.vstack(ch) if stereo else ch[0], 0.004, 0.02))


def shape_env(shape, u):
    u = np.clip(u, 0, 1)
    if shape == "rise":
        return u ** 2.2 * np.clip((1 - u) / 0.04, 0, 1)
    if shape == "fall":
        return (1 - u) ** 1.8 * np.clip(u / 0.04, 0, 1)
    if shape == "swell":
        return np.sin(0.5 * np.pi * np.clip(u / 0.85, 0, 1)) ** 2 * np.clip((1 - u) / 0.15, 0, 1)
    return np.sin(np.pi * u) ** 2


def whoosh(rng, dur, f0, f1, shape="arch", bw=1.2, curve=1.0, stereo=True):
    return noise_sweep(rng, dur, lambda T: f0 * (f1 / f0) ** (np.clip(T / dur, 0, 1) ** curve),
                       lambda T: shape_env(shape, T / dur), bw, stereo)


class Mixer:
    """stereo buses; each event may also send to reverb buses ("rv:<space>:<group>")"""

    def __init__(self, n):
        self.n = n
        self.b = {}

    def bus(self, k):
        if k not in self.b:
            self.b[k] = np.zeros((2, self.n))
        return self.b[k]

    def add(self, sig, t, gain=1.0, pan=0.0, bus="fx", send=None):
        x = pan2(np.asarray(sig, dtype=float), pan) * gain
        i = int(round(t * SR))
        if i < 0:
            x, i = x[:, -i:], 0
        m = min(x.shape[1], self.n - i)
        if m <= 0:
            return
        self.bus(bus)[:, i: i + m] += x[:, :m]
        grp = "post" if bus == "post" else "main"
        for k, a in (send or {}).items():
            if a > 0:
                self.bus(f"rv:{k}:{grp}")[:, i: i + m] += x[:, :m] * a


# spaces: (RT60 s, pre-delay s, HF damping corner Hz, ...) - generated, decorrelated L/R
SPACES = {
    "room": dict(rt=0.30, pre=0.003, damp=5500, er=((0.0029, .55), (0.0047, .42), (0.0071, .33), (0.0098, .26), (0.0133, .2), (0.0171, .14))),
    "clinic": dict(rt=0.55, pre=0.005, damp=7500, er=((0.0041, .5), (0.0069, .4), (0.0102, .3), (0.0144, .22))),
    "corr": dict(rt=1.2, pre=0.006, damp=6000, flutter=(0.024, 14, 0.62)),
    "mid": dict(rt=1.5, pre=0.016, damp=6500),
    "hall": dict(rt=5.5, pre=0.075, damp=4200, low=1.15),
    "warm": dict(rt=3.0, pre=0.03, damp=2400, low=1.2),
}


def make_ir(name, rt, pre=0.01, damp=6000.0, low=1.0, er=(), flutter=None, build=0.015):
    rng = R("ir:" + name)
    n = ns(min(rt * 1.4 + pre, 8.0))
    t = tv(n)
    out = []
    for ch in range(2):
        z = rng.standard_normal(n)
        acc = np.zeros(n)
        for c in (63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000):
            rtc = rt * (low if c <= 125 else 1.0) / (1.0 + (c / damp) ** 1.6)
            acc += bp(z, c / np.sqrt(2), min(c * np.sqrt(2), SR * 0.46), 2) * np.exp(-6.91 * t / max(rtc, 0.04))
        acc *= 1 - np.exp(-t / build)
        acc /= np.sqrt(np.sum(acc ** 2))
        p = ns(pre * (1 + 0.06 * ch))
        acc = np.concatenate([np.zeros(p), acc])[:n]
        for d, g in er:
            j = ns(d * (1 + 0.05 * (ch - 0.5)))
            if j < n:
                acc[j] += g * 0.3 * (1 if rng.random() < 0.6 else -1)
        if flutter:
            d, kk, g = flutter
            for k in range(1, kk + 1):
                j = ns(d * k + 0.0013 * ch)
                if j < n:
                    acc[j] += 0.35 * g ** k * (-1) ** k
        out.append(lp(acc, 16000, 2))
    ir = np.vstack(out)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve_st(x, ir):
    n = x.shape[1]
    a, b = 0.8 * x[0] + 0.2 * x[1], 0.2 * x[0] + 0.8 * x[1]
    return np.vstack([ss.oaconvolve(a, ir[0])[:n], ss.oaconvolve(b, ir[1])[:n]])


# ============================================================================== dynamics & time
def compressor(x, thr, ratio, att=0.005, rel=0.08, knee=6.0, win=0.005, makeup=0.0, hop=48):
    """feed-forward, linked RMS compressor; x: (channels, n)"""
    c, n = x.shape
    m = -(-n // hop)
    p = np.zeros(m * hop)
    p[:n] = np.mean(x ** 2, axis=0)
    p = p.reshape(m, hop).mean(axis=1)
    k = max(1, int(round(win * SR / hop)))
    if k > 1:
        p = np.convolve(p, np.ones(k) / k, mode="same")
    over = 10 * np.log10(p + 1e-12) - thr
    sl = 1.0 / ratio - 1.0
    gr = np.where(over <= -knee / 2, 0.0, np.where(over >= knee / 2, sl * over, sl * (over + knee / 2) ** 2 / (2 * knee)))
    aa, ar = np.exp(-hop / (att * SR)), np.exp(-hop / (rel * SR))
    g, s = np.empty(m), 0.0
    for i in range(m):
        cf = aa if gr[i] < s else ar
        s = cf * s + (1 - cf) * gr[i]
        g[i] = s
    return x * db(np.interp(np.arange(n), np.arange(m) * hop + hop / 2, g) + makeup)


def gate_curve(keys, n):
    """piecewise-linear (dB) gain automation; <= -119 dB is exact silence"""
    keys = sorted(keys)
    d = np.interp(np.arange(n) / SR, [k[0] for k in keys], [k[1] for k in keys])
    g = db(d)
    g[d <= -119] = 0.0
    return g


def tv_lowpass(x, t0, t1, fc_fn, order=2.0, nf=2048, hop=256):
    """time-varying low-pass over [t0, t1] (STFT mask; transparent wherever fc >= 19 kHz)"""
    a, b = max(0, ns(t0)), min(x.shape[1], ns(t1))
    f, tt, Z = ss.stft(x[:, a:b], SR, nperseg=nf, noverlap=nf - hop, axis=-1)
    fc = fc_fn(t0 + tt)
    H = 1.0 / np.sqrt(1.0 + (f[:, None] / np.maximum(fc[None, :], 20.0)) ** (2 * order))
    H = np.where(fc[None, :] >= 19000, 1.0, H)
    _, y = ss.istft(Z * H[None], SR, nperseg=nf, noverlap=nf - hop, time_axis=-1, freq_axis=-2)
    x[:, a:b] = y[:, : b - a]


def warp(x, t0, dur, depth):
    """bend time inside [t0, t0+dur]: pitch sags then springs back; net zero offset (no seam)"""
    a, m = ns(t0), ns(dur)
    if a + m + 2 >= x.shape[1]:
        return
    rate = 1.0 - depth * np.sin(TAU * np.arange(m) / m)
    pos = a + np.concatenate([[0.0], np.cumsum(rate[:-1])])
    i0 = np.floor(pos).astype(int)
    fr = pos - i0
    x[:, a: a + m] = x[:, i0] * (1 - fr) + x[:, i0 + 1] * fr


def stutter(x, t, grain, reps, fi=0.0015, fo=0.003):
    """one frame repeats: the same grain played `reps` times (each faded), then time resumes"""
    a, g = ns(t), ns(grain)
    src = fade(x[:, a: a + g].copy(), fi, fo)
    k = ns(fi)
    x[:, a - k: a] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, k + 1) / k)
    for r in range(reps):
        x[:, a + r * g: a + (r + 1) * g] = src
    e, k2 = a + reps * g, ns(0.002)
    x[:, e: e + k2] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(k2) / k2)


def granular(src, n_out, pos_fn, pitch_fn, rng, grain=0.08, hop=0.02, jit_fn=None, drop_fn=None, amp_jit=0.0):
    """resynthesise a stereo source along a read-position curve (seconds) with Hann grains"""
    out = np.zeros((2, n_out))
    g = ns(grain)
    w = hann(g)
    L = src.shape[1]
    k = 0
    while True:
        to = k * hop + rng.uniform(-0.25, 0.25) * hop
        k += 1
        if ns(to) + g >= n_out:
            break
        if to < 0 or (drop_fn is not None and rng.random() < drop_fn(to)):
            continue
        p = pos_fn(to) + (rng.normal(0, jit_fn(to)) if jit_fn else 0.0)
        idx = p * SR + np.arange(g) * pitch_fn(to)
        if idx[0] < 0 or idx[-1] >= L - 1:
            continue
        i0 = idx.astype(int)
        fr = idx - i0
        gr = (src[:, i0] * (1 - fr) + src[:, i0 + 1] * fr) * w
        i = ns(to)
        out[:, i: i + g] += gr * (1 + rng.uniform(-amp_jit, amp_jit))
    return out * (2 * hop / grain)


def stretch(x, factor, pitch, rng, grain=0.07):
    """time-stretch a mono sound by `factor`, transposed by `pitch` (granular)"""
    src = np.vstack([x, x])
    n_out = ns(len(x) / SR * factor)
    return granular(src, n_out, lambda t: t / factor, lambda t: pitch, rng, grain, grain / 4,
                    jit_fn=lambda t: 0.004).mean(axis=0)


def duck(me, vo, hi_db=5.5, lo_db=3.5, xover=200.0, thr=-45.0, hold=0.16, att=0.05, rel=0.42, look=0.07):
    """two-band sidechain: the effects sit ~5 dB under the voice (lows ~3.5 dB), smooth envelopes"""
    n = me.shape[1]
    hop = 240
    m = n // hop + 1
    v = np.zeros(m * hop)
    v[:n] = np.mean(vo ** 2, axis=0)
    act = (10 * np.log10(v.reshape(m, hop).mean(axis=1) + 1e-12) > thr).astype(float)
    act = maximum_filter1d(act, size=2 * int(hold * SR / hop) + 1)
    lk = int(look * SR / hop)
    act = np.concatenate([act[lk:], np.zeros(lk)])
    aa, ar = np.exp(-hop / (att * SR)), np.exp(-hop / (rel * SR))
    sm, s = np.empty(m), 0.0
    for i in range(m):
        c = aa if act[i] > s else ar
        s = c * s + (1 - c) * act[i]
        sm[i] = s
    a = np.interp(np.arange(n), np.arange(m) * hop + hop / 2, sm)
    lo = ss.sosfiltfilt(ss.butter(2, xover / (SR / 2), "low", output="sos"), me, axis=-1)
    return lo * db(-lo_db * a) + (me - lo) * db(-hi_db * a), a


def true_peak(x):
    return 20 * np.log10(np.max(np.abs(ss.resample_poly(x, 4, 1, axis=-1))) + 1e-12)


def limiter_gain(y, ceil, look=0.0015, rel=0.12):
    """look-ahead true-peak limiter gain (4x oversampled detection, smooth attack, slow release)"""
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


# ============================================================================== instruments
def tone_grain(f, dur, att=0.004, tau=None, partials=((1, 1.0),)):
    n = ns(dur)
    t = tv(n)
    x = sum(a * np.sin(TAU * f * k * t) for k, a in partials) * np.exp(-t / (tau or dur * 0.3))
    ia = max(2, ns(att))
    x[:ia] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(ia) / ia)
    return fade(x, 0.0, min(0.02, dur * 0.2))


def glint(f, dur=0.9, tau=0.22):
    """a microscopic point of light: a tiny, very high pure tone"""
    t = tv(ns(dur))
    x = np.sin(TAU * f * t) * np.exp(-t / tau) + 0.1 * np.sin(TAU * 2 * f * t) * np.exp(-t / (tau * 0.35))
    ia = ns(0.006)
    x[:ia] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(ia) / ia)
    return fade(x, 0, 0.05)


def glide(f0, f1, dur, att=0.03):
    t = tv(ns(dur))
    x = np.sin(TAU * np.cumsum(f0 * (f1 / f0) ** (t / dur)) / SR) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return fade(x, att, 0.03)


def tpulse(f0, dur, att=0.03, decay=0.8, partials=(1.0, 0.5, 0.22, 0.1, 0.05), drop=0.025, extra=()):
    """the tonal pulse: a low, soft, pitched pressure wave (fundamental + quiet harmonics so it still
    reads on small speakers). extra: [(ratio, amp)] pure partials (warmth)."""
    n = ns(dur)
    t = tv(n)
    ph = TAU * np.cumsum(f0 * (1 + drop * np.exp(-t / 0.06))) / SR
    x = np.zeros(n)
    for k, a in enumerate(partials, 1):
        x += a * np.sin(k * ph) * np.exp(-t / (decay / (1 + 0.45 * (k - 1))))
    for r, a in extra:
        if a > 0:
            x += a * np.sin(r * ph) * np.exp(-t / (decay * 0.8))
    ia = max(2, ns(att))
    x[:ia] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(ia) / ia)
    return fade(x, 0, min(0.05, dur * 0.2))


def walk_pulse(f0=D2, decay=0.17):
    """the touch's pulse, made rhythmic: one per footfall"""
    return tpulse(f0, 0.6, att=0.004, decay=decay, partials=(1.0, 0.7, 0.36, 0.18, 0.08), drop=0.06)


def tick_grain(rng, f, dur=0.03):
    t = tv(ns(dur))
    x = np.sin(TAU * f * t) * np.exp(-t / 0.006) + 0.4 * bp(rng.standard_normal(len(t)), 3000, 12000, 2) * np.exp(-t / 0.0015)
    return fade(x, 0.0004, 0.005)


def air_grain(rng, dur, lo, hi):
    m = ns(dur)
    return bp(rng.standard_normal(m), lo, hi, 2) * hann(m) ** 1.5


def lorentz(F, fc, bw):
    return 1.0 / (1.0 + ((F - fc) / (0.5 * bw)) ** 2)


def breath(rng, ti=0.5, gap=0.06, te=0.62, ex_gain=0.55):
    """a single human breath: a soft open-mouth inhale, the turn, a shorter warm exhale.
    Returns (mono, lead): the inhale begins `lead` s into the signal (a tiny lip click precedes it)."""
    lead = 0.045
    te0 = ti + gap

    def G(F, T):
        u = np.clip(T / ti, 0, 1)
        inh = (0.95 * lorentz(F, 640 + 120 * u, 320) + 0.8 * lorentz(F, 1150 + 180 * u, 380) + 0.6 * lorentz(F, 2450, 450)
               + 0.45 * lorentz(F, 3500, 700) + 0.32 * lorentz(F, 5200, 2600) + 0.05) * np.clip(F / 450, 0, 1) ** 1.6
        a_in = np.where(T < ti, np.sin(0.5 * np.pi * np.clip(T / (0.78 * ti), 0, 1)) ** 1.7
                        * np.clip((ti - T) / (0.16 * ti), 0, 1) ** 0.8, 0.0)
        v = np.clip((T - te0) / te, 0, 1)
        exh = (1.0 * lorentz(F, 560 - 70 * v, 300) + 0.62 * lorentz(F, 1350 - 100 * v, 420) + 0.32 * lorentz(F, 2350, 520)
               + 0.16 * lorentz(F, 3400, 900) + 0.04) * np.clip(F / 300, 0, 1) ** 1.3 / (1 + (F / 4200) ** 2)
        a_ex = np.where(T >= te0, (1 - np.exp(-(T - te0) / 0.04)) * np.exp(-(T - te0) / 0.2)
                        * np.clip((te0 + te - T) / 0.12, 0, 1), 0.0)
        return inh * a_in + exh * a_ex * ex_gain

    x = shaped_noise(rng, ti + gap + te + 0.08, G)
    fl = lp(rng.standard_normal(len(x)), 18, 2)
    x *= 1 + 0.16 * fl / (np.max(np.abs(fl)) + 1e-9)  # turbulence
    x = norm(fade(hp(x, 110, 2), 0.003, 0.03))
    m = ns(0.004)
    click = norm(bp(rng.standard_normal(m), 1400, 4800, 2) * hann(m))
    out = np.zeros(ns(lead) + len(x))
    j = ns(lead - 0.028)
    out[j: j + m] += click * db(-30)
    out[ns(lead):] += x
    return out, lead


def dive(rng, d):
    """the impossible dive toward the point: air rushing past, the point's tone approaching"""
    tail = 0.45
    fc = lambda T: np.where(T <= d, 700 * (9000 / 700) ** (np.clip(T / d, 0, 1) ** 1.5), 9000 * np.exp(-(T - d) / 0.2) + 2500)
    env = lambda T: np.where(T <= d, np.clip(T / d, 0, 1) ** 2.4, 0.3 * np.exp(-(T - d) / 0.12))
    air = noise_sweep(rng, d + tail, fc, env, bw=1.6)
    n = ns(d)
    t = tv(n)
    tone = np.sin(TAU * np.cumsum(D6 * (1 + 0.08 * (t / d) ** 2)) / SR) * (t / d) ** 2
    out = air.copy()
    out[:, :n] += pan2(fade(tone, 0.01, 0.03) * 0.25)
    return out


def touch_pulse(rng, warm=0.0):
    """a fingertip touches a hand: a soft tonal pulse (felt more than heard) and a radial wave of air
    crossing the frame, falling in pitch and widening as it spreads. warm=1: the fuller return."""
    dur = 3.4 + 1.6 * warm
    n = ns(dur)
    body = tpulse(D2, dur, att=0.035 + 0.06 * warm, decay=0.95 + 0.9 * warm,
                  partials=(1.0, 0.6 + 0.15 * warm, 0.28 + 0.12 * warm, 0.12 + 0.06 * warm, 0.05),
                  extra=((1.5, 0.22 * warm), (2.5, 0.10 * warm), (6.0, 0.03 + 0.02 * warm)))
    out = pan2(norm(body))
    wd = 1.3 + 0.5 * warm
    wave = noise_sweep(rng, wd + 0.3, lambda T: 1300 * (240 / 1300) ** (np.clip(T / wd, 0, 1) ** 0.7),
                       lambda T: np.clip(T / wd / 0.05, 0, 1) ** 2 * np.exp(-T / wd * 3.2), bw=1.6, stereo=False)
    wave = widen(norm(wave), rng, np.clip(tv(len(wave)) / 0.6, 0, 1))
    out[:, : wave.shape[1]] += wave * (0.22 + 0.1 * warm)
    m = ns(0.03)
    tap = lp(rng.standard_normal(m), 2200, 2) * np.exp(-tv(m) / 0.004)
    out[:, :m] += pan2(fade(norm(tap), 0.0005, 0.005) * 0.06 * (1 - 0.5 * warm))
    return out


def ring(modes, n, pitch=1.0, rng=None, var=0.0, tscale=1.0):
    """sum of damped modes [(Hz, tau s, amp)]"""
    t = tv(n)
    x = np.zeros(n)
    for f, tau, a in modes:
        ff = f * pitch * (1 + (rng.uniform(-var, var) if rng is not None and var else 0.0))
        if ff < SR * 0.45:
            x += a * np.exp(-t / (tau * tscale)) * np.sin(TAU * ff * t)
    return x


def creak(rng, dur, f0=70, f1=140, modes=((290, .010, 1.0), (640, .008, .7), (1180, .006, .5), (2150, .004, .3))):
    """wood (or leather) under load: an irregular, gliding stick-slip pulse train through resonances"""
    n = ns(dur)
    imp = np.zeros(n)
    t = 0.0
    while t < dur:
        t += 1 / (f0 + (f1 - f0) * t / dur) * rng.uniform(0.75, 1.25)
        if ns(t) < n:
            imp[ns(t)] = rng.uniform(0.5, 1.0)
    y = sum(a * resonate(imp, f * rng.uniform(0.95, 1.05), tau) for f, tau, a in modes)
    return fade(y * np.sin(np.pi * np.clip(tv(n) / dur, 0, 1)) ** 0.8, 0.002, 0.02)


SURF = {  # floor modes (Hz, tau, amp), body thump (Hz, tau), contact click band (lo, hi, tau), grit
    "tile": dict(m=((290, .020, .45), (760, .013, .55), (1430, .009, .45), (2380, .006, .35), (3900, .004, .22)), b=(84, .040), c=(2500, 10000, .0022), g=0.0),
    "wood": dict(m=((128, .050, .70), (214, .038, .60), (395, .026, .45), (660, .018, .32), (1150, .011, .22), (2050, .006, .12)), b=(72, .055), c=(1800, 8000, .0028), g=0.0),
    "stone": dict(m=((410, .015, .45), (1020, .010, .42), (1880, .007, .32), (3150, .005, .22), (5200, .003, .12)), b=(66, .048), c=(2800, 11000, .0019), g=0.1),
    "stair": dict(m=((92, .085, .75), (171, .060, .60), (318, .042, .45), (545, .030, .30), (930, .020, .18)), b=(58, .075), c=(1600, 7000, .0030), g=0.04),
    "vinyl": dict(m=((240, .016, .40), (600, .011, .35), (1250, .007, .22)), b=(80, .038), c=(1900, 6500, .0034), g=0.0),
    "asphalt": dict(m=((360, .012, .35), (880, .008, .28), (1700, .005, .18)), b=(70, .045), c=(2200, 9000, .0020), g=0.55),
    "rug": dict(m=((170, .022, .35), (420, .010, .15)), b=(76, .050), c=(900, 2600, .0060), g=0.0),
    "path": dict(m=((300, .014, .35), (760, .009, .25), (1500, .006, .15)), b=(70, .050), c=(1800, 7000, .0026), g=0.3),
    "wet": dict(m=((330, .012, .30), (820, .008, .22)), b=(72, .045), c=(1500, 6000, .0030), g=0.0),
    "soft": dict(m=((150, .030, .40), (360, .015, .20)), b=(70, .060), c=(1000, 3500, .0050), g=0.0),
}


def footstep(rng, surf="wood", weight=0.6, hard=0.5, roll=0.075, toe=0.5, scuff=0.12, drag=0.0, pitch=1.0,
             cloth=0.0, creak_=0.0, decay=1.0, splash=0.0, payal=0.0, grit=None):
    """one footfall: heel strike -> roll -> ball of the foot, on a surface. Returns (sig, pre): the heel
    contact sits `pre` s into sig (cloth / a dragging toe come before it), so place it at t - pre."""
    S = SURF[surf]
    pre = 0.006
    if cloth > 0:
        pre = max(pre, 0.32)
    if drag > 0:
        pre = max(pre, 0.26)
    n = ns(pre + roll + 0.55)
    out = np.zeros(n)
    h0 = ns(pre)

    def put(sig, i):
        if 0 <= i < n:
            j = min(len(sig), n - i)
            out[i: i + j] += sig[:j]

    def contact(amp, soft, fsc, wgt):
        m = ns(0.45)
        t = tv(m)
        rg = ring(S["m"], m, pitch * fsc, rng, 0.05, decay * (0.8 + 0.4 * wgt))
        fb, tb = S["b"]
        fb *= pitch * rng.uniform(0.95, 1.05)
        body = np.sin(TAU * np.cumsum(fb * (1 + 0.9 * np.exp(-t / 0.005))) / SR)
        body *= np.exp(-t / (tb * decay * (0.7 + 0.6 * wgt))) * (1 - np.exp(-t / 0.0015))
        th = lp(rng.standard_normal(m), 240, 2) * np.exp(-t / 0.016)
        x = soften(rg * 0.55 + body * (0.3 + 0.9 * wgt) + th * (0.15 + 0.3 * wgt), 0.0005 + 0.0045 * soft)
        lo, hi, ct = S["c"]
        return (x + bp(rng.standard_normal(m), lo, hi, 2) * np.exp(-t / ct) * (0.1 + 0.55 * hard) * (1 - 0.7 * soft)) * amp

    put(contact(1.0, 1 - hard, 1.0, weight), h0)
    t_toe = h0 + ns(roll * rng.uniform(0.92, 1.08))
    if toe > 0:
        put(contact(toe * rng.uniform(0.85, 1.1), min(1.0, 1.25 - hard), 1.12, weight * 0.6), t_toe)
    lo, hi, _ = S["c"]
    if scuff > 0:  # the sole sliding through the roll
        m = ns(roll + 0.05)
        put(bp(rng.standard_normal(m), lo * 0.5, hi * 0.6, 2) * np.sin(np.pi * np.arange(m) / m) ** 2 * scuff * 0.22, h0 + ns(0.004))
    if drag > 0:  # the painful leg does not lift: the toe scrapes forward before the contact
        m = ns(0.08 + 0.17 * drag)
        t = tv(m)
        am = 0.65 + 0.35 * np.abs(np.sin(TAU * rng.uniform(18, 30) * t + rng.uniform(0, 3)))
        e = np.sin(0.5 * np.pi * np.clip(t / (0.7 * t[-1]), 0, 1)) ** 2 * np.clip((t[-1] - t) / (0.3 * t[-1]), 0, 1)
        put(bp(rng.standard_normal(m), 600, 4200, 2) * am * e * drag * 0.32, h0 - m + ns(0.01))
    g = S["g"] if grit is None else grit
    if g > 0:  # grit under the sole
        for c0 in (h0, t_toe):
            for _ in range(int(g * rng.uniform(10, 22))):
                m = ns(rng.uniform(0.0004, 0.0014))
                put(bp(rng.standard_normal(m + 16), 3000, 12000, 2)[16:] * hann(m) * rng.exponential(0.25), c0 + ns(rng.uniform(0, 0.035)))
    if splash > 0:  # wet ground
        m = ns(0.12)
        t = tv(m)
        put(bp(rng.standard_normal(m), 400, 3500, 2) * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.035) * 0.45 * splash, h0)
        for _ in range(14):
            f0 = np.exp(rng.uniform(np.log(1200), np.log(3800)))
            mm = ns(rng.uniform(0.005, 0.012))
            t2 = tv(mm)
            d = np.sin(TAU * np.cumsum(f0 * (1 + 0.7 * t2 / t2[-1])) / SR) * np.exp(-t2 / (t2[-1] * 0.35))
            put(fade(d, 0.0004, 0.002) * rng.uniform(0.05, 0.25) * splash, h0 + ns(rng.uniform(0.01, 0.16)))
    if payal > 0:  # anklet bells
        for _ in range(int(7 * payal)):
            m = ns(0.06)
            t = tv(m)
            f = rng.uniform(4800, 7800)
            jn = (np.sin(TAU * f * t) + 0.5 * np.sin(TAU * f * 1.48 * t)) * np.exp(-t / rng.uniform(0.01, 0.025))
            put(fade(jn, 0.0003, 0.01) * rng.uniform(0.04, 0.12) * payal, h0 + ns(rng.uniform(0.0, 0.07)))
    if cloth > 0:  # the leg swinging through fabric before the footfall
        m = ns(0.3)
        put(bp(rng.standard_normal(m), 350, 3800, 2) * np.sin(np.pi * np.arange(m) / m) ** 2 * cloth * 0.1, h0 - ns(0.27))
    if creak_ > 0:  # leather flexing as the weight rolls over
        put(creak(rng, 0.045, 260, 420, ((1150, .006, 1.0), (2300, .004, .5))) * creak_ * 0.1, t_toe + ns(0.025))
    return norm(fade(hp(out, 35, 2), 0.001, 0.05)), pre


TICK = ((2240, .020, .55), (3610, .014, .45), (5030, .009, .32), (6880, .006, .2), (910, .025, .22))
TOCK = ((1520, .028, .55), (2470, .018, .4), (3460, .012, .28), (640, .035, .3))
CASE = ((148, .06, .45), (231, .045, .35), (395, .03, .25))


def clock_tick(rng, tock=False, pitch=1.0, size=1.0, bright=1.0):
    """a giant clock's escapement: metal tick (or tock), a wooden case, a few ratchet micro-grains"""
    m = ns(0.18)
    t = tv(m)
    x = soften(ring(TOCK if tock else TICK, m, pitch, rng, 0.03) * 0.6, 0.0004)
    x += ring(CASE, m, pitch, rng, 0.05) * 0.5 * size
    x += bp(rng.standard_normal(m), 2800, 11000, 2) * np.exp(-t / 0.0012) * 0.35 * bright
    for _ in range(rng.integers(2, 5)):
        i, k = ns(rng.uniform(0.003, 0.022)), ns(0.0006)
        x[i: i + k] += bp(rng.standard_normal(k + 8), 4000, 12000, 2)[8:] * hann(k) * rng.uniform(0.1, 0.3)
    return fade(norm(x), 0.0003, 0.02)


def gong(f0, dur, soft=0.006):
    """the giant clock body: a soft, low, inharmonic strike"""
    t = tv(ns(dur))
    x = sum(a * np.sin(TAU * f0 * r * t) * np.exp(-t / (dur * 0.3 * d))
            for r, d, a in ((1.0, 1.0, 1.0), (2.0, 0.6, 0.45), (2.76, 0.45, 0.35), (3.9, 0.3, 0.2), (5.4, 0.2, 0.12)))
    return fade(norm(soften(x, soft) * np.clip(t / 0.01, 0, 1)), 0.002, 0.2)


def bell(f, dur, ratios=(1.0, 2.0, 2.74, 3.9, 5.4), decays=(1.0, 0.7, 0.45, 0.3, 0.2), amps=(1.0, 0.5, 0.45, 0.3, 0.2), tau=0.5):
    t = tv(ns(dur))
    x = sum(a * np.sin(TAU * f * r * t) * np.exp(-t / (tau * d)) for r, d, a in zip(ratios, decays, amps) if f * r < SR * 0.45)
    return fade(x, 0.0008, 0.03)


def zipper(rng, dur):
    n = ns(dur)
    out = np.zeros(n)
    t = 0.0
    while True:
        t += 1 / (160 + 300 * t / dur) * rng.uniform(0.7, 1.3)
        i, m = ns(t), ns(0.0012)
        if i + m >= n:
            break
        out[i: i + m] += bp(rng.standard_normal(m + 8), 2500, 9000, 2)[8:] * hann(m) * rng.uniform(0.5, 1)
    return out


def crackle(rng, dur, count):
    """red particles: a few compressed micro-clicks"""
    n = ns(dur)
    out = np.zeros(n)
    for _ in range(count):
        i, m = ns(rng.uniform(0, dur * 0.7)), ns(rng.uniform(0.0005, 0.003))
        out[i: i + m] += bp(rng.standard_normal(m + 16), 1500, 9000, 2)[16:] * hann(m) * rng.uniform(0.3, 1) * rng.choice((-1, 1))
    return fade(np.tanh(norm(out) * 3), 0.0005, 0.005)


def particle_spray(rng, dur=0.3, count=40, lo=3500, hi=12000, decay=0.08):
    """a footfall made of particles: tiny glints scattering"""
    n = ns(dur)
    out = np.zeros((2, n))
    for _ in range(count):
        t0 = rng.exponential(decay)
        if t0 > dur - 0.01:
            continue
        f = np.exp(rng.uniform(np.log(lo), np.log(hi)))
        m = ns(rng.uniform(0.002, 0.007))
        g = np.sin(TAU * f * tv(m)) * hann(m) * rng.uniform(0.3, 1.0) * np.exp(-t0 / decay)
        i = ns(t0)
        out[:, i: i + m] += pan2(g, rng.uniform(-0.9, 0.9))[:, : n - i]
    return out


def assemble(rng, dur, f_lo=2500, f_hi=9000, peak=260):
    """particles rebuilding something: grains converge (density rises, the image narrows), settle"""
    n = ns(dur)
    out = np.zeros((2, n))
    tc = 0.0
    while True:
        tc += rng.exponential(1 / (15 + peak * np.sin(np.pi * min(tc / dur, 1)) ** 1.5))
        if tc > dur - 0.01:
            break
        u = tc / dur
        m = ns(rng.uniform(0.002, 0.008))
        f = np.exp(rng.uniform(np.log(f_lo), np.log(f_hi))) * (1.3 - 0.4 * u)
        g = np.sin(TAU * f * tv(m)) * hann(m) * rng.uniform(0.15, 0.6)
        sp = 1 - 0.75 * u
        i = ns(tc)
        out[:, i: i + m] += pan2(g, rng.uniform(-sp, sp))[:, : n - i]
    return out


def drone(rng, parts, dur, att=1.0, rel=1.0, width=0.6):
    """pure sustained partials [(Hz, amp)], each breathing slowly; width = a static L/R phase offset"""
    n = ns(dur)
    t = tv(n)
    out = np.zeros((2, n))
    for f, a in parts:
        ph0, dph = rng.uniform(0, TAU), width * 0.9
        sw = 0.85 + 0.15 * np.sin(TAU * rng.uniform(0.07, 0.16) * t + rng.uniform(0, TAU))
        for c in range(2):
            out[c] += a * sw * (np.sin(TAU * f * t + ph0 + c * dph) + 0.25 * np.sin(TAU * (f + 0.13) * t + ph0 + c * dph + 1))
    return fade(out * (np.clip(t / att, 0, 1) ** 2 * np.clip((dur - t) / rel, 0, 1) ** 1.5), 0.01, 0.05)


def air_bed(rng, dur, lo=120, hi=4200, fi=0.8, fo=0.8, breathe=0.2):
    n = ns(dur)
    t = tv(n)
    x = np.vstack([lp(hp(pink(rng, n), lo, 2), hi, 2) for _ in range(2)])
    x /= np.max(np.abs(x))
    br = 1 - breathe + breathe * np.sin(TAU * 0.17 * t - 1.0)
    return x * br * np.clip(t / fi, 0, 1) ** 2 * np.clip((dur - t) / fo, 0, 1) ** 1.5


# ---------------------------------------------------------------- the nine worlds (one footfall each)
def snap_school(rng):  # a brass bell struck twice, far down a corridor
    n = ns(0.6)
    out = np.zeros(n)
    for dt, g in ((0.02, 1.0), (0.15, 0.75)):
        b = bell(A5 * rng.uniform(0.997, 1.003), 0.45, tau=0.28)
        out[ns(dt): ns(dt) + len(b)] += b[: n - ns(dt)] * g
    return fade(norm(lp(out, 4500, 2)), 0.001, 0.08), -0.35, -33, {"corr": 0.8}


def snap_street(rng):  # Mumbai traffic air passing by; one horn, far away
    dur = 0.6
    n = ns(dur)
    t = tv(n)
    e = np.clip(t / 0.12, 0, 1) ** 1.5 * np.clip((dur - t) / 0.3, 0, 1)
    pan = -0.6 + 1.2 * t / dur
    w1, w2 = (norm(lp(hp(pink(rng, n), 70, 2), 1500, 2)) for _ in range(2))
    out = pan2(w1 * e, pan) * 0.85 + pan2(w2 * e, -0.5 * pan) * 0.3
    m = ns(0.14)
    ph = TAU * 415 * tv(m)
    horn = lp(bp(sum(np.sin(k * ph) / k for k in (1, 3, 5, 7, 9)), 300, 2600, 2), 1800, 2) * hann(m) ** 0.5
    out[:, ns(0.17): ns(0.17) + m] += pan2(norm(horn) * 0.18, 0.45)
    return fade(out, 0.01, 0.06), 0.0, -31, {"mid": 0.35}


def snap_kitchen(rng):  # pressure-cooker steam (a short hiss with its whistle) + a steel tumbler's ting
    dur = 0.5
    n = ns(dur)
    t = tv(n)
    hiss = norm(bp(rng.standard_normal(n), 2500, 11000, 2))
    wh = norm(resonate(rng.standard_normal(n), 2950, 0.02))
    x = (hiss * 0.8 + wh * 0.35) * np.clip(t / 0.05, 0, 1) * np.clip((0.4 - t) / 0.12, 0, 1)
    ting = norm(bell(3350, 0.35, ratios=(1, 1.52, 2.31, 2.98), decays=(1, .6, .4, .3), amps=(1, .5, .35, .2), tau=0.12))
    x[ns(0.07): ns(0.07) + len(ting)] += ting[: n - ns(0.07)] * 0.3
    return fade(norm(x), 0.005, 0.05), 0.3, -34, {"room": 0.4}


def snap_hospital(rng):  # a soft monitor beep
    m = ns(0.11)
    x = fade(np.sin(TAU * A5 * tv(m)) + 0.04 * np.sin(TAU * 3 * A5 * tv(m)), 0.008, 0.012)
    out = np.zeros(ns(0.5))
    out[ns(0.03): ns(0.03) + m] += x
    return norm(out), 0.25, -36, {"room": 0.35, "mid": 0.15}


def snap_wedding(rng):  # a shehnai-like reed colour: a grace note leaning into D5, a slow vibrato
    dur = 0.5
    n = ns(dur)
    t = tv(n)
    f = D5 * (9 / 8 + (1 - 9 / 8) * np.clip(t / 0.08, 0, 1) ** 0.5)
    f = f * (1 + 0.008 * np.sin(TAU * 5.5 * t) * np.clip((t - 0.12) / 0.1, 0, 1))
    ph = TAU * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k ** 0.85 * (1.35 if k % 2 else 1.0) for k in range(1, 16) if D5 * k * 1.13 < SR * 0.45)
    x = lp(peq(peq(hp(x, 450, 2), 1350, 7, 1.3), 2900, 6, 1.6), 6500, 2)
    x = norm(x) + bp(rng.standard_normal(n), 1500, 5000, 2) * 0.03
    return fade(norm(x * np.clip(t / 0.03, 0, 1) * np.clip((dur - t) / 0.18, 0, 1)), 0.004, 0.03), -0.3, -37, {"mid": 0.55}


def snap_bedroom(rng):  # a lullaby-ish music box: three soft tines
    n = ns(0.55)
    out = np.zeros(n)
    for j, (f, dt) in enumerate(((FS5 * 2, 0.0), (D6, 0.13), (A5, 0.26))):
        m = ns(0.5)
        t = tv(m)
        x = (np.sin(TAU * f * t) + 0.12 * np.sin(TAU * f * 2.0 * t) * np.exp(-t / 0.05)
             + 0.05 * np.sin(TAU * f * 5.4 * t) * np.exp(-t / 0.02)) * np.exp(-t / 0.22)
        i = ns(dt + 0.01)
        out[i: i + m] += fade(x, 0.0015, 0.03)[: n - i] * (1.0 - 0.15 * j)
    return fade(norm(out), 0.001, 0.05), 0.35, -37, {"warm": 0.4}


def snap_airport(rng):  # the terminal chime: three soft bars in a vast hall
    n = ns(0.6)
    out = np.zeros(n)
    for f, dt in ((A5, 0.0), (FS5, 0.15), (D5, 0.30)):
        m = ns(0.55)
        t = tv(m)
        x = (np.sin(TAU * f * t) + 0.18 * np.sin(TAU * 4 * f * t) * np.exp(-t / 0.08)) * np.exp(-t / 0.5)
        i = ns(dt + 0.01)
        out[i: i + m] += fade(x, 0.003, 0.03)[: n - i]
    return fade(norm(out), 0.002, 0.06), -0.2, -38, {"hall": 0.6}


def snap_rain(rng):  # a passing shower: droplets on a wash
    dur = 0.55
    n = ns(dur)
    t = tv(n)
    wash = np.vstack([bp(rng.standard_normal(n), 900, 9000, 2) for _ in range(2)])
    out = wash / np.max(np.abs(wash)) * np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.25, 0, 1) * 0.45
    for _ in range(110):
        t0 = rng.uniform(0, dur - 0.03)
        f0 = np.exp(rng.uniform(np.log(1300), np.log(4200)))
        m = ns(rng.uniform(0.004, 0.012))
        tt = tv(m)
        d = np.sin(TAU * np.cumsum(f0 * (1 + 0.6 * tt / tt[-1])) / SR) * np.exp(-tt / (tt[-1] * 0.35))
        d = fade(d, 0.0004, 0.002) * rng.uniform(0.2, 1.0) * np.clip(t0 / 0.08, 0.2, 1) * np.clip((dur - t0) / 0.2, 0.1, 1)
        i = ns(t0)
        out[:, i: i + m] += pan2(d, rng.uniform(-0.9, 0.9))[:, : n - i]
    return fade(norm(out), 0.005, 0.05), 0.0, -32, {"mid": 0.3}


def snap_stairs(rng):  # a stair tread creaking under her weight
    c = creak(rng, 0.3, 60, 130)
    out = np.zeros(ns(0.5))
    out[ns(0.06): ns(0.06) + len(c)] += c
    return norm(out), 0.2, -33, {"room": 0.3, "mid": 0.2}


WORLDS = {  # world -> (floor, footstep options, footstep sends, snapshot)
    "school": ("tile", dict(hard=0.75), {"corr": 0.35}, snap_school),
    "street": ("asphalt", dict(hard=0.6), {"mid": 0.1}, snap_street),
    "kitchen": ("stone", dict(hard=0.6), {"room": 0.3}, snap_kitchen),
    "hospital": ("vinyl", dict(hard=0.5), {"room": 0.3, "mid": 0.1}, snap_hospital),
    "wedding": ("rug", dict(hard=0.3, payal=1.0), {"mid": 0.15}, snap_wedding),
    "bedroom": ("wood", dict(hard=0.35), {"room": 0.25}, snap_bedroom),
    "airport": ("stone", dict(hard=0.7), {"hall": 0.35}, snap_airport),
    "rain": ("wet", dict(hard=0.5, splash=1.0), {"mid": 0.15}, snap_rain),
    "stairs": ("stair", dict(hard=0.5, roll=0.04), {"room": 0.2, "mid": 0.15}, snap_stairs),
}


def world(name):
    return WORLDS.get(name, ("wood", {}, {"room": 0.2}, None))


# ---------------------------------------------------------------- textures
def tunnel_bed(rng, dur):
    """inside the green line: a tube of air that sings softly in D"""
    n = ns(dur)
    t = tv(n)
    x = np.vstack([norm(lp(hp(comb(pink(rng, n), f, 0.95), 120, 2), 2600, 2)) for f in (D3, D3 * 1.0035)])
    return fade(x * (0.8 + 0.2 * np.sin(TAU * 0.9 * t + 1.0)) * np.clip(t / 0.3, 0, 1) ** 2 * np.clip((dur - t) / 0.4, 0, 1), 0.01, 0.05)


def comb_air(rng, dur, f):
    n = ns(dur)
    x = norm(lp(hp(comb(pink(rng, n), f, 0.9), 150, 2), 2500, 2))
    return fade(x * np.sin(np.pi * np.clip(tv(n) / dur, 0, 1)) ** 2, 0.01, 0.03)


def frag_flash(rng, k):
    """a memory fragment flashing for a few frames: a bright flare of air + a micro snapshot"""
    n = ns(0.3)
    out = np.zeros((2, n))
    out[:, : ns(0.05)] += pan2(norm(air_grain(rng, 0.05, 4000, 13000)) * 0.35)
    kind = k % 7
    if kind == 0:  # a school shoe: a small heel click
        s, pre = footstep(rng, "tile", weight=0.3, hard=0.9, roll=0.05, toe=0.35, scuff=0.0)
        s = s[ns(pre):]
    elif kind == 1:  # a staircase: a wooden knock and a creak grain
        s, pre = footstep(rng, "stair", weight=0.4, hard=0.5, roll=0.03, toe=0.2, scuff=0.0)
        s = s[ns(pre):]
        c = creak(rng, 0.12)
        s[ns(0.03): ns(0.03) + len(c)] += norm(c) * 0.4
    elif kind == 2:  # a schoolbag: a short zip
        s = zipper(rng, 0.09)
    elif kind == 3:  # a bicycle: a tiny bell
        s = bell(2093.0, 0.28, ratios=(1, 2.43, 3.95, 5.6), decays=(1, .5, .3, .2), amps=(1, .4, .25, .1), tau=0.15)
    elif kind == 4:  # a child's hand: a small soft pat
        m = ns(0.06)
        t = tv(m)
        s = fade(lp(rng.standard_normal(m), 1200, 2) * np.exp(-t / 0.008) + 0.5 * np.sin(TAU * 180 * t) * np.exp(-t / 0.012), 0.0005, 0.01)
    elif kind == 5:  # a mother's hand: a soft warm tone
        s = tone_grain(D4, 0.25, att=0.012, tau=0.1, partials=((1, 1.0), (2, 0.3)))
    else:  # the line itself
        s = tone_grain(D5, 0.22, att=0.006, tau=0.08)
    s = norm(s)[: n - ns(0.01)]
    out[:, ns(0.01): ns(0.01) + len(s)] += pan2(s * 0.8, rng.uniform(-0.3, 0.3))
    return fade(out, 0.001, 0.05)


def motion_bed(rng, dur, steps_rel):
    """the air of a body in motion: swells between footfalls, brightens as the walk builds"""
    n = ns(dur)
    t = tv(n)
    x = np.vstack([bp(pink(rng, n), 500, 6000, 2) for _ in range(2)])
    x /= np.max(np.abs(x))
    u = t / dur
    x = lp(x, 1500, 2) * (1 - u) + x * u
    sr = np.asarray(steps_rel, float)
    ph = np.interp(t, sr, np.arange(len(sr))) % 1.0 if len(sr) > 1 else np.zeros(n)
    stride = 0.6 + 0.4 * np.sin(np.pi * ph) ** 2
    return x * stride * (0.25 + 0.75 * u ** 1.3) * np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 0.5, 0, 1)


def vast_air(rng, dur):
    n = ns(dur)
    t = tv(n)
    x = np.vstack([lp(hp(pink(rng, n), 40, 2), 500, 2) for _ in range(2)])
    x /= np.max(np.abs(x))
    return x * (0.7 + 0.3 * np.sin(TAU * 0.25 * t)) * np.clip(t / 0.8, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)


def groan(rng, dur, sev):
    """the architecture bending around a red particle: a low structural moan and a creak"""
    n = ns(dur)
    t = tv(n)
    f = 62 * (0.72 + 0.28 * np.exp(-t / 0.25)) * (1 + 0.02 * np.sin(TAU * 3.1 * t))
    y = lp(np.tanh(2.2 * np.sin(TAU * np.cumsum(f) / SR)) * 0.6, 900, 2) * (1 - np.exp(-t / 0.05)) * np.exp(-t / (0.35 + 0.15 * sev))
    c = creak(rng, min(dur, 0.45), 40, 85, ((180, .02, 1.0), (410, .015, .7), (760, .01, .4)))
    y[: len(c)] += norm(c) * 0.3 * sev
    return fade(norm(y), 0.004, 0.05)


def inner(rng, dur):
    """inside the knee: muffled pressure"""
    n = ns(dur)
    t = tv(n)
    x = norm(lp(pink(rng, n), 180, 2)) * (0.8 + 0.2 * np.sin(TAU * 1.3 * t))
    return fade(x * np.clip(t / 0.3, 0, 1) * np.clip((dur - t) / 0.5, 0, 1), 0.01, 0.05)


def walk_source(P, nsteps):
    """the steady walk rhythm (pulse, offbeat air, sixteenth ticks) as a buffer: the material that
    the slowed-down replay stretches"""
    m = Mixer(ns(P * nsteps + 1.0))
    r = R("walk-source")
    for k in range(nsteps):
        t = k * P
        m.add(walk_pulse(), t, db(-26), 0.0, "x")
        m.add(air_grain(r, 0.05, 3500, 10000), t + P / 2, db(-33), 0.3 if k % 2 else -0.3, "x")
        for j, acc in enumerate((1.0, 0.45, 0.7, 0.45)):
            m.add(tick_grain(r, D6 if j % 2 == 0 else A5 * 2), t + j * P / 4, db(-37) * acc, 0.25 * (-1) ** j, "x")
    return m.b["x"]


def grind(rng, dur, sev):
    """bone-on-bone friction: clustered stick-slip events through bone/cartilage resonances, a scrape
    riding on their density, then crushed (sample-and-hold) and saturated: granular, compressed"""
    n = ns(dur)
    t = tv(n)
    banks = (((380, .004), (980, .003), (1650, .002)), ((520, .0035), (1250, .0025), (2300, .0018)),
             ((700, .003), (1700, .0022), (3200, .0015)), ((950, .0025), (2400, .0018), (4300, .0012)))
    imp = np.zeros((len(banks), n))
    rate, tc = 140 + 700 * sev, 0.0
    while True:
        tc += rng.exponential(1 / rate) * (0.25 if rng.random() < 0.4 else 1.0)
        i = ns(tc)
        if i >= n:
            break
        if rng.random() > np.sin(np.pi * min(1.0, tc / dur)) ** 0.5:
            continue
        imp[rng.integers(len(banks)), i] += (rng.pareto(2.0) + 0.3) * rng.choice((-1, 1))
    y = sum(resonate(imp[b], f * rng.uniform(0.93, 1.07), tau * (1 + sev)) for b, bank in enumerate(banks) for f, tau in bank)
    dens = lp(np.abs(imp).sum(axis=0), 30, 2)
    scrape = bp(rng.standard_normal(n), 900, 6500, 2) * dens / (np.max(dens) + 1e-9)
    x = norm(y) + norm(scrape) * (0.35 + 0.3 * sev)
    k = 2 + int(round(2 * sev))
    x = lp(np.repeat(x[::k], k)[:n], 9500, 2)
    x = np.tanh(norm(x) * (1.6 + 3.0 * sev))
    return fade(norm(x * np.clip(t / 0.03, 0, 1) * np.clip((dur - t) / 0.08, 0, 1)), 0.002, 0.01)


def line_fragments(rng, dur, sev):
    """the green line scraped into fragments: chopped grains of the pure line tone, detuning as it worsens"""
    n = ns(dur)
    out = np.zeros((2, n))
    tc = 0.0
    while True:
        tc += rng.exponential(0.035 + 0.03 * (1 - sev))
        if tc > dur - 0.07:
            break
        m = ns(rng.uniform(0.012, 0.055))
        f = D5 * 2 ** (rng.normal(0, 0.15 + 0.6 * sev) / 12)
        g = np.sin(TAU * f * tv(m) + rng.uniform(0, TAU)) * hann(m) * (1 - tc / dur) ** 1.5
        i = ns(tc)
        out[:, i: i + m] += pan2(g, rng.uniform(-0.5, 0.5))[:, : n - i]
    return out


def approach(rng, dur):
    """two surfaces closing in: pressure building; red energy accumulating (a thin, rough shimmer)"""
    p = noise_sweep(rng, dur, lambda T: 220 * (1100 / 220) ** np.clip(T / dur, 0, 1), lambda T: np.clip(T / dur, 0, 1) ** 2.5, bw=1.4)
    t = tv(p.shape[1])
    sh = sum(np.sin(TAU * f * t + rng.uniform(0, TAU)) for f in (2793, 2960, 3136)) * (t / dur) ** 3
    return p * 0.8 + pan2(fade(sh, 0.01, 0.005) * 0.05)


def joint_bed(rng, dur):
    """inside the joint: a pressurised low throb (D against E-flat, beating), close and narrow"""
    n = ns(dur)
    t = tv(n)
    x = np.tanh(1.8 * (np.sin(TAU * D2 * t) + 0.8 * np.sin(TAU * D2 * 16 / 15 * t + 1.0))) * 0.6
    x += norm(lp(rng.standard_normal(n), 160, 2)) * 0.35 + norm(bp(rng.standard_normal(n), 300, 900, 2)) * 0.06
    return fade(x * np.clip(t / 0.5, 0, 1) * (0.55 + 0.45 * t / dur), 0.05, 0.02)


def thud(rng):
    """a sentence hitting an invisible wall: dull, dead, no room"""
    t = tv(ns(0.16))
    body = np.sin(TAU * np.cumsum(62 * (1 + 0.8 * np.exp(-t / 0.006))) / SR) * np.exp(-t / 0.035)
    x = (body + 0.35 * lp(rng.standard_normal(len(t)), 900, 2) * np.exp(-t / 0.01)) * (1 - np.exp(-t / 0.001))
    return fade(norm(x), 0.0005, 0.02)


def crunch(rng):
    """HURT: one short, compressed granular crunch"""
    g = grind(rng, 0.17, 1.0)
    t = tv(len(g))
    press = np.sin(TAU * np.cumsum(55 * (1 + 0.5 * np.exp(-t / 0.01))) / SR) * np.exp(-t / 0.05)
    return fade(norm(np.tanh(norm(g + 0.4 * press) * 2.5)), 0.001, 0.025)


def explode_air(rng, dur=1.8):
    """the joint bursts into millions of particles: airy and soft, a release - not an explosion"""
    n = ns(dur)
    air = noise_sweep(rng, dur, lambda T: 7000 * (2600 / 7000) ** np.clip(T / dur, 0, 1),
                      lambda T: np.clip(T / 0.03, 0, 1) ** 1.5 * np.exp(-T / 0.42), bw=2.2)
    out = air * 0.5
    tc = 0.0
    while True:
        tc += rng.exponential(1 / (2600 * np.exp(-tc / 0.32) + 20))
        if tc > dur - 0.02:
            break
        m = ns(rng.uniform(0.0015, 0.005))
        f = np.exp(rng.uniform(np.log(4500), np.log(15000)))
        g = np.sin(TAU * f * tv(m)) * hann(m) * rng.uniform(0.1, 0.45) * np.exp(-tc / 0.6)
        sp = min(1.0, 0.2 + tc / 0.5)
        i = ns(tc)
        out[:, i: i + m] += pan2(g, rng.uniform(-sp, sp))[:, : n - i]
    return fade(out, 0.002, 0.1)


def room_tone(rng, dur):
    """a quiet examination room: ventilation air and the faintest mains hum"""
    n = ns(dur)
    t = tv(n)
    hum = 0.05 * np.sin(TAU * 100 * t) + 0.025 * np.sin(TAU * 200 * t + 0.5) + 0.01 * np.sin(TAU * 300 * t)
    x = np.vstack([lp(hp(pink(rng, n), 90, 2), 3200, 2) + hum for _ in range(2)])
    return x / np.max(np.abs(x))


def memory_palette():
    """mono fragments of everything she lived through, for the memory flashes"""
    pal = [mono(f(R("pal-" + f.__name__))[0]) for f in
           (snap_school, snap_kitchen, snap_hospital, snap_wedding, snap_bedroom, snap_airport, snap_rain, snap_stairs, snap_street)]
    for k, s in enumerate(("tile", "wood", "stone", "path")):
        pal.append(footstep(R(f"pal-step{k}"), s, weight=0.5)[0])
    pal += [clock_tick(R("pal-tick")), walk_pulse() * 0.5, zipper(R("pal-zip"), 0.1),
            bell(2093.0, 0.3, ratios=(1, 2.43, 3.95), decays=(1, .5, .3), amps=(1, .4, .25), tau=0.15)]
    return [norm(p) for p in pal]


def memory_cloud(rng, dur, pal, peak=170):
    """hundreds of tiny memory flashes: 20-70 ms grains of her whole life, scattered across the image"""
    n = ns(dur)
    out = np.zeros((2, n))
    tc = 0.0
    while True:
        tc += rng.exponential(1 / (25 + peak * np.sin(np.pi * min(1.0, tc / dur)) ** 1.2))
        if tc > dur - 0.08:
            break
        src = pal[rng.integers(len(pal))]
        g = ns(rng.uniform(0.022, 0.07))
        if len(src) <= g:
            continue
        seg = None
        for _ in range(5):
            off = rng.integers(0, len(src) - g)
            seg = src[off: off + g]
            if np.sqrt(np.mean(seg ** 2)) > 0.03:
                break
        gr = seg / (np.sqrt(np.mean(seg ** 2)) + 1e-9) * hann(g) * 0.1 * rng.uniform(0.4, 1.0)
        i = ns(tc)
        out[:, i: i + g] += pan2(gr, rng.uniform(-0.95, 0.95))[:, : n - i]
    return fade(hp(out, 300, 2), 0.05, 0.1)


def ribbon(rng, dur, f=D5):
    """SHOWING stretches across the screen: a shimmering band of line-tone grains spreading wide"""
    n = ns(dur)
    out = np.zeros((2, n))
    tc = 0.0
    while True:
        tc += rng.exponential(1 / 90)
        if tc > dur - 0.1:
            break
        u = tc / dur
        m = ns(rng.uniform(0.04, 0.09))
        ff = f * (2.0 if rng.random() < 0.3 else 1.0) * 2 ** (rng.normal(0, 0.03) / 12)
        g = np.sin(TAU * ff * tv(m) + rng.uniform(0, TAU)) * hann(m) * rng.uniform(0.3, 1.0) * np.sin(np.pi * u) ** 0.7
        sp = 0.1 + 0.9 * min(1.0, u / 0.7)
        out[:, ns(tc): ns(tc) + m] += pan2(g, rng.uniform(-sp, sp))[:, : n - ns(tc)]
    return out


def converge(rng, dur, tail=0.9, f_to=D5):
    """everything collapses into one green line: grains glide to a unison and to the centre"""
    n = ns(dur + tail)
    out = np.zeros((2, n))
    tc = 0.0
    while True:
        tc += rng.exponential(1 / (70 * (1 - tc / dur) + 8))
        if tc > dur * 0.92:
            break
        left = max(1e-3, dur - tc)
        m = ns(left + 0.05)
        tt = tv(m)
        f0 = f_to * PENTA[rng.integers(5)] * 2.0 ** rng.integers(-1, 2)
        u = np.clip(tt / left, 0, 1)
        g = np.sin(TAU * np.cumsum(f0 * (f_to / f0) ** (u ** 0.6)) / SR) * np.clip(tt / 0.01, 0, 1) * np.exp(-tt / 0.25) * rng.uniform(0.2, 0.6)
        i = ns(tc)
        out[:, i: i + m] += pan2(fade(g, 0.002, 0.02), rng.uniform(-1, 1) * (1 - u))[:, : n - i]
    m = n - ns(dur * 0.55)
    tt = tv(m)
    line = np.sin(TAU * f_to * tt) * np.clip(tt / (dur * 0.45), 0, 1) ** 2 * np.clip((m / SR - tt) / tail, 0, 1)
    out[:, n - m:] += pan2(fade(line, 0.01, 0.05) * 0.5)
    return out


def release(rng, k, total):
    """a red particle leaving: a little rise of air let go, and a tiny pure tone, lighter each time.
    Returns (sig, lead): the release moment sits `lead` s into the signal."""
    light = k / max(1, total - 1)
    m = ns(0.16)
    t = tv(m)
    puff = bp(rng.standard_normal(m), 1800 + 2500 * light, 9000 + 3000 * light, 2)
    x = norm(puff * (t / t[-1]) ** 2.5 * np.clip((t[-1] - t) / 0.006, 0, 1)) * 0.5
    h = (8, 9, 10, 12, 16, 18, 20)[k % 7]
    tm = ns(0.09)
    tone = fade(np.sin(TAU * D2 * h * tv(tm)) * np.exp(-tv(tm) / (0.035 - 0.012 * light)), 0.003, 0.01)
    i = m - ns(0.008)
    out = np.zeros(m + tm)
    out[:m] += x
    out[i: i + tm] += tone * 0.6
    return out, i / SR


def star(rng):
    f = D6 * PENTA[rng.integers(5)] * (2.0 if rng.random() < 0.35 else 1.0)
    return tone_grain(f, rng.uniform(0.3, 0.7), att=0.006, tau=0.12, partials=((1, 1.0), (2, 0.05)))


# ============================================================================== the film
class Film:
    def __init__(self, C):
        self.C, self.EV, self.SHOT, self.VO = C, C["EV"], C["SHOT"], C["VO"]
        self.dur = float(C["DURATION"])
        self.N = ns(self.dur)
        self.mx = Mixer(self.N + ns(TAIL))
        self.lpf, self.warps, self.stutters, self.gates = [], [], [], []
        ws = self.EV["walkSteps"]
        self.P = float(np.median(np.diff(ws))) if len(ws) > 2 else 0.53  # stride period of the walk

    # ------------------------------------------------------------------ 01 the first line
    def s01(self):
        E, mx = self.EV, self.mx
        b, lead = breath(R("breath"))  # one breath on black: the very first sound
        mx.add(b, E["breath"] - lead, db(-17), 0.0, "fx", {"room": 0.08})
        mx.add(glint(D6, 1.0, 0.25), E["pointOn"], db(-40), 0.0, "tone", {"mid": 0.3})  # the green point
        d0, d1 = E["dive"]
        mx.add(dive(R("dive"), d1 - d0), d0, db(-27), 0.0, "fx", {"mid": 0.12})
        mx.add(touch_pulse(R("touch"), 0.0), E["touch"], db(-13), 0.0, "tone", {"mid": 0.1})  # the touch
        c0, m0, p0, ti = E["constellation"], E["map"], E["path"], E["tunnelIn"]
        r = R("constellation")  # hands -> a constellation of tiny tuned points
        for k in range(13):
            t = c0 + (m0 - c0 + 0.25) * (k + r.uniform(0.1, 0.9)) / 13
            f = D6 * PENTA[r.integers(5)] * (2.0 if r.random() < 0.3 else 1.0)
            mx.add(tone_grain(f, r.uniform(0.15, 0.35), att=0.004, tau=0.07, partials=((1, 1.0), (2, 0.06))), t,
                   db(-45 + r.uniform(-4, 2)), r.uniform(-0.85, 0.85), "tone", {"hall": 0.3})
        mx.add(comb_air(R("map"), (p0 - m0) + 0.5, D3), m0, db(-38), 0.0, "amb", {"mid": 0.25})  # contour air
        gd = (ti - p0) + 0.15  # the path: a line being drawn
        mx.add(glide(D4, D5, gd, att=0.05), p0, db(-43), np.linspace(-0.35, 0.35, ns(gd)), "tone", {"mid": 0.3})
        mx.add(whoosh(R("tunnel-in"), 0.55, 300, 3800, "rise"), ti - 0.45, db(-29), 0.0, "fx", {"mid": 0.12})
        mx.add(tunnel_bed(R("tunnel"), E["legsOut"] + 0.4 - ti), ti, db(-31), 0.0, "amb", {"mid": 0.1})

    # ------------------------------------------------------------------ 02 the walk (inside the line)
    def s02(self):
        E, mx = self.EV, self.mx
        for k, t in enumerate(E["frags"]):  # memory fragments, accelerating
            mx.add(frag_flash(R(f"frag{k}"), k), t, db(-28 + 0.5 * k), 0.0, "fx", {"mid": 0.22})
            mx.add(tone_grain(D5 if k % 2 == 0 else A4, 0.06, att=0.002, tau=0.016), t, db(-37), 0.3 if k % 2 else -0.3, "tone", {"mid": 0.2})
        for k, t in enumerate(E["wordSteps"]):  # HOW TO WALK. stepping toward camera
            s, pre = footstep(R(f"wordstep{k}"), "soft", weight=0.35 + 0.08 * k, hard=0.3, roll=0.045, toe=0.3, scuff=0.04)
            mx.add(s, t - pre, db(-29 + 1.5 * k), 0.0, "foley", {"mid": max(0.05, 0.25 - 0.05 * k)})
            mx.add(tpulse(D3, 0.4, att=0.004, decay=0.1, partials=(1, .3, .1)), t, db(-35 + 1.5 * k), 0.0, "tone")
        lo = E["legsOut"]  # the tunnel becomes legs of particles
        mx.add(assemble(R("legs"), 0.5, 3000, 11000), lo - 0.35, db(-33), 0.0, "fx", {"mid": 0.2})

    # ------------------------------------------------------------------ 02-03 a life in one walk
    def s03(self):
        E, mx = self.EV, self.mx
        ws, worlds = list(E["walkSteps"]), list(E["worlds"])
        nx = max(0, len(ws) - len(worlds) - 1)
        exit_, wst, into = ws[:nx], ws[nx: nx + len(worlds)], ws[-1]
        w03 = E["words03"]
        ran, kept = w03["ran"], w03["keptGoing"]
        t_w0 = wst[0] if wst else ws[0]
        for k, t in enumerate(exit_):  # out of the tunnel: footfalls made of particles
            s, pre = footstep(R(f"exit{k}"), "soft", weight=0.5, hard=0.45, roll=0.065, toe=0.45, scuff=0.08)
            mx.add(s, t - pre, db(-22), -0.12 if k % 2 == 0 else 0.12, "foley", {"mid": 0.2})
            mx.add(particle_spray(R(f"exitp{k}"), 0.3, 36), t, db(-35), 0.0, "fx", {"mid": 0.25})
        for k, (t, name) in enumerate(zip(wst, worlds)):  # each footfall grows a world
            surf, opts, sends, snap = world(name)
            o = dict(weight=0.55, roll=0.07, toe=0.5, scuff=0.12)
            o.update(opts)
            s, pre = footstep(R(f"world-{name}-{k}"), surf, **o)
            mx.add(s, t - pre, db(-20), -0.1 if (nx + k) % 2 == 0 else 0.1, "foley", sends)
            if snap is not None:
                sig, pan, gdb, ssend = snap(R(f"snap-{name}-{k}"))
                mx.add(sig, t + 0.015, db(gdb), pan, "world", ssend)
        s, pre = footstep(R("into-clock"), "stone", weight=0.9, hard=0.75, roll=0.06, toe=0.4, scuff=0.05)
        mx.add(s, into - pre, db(-17), 0.0, "foley", {"mid": 0.25, "hall": 0.2})
        # rhythmic layers, built on the footfalls
        span = max(1e-3, into - ws[0])
        for t in ws:
            mx.add(walk_pulse(), t, db(-32 + 9 * (t - ws[0]) / span), 0.0, "tone")
        r = R("offbeats")
        for i in range(len(ws) - 1):
            a, b = ws[i], ws[i + 1]
            if a >= t_w0 - 1e-6:
                u = (a - t_w0) / max(1e-3, into - t_w0)
                mx.add(air_grain(r, 0.05, 3500, 10000), 0.5 * (a + b), db(-39 + 7 * u), 0.3 if i % 2 else -0.3, "fx")
        r = R("ran")  # RAN accelerates: a roll of tuned ticks
        t, k = ran[0], 0
        while t < ran[1]:
            u = (t - ran[0]) / (ran[1] - ran[0])
            mx.add(tick_grain(r, D6 * 1.5 ** u), t, db(-41 + 7 * u), 0.4 * np.sin(k * 1.7), "fx", {"mid": 0.12})
            t += 0.13 * (0.035 / 0.13) ** u
            k += 1
        r = R("kept")  # KEPT GOING: a steady sixteenth grid locked to the stride
        for i in range(len(ws) - 1):
            a, b = ws[i], ws[i + 1]
            for j, acc in enumerate((1.0, 0.45, 0.7, 0.45)):
                t = a + j * (b - a) / 4
                if kept[0] - 1e-6 <= t < into:
                    mx.add(tick_grain(r, D6 if j % 2 == 0 else A5 * 2), t, db(-35) * acc, 0.25 * (-1) ** j, "fx", {"mid": 0.1})
        dur = into + 0.6 - t_w0
        mx.add(motion_bed(R("motion"), dur, [x - t_w0 for x in ws if x >= t_w0 - 1e-6]), t_w0, db(-31), 0.0, "amb")
        p1 = E["clockPull"][1]
        mx.add(drone(R("walk-drone"), ((D2, 0.8), (A2, 0.45), (D3, 0.3)), p1 - t_w0, att=1.2, rel=0.8), t_w0, db(-36), 0.0, "tone")
        kd = kept[1] - kept[0] + 0.2  # KEPT GOING travels across the whole frame
        n = ns(kd)
        sw = whoosh(R("kept-sweep"), kd, 1800, 4200, "arch", bw=1.4, stereo=False)
        tone = (np.sin(TAU * D5 * tv(n)) + 0.4 * np.sin(TAU * A5 * tv(n))) * np.sin(np.pi * np.clip(tv(n) / kd, 0, 1)) ** 2
        pan = -0.95 + 1.9 * smoothstep(tv(n) / kd)
        mx.add(sw + 0.05 * fade(tone, 0.02, 0.05), kept[0], db(-31), pan, "fx", {"mid": 0.25})
        wk = w03["walked"]  # WALKED travels smoothly: a soft airy glide
        wd = wk[1] - wk[0]
        mx.add(whoosh(R("walked"), wd, 900, 2200, "arch", bw=1.0, stereo=False), wk[0], db(-38), np.linspace(-0.5, 0.3, ns(wd)), "fx", {"mid": 0.2})

    # ------------------------------------------------------------------ 04 time breaks
    def s04(self):
        E, mx = self.EV, self.mx
        into = E["walkSteps"][-1]
        p0, p1 = E["clockPull"]
        ages, stut = list(E["ages"]), list(E["stutter"])
        c0, c1 = E["clockSlow"]
        mx.add(whoosh(R("pull"), (p1 - p0) + 0.35, 5500, 420, "fall", bw=1.5), p0, db(-26), 0.0, "fx", {"hall": 0.35})
        mx.add(gong(D3, 5.0), p1, db(-26), 0.0, "tone", {"hall": 0.45})  # the giant clock, revealed
        P0, Pmin = self.P / 2, 0.042
        acc_end = ages[-1] + 0.15

        def period(t):
            if t < acc_end:  # accelerating through the decades
                return P0 * (Pmin / P0) ** (np.clip((t - into) / (acc_end - into), 0, 1) ** 1.25)
            if t < c0:
                return Pmin
            return Pmin * (0.55 / Pmin) ** (np.clip((t - c0) / (c1 - c0), 0, 1) ** 1.3)  # losing momentum

        def pitch(t):
            return 2.0 ** (-0.75 * np.clip((np.asarray(t) - c0) / (c1 - c0), 0, 1) ** 1.6)  # the pitch sags

        r = R("clock-ticks")
        ticks, t = [], into
        while t < c1:
            ticks.append(t)
            per = period(t)
            t += per + (r.uniform(-0.12, 0.12) * per if t >= acc_end else 0.0)
        ticks = sorted([x for x in ticks if min(abs(x - s) for s in stut) > 0.012] + stut)  # stutters land on ticks
        for k, t in enumerate(ticks):
            u = np.clip((t - into) / (acc_end - into), 0, 1)
            v = np.clip((t - c0) / (c1 - c0), 0, 1)
            g = db(-31 + 6 * u) * (period(t) / P0) ** 0.35 * (1 - 0.6 * v)
            if any(abs(t - s) < 1e-6 for s in stut):
                g *= 1.6
            tock = k % 2 == 1
            mx.add(clock_tick(r, tock, float(pitch(t))), t, g, 0.3 if tock else -0.3, "fx", {"hall": 0.12, "mid": 0.1})
        for k, t in enumerate(ages):  # the second hand passes 20s, 30s, 40s, 50s
            mx.add(tone_grain(D6 * (1 - 0.012 * k), 1.2, att=0.003, tau=0.4 - 0.06 * k, partials=((1, 1), (2, 0.12), (3, 0.04))),
                   t, db(-34), -0.5 + k * 0.33, "tone", {"hall": 0.35})
            mx.add(clock_tick(R(f"age{k}"), True, 0.7, size=1.6), t, db(-28), 0.0, "fx", {"hall": 0.3})
            mx.add(whoosh(R(f"hand{k}"), 0.35, 1500, 5000, "arch", bw=1.0, stereo=False), t - 0.2, db(-39), -0.5 + k * 0.33, "fx")
        dd = c1 + 0.35 - p1  # a time drone under the clock, sagging with it
        n = ns(dd)
        tt = p1 + tv(n)
        ph = TAU * np.cumsum(D3 * pitch(tt)) / SR
        x = (np.sin(ph) + 0.5 * np.sin(1.5 * ph) + 0.25 * np.sin(2 * ph)) * np.clip((tt - p1) / 0.8, 0, 1) * np.clip((c1 + 0.35 - tt) / 0.5, 0, 1)
        mx.add(fade(x, 0.01, 0.05), p1, db(-38), 0.0, "tone", {"hall": 0.2})
        for j, t in enumerate(stut):  # one frame repeats. again. again.
            nxt = stut[j + 1] if j + 1 < len(stut) else c0
            grain = (0.08, 0.065, 0.09)[j % 3]
            self.stutters.append((t, grain, int(max(2, min(4, np.floor((nxt - t - 0.008) / grain))))))
        fr = E["firstRed"]  # the first red particle: barely there
        mx.add(crackle(R("first-red"), 0.07, 6), fr, db(-42), 0.35, "fx")
        n = ns(0.5)
        wh = (np.sin(TAU * 2489 * tv(n)) + np.sin(TAU * 2637 * tv(n))) * np.sin(np.pi * tv(n) / 0.5) ** 2
        mx.add(fade(wh, 0.01, 0.01), fr, db(-52), 0.35, "tone")

    # ------------------------------------------------------------------ 05 the first interruption
    def s05(self):
        E, mx = self.EV, self.mx
        st, rh = list(E["stairSteps"]), list(E["redHits"])
        k0, k1 = E["kneeDive"]
        mx.add(vast_air(R("vast"), k1 - st[0] + 0.6), st[0] - 0.3, db(-36), 0.0, "amb", {"hall": 0.25})
        for i, t in enumerate(st):  # an impossible staircase: steps in a vast space, slowing
            u = i / max(1, len(st) - 1)
            s, pre = footstep(R(f"stair{i}"), "stone", weight=0.6 + 0.3 * u, hard=0.55, roll=0.035, toe=0.3, scuff=0.06,
                              pitch=1 - 0.06 * u, decay=1.1)
            mx.add(s, t - pre, db(-19 + u), 0.15 if i % 2 else -0.15, "foley", {"hall": 0.5})
        for j, t in enumerate(rh):  # the line hits red: the architecture bends
            sev = (j + 1) / len(rh)
            mx.add(groan(R(f"groan{j}"), 1.1, sev), t, db(-25 + 3 * sev), 0.0, "fx", {"hall": 0.35})
            mx.add(crackle(R(f"redhit{j}"), 0.1, 14), t, db(-33 + 3 * sev), 0.2 - 0.4 * j, "fx", {"hall": 0.2})
            self.warps.append((t + 0.03, 0.75, 0.06 + 0.05 * sev))
        mx.add(whoosh(R("knee"), k1 - k0 + 0.25, 3000, 180, "swell", bw=1.6), k0 - 0.05, db(-24), 0.0, "fx")
        sl0 = E["slowSteps"][0]
        mx.add(inner(R("knee-in"), sl0 + 0.9 - (k1 - 0.3)), k1 - 0.3, db(-30), 0.0, "amb")

        def fc(t):  # inward: everything closes over, then the replay opens out of it
            a = 20000 * (450 / 20000) ** (np.clip((t - k0) / (k1 - k0), 0, 1) ** 1.3)
            b = 450 * (20000 / 450) ** (np.clip((t - k1) / (sl0 + 0.8 - k1), 0, 1) ** 1.5)
            return np.where(t < k1, a, b)

        self.lpf.append((k0 - 0.1, sl0 + 1.0, fc))

    # ------------------------------------------------------------------ 06 slower
    def s06(self):
        E, mx, P = self.EV, self.mx, self.P
        sl, rates = list(E["slowSteps"]), list(E["slowRates"])
        rates += [rates[-1]] * max(0, len(sl) + 1 - len(rates))
        s0, s1 = self.SHOT["s06"]
        kt, ktau = np.array(sl), np.arange(len(sl)) * P
        r0, rN = rates[0], rates[len(sl)]

        def tau_of(t):  # the walk's own time, slowing 100 -> 30 % (each footfall lands on its cue)
            t = np.asarray(t, float)
            return np.where(t < kt[0], (t - kt[0]) * r0, np.where(t > kt[-1], ktau[-1] + (t - kt[-1]) * rN, np.interp(t, kt, ktau)))

        def t_of(tau):
            tau = np.asarray(tau, float)
            return np.where(tau < 0, kt[0] + tau / r0, np.where(tau > ktau[-1], kt[-1] + (tau - ktau[-1]) / rN, np.interp(tau, ktau, kt)))

        def rate_at(t):
            return rates[min(int(np.searchsorted(kt, t, side="right")), len(rates) - 1)]

        rmin = min(rates)

        def heavy(t):
            return (1 - rate_at(t)) / max(1e-3, 1 - rmin)

        names = list(E["worlds"]) or ["school"]
        for k, t in enumerate(sl):  # the same walk replayed: footfalls further apart, heavier
            r, h = rate_at(t + 1e-4), heavy(t + 1e-4)
            surf = world(names[k % len(names)])[0]
            s, pre = footstep(R(f"slow{k}"), surf, weight=0.55 + 0.4 * h, hard=0.5 - 0.15 * h, roll=0.07 + 0.09 * h, toe=0.5,
                              scuff=0.1 + 0.25 * h, drag=0.35 * h if h > 0.5 else 0.0, pitch=1 - 0.16 * h, decay=1 + 0.7 * h)
            mx.add(s, t - pre, db(-20 + 2 * h), -0.1 if k % 2 == 0 else 0.1, "foley", {"mid": 0.25 + 0.2 * h})
            mx.add(tpulse(D2 * r ** 0.25, 0.9, att=0.006, decay=0.17 / r ** 0.6, partials=(1, .7, .36, .18, .08), drop=0.06),
                   t, db(-27), 0.0, "tone", {"mid": 0.15})
            snap = world(names[k % len(names)])[3]  # a ghost of each world, stretched
            if snap is not None:
                g = stretch(mono(snap(R(f"ghost-{k}"))[0]), 1 / r, r ** 0.5, R(f"ghost-st{k}"))
                mx.add(lp(g, 3000, 2), t + 0.02, db(-41), 0.3 * (-1) ** k, "world", {"warm": 0.5})
        r = R("slow-ticks")  # the subdivisions slow with it - and lose their footing
        for k in range(-2, int(np.ceil(float(tau_of(s1)) / P)) + 1):
            for j in (1, 2, 3):
                t = float(t_of((k + j / 4) * P))
                if t < s0 or t > s1 - 0.05:
                    continue
                h = heavy(t)
                if r.random() < 0.55 * h:
                    continue
                t += r.normal(0, 0.035 * h)
                if j == 2:
                    mx.add(air_grain(r, 0.05 / rate_at(t) ** 0.5, 3000, 9000), t, db(-38), 0.3 * (-1) ** k, "fx", {"mid": 0.2})
                else:
                    mx.add(tick_grain(r, D6 * rate_at(t) ** 0.3, 0.03 / rate_at(t) ** 0.3), t, db(-40), 0.25 * (-1) ** j, "fx", {"mid": 0.2})
        src = walk_source(P, 8)  # and the whole rhythm, granular-stretched underneath: time itself dragging
        g0 = sl[0]
        n_out = ns(s1 - g0)
        sm = granular(src, n_out, lambda q: float(tau_of(g0 + q)), lambda q: rate_at(g0 + q) ** 0.35, R("smear"),
                      grain=0.09, hop=0.0225, jit_fn=lambda q: 0.004 + 0.05 * heavy(g0 + q),
                      drop_fn=lambda q: 0.4 * heavy(g0 + q), amp_jit=0.3)
        mx.add(fade(sm, 0.2, 0.3), g0, db(-5), 0.0, "fx", {"mid": 0.3})

    # ------------------------------------------------------------------ 07 resistance
    def s07(self):
        E, mx = self.EV, self.mx
        j0, j1 = E["jointIn"]
        col, ts, hu, ex = list(E["collisions"]), E["textStop"], E["hurt"], E["explode"]
        mx.add(whoosh(R("joint-in"), j1 - j0 + 0.2, 4000, 250, "fall", bw=1.4), j0, db(-27), 0.0, "fx", {"mid": 0.15})
        mx.add(joint_bed(R("joint-bed"), hu - j0 + 0.2), j0, db(-24), 0.0, "pain")
        prev = j0
        for k, c in enumerate(col):
            if abs(c - hu) < 0.06:
                break  # the last approach ends in HURT (below)
            sev = (k + 1) / len(col)
            if c - prev > 0.05:
                mx.add(approach(R(f"appr{k}"), c - prev), prev, db(-33 + 6 * sev), 0.0, "pain")
            nxt = col[k + 1] if k + 1 < len(col) else hu
            gd = max(0.12, min(0.32 + 0.14 * k, nxt - c - 0.06))
            mx.add(grind(R(f"grind{k}"), gd, sev), c, db(-21 + 4 * sev), 0.0, "pain")  # surfaces grind
            mx.add(line_fragments(R(f"frag-line{k}"), 0.45, sev), c + 0.05, db(-36), 0.0, "fx")  # the line scraped
            prev = c + gd
        if hu - prev > 0.05:
            mx.add(approach(R("appr-last"), hu - prev), prev, db(-27), 0.0, "pain")
        mx.add(crunch(R("hurt")), hu, db(-16), 0.0, "post")  # HURT: one compressed crunch...
        self.gates.append([(hu + 0.12, 0.0), (hu + 0.16, -42.0), (ex - 0.03, -42.0), (ex, 0.0)])  # ...then almost nothing
        mx.add(thud(R("stop")), ts, db(-17), 0.0, "post")  # the sentence stops dead
        self.gates.append([(ts - 0.002, 0.0), (ts + 0.006, -24.0), (ts + 0.2, -24.0), (ts + 0.29, 0.0)])

    # ------------------------------------------------------------------ 08 the human scale
    def s08(self):
        E, mx = self.EV, self.mx
        ex, (r0, r1) = E["explode"], E["room"]
        ps, no, (o0, o1) = list(E["patientSteps"]), E["notices"], E["oaWord"]
        pu0 = E["pupil"][0]
        mx.add(explode_air(R("explode")), ex, db(-22), 0.0, "fx", {"mid": 0.3})
        rt_end = pu0 + 0.9
        rt = room_tone(R("room"), rt_end - r0)
        t = r0 + tv(rt.shape[1])
        e = np.clip((t - r0) / 0.7, 0, 1) * np.clip((rt_end - t) / 0.9, 0, 1)
        e *= 1 - 0.35 * np.exp(-(((t - (no + 0.5)) / 0.6) ** 2))  # the room holds its breath when she is noticed
        mx.add(rt * e, r0, db(-46), 0.0, "amb")
        mx.add(assemble(R("rebuild"), r1 - r0, 2500, 9000), r0, db(-36), 0.0, "fx", {"clinic": 0.3})
        d = np.diff(ps)
        med = np.median(d) if len(d) else 0.7
        for i, t in enumerate(ps):  # a limp: the painful leg lands short, soft, its toe dragging
            painful = bool(d[i] < med) if i < len(d) else (not bool(d[i - 1] < med) if i > 0 else True)
            if painful:
                s, pre = footstep(R(f"limp{i}"), "vinyl", weight=0.45, hard=0.35, roll=0.11, toe=0.55, scuff=0.25, drag=0.7)
                g = -27
            else:
                s, pre = footstep(R(f"limp{i}"), "vinyl", weight=0.75, hard=0.5, roll=0.07, toe=0.45, scuff=0.1)
                g = -24
            mx.add(s, t - pre, db(g), -0.35 + 0.6 * i / max(1, len(ps) - 1), "foley", {"clinic": 0.3})
        n = ns(2.6)  # the doctor notices: one soft, pure tone (the line's own pitch)
        tt = tv(n)
        nt = (np.sin(TAU * D5 * tt) + 0.08 * np.sin(TAU * D6 * tt)) * smoothstep(tt / 0.15) * np.exp(-tt / 0.9)
        mx.add(fade(nt, 0.0, 0.1), no, db(-33), 0.0, "tone", {"mid": 0.25})
        mx.add(assemble(R("oa-form"), 0.55, 5000, 12000), o0, db(-41), 0.0, "fx")  # OSTEOARTHRITIS forms...
        mx.add(assemble(R("oa-gone"), 0.5, 4000, 11000)[:, ::-1], o1 - 0.45, db(-42), 0.0, "fx")  # ...and dissolves

    # ------------------------------------------------------------------ 09 the memory glitch
    def s09(self):
        E, mx = self.EV, self.mx
        pu0, pu1 = E["pupil"]
        s9, h9, m9 = E["stair09"], E["hand09"], E["memory09"]
        co0 = E["collapse"][0]
        pd = pu1 - pu0 + 0.4  # into the doctor's pupil: the sound opens
        push = noise_sweep(R("pupil"), pd, lambda T: 250 * (6000 / 250) ** (np.clip(T / pd, 0, 1) ** 1.5),
                           lambda T: np.sin(0.5 * np.pi * np.clip(T / pd / 0.8, 0, 1)) ** 2 * np.clip((1 - T / pd) / 0.2, 0, 1), bw=1.8)
        n = push.shape[1]
        sub = np.sin(TAU * D2 * tv(n)) * np.sin(np.pi * np.clip(tv(n) / pd, 0, 1)) ** 2
        mx.add(push + pan2(fade(sub, 0.01, 0.05) * 0.3), pu0, db(-27), 0.0, "fx", {"warm": 0.35})
        a0, a1 = pu1 - 0.4, co0 + 0.4
        mx.add(air_bed(R("memory-air"), a1 - a0, 120, 4200), a0, db(-36), 0.0, "amb", {"warm": 0.3})
        mx.add(drone(R("mem-drone1"), ((D2, 0.7), (A2, 0.5), (D3, 0.4)), (co0 + 0.3) - (s9 - 0.3), att=1.2, rel=0.7),
               s9 - 0.3, db(-30), 0.0, "tone", {"warm": 0.4})
        mx.add(drone(R("mem-drone2"), ((FS3, 0.35), (A3, 0.3), (D4, 0.22), (FS4, 0.1)), (co0 + 0.3) - m9, att=0.9, rel=0.7),
               m9, db(-31), 0.0, "tone", {"warm": 0.5})
        for i, dt in enumerate((0.0, 0.5)):  # a staircase...
            s, pre = footstep(R(f"stair09-{i}"), "stair", weight=0.45, hard=0.3, roll=0.05, toe=0.35, scuff=0.06)
            mx.add(lp(s, 3500, 2), s9 + dt - pre, db(-26 - 4 * i), 0.2 - 0.3 * i, "foley", {"warm": 0.55})
        mx.add(touch_pulse(R("hand09"), 0.5), h9, db(-21), 0.0, "tone", {"warm": 0.3})  # ...a hand...
        mx.add(whoosh(R("mem-bloom"), 1.6, 600, 5000, "arch", bw=2.0), m9 - 0.2, db(-33), 0.0, "amb", {"warm": 0.4})  # ...her

    # ------------------------------------------------------------------ 10 she
    def s10(self):
        E, mx = self.EV, self.mx
        she, (th0, th1) = E["she"], E["throughH"]
        (me0, me1), (sh0, sh1), (co0, co1) = E["memories10"], E["showing"], E["collapse"]
        n = ns(2.6)  # SHE: a soft, wide bloom - no hit
        t = tv(n)
        sub = (np.sin(TAU * D2 * t) + 0.5 * np.sin(TAU * D3 * t) + 0.2 * np.sin(TAU * A3 * t)) * (1 - np.exp(-t / 0.18)) * np.exp(-t / 0.9)
        mx.add(pan2(fade(sub, 0.01, 0.1)) + whoosh(R("she-air"), 2.6, 400, 3000, "arch", bw=2.0) * 0.2, she, db(-20), 0.0, "tone", {"warm": 0.35})
        td = th1 - th0 + 0.3  # through the letter H
        pb = whoosh(R("throughH"), td, 900, 4500, "arch", bw=1.3, stereo=False)
        mx.add(widen(pb, R("throughH-w"), np.sin(np.pi * np.clip(tv(len(pb)) / td, 0, 1))), th0, db(-28), 0.0, "fx", {"warm": 0.2})
        mx.add(memory_cloud(R("memories"), me1 - me0, memory_palette()), me0, db(-24), 0.0, "fx", {"warm": 0.3})
        mx.add(ribbon(R("showing"), sh1 - sh0 + 0.2), sh0, db(-31), 0.0, "tone", {"warm": 0.3})  # SHOWING stretches
        mx.add(converge(R("collapse"), co1 - co0, tail=0.9), co0, db(-28), 0.0, "tone", {"warm": 0.25})  # one line

    # ------------------------------------------------------------------ 11 the loop
    def s11(self):
        E, mx = self.EV, self.mx
        mh0, t11, ro = E["motherHand"][0], E["touch11"], list(E["redOut"])
        po0 = E["pullOut12"][0]
        mx.add(air_bed(R("hands-air"), po0 + 0.6 - mh0, 150, 3500), mh0, db(-41), 0.0, "amb", {"warm": 0.3})
        mx.add(touch_pulse(R("touch11"), 1.0), t11, db(-12), 0.0, "tone", {"warm": 0.3})  # the touch returns, fuller
        for k, t in enumerate(ro):  # red particles leave, one by one, each lighter
            s, lead = release(R(f"redout{k}"), k, len(ro))
            mx.add(s, t - lead, db(-33 - 1.2 * k), 0.35 * np.sin(1.9 * k), "fx", {"warm": 0.3})

    # ------------------------------------------------------------------ 12 now
    def s12(self):
        E, mx = self.EV, self.mx
        (po0, po1), tg, (st0, st1), pur = E["pullOut12"], list(E["togetherSteps"]), E["stars"], E["purple"]
        mx.add(whoosh(R("pullout"), po1 - po0 + 0.3, 2500, 700, "arch", bw=1.8), po0, db(-33), 0.0, "fx", {"warm": 0.3})
        mx.add(air_bed(R("evening"), pur - po0, 150, 3000, fi=0.8, fo=pur - st0), po0, db(-40), 0.0, "amb", {"warm": 0.2})
        span = max(1e-3, tg[-1] - tg[0])
        for k, t in enumerate(tg):  # two people walking, at her pace
            u = (t - tg[0]) / span
            s, pre = footstep(R(f"her{k}"), "path", weight=0.55, hard=0.45, roll=0.085, toe=0.5, scuff=0.15,
                              drag=0.12 if k % 2 == 0 else 0.0, grit=0.2)
            mx.add(s, t - pre, db(-24 - 4 * u), -0.15, "foley", {"warm": 0.15})
            r = R(f"child{k}")
            s, pre = footstep(r, "path", weight=0.65, hard=0.55, roll=0.07, toe=0.5, scuff=0.1, grit=0.2)
            mx.add(s, t + r.uniform(0.022, 0.045) - pre, db(-25 - 4 * u), 0.15, "foley", {"warm": 0.15})
            mx.add(walk_pulse(decay=0.22), t, db(-33 - 5 * u), 0.0, "tone", {"warm": 0.2})
        mx.add(drone(R("together"), ((D3, 0.5), (A3, 0.35)), st1 - tg[0], att=0.8, rel=1.6), tg[0], db(-38), 0.0, "tone", {"warm": 0.4})
        r = R("stars")  # the world dissolves into stars
        t = st0
        while True:
            t += r.exponential(1 / 9)
            if t > pur - 0.1:
                break
            mx.add(star(r), t, db(-42 + r.uniform(-4, 2)), r.uniform(-0.9, 0.9), "tone", {"hall": 0.4})

    # ------------------------------------------------------------------ 13 the pledge
    def s13(self):
        E, mx = self.EV, self.mx
        pur, li = E["purple"], E["lineIn"]
        rm, pl = list(E["redMarks"]), list(E["pledge"])
        fg0, fg1 = E["figure"]
        fs = E["finalStep"]
        s14 = self.SHOT["s14"][0]
        self.gates.append([(pur - 0.002, 0.0), (pur + 0.15, -50.0), (s14, -50.0), (s14 + 0.5, -120.0)])  # near silence
        t_arr = max(li + 1.5, (rm[0] if rm else li + 2.8) - 0.3)  # the line's head reaches the right edge
        t_end = min(fg1, fs - 0.18)
        n = ns(t_end - li)
        t = li + tv(n)
        ph = TAU * D5 * tv(n)
        u = np.clip((t - li) / (t_arr - li), 0, 1)  # head: one pure tone travelling left -> right
        head = pan2(np.sin(ph) * np.clip((t - li) / 0.25, 0, 1) * np.clip((t_arr + 0.25 - t) / 0.35, 0, 1), -0.95 + 1.9 * smoothstep(u))
        amp = 0.8 * u ** 1.2  # body: the line drawn behind it, spanning the frame
        for a, b in zip(rm, pl):  # a red interruption... healed on the step
            amp = amp * (1 - 0.8 * (smoothstep((t - a) / 0.03) - smoothstep((t - b + 0.02) / 0.1)))
        sw = np.ones(n)
        for b in pl:
            sw += 0.35 * smoothstep((t - b) / 0.03) * np.exp(-np.clip(t - b, 0, None) / 0.5)
        dis = np.clip((t - fg0) / max(1e-3, t_end - fg0), 0, 1)  # the line becomes a figure: it dissolves
        r = R("figure-grains")
        gm = np.zeros(n)
        tc = fg0 - li
        while tc < t_end - li:
            m = ns(r.uniform(0.02, 0.06))
            i = ns(tc)
            gm[i: i + m] += hann(m)[: n - i]
            tc += r.uniform(0.025, 0.07)
        mask = (1 - dis) + dis * np.clip(gm, 0, 1)
        amp = amp * sw * mask * (1 - dis) ** 1.3
        body = np.sin(ph)
        for k, (ratio, a) in enumerate(((1.5, 0.22), (2.0, 0.15))):  # a pure fifth, then the octave join in
            if k + 1 < len(pl):
                body = body + a * np.sin(ratio * ph) * smoothstep((t - pl[k + 1]) / 0.15)
        line = np.vstack([body, body]) * amp
        line[1] = np.sin(ph + 0.8) * amp + (body - np.sin(ph)) * amp  # a little width (static phase)
        mx.add(fade(head + line, 0.02, 0.06), li, db(-30), 0.0, "post")
        for k, a in enumerate(rm):  # red marks: tiny compressed crackles at their place on the line
            mx.add(crackle(R(f"redmark{k}"), 0.08, 9), a, db(-38), -0.45 + 0.9 * k / max(1, len(rm) - 1), "post")
        for k, b in enumerate(pl):  # NOTICE / ADDRESS / KEEP MOVING: each word lands on a step
            s, pre = footstep(R(f"pledge{k}"), "wood", weight=0.45, hard=0.4, roll=0.07, toe=0.4, scuff=0.06)
            mx.add(s, b - pre, db(-27 + k), 0.0, "post", {"mid": 0.15})
            mx.add(walk_pulse(decay=0.2), b, db(-34 + k), 0.0, "post")
        mx.add(assemble(R("figure"), t_end - fg0, 4000, 11000, peak=120), fg0, db(-42), 0.0, "post")

    # ------------------------------------------------------------------ 14 the final image
    def s14(self):
        E, mx = self.EV, self.mx
        fs, br, end = E["finalStep"], E["brand"], E["end"]
        s, pre = footstep(R("final-step"), "wood", weight=0.72, hard=0.62, roll=0.09, toe=0.55, scuff=0.1, cloth=1.0, creak_=0.6)
        mx.add(s, fs - pre, db(-9), 0.0, "post", {"room": 0.07})  # ONE single clean footstep
        a0 = max(br + 0.15, fs + 0.5)  # then silence: the brand, at most a breath of air, gone well before the end
        a1 = min(end - 0.6, a0 + 1.8)
        if a1 - a0 > 0.4:
            mx.add(air_bed(R("brand-air"), a1 - a0, 300, 6000, fi=0.6, fo=0.9, breathe=0.0), a0, db(-60), 0.0, "post")

    # ------------------------------------------------------------------ render
    def build(self):
        for s in (self.s01, self.s02, self.s03, self.s04, self.s05, self.s06, self.s07, self.s08, self.s09,
                  self.s10, self.s11, self.s12, self.s13, self.s14):
            s()

    def render(self, vo_dir):
        mx = self.mx
        n = mx.n
        if "pain" in mx.b:  # the joint: compressed hard, narrow, close
            p = compressor(hp(mx.b["pain"], 70, 2), thr=-30.0, ratio=6.0, att=0.002, rel=0.06, knee=6.0, win=0.004, makeup=8.0)
            mid, side = p.mean(axis=0), (p[0] - p[1]) / 2
            mx.b["pain"] = np.vstack([mid + 0.4 * side, mid - 0.4 * side])
        irs = {}
        main, post = np.zeros((2, n)), np.zeros((2, n))
        for k, x in mx.b.items():
            if k.startswith("rv:"):
                _, space, grp = k.split(":")
                if space not in irs:
                    irs[space] = make_ir(space, **SPACES[space])
                (post if grp == "post" else main)[:] += convolve_st(x, irs[space])
            elif k == "post":
                post += x
            else:
                main += x
        for t0, t1, fc in self.lpf:
            tv_lowpass(main, t0, t1, fc)
        for t0, d, depth in self.warps:
            warp(main, t0, d, depth)
        for t, g, r in self.stutters:
            stutter(main, t, g, r)
        g = np.ones(n)
        for keys in self.gates:
            g *= gate_curve(keys, n)
        me = hp(main * g + post, 20, 2)[:, : self.N]
        vo = self.place_vo(vo_dir)[:, : self.N]
        me, act = duck(me, vo)
        return me, vo, act

    def place_vo(self, vo_dir):
        n = self.mx.n
        v = np.zeros(n)
        for L in self.VO:
            x, sr = sf.read(os.path.join(vo_dir, L["key"] + ".wav"), always_2d=True)
            x = x.mean(axis=1)
            if sr != SR:
                x = ss.resample_poly(x, SR, sr)
            x = fade(x - np.mean(x), 0.004, 0.01)
            i = ns(L["t"])
            m = min(len(x), n - i)
            v[i: i + m] += x[:m]
        return vo_chain(v)


def vo_chain(v):
    """high-pass 80 Hz, gentle presence, light compression, a very short subtle room"""
    x = hp(v, 80, 4)
    x = peq(x, 230, -1.5, 0.9)
    x = peq(x, 3300, 3.0, 0.8)
    x = shelf(x, 8500, -2.0, True)  # the TTS guide voice has a sibilant bump at 8-10 kHz
    x = compressor(x[None, :], thr=-27.0, ratio=2.2, att=0.008, rel=0.14, knee=8.0, win=0.01)[0]
    ir = make_ir("vo-room", rt=0.22, pre=0.002, damp=6000, er=((0.0023, .5), (0.0041, .4), (0.0062, .3), (0.0089, .2)))
    x = x + ss.oaconvolve(x, ir[0])[: len(x)] * db(-17)
    st = np.vstack([x, x])
    loud = pyln.Meter(SR).integrated_loudness(st.T)
    return st * db(VO_LUFS - loud)


# ============================================================================== master & report
def master(me, vo):
    """one gain + one true-peak limiter envelope for everything, so me + vo == mix exactly"""
    meter = pyln.Meter(SR)
    mix = me + vo
    g = float(db(TARGET_LUFS - meter.integrated_loudness(mix.T)))
    lim = np.ones(mix.shape[1])
    for _ in range(6):
        y = mix * (g * lim)
        if true_peak(y) > TP_CEIL - 0.2:
            lim = lim * limiter_gain(y, float(db(TP_CEIL - 0.35)))
            y = mix * (g * lim)
        L = meter.integrated_loudness(y.T)
        if abs(L - TARGET_LUFS) < 0.05 and true_peak(y) <= TP_CEIL - 0.1:
            break
        g *= float(db(TARGET_LUFS - L))
    G = g * lim
    return me * G, vo * G, mix * G, G


def kmomentary(x, win=0.4, hop=0.1):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    k = ss.lfilter(b2, a2, ss.lfilter(b1, a1, x, axis=-1), axis=-1)
    p = np.sum(k ** 2, axis=0)
    w, h = ns(win), ns(hop)
    c = np.concatenate([[0.0], np.cumsum(p)])
    idx = np.arange(0, len(p) - w, h)
    return idx / SR + win / 2, -0.691 + 10 * np.log10((c[idx + w] - c[idx]) / w + 1e-12)


def report(F, me, vo, mix, G):
    meter = pyln.Meter(SR)
    print(f"  integrated  mix {meter.integrated_loudness(mix.T):6.2f} LUFS | me {meter.integrated_loudness(me.T):6.2f} | "
          f"vo {meter.integrated_loudness(vo.T):6.2f}   true peak {true_peak(mix):5.2f} dBTP   limiter max GR "
          f"{-20 * np.log10(np.min(G / np.max(G))):4.2f} dB")
    print(f"  length {mix.shape[1]} samples = {mix.shape[1] / SR:.3f} s   DC L {np.mean(mix[0]):+.2e} R {np.mean(mix[1]):+.2e}")
    tm, lm = kmomentary(me)
    _, lv = kmomentary(vo)
    _, lx = kmomentary(mix)
    print("  shot   window        M&E max/mean   VO max   mix max   (momentary LUFS)")
    for name, (a, b) in F.SHOT.items():
        s = (tm >= a) & (tm < b)
        print(f"  {name}  {a:5.2f}-{b:5.2f}   {lm[s].max():6.1f} {np.mean(lm[s]):6.1f}   {lv[s].max():6.1f}   {lx[s].max():6.1f}")
    fs = F.EV["finalStep"]
    seg = np.abs(mix[:, ns(fs - 0.25): ns(fs + 0.3)]).max(axis=0)
    on = np.argmax(seg > 0.1 * seg.max())
    print(f"  final footstep: onset {fs - 0.25 + on / SR:.4f} s vs EV.finalStep {fs:.4f} s  (peak {20 * np.log10(seg.max()):.1f} dBFS)")
    q = mix[:, ns(F.EV['end'] - 0.5):]
    print(f"  last 0.5 s peak: {20 * np.log10(np.max(np.abs(q)) + 1e-12):.1f} dBFS")


def write(path, x):
    sf.write(path, np.clip(x, -1.0, 1.0).T, SR, subtype="PCM_24")


def main():
    args = sys.argv[1:]
    debug = None
    if "--debug" in args:
        i = args.index("--debug")
        debug = args[i + 1]
        del args[i: i + 2]
    if len(args) < 2:
        sys.exit(__doc__)
    cues_path, out_dir = args[0], args[1]
    C = json.load(open(cues_path))
    vo_dir = os.path.join(os.path.dirname(os.path.abspath(cues_path)), "vo")
    os.makedirs(out_dir, exist_ok=True)
    F = Film(C)
    print("synthesising...")
    F.build()
    print("rendering spaces, dynamics, VO...")
    me, vo, act = F.render(vo_dir)
    me, vo, mix, G = master(me, vo)
    assert mix.shape[1] == F.N
    write(os.path.join(out_dir, "mix.wav"), mix)
    write(os.path.join(out_dir, "me.wav"), me)
    write(os.path.join(out_dir, "vo_stem.wav"), vo)
    if debug:
        os.makedirs(debug, exist_ok=True)
        for k, x in F.mx.b.items():
            if not k.startswith("rv:"):
                write(os.path.join(debug, f"bus_{k}.wav"), x[:, : F.N] * G[None, :] if x.shape[1] >= F.N else x)
        np.save(os.path.join(debug, "duck.npy"), act)
    report(F, me, vo, mix, G)
    m4a = os.path.join(out_dir, "mix.m4a")
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(out_dir, "mix.wav"), "-c:a", "aac", "-b:a", "192k",
                        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart", m4a],
                       check=True)
        print("wrote", m4a)
    except (OSError, subprocess.CalledProcessError) as e:
        print("ffmpeg failed (mix.wav is complete):", e)
    print("wrote", ", ".join(os.path.join(out_dir, f) for f in ("mix.wav", "me.wav", "vo_stem.wav")))


if __name__ == "__main__":
    main()

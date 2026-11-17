# score.py <film dir> : music + foley + voice -> <film dir>/out/mix.wav
# Each film has a cues.py next to it that defines CUES (dict of times), ARR (arrangement) and FX (foley).
# This file holds the shared harmony, the instrument writing and the mix (music and beds duck under the voice).
import sys, os, json, importlib.util
LIB = '/home/user/lemomo-ai/lemo-opuscar'
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf
from core.audio import sampler as S
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, add, limit, whoosh, thump, ding, pop

FILM = os.path.abspath(sys.argv[1])
TL = json.load(open(os.path.join(FILM, 'timeline.json')))
spec = importlib.util.spec_from_file_location('cues', os.path.join(FILM, 'cues.py')); C = importlib.util.module_from_spec(spec)
C.TL = TL; spec.loader.exec_module(C)
DUR = TL['dur'] + .3
N = int(DUR * SR)
S.seed(7); rng = np.random.default_rng(5)

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
# chords: root, quality
CH = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'sus2': [0, 2, 7], 'maj7': [0, 4, 7, 11], 'add9': [0, 4, 7, 14], 'min7': [0, 3, 7, 10]}
def chord_notes(sym, octave=3):
    root = sym.rstrip('mM7sus2add9')
    q = 'min' if sym.endswith('m') else 'maj7' if sym.endswith('M7') else 'add9' if sym.endswith('add9') else 'sus2' if sym.endswith('sus2') else 'min7' if sym.endswith('m7') else 'maj'
    if sym.endswith('m7'): root = sym[:-2]
    r = 12 * (octave + 1) + NOTE[root]
    return r, [r + i for i in CH[q]]

def music():
    """The arrangement: ARR = dict(bpm, prog [chord per bar], start, sections: [(t0, t1, layers set)], melody: [(beat, midi, beats)])"""
    A = C.ARR; bpm = A['bpm']; beat = 60 / bpm; bar = beat * A.get('beats', 4)
    ev = []
    t0 = A.get('start', 0.)
    nb = int((DUR - t0) / bar) + 2
    def layers_at(t):
        for a, b, L in A['sections']:
            if a <= t < b: return L
        return set()
    for i in range(nb):
        tb = t0 + i * bar
        if tb > DUR: break
        sym = A['prog'][i % len(A['prog'])]
        r, ns = chord_notes(sym, 2)
        L = layers_at(tb + .01)
        V = A.get('vel', {})
        if 'pad' in L:   # sustained strings: cellos on root, violas/violins on the chord
            ev.append(dict(t=tb, inst='cellos', pitch=r, dur=bar + .3, vel=V.get('pad', .42), pan=-.25, attack=.25))
            for k, n in enumerate(ns[1:]): ev.append(dict(t=tb, inst='violins' if k else 'violas', pitch=n + 12, dur=bar + .3, vel=V.get('pad', .42) * .8, pan=.3 - .2 * k, attack=.35))
        if 'bass' in L: ev.append(dict(t=tb, inst='contrabass_pizz', pitch=r - 12 + 12, dur=beat, vel=.55, pan=0))
        if 'pizz' in L:
            for b in range(A.get('beats', 4)):
                n = ns[(b * 2) % len(ns)] + 12
                ev.append(dict(t=tb + b * beat, inst='violins_pizz' if b % 2 else 'cellos_pizz', pitch=n if b % 2 else r, dur=beat * .9, vel=V.get('pizz', .5) * (1 if b == 0 else .8), pan=.2 if b % 2 else -.2))
        if 'harp' in L:  # rising arpeggio in eighths
            arp = [ns[0] + 12, ns[1] + 12, ns[2] + 12, ns[0] + 24, ns[2] + 12, ns[1] + 24, ns[2] + 24, ns[0] + 36]
            for k in range(2 * A.get('beats', 4)):
                ev.append(dict(t=tb + k * beat / 2, inst='harp', pitch=arp[k % len(arp)], dur=beat * 1.5, vel=V.get('harp', .45) * (1 if k == 0 else .75), pan=-.35 + .1 * (k % 4)))
        if 'piano' in L:  # broken chord in the left hand, open voicing
            ev.append(dict(t=tb, inst='piano', pitch=r + 12, dur=bar, vel=V.get('piano', .45), pan=-.1))
            ev.append(dict(t=tb + beat, inst='piano', pitch=ns[2] + 12, dur=bar - beat, vel=V.get('piano', .45) * .75, pan=-.05))
            ev.append(dict(t=tb + 2 * beat, inst='piano', pitch=ns[1] + 24, dur=bar - 2 * beat, vel=V.get('piano', .45) * .7, pan=0))
        if 'guitar' in L:
            for b in range(A.get('beats', 4)):
                for k, n in enumerate([r + 12, ns[1] + 12, ns[2] + 12, ns[0] + 24] if b % 2 == 0 else [ns[2] + 12, ns[0] + 24]):
                    ev.append(dict(t=tb + b * beat + k * .02, inst='guitar_nylon', pitch=n, dur=beat * 1.4, vel=V.get('guitar', .45) * (.9 if b == 0 else .7), pan=.15))
        if 'brush' in L:
            for b in range(A.get('beats', 4)):
                ev.append(dict(t=tb + b * beat, inst='shaker', pitch=None, dur=None, vel=.18 if b % 2 else .26, pan=.25))
        if 'glock' in L and i % 2 == 0:
            ev.append(dict(t=tb, inst='glockenspiel', pitch=ns[0] + 36, dur=1.5, vel=.3, pan=.3))
    # melody (beats from start, midi, beats long, inst)
    for b, p, ln, inst in A.get('melody', []):
        ev.append(dict(t=t0 + b * beat, inst=inst, pitch=p, dur=ln * beat, vel=A.get('mvel', .5), pan=.1, attack=.04))
    # final chord on the end card and a gentle hit
    for t, sym, insts in A.get('stabs', []):
        r, ns = chord_notes(sym, 2)
        for inst in insts:
            for k, n in enumerate(ns): ev.append(dict(t=t + k * (.03 if inst in ('harp', 'piano') else 0), inst=inst, pitch=n + (24 if inst in ('harp', 'glockenspiel', 'vibraphone') else 12), dur=3.2, vel=.42, pan=-.3 + .3 * k))
    m = S.render(ev, dur=DUR)
    return S.room(m, size=A.get('room', .55), mix=A.get('wet', .22))

def voice():
    v, sr = sf.read(os.path.join(FILM, 'vo.wav'))
    if v.ndim > 1: v = v.mean(1)
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    # gentle presence + compression
    v = v + bp(v, 2000, 5000) * .25
    env = np.abs(v); g = np.ones_like(v)
    from scipy.signal import lfilter
    e = lfilter([.002], [1, -.998], env)
    thr = .08; g = np.where(e > thr, (thr + (e - thr) / 3) / np.maximum(e, 1e-9), 1)
    return v * g

def main():
    os.makedirs(os.path.join(FILM, 'out'), exist_ok=True)
    mus = music()
    mus = np.pad(mus, ((0, max(0, N - len(mus))), (0, 0)))[:N]
    fx = np.zeros((N, 2)); bed = np.zeros((N, 2))
    C.FX(fx, bed, dict(t_=t_, env_exp=env_exp, bp=bp, lp=lp, hp=hp, noise=noise, norm=norm, add=add, whoosh=whoosh, thump=thump, ding=ding, pop=pop, S=S, SR=SR, rng=rng, N=N))
    vo = voice()
    # ducking: music and beds dip ~8 dB under the voice
    from scipy.signal import lfilter
    env = lfilter([.0015], [1, -.9985], np.abs(vo))
    duck = 1 - .62 * np.clip(env / .03, 0, 1)
    duck = lfilter([.0008], [1, -.9992], duck) / max(1e-9, lfilter([.0008], [1, -.9992], np.ones(1))[0] * 1250) if False else duck
    mix = mus * C.ARR.get('mgain', .55) * duck[:, None] + bed * duck[:, None] * .9 + fx + np.stack([vo, vo], 1) * 1.0
    # fade the head and tail
    f = np.ones(N); fi = int(.04 * SR); fo = int(.9 * SR); f[:fi] = np.linspace(0, 1, fi); f[-fo:] = np.linspace(1, 0, fo) ** 1.5
    mix *= f[:, None]
    mix = limit(mix * .9, .95)
    sf.write(os.path.join(FILM, 'out', 'mix.wav'), mix.astype(np.float32), SR)
    sf.write(os.path.join(FILM, 'out', 'music.wav'), (mus * .5).astype(np.float32), SR)
    print('mix', round(N / SR, 2), 's ->', os.path.join(FILM, 'out', 'mix.wav'))

main()

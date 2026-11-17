# ep03 sound: an airport chime opens; the grey hall is a thin string pad under the crowd; when the
# colour arrives (on "Wockhardt") the whole ensemble enters on a bar line; knife scrapes mark the paint-overs.
L = {l['id']: l for l in TL['lines']}
wd = lambda i, w: next(x['t'] for x in L[i]['words'] if x['w'].lower().startswith(w))
cut = dict(hall=L['m1']['t0'] - .12, reveal=wd('m2', 'wockhardt'), road=wd('m2', 'pickup') - .25, room=wd('m2', 'accommodation') - .2,
           hosp=wd('m2', 'coordinated') - .2, end=L['cta']['t0'] - .25, cta=L['cta']['t0'])
BPM = 84; BAR = 4 * 60 / BPM
start = cut['reveal'] - 3 * BAR
M = lambda n: 12 * (int(n[-1]) + 1) + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[n[0]] + (1 if '#' in n else 0)
mel = []; b = 12
for bar in [[('F#5', 2), ('A5', 1), ('F#5', 1)], [('F#5', 2), ('E5', 1), ('D5', 1)], [('D5', 3), ('B4', 1)], [('C#5', 2), ('E5', 2)], [('D5', 4)]]:
    for n, ln in bar: mel.append((b, M(n), ln, 'flute')); b += ln
ARR = dict(bpm=BPM, start=start, prog=['D', 'Bm', 'G', 'A'], room=.6, wet=.24, mgain=.6, mvel=.42,
           sections=[(start, cut['hall'], {'pad', 'harp'}), (cut['hall'], cut['reveal'] - .01, {'pad'}),
                     (cut['reveal'] - .01, cut['end'], {'pad', 'harp', 'piano', 'pizz', 'bass'}), (cut['end'], 99, {'pad', 'harp'})],
           vel=dict(pad=.36, harp=.4, piano=.4, pizz=.42), melody=mel,
           stabs=[(cut['cta'] + 3.0, 'D', ['harp', 'glockenspiel'])])

def FX(fx, bed, k):
    np = __import__('numpy'); S, SR, rng = k['S'], k['SR'], k['rng']; add, bp, lp, hp, noise, norm, env_exp, t_ = k['add'], k['bp'], k['lp'], k['hp'], k['noise'], k['norm'], k['env_exp'], k['t_']
    def put(buf, x, at, g=1., pan=0.):
        if x.ndim == 2: x = x.mean(1)
        add(buf, x, at, g, pan)
    # airport announcement chime (three soft vibraphone tones), then the plane's low pass
    for i, n in enumerate(['A5', 'F#5', 'D5']): put(fx, S.note('vibraphone', n, 1.4, vel=.5), .15 + i * .42, .5, .1)
    d = 3.8; rum = lp(noise(d), 260) * np.sin(np.pi * t_(d) / d) ** 1.5 + bp(noise(d), 600, 2400) * .25 * np.sin(np.pi * t_(d) / d) ** 3
    put(bed, norm(rum) * .5, 0, .55, 0)
    # the hall: room tone and a crowd murmur, rolling footsteps, until we leave
    d = cut['road'] + .4 - cut['hall']; m = np.abs(bp(rng.standard_normal(int(d * SR)), 2, 9, 1)); m /= m.max() + 1e-9
    mur = bp(noise(d), 300, 1800) * (.5 + .5 * m); env = np.minimum(1, t_(d) / .5) * np.minimum(1, (d - t_(d)) / .4)
    put(bed, norm(mur * env) * .35, cut['hall'], .55, 0)
    for i in range(int(d * 2.6)):
        tt = cut['hall'] + i / 2.6 + rng.random() * .1; s = hp(noise(.07), 900) * env_exp(.07, .012)
        put(bed, norm(s) * .18, tt, .4, rng.uniform(-.7, .7))
    # paint-overs: a soft palette-knife drag (kept low)
    def knife(d=.45, v=1.):
        n = noise(d); g = 1 + 4 * np.abs(bp(rng.standard_normal(len(n)), 30, 120, 1))
        return norm(bp(n * g, 1800, 7000) * np.sin(np.pi * t_(d) / d) ** .6) * v
    for c, p in [('road', -.3), ('room', .3), ('hosp', -.2), ('end', 0)]: put(fx, knife(.45), cut[c] - .05, .16, p)
    # the reveal: a bright shimmer
    for i, n in enumerate(['D6', 'F#6', 'A6', 'D7']): put(fx, S.note('glockenspiel', n, 1.5, vel=.35), cut['reveal'] + i * .06, .3, -.2 + i * .15)
    # the car crossing the bridge: tyres on the deck, panned left to right
    d = cut['room'] + .6 - cut['road']; car = lp(noise(d), 900) * np.sin(np.pi * t_(d) / d) ** 2
    for j, p in enumerate(np.linspace(-.8, .8, 6)): put(fx, norm(car[int(j * len(car) / 6):int((j + 1) * len(car) / 6)]) * .4, cut['road'] + j * d / 6, .35, p)
    gull = lambda: norm(np.sin(2 * np.pi * np.cumsum(np.linspace(1700, 1200, int(.3 * SR))) / SR) * env_exp(.3, .08)) * .5
    put(bed, gull(), cut['road'] + .4, .25, .5)
    # the room: a lamp switch; the hospital: sliding doors
    put(fx, k['pop'](.6), cut['room'] + .35, .3, .5)
    put(fx, k['whoosh'](.6, .6), cut['hosp'] + .6, .25, 0)
    # the button tap on the end card
    put(fx, k['pop'](.8), cut['cta'] + 1.4 + 1.6, .35, .3)

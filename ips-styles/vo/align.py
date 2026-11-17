# align.py <ep>: word times from the waveform. Pauses (low-energy gaps) are matched to punctuation,
# then words inside each speech run are placed by vowel-weighted length. Writes <ep>/words.json.
import json, sys, re, wave, numpy as np
ep = sys.argv[1]
lines = json.load(open(f'{ep}/lines.json'))
def load(p):
    w = wave.open(p); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x, sr
def weight(w):
    v = len(re.findall(r'[aeiouy]+', w.lower())) or 1
    return 0.55 * v + 0.07 * len(re.sub(r'\W', '', w)) + 0.1
out = {}
for L in lines:
    x, sr = load(f"{ep}/{L['id']}.wav"); hop = int(sr * .01)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(e + 1e-9); thr = db.max() - 32
    voiced = db > thr
    # silent gaps >= 90 ms inside the line
    gaps = []; i = 0; n = len(voiced)
    first = np.argmax(voiced); last = n - np.argmax(voiced[::-1])
    i = first
    while i < last:
        if not voiced[i]:
            j = i
            while j < last and not voiced[j]: j += 1
            if j - i >= 9: gaps.append((i * .01, j * .01))
            i = j
        else: i += 1
    words = L['text'].split()
    # break points after punctuation, longest gaps first
    br = [k for k, w in enumerate(words[:-1]) if re.search(r'[,.?!;:—]$', w)]
    gaps = sorted(sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)[:len(br)])
    use = br[:len(gaps)] if len(gaps) >= len(br) else br[:len(gaps)]
    runs = []; s = first * .01; k0 = 0
    for k, g in zip(use, gaps): runs.append((k0, k + 1, s, g[0])); s = g[1]; k0 = k + 1
    runs.append((k0, len(words), s, last * .01))
    res = []
    for a, b, t0, t1 in runs:
        ws = words[a:b]; W = [weight(w) for w in ws]; tot = sum(W); acc = 0
        for w, wt in zip(ws, W):
            res.append({'w': w, 't': round(t0 + (t1 - t0) * acc / tot, 3), 'end': round(t0 + (t1 - t0) * (acc + wt) / tot, 3)}); acc += wt
    out[L['id']] = {'dur': round(len(x) / sr, 3), 'words': res}
json.dump(out, open(f'{ep}/words.json', 'w'), indent=0)
print(ep, {k: len(v['words']) for k, v in out.items()})

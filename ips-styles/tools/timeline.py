# timeline.py <ep> <out.json> [start=0.6] [gap=0.45] [ctaGap=0.9] [tail=2.6]
# Places the episode's voice lines on one clock and writes the film's timeline (lines, absolute word
# times) plus a 48 kHz voice stem (<out dir>/vo.wav) for the mix.
import json, sys, wave, numpy as np, os
ep, outp = sys.argv[1], sys.argv[2]
start, gap, cgap, tail = [float(a) for a in (sys.argv[3:7] + ['0.6', '0.45', '0.9', '2.6'][len(sys.argv[3:7]):])]
root = os.path.join(os.path.dirname(__file__), '..', 'vo', ep)
lines = json.load(open(f'{root}/lines.json')); W = json.load(open(f'{root}/words.json'))
t = start; res = []
for i, L in enumerate(lines):
    if L['id'] == 'cta': t += cgap - gap
    w = W[L['id']]
    res.append({'id': L['id'], 'text': L['text'], 't0': round(t, 3), 'dur': w['dur'],
                'words': [{'w': x['w'], 't': round(t + x['t'], 3), 'end': round(t + x['end'], 3)} for x in w['words']]})
    t += w['dur'] + gap
dur = round(res[-1]['t0'] + res[-1]['dur'] + tail, 3)
json.dump({'ep': ep, 'dur': dur, 'lines': res}, open(outp, 'w'), indent=1)
# voice stem
SR = 48000; buf = np.zeros(int(dur * SR) + SR, np.float32)
for L in res:
    wv = wave.open(f"{root}/{L['id']}.wav"); sr = wv.getframerate()
    x = np.frombuffer(wv.readframes(wv.getnframes()), np.int16).astype(np.float32) / 32768
    x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    i0 = int(L['t0'] * SR); buf[i0:i0 + len(x)] += x
buf = buf[:int(dur * SR)]
o = wave.open(os.path.join(os.path.dirname(outp), 'vo.wav'), 'w'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
o.writeframes((np.clip(buf, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()
print(ep, 'dur', dur, [(L['id'], L['t0']) for L in res])

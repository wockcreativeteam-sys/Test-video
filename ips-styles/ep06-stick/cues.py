BPM = 96
ARR = dict(bpm=BPM, start=.2, prog=['C', 'Am', 'F', 'G'], room=.5, wet=.2, mgain=.6,
           sections=[(0, 99, {'pad', 'harp', 'glock', 'pizz'})], vel=dict(pad=.3, harp=.38, pizz=.36))
def FX(fx, bed, k):
    for t in [.2, .32, .44, .56]: k['add'](fx, k['S'].note('kalimba', 'E5', .8, vel=.5), t, .4, 0)

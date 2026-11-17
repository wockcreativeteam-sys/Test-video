BPM = 88; BAR = 4 * 60 / BPM
ARR = dict(bpm=BPM, start=.2, prog=['D', 'A', 'Bm', 'G'], room=.6, wet=.24, mgain=.6,
           sections=[(0, 3.4, {'pad', 'harp'}), (3.4, 99, {'pad', 'harp', 'piano', 'pizz', 'bass'})], vel=dict(pad=.36, harp=.4, piano=.4, pizz=.4))
def FX(fx, bed, k): k['add'](fx, k['thump'](.8), .25, .5, 0)

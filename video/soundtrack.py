#!/usr/bin/env python3
"""A soft soundtrack for the showcase video, synthesized like the game's own
sound: meadow air, birds, wing hum, rain, crickets, the hive, and the game's
pentatonic chimes. Pure Python (no numpy), so it runs anywhere.

    python3 video/soundtrack.py video/out/timeline.json video/out/soundtrack.wav
"""
import json, math, random, struct, sys, wave

RATE = 44100
random.seed(7)


def main(timeline_path, out_path):
    tl = json.load(open(timeline_path))
    total = tl['total']
    shots = {s['shot']: s for s in tl['shots']}
    n = int(total * RATE)
    buf = [0.0] * n

    def span(name):
        s = shots.get(name)
        return (s['start'], s['start'] + s['duration']) if s else None

    def gate(t, a, b, fade=.6):
        if t < a or t > b: return 0.0
        return min(1.0, (t - a) / fade, (b - t) / fade)

    def add_tone(at, freq, length, level, to=None, shape='sine'):
        """One note: a sine (optionally sliding to `to`) with a soft attack and decay."""
        start = int(at * RATE); count = int(length * RATE); phase = 0.0
        for i in range(count):
            k = start + i
            if k >= n: break
            u = i / count
            f = freq if to is None else freq * (to / freq) ** u
            phase += 2 * math.pi * f / RATE
            env = min(1.0, i / (RATE * .012)) * math.exp(-u * 4.5)
            v = math.sin(phase) if shape == 'sine' else (math.sin(phase) + math.sin(3 * phase) / 9)
            buf[k] += level * env * v

    # Meadow air: soft low noise that swells slowly, quieter at night.
    night = span('night')
    low = 0.0
    for i in range(n):
        t = i / RATE
        low += .015 * (random.uniform(-1, 1) - low)
        at_night = night and night[0] + .5 < t < night[1] - .5
        buf[i] += low * (.9 + .5 * math.sin(t * .37)) * (.35 if at_night else 1.0) * 1.6

    # Birds in the day shots, and at dawn at the end of the night.
    day = [span(s) for s in ('title', 'flight', 'find-ladybird', 'find-snail', 'find-ring', 'summer', 'end')]
    if night: day.append((night[1] - 1.2, night[1]))
    for a_b in day:
        if not a_b: continue
        a, b = a_b
        t = a + random.uniform(.2, 1.0)
        while t < b - .4:
            base = random.uniform(1900, 3000); at = t
            for _ in range(random.randint(2, 4)):
                length = random.uniform(.07, .18)
                add_tone(at, base * random.uniform(.85, 1.25), length, random.uniform(.018, .03), to=base * random.choice((.75, 1.3)))
                at += length + random.uniform(.03, .09)
            t += random.uniform(1.1, 2.4)

    # Wing hum: in flight, on the poppy, and on the way home.
    hum_spans = [(span('flight'), .09, 165), (span('poppy'), .035, 150), (span('home'), .06, 170)]
    for a_b, level, f0 in hum_spans:
        if not a_b: continue
        a, b = a_b; phase = 0.0
        for i in range(int(a * RATE), min(n, int(b * RATE))):
            t = i / RATE
            f = f0 + 3 * math.sin(t * 2 * math.pi * 6.5)
            phase += 2 * math.pi * f / RATE
            v = math.sin(phase) + math.sin(3 * phase) / 9 + math.sin(5 * phase) / 25 + .16 * math.sin(2.006 * phase)
            buf[i] += level * gate(t, a, b, .5) * v * (.85 + .15 * math.sin(t * 9.1))

    # The hive: two close pitches for the swarm, and a low drone inside.
    home = span('home')
    if home:
        a, b = home; ph = [0.0] * 4
        for i in range(int(a * RATE), min(n, int(b * RATE))):
            t = i / RATE; g = gate(t, a + .8, b, 1.2)
            for j, f in enumerate((174, 179.3, 109.5, 164.8)):
                ph[j] += 2 * math.pi * f / RATE
            buf[i] += g * (.028 * (math.sin(ph[0]) + math.sin(ph[1])) + .03 * math.sin(ph[2]) + .018 * math.sin(ph[3]))

    # Rain: in the shower, and through the wet part of the night.
    rains = []
    if span('rain'): rains.append((span('rain'), 1.0))
    if night:
        d = night[1] - night[0]; rains.append(((night[0] + .36 * d, night[0] + .74 * d), .8))
    for (a, b), level in rains:
        lp = 0.0
        for i in range(int(a * RATE), min(n, int(b * RATE))):
            t = i / RATE; x = random.uniform(-1, 1); lp += .08 * (x - lp)
            buf[i] += .11 * level * gate(t, a, b, .5) * (x - lp) * (.9 + .1 * math.sin(t * 2))
        t = a + .1
        while t < b - .2:
            add_tone(t, random.uniform(1300, 2700), .09, .02 * level, to=None)
            t += random.uniform(.05, .22)

    # Crickets through the dark, hushed in the rain.
    if night:
        a, b = night; d = b - a
        for pitch, every, level in ((4350, .72, .02), (4720, .95, .013), (3980, 1.3, .009)):
            t = a + random.uniform(0, every)
            while t < b - .3:
                u = (t - a) / d
                hush = 1 - .85 * (1 if .36 < u < .74 else 0)
                env = min(1, u / .12) * min(1, (1 - u) / .15) * hush
                for k in range(random.randint(3, 4)):
                    s0 = int((t + k * .034) * RATE); cnt = int(.018 * RATE)
                    for i in range(cnt):
                        if s0 + i < n:
                            buf[s0 + i] += level * env * math.sin(math.pi * i / cnt) ** 2 * math.sin(2 * math.pi * pitch * i / RATE)
                t += every * random.uniform(.9, 1.1)

    # The game's chimes: pollination on the poppy, the fairy ring, and the end.
    if span('poppy'):
        for j, f in enumerate((659, 784, 1047)): add_tone(span('poppy')[0] + 2.4 + j * .13, f, .7, .06)
    if span('find-ring'):
        for j, f in enumerate((659, 784, 1047)): add_tone(span('find-ring')[0] + .5 + j * .13, f, .7, .05)
    if span('end'):
        for j, f in enumerate((523, 659, 784, 1047)): add_tone(span('end')[0] + .9 + j * .13, f, .9, .06)

    # Fade in and out, normalise gently, and write 16-bit mono.
    peak = max(1e-6, max(abs(v) for v in buf))
    scale = min(1.0, .8 / peak)
    frames = bytearray()
    for i, v in enumerate(buf):
        t = i / RATE
        g = min(1.0, t / 1.0, (total - t) / 1.2)
        frames += struct.pack('<h', int(max(-1, min(1, v * scale * g)) * 32767))
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(frames))
    print(f'Wrote {out_path} ({total:.1f} s, peak {peak:.2f})')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

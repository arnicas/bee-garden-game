#!/usr/bin/env python3
"""Assembles the showcase video from captured frames (see video/README.md).

Needs ffmpeg and ImageMagick (magick). Run from the project root after
`npx playwright test -c video/playwright.config.ts`:

    python3 video/assemble.py

Writes video/out/bee-garden.mp4 (1920x1080, 30 fps, H.264 + AAC).
"""
import json, os, subprocess, sys

OUT = 'video/out'
FRAMES = f'{OUT}/frames'
FPS = 30
W, H = 1920, 1080
LINK = 'arnicas.github.io/bee-garden-game'
CREDIT = 'A game by Lynn Cherny / @arnicas'

# (shot, dissolve into it in seconds). Captions run over absolute time ranges below.
# The last shot (the high, quiet view over the meadow) carries the end titles.
SHOTS = [
    ('title', 0), ('flight', .6), ('poppy', .5), ('rain', .6),
    ('find-ladybird', .5), ('find-snail', .2), ('find-web', .2), ('find-ring', .2),
    ('home', .6), ('results', .5), ('facts', .2), ('night', .7), ('summer', .7), ('idle', .9),
]
# Clips recorded by hand, turned into frames like the captured shots:
# name -> (file, start s, length s, crop w:h:x:y in the source). The crop drops the
# on-screen message at the top and keeps 16:9; the clip is scaled up to 1920x1080.
CLIPS = {
    'find-web': ('video/web-blowing.mp4', .8, 2.4, '774:436:40:44'),
}
CAPTIONS = [
    # (first shot, last shot, text[, height above the bottom edge])
    ('flight', 'flight', 'You are one honeybee, out for a summer’s day.'),
    ('poppy', 'poppy', 'Carry pollen from flower to flower.'),
    ('rain', 'rain', 'Shelter from the rain and the heat.'),
    ('find-ladybird', 'find-ring', 'Find the small lives in the grass.'),
    ('home', 'home', 'Bring your harvest home to the hive.'),
    ('facts', 'facts', 'Learn about real bees and flower meadows.', 42),
    ('night', 'night', 'The night passes…'),
    ('summer', 'summer', 'Next summer’s meadow grows from what you pollinated.'),
]


def run(*args):
    print(' '.join(args)[:200], flush=True)
    subprocess.run(args, check=True)


def frames_in(shot):
    return len([f for f in os.listdir(f'{FRAMES}/{shot}') if f.endswith('.jpg')])


def text_png(path, text, size, font='Palatino-Italic', y=118, gravity='south'):
    """Cream text with a soft dark shadow, on a transparent full frame."""
    run('magick', '-size', f'{W}x{H}', 'xc:none', '-font', font, '-pointsize', str(size), '-gravity', gravity,
        '(', '-clone', '0', '-fill', '#0d140cb0', '-annotate', f'+0+{y}', text, '-blur', '0x22', ')',
        '(', '-clone', '0', '-fill', '#0d140ce0', '-annotate', f'+0+{y}', text, '-blur', '0x5', ')',
        '(', '-clone', '0', '-fill', '#fbf5e5', '-annotate', f'+0+{y}', text, ')',
        '-delete', '0', '-background', 'none', '-flatten', path)


def clip_frames():
    for name, (src, start, length, crop) in CLIPS.items():
        if not os.path.exists(src):
            continue
        out = f'{FRAMES}/{name}'
        os.makedirs(out, exist_ok=True)
        for f in os.listdir(out):
            os.remove(f'{out}/{f}')
        run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(start), '-t', str(length), '-i', src,
            '-vf', f'crop={crop},scale={W}:{H}:flags=lanczos,fps={FPS}', '-q:v', '2', '-start_number', '0', f'{out}/%04d.jpg')


def main():
    os.makedirs(f'{OUT}/cards', exist_ok=True)
    clip_frames()
    shots = [(name, fade, frames_in(name) / FPS) for name, fade in SHOTS if os.path.isdir(f'{FRAMES}/{name}')]
    if not shots:
        sys.exit('No frames: run the capture first.')

    # Timeline: each shot starts when the previous one begins to dissolve.
    timeline, t = [], 0.0
    for i, (name, fade, dur) in enumerate(shots):
        start = t - (fade if i else 0)
        timeline.append({'shot': name, 'start': round(start, 3), 'duration': round(dur, 3), 'fade': fade if i else 0})
        t = start + dur
    total = t
    last = timeline[-1]
    # The soundtrack's closing chime and birds follow the end titles.
    timeline.append({'shot': 'end', 'start': round(last['start'] + 1.6, 3), 'duration': round(last['duration'] - 1.6, 3), 'fade': 0})
    with open(f'{OUT}/timeline.json', 'w') as f:
        json.dump({'total': total, 'shots': timeline}, f, indent=1)

    # Titles: the name and what it is at the start; the name and where to play at the end.
    text_png(f'{OUT}/cards/title-name.png', 'Bee Garden', 150, 'Palatino', y=-70, gravity='center')
    text_png(f'{OUT}/cards/title-sub.png', 'A game about bees in a flower meadow.', 58, 'Palatino-Italic', y=55, gravity='center')
    run('magick', f'{OUT}/cards/title-name.png', f'{OUT}/cards/title-sub.png', '-composite', f'{OUT}/cards/title.png')
    text_png(f'{OUT}/cards/end-title.png', 'Bee Garden', 132, 'Palatino', y=-70, gravity='center')
    text_png(f'{OUT}/cards/end-play.png', 'Play free in your browser', 52, 'Palatino-Italic', y=60, gravity='center')
    text_png(f'{OUT}/cards/end-link.png', LINK, 38, 'Avenir-Next-Medium', y=140, gravity='center')
    text_png(f'{OUT}/cards/end-credit.png', CREDIT, 34, 'Palatino-Italic', y=205, gravity='center')
    letters = f'{OUT}/cards/title-letters.png'
    black, white = f'{OUT}/cards/title-letters-black.png', f'{OUT}/cards/title-letters-white.png'
    if os.path.exists(black) and os.path.exists(white):
        # Transparency from the shots over black and white: alpha = 1 - (white - black), colour = black / alpha.
        run('magick', black, white, '-fx', 'u+(1-v)>0 ? 1 : 0', '-alpha', 'off', f'{OUT}/cards/mask-tmp.png')
        run('magick', black, white, '-compose', 'difference', '-composite', '-colorspace', 'gray', '-negate', f'{OUT}/cards/alpha.png')
        run('magick', black, f'{OUT}/cards/alpha.png', '-fx', 'v.r > 0.004 ? u / v.r : 0', f'{OUT}/cards/colour.png')
        run('magick', f'{OUT}/cards/colour.png', f'{OUT}/cards/alpha.png', '-alpha', 'off', '-compose', 'copy-opacity', '-composite', letters)
    if os.path.exists(letters):
        # The game's painted title (captured by the 'showcase title card' test) above the words.
        run('magick', f'{OUT}/cards/end-play.png', f'{OUT}/cards/end-link.png', '-composite', f'{OUT}/cards/end-credit.png', '-composite',
            '(', letters, '-resize', '620x', ')', '-gravity', 'center', '-geometry', '+0-175', '-composite', f'{OUT}/cards/end.png')
    else:
        run('magick', f'{OUT}/cards/end-title.png', f'{OUT}/cards/end-play.png', '-composite', f'{OUT}/cards/end-link.png', '-composite',
            f'{OUT}/cards/end-credit.png', '-composite', f'{OUT}/cards/end.png')

    # Captions over absolute time ranges.
    starts = {s['shot']: s for s in timeline}
    captions = []
    for i, (first, last_shot, text, *lift) in enumerate(CAPTIONS):
        if first not in starts or last_shot not in starts:
            continue
        a = starts[first]['start'] + starts[first]['fade'] + .25
        b = starts[last_shot]['start'] + starts[last_shot]['duration'] - .35
        path = f'{OUT}/cards/caption-{i}.png'
        text_png(path, text, 60, y=lift[0] if lift else 118)
        captions.append((path, a, b))
    # The title shot is the game's own title screen now, so it needs no card over it.
    captions.append((f'{OUT}/cards/end.png', last['start'] + 1.6, total + 1))

    # Soundtrack, matched to the timeline.
    run(sys.executable, 'video/soundtrack.py', f'{OUT}/timeline.json', f'{OUT}/soundtrack.wav')

    inputs, filters = [], []
    for i, (name, fade, dur) in enumerate(shots):
        inputs += ['-framerate', str(FPS), '-i', f'{FRAMES}/{name}/%04d.jpg']
        filters.append(f'[{i}:v]settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v{i}]')
    n = len(shots)
    chain = 'v0'
    for i in range(1, n):
        fade = timeline[i]['fade']
        offset = timeline[i]['start']
        filters.append(f'[{chain}][v{i}]xfade=transition=fade:duration={fade}:offset={offset:.3f}[x{i}]')
        chain = f'x{i}'
    k = n
    for j, (path, a, b) in enumerate(captions):
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{total:.3f}', '-i', path]
        filters.append(f'[{k + j}:v]format=rgba,fade=t=in:st={a:.2f}:d=0.45:alpha=1,fade=t=out:st={b - .45:.2f}:d=0.45:alpha=1[c{j}]')
        filters.append(f'[{chain}][c{j}]overlay=0:0:shortest=0[o{j}]')
        chain = f'o{j}'
    filters.append(f'[{chain}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - .8:.2f}:d=0.8,format=yuv420p[vout]')
    audio_index = k + len(captions)
    inputs += ['-i', f'{OUT}/soundtrack.wav']
    run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
        '-map', '[vout]', '-map', f'{audio_index}:a', '-t', f'{total:.3f}',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '160k', f'{OUT}/bee-garden.mp4')
    # A lighter copy for sites with upload limits.
    run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', f'{OUT}/bee-garden.mp4', '-c:v', 'libx264', '-preset', 'slow',
        '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'copy', f'{OUT}/bee-garden-small.mp4')
    print(f'Wrote {OUT}/bee-garden.mp4 and bee-garden-small.mp4 ({total:.1f} s)')


if __name__ == '__main__':
    main()

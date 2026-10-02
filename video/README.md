# Showcase video

A short film of the game for sharing: about 35 seconds, 1920×1080, with
captions and a soft synthesized soundtrack.

1. Build, then capture the frames (a few minutes; the game advances exactly
   1/30 s per frame, so the motion is smooth however slowly it renders):

   ```sh
   npm run build
   npx playwright test -c video/playwright.config.ts
   ```

   Re-take some shots only: `SHOTS=flight,rain npx playwright test -c video/playwright.config.ts`
   (shots: title, flight, poppy, rain, finds, home, results, night, summer; card re-takes only
   the painted title for the end titles).

   The title shot is the game's own title screen: its CSS animations and the flying bee are
   held to the capture clock each frame (`holdAnimations`), so they keep time with the film.

2. Assemble (needs ffmpeg and ImageMagick):

   ```sh
   python3 video/assemble.py
   ```

   This writes `video/out/bee-garden.mp4`. Captions, shot order and dissolves
   are at the top of `assemble.py`; the soundtrack is `soundtrack.py`.

Frames are large (about 300 KB each); delete `video/out/frames/` when done.

## README images

`readme-images.spec.ts` retakes the title, results, next-summer and bee lore pictures in
`docs/images/` (the other pictures there were taken by hand):

```sh
npm run build
npx playwright test -c video/playwright.config.ts video/readme-images.spec.ts
sips -Z 800 -s formatOptions 82 artifacts/readme-images/*.jpg --out docs/images/
```

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { touchWords } from '../src/touch-controls';

// Every line of game text that names a key (hints, notes, cues, tips and facts) reads without
// keys on a tablet: each key becomes a touch-button chip (the swap table in touch-controls.ts).
const KEY = /\b(E|F|Q|R|Space|Ctrl|Shift|Esc|WASD)\b|Arrow keys|left mouse/;
function gameLines(): string[] {
  const lines = new Set<string>();
  for (const file of ['src/garden.ts', 'src/bee-facts.ts', 'src/ui.ts']) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/'([^'\n]{8,})'|`([^`\n]{8,})`/g)) {
      const line = m[1] ?? m[2];
      if (!KEY.test(line) || /<kbd|key\(|aria-|data-|keyPattern|KeyE|Key[A-Z]'|code ===|\$\{key/.test(line)) continue;
      // Lines only for the keyboard: tooltips (titles; no hover on touch) and the keyboard guide.
      if (/^(Tuck beneath this leaf with E|Wake now with E|Arrow keys: |W A S D keys|Arrow keys$|F \/ left mouse$)/.test(line)) continue;
      lines.add(line);
    }
  }
  return [...lines];
}

test('the swap table turns every key in the game text into a touch button', () => {
  const lines = gameLines();
  expect(lines.length).toBeGreaterThan(50);
  const left = lines.map(line => [line, touchWords(line).replace(/⟦[^⟧]+⟧/g, '')] as const).filter(([, out]) => KEY.test(out));
  expect(left.map(([line, out]) => `${line}\n  → ${out}`)).toEqual([]);
});

test('the swap table picks the right button', () => {
  expect(touchWords('E · Land on corn poppy')).toBe('⟦land|Land⟧ on corn poppy');
  expect(touchWords('A little pool · Hold F to sip water')).toBe('A little pool · Hold ⟦water|Sip water⟧ to sip water');
  expect(touchWords('Hold F to sip nectar · Walk through the center for pollen')).toBe('Hold ⟦sip|Sip⟧ to sip nectar · Walk through the center for pollen');
  expect(touchWords('Sheltered among the grass · E to rest · Space to fly · WASD to walk')).toBe('Sheltered among the grass · ⟦rest|Rest⟧ to rest · ⟦up|Fly⟧ to fly · the ⟦stick|Stick⟧ walks');
  expect(touchWords('Settling onto the flower · Space to cancel')).toBe('Settling onto the flower · ⟦land|Cancel⟧ to stop');
  expect(touchWords('Caught in a web · Tap Space or W to pull free')).toBe('Caught in a web · Tap ⟦land|Pull free⟧');
  expect(touchWords('Rain falls on the leaf · E to tuck underneath')).toBe('Rain falls on the leaf · ⟦rest|Shelter beneath⟧ to tuck underneath');
});
